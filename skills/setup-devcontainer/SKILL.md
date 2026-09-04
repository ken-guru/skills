---
name: setup-devcontainer
description: Set up isolated Claude Code, Codex, Antigravity, and/or GitHub Copilot devcontainers (Ubuntu base image, Node, GitHub CLI, persistent auth, automatic skill sync) in the current repo — one independent Tool Container per selected CLI, runnable concurrently — optionally layering on SSH deploy-key/signing-key automation for agent-driven git push and signed commits. Use when the user wants to add a devcontainer for one or more AI CLIs, add a new AI CLI to an existing devcontainer setup, or add SSH key automation to a Tool Container that already exists.
---

# Setup Devcontainer

Generates `.devcontainer/` from the templates in [templates/](templates/): one
independent **Tool Container** per selected AI CLI — Claude Code, Codex,
Antigravity, and/or GitHub Copilot — instead of a single shared container
bundling every tool together. See
[CONTEXT.md](CONTEXT.md) for the vocabulary used throughout this skill
(Tool Container, Shared Container, Collision, Concurrent Workspace).

- **Shared base image** (`base.Dockerfile`) — Node.js, the GitHub CLI, and a
  fixed `vscode` user/UID/GID, built once and reused (via Docker's own layer
  sharing) across every Tool Container instead of reinstalled per tool.
  Rebuilt and retagged only when its rendered content changes, always with
  the user's confirmation before bumping the version.
- **One Tool Container per selected tool** — its own Dockerfile (extending
  the shared base), `devcontainer.json`, post-create script, and Compose
  service. Fully isolated: a permission grant, config volume, or install step
  for one tool never reaches another's container. This skill builds and tags
  each tool's image itself (`docker build`, same as the base image) and the
  Compose service references that pre-built tag via `image:`, never `build:`
  — VS Code's Dev Containers CLI is known to pass `--pull` when it builds a
  Compose service itself, which forces Docker to try re-resolving *any*
  locally-built image referenced via `FROM` (including our own shared base)
  from a registry, and fails hard since it was never pushed anywhere. Pre-
  building ourselves means VS Code never has a build step to run at all for
  these services — just an already-present image to start.
- **Concurrent Workspace** — every Tool Container is a service in the same
  `docker-compose.yml`, bind-mounting this same repo checkout. Opening two
  tools' containers in two separate VS Code windows runs them side by side.
- **SSH layer** — deploy-key/signing-key automation for agent-driven
  `git push` and signed commits. Optional per tool, addable to any tool after
  the fact without touching that tool's existing files. Shared across every
  SSH-enabled Tool Container (one registered key pair per repo, not one per
  tool).
