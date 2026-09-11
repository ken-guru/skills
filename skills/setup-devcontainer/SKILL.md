---
name: setup-devcontainer
description: Generate a shared devcontainer (Ubuntu base image, Node, GitHub CLI, one persistent config volume) in the current repo — one container every AI CLI installs into, added independently via its four companion setup-<tool>-devcontainer skills — optionally layering on SSH deploy-key/signing-key automation for agent-driven git push and signed commits. Use when the user wants to add a devcontainer to a repo, add SSH key automation to an existing devcontainer, or connect a Local Checkout to a real GitHub repo. Not for adding an AI CLI itself — run the matching setup-<tool>-devcontainer skill for that, after this one.
---

# Setup Devcontainer

Generates `.devcontainer/` from the templates in [templates/](templates/):
one **Shared Container** — a single `devcontainer.json` and `Dockerfile` —
that every selected AI CLI installs into via its own independent skill, run
separately after this one. See [CONTEXT.md](CONTEXT.md) for this skill's
vocabulary (Shared Container, Local Checkout, Shared Checkout, Scaffold,
CLI Skill, Own-Block Contract, Capability Seam).

This skill owns the container definition (`devcontainer.json`, `Dockerfile`)
and the shared parts of `post-create.sh`/`post-start.sh`/`README.md`
entirely — no CLI skill ever edits them directly, except for one narrow,
explicit exception (the Capability Seam, `runArgs`, used by
`setup-codex-devcontainer`).

## 1. Detect the target repo

```bash
git remote get-url origin
```

Parse `owner/repo` from it (works for both `git@github.com:owner/repo.git` and
`https://github.com/owner/repo` forms) — this is `{{REPO_SLUG}}`. `{{REPO_NAME}}` is the `repo`
part alone, used in the volume names.

If there's no `origin` remote yet, ask one question: "Does a GitHub repository already exist for
this project? If yes, name it (`owner/repo`) — the container's `GH_TOKEN` will need access to it.
If no, or you're not ready to connect yet, this becomes a local-only **Local Checkout** —
connectable to GitHub later (see 'Connecting a Local Checkout to a real GitHub repo')."

- **Named an existing repo**: resolve `{{REPO_SLUG}}`/`{{REPO_NAME}}` from it, same as the
  existing-`origin` case above.
- **Local Checkout**: `{{REPO_SLUG}}` stays empty. `{{REPO_NAME}}` falls back to the local working
  directory's basename (`basename "$(pwd)"`), sanitized to Docker's naming rules (lowercase,
  invalid characters replaced with `-`) — state the resolved name back to the user as part of
  your summary; don't decide it silently. Also ask, as a separate yes/no question: "Initialize
  this workspace with `git init`?" Record the answer as `{{LOCAL_CHECKOUT_GIT_INIT}}`
  (`"true"`/`"false"`). If yes, resolve `{{GIT_DEFAULT_BRANCH}}` from the host's
  `git config --global init.defaultBranch` — substitute it as an empty string if the host has
  none configured; always substitute this placeholder with *something*, even `""`.

Done when you have `{{REPO_SLUG}}` (possibly empty) and `{{REPO_NAME}}` — plus, if Local Checkout,
`{{LOCAL_CHECKOUT_GIT_INIT}}` and, if that's yes, `{{GIT_DEFAULT_BRANCH}}`.

## 2. Discover existing setup

```bash
test -f .devcontainer/devcontainer.json && echo "devcontainer already exists"
```

- **Already exists**: this repo already has a Shared Container from a prior run. Nothing to
  regenerate — CLI installs are handled entirely by the setup-`<tool>`-devcontainer skills, and
  adding SSH to an existing devcontainer is [Adding SSH to a tool
  later](docs/adding-ssh-later.md). Stop here unless the user is specifically asking to
  reconfigure the base devcontainer itself.
- **Doesn't exist**: fresh setup, continue to step 3.

Also check for a leftover container from an unrelated prior setup of this same workspace folder —
the Dev Containers CLI labels containers by `devcontainer.local_folder=<absolute workspace path>`,
independent of what the current config says, so a stale container can survive even after its old
config was deleted or never committed:

```bash
docker ps -a --filter "label=devcontainer.local_folder=$(pwd)" --format '{{.ID}} {{.Image}}'
```

