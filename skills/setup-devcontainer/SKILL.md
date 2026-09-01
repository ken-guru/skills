---
name: setup-devcontainer
description: Set up a Claude Code devcontainer (Ubuntu base image, Node, GitHub CLI, persistent auth, automatic skill sync) in the current repo, optionally layering on SSH deploy-key/signing-key automation for agent-driven git push and signed commits. Use when the user wants to add a devcontainer for Claude Code, or add SSH key automation to a devcontainer that already has the baseline.
---

# Setup Devcontainer

Generates `.devcontainer/` from the templates in [templates/](templates/): a baseline Claude
Code devcontainer setup with repo-specific values replaced by placeholders. One always-written
baseline, plus two independent opt-ins:

- **baseline** — Claude Code + `gh` CLI + persistent auth + skill sync. Always written.
- **SSH layer** — deploy-key/signing-key automation for agent-driven `git push` and signed
  commits. Optional, and addable after the fact without touching the baseline files.
- **YOLO alias** — a `claude-yolo` shell alias (`claude --permission-mode auto --worktree
  --remote-control`) for fast, unattended iteration. Optional — some developers don't want a
  no-holds-barred agent available inside the container at all.

## 1. Detect the target repo

```bash
git remote get-url origin
```

Parse `owner/repo` from it (works for both `git@github.com:owner/repo.git` and
`https://github.com/owner/repo` forms) — this is `{{REPO_SLUG}}`. `{{REPO_NAME}}` is the `repo`
part alone, used in volume names and SSH key titles.

If there's no `origin` remote yet (brand-new repo), ask the user for the intended `owner/repo`
instead of guessing.

Done when you have both `{{REPO_SLUG}}` and `{{REPO_NAME}}`.

## 2. Check for an existing baseline and a lingering container

```bash
test -f .devcontainer/devcontainer.json && echo exists
```