- **YOLO alias** — a shell alias for fast, unattended iteration, named after
  the tool's actual CLI invocation, not its folder name: `claude-yolo`,
  `codex-yolo`, `agy-yolo` (Antigravity's binary is `agy`, not `antigravity`),
  `copilot-yolo`. Optional per tool — some developers don't want a
  no-holds-barred agent available inside a given Tool Container at all.

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

## 2. Discover existing Tool Containers

```bash
test -f .devcontainer/base.Dockerfile && echo "has base image"
for t in claude-code codex antigravity copilot; do
  test -f ".devcontainer/$t/devcontainer.json" && echo "$t exists"
done
test -f .devcontainer/devcontainer.json && echo "LEGACY Shared Container detected"
```

- **`.devcontainer/devcontainer.json` exists at the top level** (no
  `base.Dockerfile`, no per-tool subfolders): this is the old, single Shared
  Container from before this skill split into Tool Containers. There is no
  in-place converter. Tell the user to remove `.devcontainer/` entirely and
  re-run this skill fresh — do not attempt to generate anything on top of it.
- **`base.Dockerfile` exists and one or more `<tool>/devcontainer.json` exist**:
  this repo already has Tool Container(s) from a prior run of this skill.
  Skip to [Adding another Tool Container
  later](#adding-another-tool-container-later) for any newly-requested tool,
  and to [Adding SSH to a tool later](#adding-ssh-to-a-tool-later) if the
  request is only to add SSH to an already-existing tool. Do not regenerate
  already-existing tools' files.
- **Neither exists**: fresh setup, continue to step 3.

For any tool whose Tool Container you're about to generate or reopen, also
check for a leftover container from an unrelated prior setup of this same
tool in this same workspace folder. The Dev Containers CLI labels containers
by `devcontainer.local_folder=<absolute workspace path>` and, for
Compose-based containers, `com.docker.compose.service=<tool>` — independent
of what the current config says, so a stale container survives even after
its old config was deleted or never committed, and reopening will silently
reuse it instead of building fresh:

```bash
docker ps -a --filter "label=devcontainer.local_folder=$(pwd)" --filter "label=com.docker.compose.service=<tool>" --format '{{.ID}} {{.Image}}'
```

If this returns anything, warn the user before they reopen that tool: a
container built from a different setup won't have the `vscode` user this
setup expects, and reopening fails with a cryptic `unable to find user
vscode: no matching entries in passwd file` that gives no hint the real
cause is the leftover container, not the new config. Offer to remove it
(`docker rm -f <id>`), but don't remove it without asking — it may hold
state the user still wants. Skip this check entirely if `docker` isn't
installed or isn't running; note that it couldn't be checked rather than
failing the rest of the skill over it.

Done when you know which of the four tools already have a Tool Container,
whether a legacy Shared Container needs a migration message instead of
generation, and whether any tool about to be (re)opened has a stale leftover
container to warn about.

## 3. Ask tool selection and per-tool options

Ask the user which tools they want (skip any already answered in their
request, and skip any tool that already has a Tool Container per step 2 —
those go through the append-flows instead):

- **Claude Code**, **OpenAI Codex CLI** (`codex`), **Google Antigravity CLI**
  (`agy`), **GitHub Copilot CLI** (`copilot`) — a multi-select. Pre-check
  Claude Code as the common case; it's fully optional and symmetric with the
  other three, just recommended by default.

For each **newly** selected tool, ask independently:

- **SSH Layer**: Does this repo need agent-driven `git push` and signed
  commits from this tool's Tool Container? (Adds deploy-key/signing-key
  automation, shared with any other Tool Container that also has it
  enabled.)
- **YOLO alias**: Should this tool get its `-yolo` alias for fast, unattended
  iteration — `claude-yolo`, `codex-yolo`, `agy-yolo`, or `copilot-yolo`,
  matching the tool's actual CLI command, **not** its folder name (Antigravity's
  is `agy-yolo`, never `antigravity-yolo`)? (Note for Copilot: `copilot-yolo`
  just echoes instructions to manually type `/sandbox enable` inside the
  session.) Each tool's `-yolo` alias reduces its permission checkpoints for
  faster iteration; the exact tradeoff differs per tool — see the README's
  "YOLO aliases" section for specifics.

Record these answers — they decide which template variants steps 5–6 use.
Both are addable later per tool without redoing anything already generated
(see the append-flows below).

## 4. Resolve placeholders

- `{{REPO_SLUG}}`, `{{REPO_NAME}}` — from step 1.
- `{{GIT_EMAIL_DEFAULT}}`, `{{GIT_NAME_DEFAULT}}` — run `git config --global user.email` and
  `git config --global user.name` on the host. If either is unset, don't invent a default: use
  `${GIT_USER_EMAIL:?Set GIT_USER_EMAIL in .devcontainer/.env}` (no `-default` fallback) in
  the base post-create script instead of the `:-` form, and drop the parenthetical in
  `.env.example`'s comment.
- `{{SKILLS_SOURCES_COMMANDS}}` (any selected tool — Claude Code, Codex, Antigravity, and Copilot
  all support this identically) — ask the user one combined question, asked once regardless of
  how many of the four tools are selected: sync AI-agent skills into every selected Tool Container
  automatically on every start? Two ready-made suites are available: `mattpocock/skills` (a broad
  general-purpose skill baseline) and `ken-guru/skills` (this collection — includes this very
  Skill, useful if a layer needs adding later from inside the container). For each, ask yes/no. In
  the same prompt, also invite the user to name any other individual skills they want, in
  `owner/repo/skill-name` form (e.g. `anthropics/skills/frontend-design`) — mixing and matching
  freely, including picking specific skills out of the two suites above instead of taking them
  whole. If the user just wants both suites in full, saying yes to both and skipping the rest is
  the fast path. The same answer applies identically to every selected tool — this question is
  about *which skills*, not *which tool*; the tool-specific part is handled entirely by the
  rendering step below, invisibly to the user.

  Validate live in this same conversation before rendering anything, for **every individually
  named skill pick, from any source including the two named defaults** (a whole-suite accept
  needs no validation — `--skill '*'` can't typo): `npx -y skills add <source> --list` (or `-l`)
  lists what that source actually contains. If the source doesn't resolve, or a named skill isn't
  in the list, tell the user and re-ask rather than rendering a broken command — this is the
  intended defense against typos, since skills.sh's own API requires authentication this context
  doesn't have, so the CLI's own listing is used instead. This applies even to a skill picked out
  of `mattpocock/skills` or `ken-guru/skills` individually rather than taken as a whole suite —
  those two sources are pre-named, not pre-validated for every skill inside them.

  Render one block **per selected tool**, since the underlying `npx skills` CLI installs to a
  specific agent's own skills directory, not a shared one — each tool's block is identical to
  every other's except for its `-a` value, taken from this fixed mapping:

  | Tool | `-a` value |
  | --- | --- |
  | Claude Code | `claude-code` |
  | Codex | `codex` |
  | Antigravity | `antigravity` |
  | Copilot | `github-copilot` |

  Within each tool's block, render one line per **distinct source**, in the order first
  mentioned:
  - A source accepted as a whole suite (either of the two defaults, or any other source the user
    chose to take in full): `npx -y skills add <source> --skill '*' -a <tool's agent name> -y --copy -g`.
  - A source with only individual picks (not accepted as a whole suite): `npx -y skills add
    <source> --skill '<name1>' --skill '<name2>' ... -a <tool's agent name> -y --copy -g`, listing
    only that source's picked skills.
  - A source both accepted as a whole suite **and** separately named for an individual pick:
    render only the whole-suite line for it — the individual pick is redundant, not
    contradictory, so drop it silently rather than flagging it back to the user.

  Use tool T's resulting multi-line block everywhere `{{SKILLS_SOURCES_COMMANDS}}` appears inside
  tool T's own template(s) — never mix one tool's `-a` value into another tool's file. Also
  record, for `{{SKILLS_SOURCES_SUMMARY}}` below: only naming a trusted source matters here —
  `-y --copy -g` installs and re-syncs that source's skills unattended on every container start,
  with no per-skill review step, and an installed skill's instructions can influence what the
  agent does inside the container. Tell the user this caution as part of asking the question, not
  as an afterthought.
- `{{SKILLS_SOURCES_SUMMARY}}` — the chosen sources and picks as a short human-readable list for
  the README's prose (e.g. `` `mattpocock/skills` (full), `ken-guru/skills` (full),
  `anthropics/skills/frontend-design` ``) — distinguishing whole-suite sources from individual
  picks, since the README's "Automatic skill sync" section states both. If the user named nothing
  (declined both defaults and no individual picks), render as "none configured."
- `{{SELECTED_TOOLS_SUMMARY}}` — a short human-readable list of the tools selected across this
  run and any already-existing ones (e.g. `` Claude Code, Codex ``), for the README's prose.

## 5. Build or reuse the shared base image

`{{BASE_IMAGE_VERSION}}` is the bare version string (`v1`, `v2`, ...);
`{{BASE_IMAGE_TAG}}` is the full image reference built from it:
`skills-tool-container-base:{{BASE_IMAGE_VERSION}}`.

- If `.devcontainer/base.Dockerfile` doesn't exist yet: write it from
  [templates/base.Dockerfile](templates/base.Dockerfile) (no placeholders to
  substitute in this file itself). Set `{{BASE_IMAGE_VERSION}}` to `v1`.
  Build it:
  `docker build -t skills-tool-container-base:v1 -f .devcontainer/base.Dockerfile .devcontainer`.
  Record the version and a content hash of the file
  (`sha256sum .devcontainer/base.Dockerfile`) into
  `.devcontainer/.base-image-version` as `<version> <sha256>`.
- If it already exists: compute the sha256 of
  [templates/base.Dockerfile](templates/base.Dockerfile)'s current rendered
  content and compare it to the hash recorded in
  `.devcontainer/.base-image-version`.
  - **Unchanged**: skip rebuilding. Use the version already recorded in
    `.devcontainer/.base-image-version` as `{{BASE_IMAGE_VERSION}}`.
  - **Changed**: tell the user the shared base layer's template has changed
    and this would affect every Tool Container that extends it, and ask
    whether to bump the version (e.g. `v1` → `v2`) and rebuild. Never bump or
    rebuild silently.
    - **Confirmed**: overwrite `.devcontainer/base.Dockerfile`, build and tag
      the bumped version, update `.devcontainer/.base-image-version` with the
      new version and hash, and use the new version as
      `{{BASE_IMAGE_VERSION}}`. A version bump also forces every already-
      generated tool's image to rebuild in step 6 (their tags are versioned
      identically to the base — see below), even though their own
      Dockerfiles didn't change.
    - **Declined**: leave `.devcontainer/base.Dockerfile` and the recorded
      version/hash untouched, and use the existing version as
      `{{BASE_IMAGE_VERSION}}` for this run's new tool(s).