If this returns anything, warn the user before they reopen: a container built from a different
setup won't have the `vscode` user this setup expects, and reopening fails with a cryptic `unable
to find user vscode: no matching entries in passwd file`. Offer to remove it (`docker rm -f <id>`),
but don't remove it without asking. Skip this check entirely if `docker` isn't installed or isn't
running.

## 3. Ask SSH layer

Skip this question entirely if `{{REPO_SLUG}}` (step 1) is empty — Local Checkout, with no GitHub
repo yet to register deploy/signing keys against; tell the user why: "SSH layer isn't available
yet — this repo has no GitHub connection; add it once one exists (see 'Connecting a Local Checkout
to a real GitHub repo')."

Otherwise ask: does this repo need agent-driven `git push` and signed commits? (Adds
deploy-key/signing-key automation — one shared key pair for the whole container.) Addable later
without redoing anything already generated (see [Adding SSH to a tool
later](docs/adding-ssh-later.md)).

## 4. Resolve remaining placeholders

- `{{REPO_SLUG}}`, `{{REPO_NAME}}`, `{{LOCAL_CHECKOUT_GIT_INIT}}`, `{{GIT_DEFAULT_BRANCH}}` — from step 1.
- `{{GIT_EMAIL_DEFAULT}}`, `{{GIT_NAME_DEFAULT}}` — run `git config --global user.email` and
  `git config --global user.name` on the host. If either is unset, don't invent a default.

## 5. Generate the devcontainer

- `.devcontainer/Dockerfile` ← [templates/Dockerfile](templates/Dockerfile), copied verbatim (no
  placeholders).
- `.devcontainer/devcontainer.json` ← [templates/devcontainer.json](templates/devcontainer.json)
  (or [templates/devcontainer.with-ssh.json](templates/devcontainer.with-ssh.json) if step 3's
  answer was yes), substitute `{{REPO_NAME}}`. The `runArgs` field starts empty — this is the
  Capability Seam, the one extension point a CLI skill (today, only `setup-codex-devcontainer`) may
  later append to.
- `.devcontainer/post-create.sh` — generated by
  [scripts/render-devcontainer.sh](scripts/render-devcontainer.sh), which assembles the base
  skeleton (git identity, Local Checkout git-init, the shared `install_cli`/`chown_config_volume`
  function definitions, and the SSH block pair if enabled), chmod'ing the result +x:

  ```bash
  scripts/render-devcontainer.sh \
    --repo-name "{{REPO_NAME}}" --repo-slug "{{REPO_SLUG}}" \
    --out .devcontainer/post-create.sh \
    [--ssh] \
    [--git-email-default "<value>"] [--git-name-default "<value>"] \
    [--local-checkout-git-init "{{LOCAL_CHECKOUT_GIT_INIT}}"] [--git-default-branch "{{GIT_DEFAULT_BRANCH}}"]
  ```

  Verify with [scripts/verify-devcontainer.sh](scripts/verify-devcontainer.sh), passing the exact
  same flags (minus `--out`, plus `--file`).

  This skeleton is what every CLI skill later appends its own install block to. The SSH block
  never fails the build — an under-scoped or missing `GH_TOKEN` (or unset `DEVCONTAINER_HOST`)
  degrades to skipping the rest of the SSH setup, recording why in `~/.ssh/.ssh-setup-skipped`.
- `.devcontainer/post-start.sh` ← [templates/post-start-base.sh](templates/post-start-base.sh),
  copied verbatim, chmod +x. Empty skeleton — each CLI skill appends its own skill-sync block here
  if the user opts into it for that tool.
- `.devcontainer/post-attach.sh` ← [templates/post-attach.sh](templates/post-attach.sh),
  substituted, chmod +x.
- `.devcontainer/.env.example` ← [templates/env.baseline.example](templates/env.baseline.example), substituted.
- `.devcontainer/README.md` ← [templates/README.baseline.md](templates/README.baseline.md), substituted. Its
  `## Installed CLI Tools` heading is deliberately the file's last section, empty — every CLI
  skill's own bullet is a plain append to end-of-file, landing there without needing to search for
  a position.
- Add `.devcontainer/.env` to `.gitignore` if it isn't already ignored.

If step 3's answer was yes:

- `.devcontainer/.env.example` gets [templates/env.ssh-block.example](templates/env.ssh-block.example)
  appended, idempotently, and its `GH_TOKEN` comment gets: `Required permissions: Administration
  (read/write) — needed to manage deploy keys — plus whatever else you use gh for.`

  ```bash
  scripts/patch-if-absent.sh append .devcontainer/.env.example "DEVCONTAINER_HOST=your-hostname-here" templates/env.ssh-block.example
  ```
- `.devcontainer/README.md` gets [templates/README.ssh-block.md](templates/README.ssh-block.md)
  inserted **before** `## Installed CLI Tools`, not appended to end-of-file — this keeps that
  section as the file's last one no matter when SSH is added — and the baseline template's closing
  "SSH deploy key and signing key automation — Not set up here" section is deleted (superseded by
  the real section):

  ```bash
  scripts/patch-if-absent.sh insert-before .devcontainer/README.md "## SSH deploy key and signing key" "## Installed CLI Tools" templates/README.ssh-block.md
  scripts/patch-if-absent.sh delete-section .devcontainer/README.md "## SSH deploy key and signing key automation"
  ```

Done when every file above exists, `devcontainer.json` parses as valid JSON with an empty `runArgs`
array (`jq -e '.runArgs == []' .devcontainer/devcontainer.json`), no `{{...}}` placeholder remains
in any written file (`grep -rn '{{' .devcontainer/`), and `post-create.sh` passes
[scripts/verify-devcontainer.sh](scripts/verify-devcontainer.sh) for the exact flags it was
rendered with.

## 6. Report next steps

Tell the user, adapted to whether SSH is present:

1. Install Docker Desktop and the **Dev Containers** VS Code extension.
2. Copy `.devcontainer/.env.example` to `.devcontainer/.env` and fill in `GH_TOKEN`{{, and
   `DEVCONTAINER_HOST` (run `hostname`) if SSH is present}}.
3. Reopen the repo in the container (**Dev Containers: Reopen in Container**).
4. Run whichever `setup-<tool>-devcontainer` skill(s) you want, to add AI CLIs.
5. {{If SSH is present: on attach, `post-attach.sh` prints a public key — paste it into
   github.com/settings/ssh as a Signing Key, then `touch ~/.ssh/.signing-key-registered`.}}

## Adding SSH to a tool later

For a repo that already has a devcontainer and now needs agent-driven `git push` / signed commits.
See [docs/adding-ssh-later.md](docs/adding-ssh-later.md).

## Connecting a Local Checkout to a real GitHub repo

For a repo generated as Local Checkout (step 1) that now has a real GitHub repository to push
to. Needs no skill-level regeneration — see
[docs/connecting-local-checkout.md](docs/connecting-local-checkout.md).