- **Exists already**: this is the "add SSH layer" case — skip to [Adding the SSH layer
  later](#adding-the-ssh-layer-later) instead of regenerating the baseline.
- **Doesn't exist**: continue to step 3.

Either way, also check for a container left over from an unrelated prior devcontainer setup for
this same workspace folder. The Dev Containers CLI labels containers by
`devcontainer.local_folder=<absolute workspace path>`, independent of what `devcontainer.json`
currently says — so a stale container survives even after its old config was deleted or never
committed, and reopening will silently reuse it instead of building fresh:

```bash
docker ps -a --filter "label=devcontainer.local_folder=$(pwd)" --format '{{.ID}} {{.Image}}'
```

If this returns anything, warn the user before they reopen: a container built from a different
setup won't have the `vscode` user this baseline expects, and reopening fails with a cryptic
`unable to find user vscode: no matching entries in passwd file` that gives no hint the real cause
is the leftover container, not the new config. Offer to remove it (`docker rm -f <id>`), but don't
remove it without asking — it may hold state the user still wants. Skip this check entirely if
`docker` isn't installed or isn't running; note that it couldn't be checked rather than failing the
rest of the skill over it.

Done when you know whether a baseline exists (and if so, have moved on to [Adding the SSH layer
later](#adding-the-ssh-layer-later) instead of continuing below) and whether a stale container
needs clearing before either path reopens the workspace.

## 3. Ask about the optional layers

Ask the user directly, as independent questions (skip any they already answered in their request):

- **SSH Layer**: Does this repo need agent-driven `git push` and signed commits? (Adds deploy-key/signing-key automation).
- **OpenAI Codex CLI**: Should we add OpenAI Codex CLI (`codex`) support to the devcontainer?
- **Google Antigravity CLI**: Should we add Google Antigravity CLI (`agy`) support to the devcontainer?
- **GitHub Copilot CLI**: Should we add GitHub Copilot (`copilot`) support to the devcontainer?
- **YOLO aliases**: Which of the installed CLIs should have a `-yolo` alias available for fast unattended iteration? (Note: `copilot-yolo` just echoes instructions to manually type `/sandbox enable` inside the session).

Record these answers — they decide which template variants and configuration injections steps 4–6 use. Optional layers can be added later (see below) without redoing this setup.

## 4. Resolve placeholders

- `{{REPO_SLUG}}`, `{{REPO_NAME}}` — from step 1.
- `{{GIT_EMAIL_DEFAULT}}`, `{{GIT_NAME_DEFAULT}}` — run `git config --global user.email` and
  `git config --global user.name` on the host. If either is unset, don't invent a default: use
  `${GIT_USER_EMAIL:?Set GIT_USER_EMAIL in .devcontainer/.env}` (no `-default` fallback) in
  `post-create.sh` instead of the `:-` form, and drop the parenthetical in `.env.example`'s
  comment.
- `{{SKILLS_SOURCES_COMMANDS}}` — ask the user which skill sources to sync into
  `~/.claude/skills` on every container start. Offer two opt-in defaults, neither required:
  `mattpocock/skills` (a broad general-purpose skill baseline) and `ken-guru/skills` (this
  collection — includes this very Skill, useful if the SSH layer needs adding later from inside
  the container). Accept any other source the user names, in `owner/repo` form. If the user has
  no preference, include both defaults. Render one line per chosen source, in the order given:
  `npx -y skills add <source> --skill '*' -a '*' -y --copy -g`. Use the resulting
  multi-line block everywhere this placeholder appears.
- `{{SKILLS_SOURCES_SUMMARY}}` — the same sources as a short human-readable list (e.g.
  `` `mattpocock/skills`, `ken-guru/skills` ``), for the README's prose.

## 5. Write or Update the Devcontainer Files

- `.devcontainer/devcontainer.json`:
  If the file doesn't exist, use [templates/devcontainer.baseline.json](templates/devcontainer.baseline.json) (or [templates/devcontainer.with-ssh.json](templates/devcontainer.with-ssh.json) if SSH layer accepted), substitute `{{REPO_NAME}}`, and write it.
  **Then (in all cases)**, carefully update the `.devcontainer/devcontainer.json` file to safely merge the following properties. Do not overwrite or remove any existing user customizations:
  - If Codex was accepted:
    - Add `.codex` mount (`"source={{REPO_NAME}}-codex-config,target=/home/vscode/.codex,type=volume"`) to the `mounts` array, and add `"CODEX_HOME": "/home/vscode/.codex"` to the `containerEnv` object.
    - Add `"SYS_ADMIN"` to a top-level `capAdd` array (create it if absent, merge into it if present) and `"seccomp=unconfined"` / `"systempaths=unconfined"` to a top-level `securityOpt` array (same merge rule) — Codex's Linux sandbox uses Bubblewrap, which needs to create unprivileged user namespaces; these are the minimum container runtime settings Bubblewrap needs, without making the whole container privileged.
    - Append the following caveat to `.devcontainer/README.md` (e.g., under a "Gotchas" or "CLI Notes" section):
      > **Codex Linux sandbox**: the `capAdd`/`securityOpt` grants above exist so Codex's own Bubblewrap sandbox (`codex-yolo`'s `--sandbox workspace-write`) can actually create its namespace. This skill does not include a runtime health probe to verify the sandbox is confining anything on your specific host — if `codex-yolo` ever behaves as though unsandboxed, that's the first thing to check by hand.
  - If Antigravity was accepted: 
    - Add `.gemini` mount (`"source={{REPO_NAME}}-antigravity-config,target=/home/vscode/.gemini,type=volume"`) to the `mounts` array.
    - Append the following caveat to `.devcontainer/README.md` (e.g., under a "Gotchas" or "CLI Notes" section):
      > **Antigravity CLI Auth**: `agy` stores auth in the system keyring, not a file. The `~/.gemini` volume mount will not persist its login across rebuilds in a bare container. You may need to re-auth `agy` each time, or add a keyring daemon yourself later if that gets annoying.
- `.devcontainer/post-create.sh`: 
  If it doesn't exist, use [templates/post-create-baseline.sh](templates/post-create-baseline.sh) and substitute. 
  If it exists, intelligently append the following blocks ONLY if they don't already exist:
  - **Codex CLI**: append [templates/post-create-codex-block.sh](templates/post-create-codex-block.sh)
  - **Antigravity CLI**: append [templates/post-create-antigravity-block.sh](templates/post-create-antigravity-block.sh)
  - **YOLO Aliases**: 
    - Claude: `alias claude-yolo="claude --permission-mode auto --worktree --remote-control"`
      > **Why not `--dangerously-skip-permissions`?** It triggers Claude Code's own bwrap sandbox,
      > whose mount-namespace view of the repo conflicts with git's worktree identity check and
      > breaks worktree creation 100% of the time. `--permission-mode auto` is a classifier-based
      > policy that gives comparable autonomy without ever triggering the sandbox.
    - Codex: `alias codex-yolo="codex --ask-for-approval on-request --sandbox workspace-write -c sandbox_workspace_write.network_access=true"`
      > **Why not `--dangerously-bypass-approvals-and-sandbox`?** That's Codex's full-bypass
      > equivalent of `--dangerously-skip-permissions` — no sandbox and no approval checkpoint at
      > all, unlike `claude-yolo` (a classifier) and `agy-yolo` (a curated allow-list), which both
      > keep a real internal checkpoint. `on-request` gives Codex the same shape: the model itself
      > judges when to escalate to a human, rather than never escalating. The `capAdd`/`securityOpt`
      > grants added to `devcontainer.json` when Codex is accepted (see step 5) are what let the
      > `workspace-write` sandbox actually create its Bubblewrap namespace.
    - Antigravity: `alias agy-yolo="agy --mode accept-edits"`
      > **Why not `--dangerously-skip-permissions --sandbox`?** Antigravity auto-approves its own
      > sandbox's internal prompts once `--dangerously-skip-permissions` is present, making
      > `--sandbox` a no-op — confirmed by a filed Google bug
      > ([antigravity-cli#36](https://github.com/google-antigravity/antigravity-cli/issues/36)), so
      > that combination gives zero protection. The real safety boundary is a curated
      > `permissions.allow` list in `~/.gemini/antigravity-cli/settings.json`, starting from
      > `git`, `gh`, `ls`, `cat` and never `rm`, `curl`, raw `bash -c`, or a wildcard — see step 6
      > for telling the user to set it up as a manual, once-per-machine step.
    - Copilot: `alias copilot-yolo="echo 'Copilot CLI requires manual sandboxing. Run the regular \`copilot\` command and then type \`/sandbox enable\` in the session.'"`
    Append the requested aliases to `~/.bashrc`.
  - **SSH Layer**: append [templates/post-create-ssh-block.sh](templates/post-create-ssh-block.sh) (substituted) if accepted.
- `.devcontainer/post-start.sh` ← [templates/post-start.sh](templates/post-start.sh), substituted. Always rewritten to ensure skill sync remains current.
- `.devcontainer/post-attach.sh` ← [templates/post-attach.sh](templates/post-attach.sh), substituted (if SSH layer accepted).
- `.devcontainer/.env.example` ← [templates/env.baseline.example](templates/env.baseline.example),
  substituted. If the SSH layer was accepted, append
  [templates/env.ssh-block.example](templates/env.ssh-block.example) and update the `GH_TOKEN`
  comment to add: `Required permissions: Administration (read/write) — needed to manage deploy
  keys — plus whatever else you use gh for.`
- `.devcontainer/README.md` ← [templates/README.baseline.md](templates/README.baseline.md),
  substituted. If the SSH layer was accepted, append
  [templates/README.ssh-block.md](templates/README.ssh-block.md) and delete the baseline
  template's closing "SSH deploy key and signing key automation — Not set up here" section
  (superseded by the real section being appended).
- Make `.devcontainer/*.sh` executable: `chmod +x .devcontainer/*.sh`.
- Add `.devcontainer/.env` to `.gitignore` if it isn't already ignored.

Done when every file above exists, `.devcontainer/devcontainer.json` parses as valid JSON
(`jq empty .devcontainer/devcontainer.json`), and no `{{...}}` placeholder remains in any written
file (`grep -rn '{{' .devcontainer/`).

## 6. Report next steps

Tell the user, adapted to whether the SSH layer, YOLO alias, and Antigravity CLI are present:

1. Install Docker Desktop and the **Dev Containers** VS Code extension.
2. Copy `.devcontainer/.env.example` to `.devcontainer/.env` and fill in `GH_TOKEN`{{, and
   `DEVCONTAINER_HOST` (run `hostname`) if the SSH layer is present}}.
3. Reopen the repo in the container (**Dev Containers: Reopen in Container**).
4. Run `claude` and log in.
5. {{If the SSH layer is present: on attach, `post-attach.sh` prints a public key — paste it into
   github.com/settings/ssh as a Signing Key, then `touch ~/.ssh/.signing-key-registered`.}}
6. {{If the YOLO alias is present: a new shell in the container has `claude-yolo` available —
   `claude --permission-mode auto --worktree --remote-control` — for fast, unattended
   iteration.}}
7. {{If Antigravity was accepted and the `agy-yolo` alias is present: `agy-yolo`'s real safety
   boundary is a curated `permissions.allow` list, not a sandbox flag — this is a manual,
   once-per-machine step, deliberately not auto-templated (silently writing a security-relevant
   allow-list on every rebuild shouldn't happen without a human's hand). Add to
   `~/.gemini/antigravity-cli/settings.json` a list scoped to the repo's actual safe commands,
   starting from `git`, `gh`, `ls`, `cat` and extending with whatever else this repo's workflows
   need (package manager, test runner, etc.) — never `rm`, `curl`, raw `bash -c`, or a wildcard.}}

Done when the user has been told every applicable item above, adapted to whether the SSH layer,
YOLO alias, and Antigravity CLI are present.

## Adding the SSH layer later

For a repo that already has the baseline from this skill (`.devcontainer/devcontainer.json`
exists, no `postAttachCommand` key in it) and now needs agent-driven `git push` / signed commits:

1. Resolve `{{REPO_SLUG}}`, `{{REPO_NAME}}` as in the main flow's step 1 above.
2. Safely merge the following properties into `.devcontainer/devcontainer.json` without overwriting existing user customizations:
   - Add the SSH mount to the `mounts` array: `"source={{REPO_NAME}}-ssh-config,target=/home/vscode/.ssh,type=volume"`
   - Add `"postAttachCommand": "bash .devcontainer/post-attach.sh"` as a top-level key.
3. Append [templates/post-create-ssh-block.sh](templates/post-create-ssh-block.sh) (substituted)
   to the end of the existing `.devcontainer/post-create.sh`.
4. Write `.devcontainer/post-attach.sh` ← [templates/post-attach.sh](templates/post-attach.sh),
   substituted, and `chmod +x` it.
5. Append [templates/env.ssh-block.example](templates/env.ssh-block.example) to
   `.devcontainer/.env.example`, and update its `GH_TOKEN` comment as in the main flow's step 5
   above.
6. `.devcontainer/.env` itself already exists in this flow (it's required for the baseline to
   have worked at all) and is gitignored — don't touch it programmatically, since it holds a live
   `GH_TOKEN`. `devcontainer.json`'s `initializeCommand` only seeds `.env` from `.env.example` when
   `.env` doesn't yet exist, so appending to `.env.example` alone never reaches the file that's
   actually loaded via `runArgs: ["--env-file", ...]`. Run `hostname` on the host yourself and give
   the user the fully resolved line to add, not a command to run themselves:
   ```
   DEVCONTAINER_HOST=<actual output of hostname>
   ```
   Skipping this makes the first build after adding the SSH layer fail at `post-create.sh` with
   `ERROR: DEVCONTAINER_HOST is not set.`
7. Append [templates/README.ssh-block.md](templates/README.ssh-block.md) to
   `.devcontainer/README.md`, and delete that file's "SSH deploy key and signing key automation —
   Not set up here" closing section.
8. Tell the user, in order: add the `DEVCONTAINER_HOST` line from step 6 to
   `.devcontainer/.env` now, before rebuilding — not after hitting the error; rebuild the container
   (**Dev Containers: Rebuild Container**); and once attached, follow the signing-key prompt from
   `post-attach.sh`.

Done when `.devcontainer/devcontainer.json` still parses as valid JSON, has both the new mount and
`postAttachCommand`, no `{{...}}` placeholder remains in any touched file, and the user has
actually been told the `DEVCONTAINER_HOST` line to add to their existing `.env` — not just to
`.env.example`.