Done when `.devcontainer/base.Dockerfile` exists, `docker image inspect
skills-tool-container-base:{{BASE_IMAGE_VERSION}}` succeeds, and
`.devcontainer/.base-image-version` records that exact version alongside a
hash matching the file actually on disk.

## 6. Generate the compose file and each selected tool's folder

For **each newly selected tool** (`claude-code`, `codex`, `antigravity`, or `copilot`):

- `.devcontainer/<tool>/Dockerfile` ← [templates/<tool>/Dockerfile](templates/), substitute
  `{{BASE_IMAGE_TAG}}` with the tag resolved in step 5.
- **Build and tag this tool's own image**:
  `docker build -t {{REPO_NAME}}-<tool>:{{BASE_IMAGE_VERSION}} -f .devcontainer/<tool>/Dockerfile .devcontainer`.
  The Compose service references this exact pre-built tag via `image:` (see below) — never
  `build:` — specifically so VS Code's Dev Containers CLI never has a build step to run for these
  services at all. This matters because that CLI is known to pass `--pull` when it *does* build a
  Compose service, which forces Docker to try re-resolving any locally-built image referenced via
  `FROM` (our shared base) from a registry — and since the base was never pushed anywhere, that
  pull fails outright and aborts the whole "Reopen in Container" attempt. Pre-building ourselves
  sidesteps the bug entirely rather than working around it.
- `.devcontainer/<tool>/devcontainer.json`:
  use [templates/<tool>/devcontainer.json](templates/) (or
  [templates/<tool>/devcontainer.with-ssh.json](templates/) if this tool's SSH
  answer was yes), substitute `{{REPO_NAME}}`, and write it.
- `.devcontainer/<tool>/post-create.sh` — assembled by concatenating, in order:
  1. [templates/post-create-base.sh](templates/post-create-base.sh), substituted (git identity — shared across every tool).
  2. [templates/<tool>/post-create-block.sh](templates/) (this tool's CLI install and config-volume ownership fix).
  3. [templates/<tool>/yolo-alias-block.sh](templates/) — only if this tool's yolo answer was yes.
  4. [templates/post-create-ssh-block.sh](templates/post-create-ssh-block.sh), substituted — only if this tool's SSH answer was yes. This block never fails the build: an under-scoped or missing `GH_TOKEN` (or an unset `DEVCONTAINER_HOST`) degrades to skipping the rest of the SSH setup and recording why in `~/.ssh/.ssh-setup-skipped`, rather than aborting `postCreateCommand` — which would otherwise also skip every block concatenated after it.
  5. [templates/post-create-warnings-block.sh](templates/post-create-warnings-block.sh) — only if this tool's SSH answer was yes, immediately after the SSH block above. Appends a snippet to `~/.bashrc` that surfaces any of this SSH layer's three standing warnings (setup skipped, signing key unregistered, deploy key missing on GitHub) at the top of every new terminal, not just once at attach — `postCreateCommand`/`postAttachCommand` each fire once per rebuild/attach, not per terminal tab.
- `.devcontainer/<tool>/post-start.sh` (every selected tool gets one — Claude Code, Codex,
  Antigravity, and Copilot all sync skills identically) ←
  [templates/<tool>/post-start.sh](templates/), substituted with that tool's own
  `{{SKILLS_SOURCES_COMMANDS}}` block from step 4 (using that tool's `-a` value, never another
  tool's). Always rewritten (even on an already-existing Tool Container) to ensure skill sync
  stays current.
- Make the new `.devcontainer/<tool>/*.sh` files executable: `chmod +x .devcontainer/<tool>/*.sh`.

If **Codex** was newly selected, append the following caveat to `.devcontainer/README.md` (under
a "Gotchas" or "CLI Notes" section, creating one if it doesn't exist):

> **Codex Linux sandbox**: Codex's Tool Container carries `capAdd`/`securityOpt` grants so
> Codex's own Bubblewrap sandbox (`codex-yolo`'s `--sandbox workspace-write`) can actually create
> its namespace — scoped to Codex's own container only, never any other tool's. This skill does
> not include a runtime health probe to verify the sandbox is confining anything on your specific
> host — if `codex-yolo` ever behaves as though unsandboxed, that's the first thing to check by
> hand.

If **Antigravity** was newly selected, append the following caveat to `.devcontainer/README.md`
(same section):

> **Antigravity CLI Auth**: `agy` stores auth in the system keyring, not a file. The
> `.antigravity` volume mount will not persist its login across rebuilds in a bare container. You
> may need to re-auth `agy` each time, or add a keyring daemon yourself later if that gets
> annoying.

If **any** newly or already-selected tool has the SSH answer yes:

- `.devcontainer/post-attach.sh` ← [templates/post-attach.sh](templates/post-attach.sh), substituted (shared across every SSH-enabled tool). Write once; `chmod +x` it.
- `.devcontainer/.env.example` gets [templates/env.ssh-block.example](templates/env.ssh-block.example) appended (only if not already present), and its `GH_TOKEN` comment gets: `Required permissions: Administration (read/write) — needed to manage deploy keys — plus whatever else you use gh for.`
- `.devcontainer/README.md` gets [templates/README.ssh-block.md](templates/README.ssh-block.md) appended (only if not already present), and the baseline template's closing "SSH deploy key and signing key automation — Not set up here" section is deleted (superseded by the real section).

If step 5 bumped `{{BASE_IMAGE_VERSION}}` this run (the **Confirmed** branch), rebuild and
retag **every already-existing tool's image** too, at the new version — same build command as
above, run again for each tool that already has a Tool Container even though none of its own
files (Dockerfile, devcontainer.json, post-create.sh) need rewriting. Their Compose service's
`image:` reference is versioned identically to the base, so without this their tag would point at
an image that no longer exists.

Always (every run, regardless of which tools are new):

- `.devcontainer/docker-compose.yml` ← rebuilt from [templates/docker-compose.yml](templates/docker-compose.yml): concatenate every currently-selected tool's [templates/<tool>/compose-fragment.yml](templates/) (substituted `{{REPO_NAME}}` and `{{BASE_IMAGE_VERSION}}`) under `services:`, and list one `{{REPO_NAME}}-<tool>-config:` volume line per selected tool under `volumes:` (plus `{{REPO_NAME}}-ssh-config:` once, if any tool has SSH enabled). **Safely rebuild, don't hand-edit around**: since this file only ever holds what this skill generated, it's fine to regenerate it wholesale from the current set of selected tools each run — never drop an already-existing tool's service just because this particular run didn't ask about it again.
- `.devcontainer/.env.example` ← [templates/env.baseline.example](templates/env.baseline.example), substituted, if it doesn't already exist.
- `.devcontainer/README.md` ← [templates/README.baseline.md](templates/README.baseline.md), substituted, if it doesn't already exist. If it already exists, update `{{SELECTED_TOOLS_SUMMARY}}`'s rendered value in place, and **backfill the "Automatic skill sync" and "YOLO aliases" sections** (matching heading) from the current template if either is missing, inserting each at the same position it holds in the current template — a README from before these sections existed should end up with them added, not left stale. Render each with current values regardless of what's configured this run (e.g. `{{SKILLS_SOURCES_SUMMARY}}` renders as "none configured" when no source is set up), the same as the rest of the baseline template already does for tools that aren't selected. If a section is already present, leave it as-is — this backfill only inserts what's missing, it doesn't reconcile wording drift in a section that already exists.
- Add `.devcontainer/.env` to `.gitignore` if it isn't already ignored.
- If **Claude Code** is selected (newly or already), add `.claude/worktrees/` to `.gitignore` if
  it isn't already ignored: `claude --worktree` (used by the `claude-yolo` alias, and available to
  any Claude Code session regardless of the alias) creates isolated git worktrees directly inside
  the bind-mounted `/workspace`, which the host sees as untracked noise in `git status` since the
  mount is the same filesystem, not container-isolated. Apply the same reasoning to any other
  tool-generated runtime noise you notice actually landing inside the workspace (as opposed to a
  config volume, which is already container-isolated and needs no gitignore entry) — this list
  isn't meant to be exhaustive up front, only to grow as real noise is observed.

Done when every file above exists, every tool's `devcontainer.json` parses as valid JSON
(`jq empty .devcontainer/<tool>/devcontainer.json`), `docker-compose.yml` parses as valid YAML
with exactly one service per selected tool, every selected tool's image actually exists at the
tag its Compose service references (`docker image inspect {{REPO_NAME}}-<tool>:{{BASE_IMAGE_VERSION}}`
succeeds for each), and no `{{...}}` placeholder remains in any written file
(`grep -rn '{{' .devcontainer/`).

## 7. Report next steps

Tell the user, adapted to which tools were selected and which have SSH/yolo:

1. Install Docker Desktop and the **Dev Containers** VS Code extension.
2. Copy `.devcontainer/.env.example` to `.devcontainer/.env` and fill in `GH_TOKEN`{{, and
   `DEVCONTAINER_HOST` (run `hostname`) if any tool's SSH layer is present}}.
3. For each selected tool: reopen the repo in that Tool Container
   (**Dev Containers: Reopen in Container**, pick the tool's name).
4. Run that tool's CLI and log in.
5. {{If more than one tool was selected: to use two at once, open a second
   VS Code window (File > New Window) on this same repo and reopen it in a
   different tool's container there — see the README's "Running tools
   concurrently" section.}}
6. {{If any tool has the SSH layer present: on attach, `post-attach.sh`
   prints a public key — paste it into github.com/settings/ssh as a Signing
   Key, then `touch ~/.ssh/.signing-key-registered`. Do this **once**,
   in whichever SSH-enabled tool's window shows the prompt first — the key
   pair and the registration marker are shared across every SSH-enabled Tool
   Container in this repo, not generated separately per tool.}}
7. {{For each tool with its YOLO alias present: a new shell in that tool's
   container has its alias available for fast, unattended iteration —
   `claude-yolo`, `codex-yolo`, `agy-yolo`, or `copilot-yolo` (matching the
   tool's actual CLI command, not its folder name). See the README's "YOLO
   aliases" section for what each one's permission tradeoff actually means
   before using it — Antigravity's in particular needs one manual setup step
   there before `agy-yolo` is meaningfully safe.}}

Done when the user has been told every applicable item above, adapted to which tools, SSH layer,
and YOLO aliases are present.

## Adding another Tool Container later

For a repo that already has `.devcontainer/base.Dockerfile` and at least one
`.devcontainer/<tool>/devcontainer.json` from a prior run of this skill, and
now wants an additional tool:

1. Resolve `{{REPO_SLUG}}`, `{{REPO_NAME}}` as in the main flow's step 1.
2. Ask which new tool(s) to add, plus their independent SSH/yolo answers, as
   in step 3.
3. Resolve placeholders as in step 4.
4. Run step 5 (build or reuse the shared base image) exactly as written —
   this is almost always a no-op reuse, since adding a tool doesn't change
   `base.Dockerfile`'s content.
5. Run step 6 for the newly-added tool(s) only. The `docker-compose.yml`
   rebuild in step 6 already regenerates the file from the full current set
   of tools (old and new together), so every already-existing tool's service
   definition is preserved automatically — nothing about an existing tool's
   files is touched by this flow.
6. Run step 7, scoped to the newly-added tool(s)' next steps only.

Done when the new tool's files exist and pass the same step-6 checks, the
existing tools' files are byte-for-byte unchanged (aside from
`docker-compose.yml`, which legitimately gains a new service block), and
`docker-compose.yml` still has exactly one service per tool that now has a
Tool Container.

## Adding SSH to a tool later

For a tool that already has a Tool Container (`.devcontainer/<tool>/devcontainer.json`
exists, no `postAttachCommand` key in it) and now needs agent-driven `git push` / signed commits:

1. Resolve `{{REPO_SLUG}}`, `{{REPO_NAME}}` as in the main flow's step 1.
2. Replace `.devcontainer/<tool>/devcontainer.json` with
   [templates/<tool>/devcontainer.with-ssh.json](templates/), substituted —
   this only adds the SSH mount and `postAttachCommand` relative to the
   existing file, so no other property changes.
3. Append [templates/post-create-ssh-block.sh](templates/post-create-ssh-block.sh) (substituted),
   then [templates/post-create-warnings-block.sh](templates/post-create-warnings-block.sh)
   (no placeholders), to the end of the existing `.devcontainer/<tool>/post-create.sh`.
4. Write `.devcontainer/post-attach.sh` ← [templates/post-attach.sh](templates/post-attach.sh),
   substituted, and `chmod +x` it, if it doesn't already exist (it may already exist if another
   tool already has SSH enabled — the file and the volume it manages are shared across every
   SSH-enabled tool).
5. Append [templates/env.ssh-block.example](templates/env.ssh-block.example) to
   `.devcontainer/.env.example` (only if not already present from another tool's SSH setup), and
   update its `GH_TOKEN` comment as in the main flow's step 6.
6. `.devcontainer/.env` itself already exists in this flow (it's required for the Tool Container to
   have worked at all) and is gitignored — don't touch it programmatically, since it holds a live
   `GH_TOKEN`. `initializeCommand` only seeds `.env` from `.env.example` when
   `.env` doesn't yet exist, so appending to `.env.example` alone never reaches the file that's
   actually loaded. If `DEVCONTAINER_HOST` isn't already set in `.env` (from another tool's SSH
   setup), run `hostname` on the host yourself and give the user the fully resolved line to add,
   not a command to run themselves:
   ```
   DEVCONTAINER_HOST=<actual output of hostname>
   ```
   Skipping this doesn't fail the build — `post-create-ssh-block.sh` degrades to skipping the SSH
   setup and recording why in `~/.ssh/.ssh-setup-skipped` — but it does mean the SSH layer silently
   never activates, so set it before the first rebuild rather than relying on the warning to catch it.
7. Append [templates/README.ssh-block.md](templates/README.ssh-block.md) to
   `.devcontainer/README.md` (only if not already present), and delete that file's "SSH deploy key
   and signing key automation — Not set up here" closing section.
8. Tell the user, in order: add the `DEVCONTAINER_HOST` line from step 6 to
   `.devcontainer/.env` now if it wasn't already there, before rebuilding — not after hitting the
   error; rebuild this tool's Tool Container (**Dev Containers: Rebuild Container**, in that
   tool's window); and once attached, follow the signing-key prompt from `post-attach.sh`.

Done when `.devcontainer/<tool>/devcontainer.json` still parses as valid JSON, has both the new
mount and `postAttachCommand`, no `{{...}}` placeholder remains in any touched file, no other
tool's files were modified, and the user has actually been told the `DEVCONTAINER_HOST` line to
add to their existing `.env` — not just to `.env.example`.
