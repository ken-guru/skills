---
name: setup-devcontainer
description: Set up isolated Claude Code, Codex, Antigravity, and/or GitHub Copilot devcontainers (Ubuntu base image, Node, GitHub CLI, persistent auth, automatic skill sync) in the current repo — one independent Tool Container per selected CLI, runnable concurrently — optionally layering on SSH deploy-key/signing-key automation for agent-driven git push and signed commits. Use when the user wants to add a devcontainer for one or more AI CLIs, add a new AI CLI to an existing devcontainer setup, add SSH key automation to a Tool Container that already exists, migrate an old Tool Container to Private Checkout, or connect a Local Checkout to a real GitHub repo.
---

# Setup Devcontainer

Generates `.devcontainer/` from the templates in [templates/](templates/): one
independent **Tool Container** per selected AI CLI — Claude Code, Codex,
Antigravity, and/or GitHub Copilot — instead of a single shared container
bundling every tool together. See
[CONTEXT.md](CONTEXT.md) for the vocabulary used throughout this skill
(Tool Container, Shared Container, Collision, Concurrent Workspace, Private
Checkout, Local Checkout, Shared Checkout, Cross-Container Leakage).

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
- **Private Checkout** — every Tool Container clones its own copy of the repo
  from `origin` into its own named volume (via `onCreateCommand`, before
  `postCreateCommand` ever runs), instead of bind-mounting the host's
  checkout. No Tool Container can read another's uncommitted work, unpushed
  branches, or `claude --worktree` worktrees — the isolation `docker-compose.yml`
  and `devcontainer.json` already gave each tool's compute now extends to its
  filesystem too. Doesn't auto-sync with `origin` or any other Tool
  Container — `git fetch`/`pull` manually; `post-attach.sh` prints a static
  reminder of this on every attach.
- **Local Checkout** — a Private Checkout with no GitHub `origin` at all: for
  a brand-new or deliberately local-only project, with no resolvable repo
  and no `GH_TOKEN` requirement. Chosen once per repo, at step 1, instead of
  naming an existing GitHub repo; every Tool Container in that run gets one.
  Initializes to a local `git init` (default) or a genuinely bare workspace,
  by a separate yes/no answer — never automatic. Connectable to a real
  GitHub repo later with no skill-level regeneration at all, just plain git
  (see "Connecting a Local Checkout to a real GitHub repo").
- **Concurrent Workspace** — every Tool Container is a service in the same
  `docker-compose.yml`, each with its own Private Checkout. Opening two
  tools' containers in two separate VS Code windows runs them side by side,
  with no shared on-disk state between them.
- **SSH layer** — deploy-key/signing-key automation for agent-driven
  `git push` and signed commits. Optional per tool, addable to any tool after
  the fact without touching that tool's existing files. Each SSH-enabled Tool
  Container registers and owns its own key pair — not shared with any other
  tool, so a compromised or runaway agent in one container can't read the
  key material another container's `git push`/commit signing depends on.
- **YOLO alias** — a shell alias for fast, unattended iteration, named after
  the tool's actual CLI invocation, not its folder name: `claude-yolo`,
  `codex-yolo`, `agy-yolo` (Antigravity's binary is `agy`, not `antigravity`),
  `copilot-yolo`. Optional per tool — some developers don't want a
  no-holds-barred agent available inside a given Tool Container at all.
- **Container identity banner** — every Tool Container prints a one-line
  banner naming itself (e.g. `── Claude Code Tool Container ──`) at the top
  of every new terminal, so it's always obvious which CLI's container a
  given shell belongs to. Every non-Copilot Tool Container also disables VS
  Code's own built-in `terminal.integrated.initialHint` terminal hint via
  `customizations.vscode.settings` — that hint suggests "Type `copilot` to
  use Copilot CLI" based on the local VS Code window's Copilot/Chat
  entitlement state, not on what's actually installed in the attached
  container, so left enabled it misleadingly nudges toward Copilot even
  inside, say, a Claude Code Tool Container. Left enabled only in Copilot's
  own Tool Container, where the suggestion happens to be correct.

## 1. Detect the target repo

```bash
git remote get-url origin
```

Parse `owner/repo` from it (works for both `git@github.com:owner/repo.git` and
`https://github.com/owner/repo` forms) — this is `{{REPO_SLUG}}`. `{{REPO_NAME}}` is the `repo`
part alone, used in volume names and SSH key titles. `{{LOCAL_CHECKOUT}}` is `"false"`.

If there's no `origin` remote yet, ask one question: "Does a GitHub repository already exist for
this project? If yes, name it (`owner/repo`) — Tool Containers will clone from there, and
`GH_TOKEN` will be required. If no, or you're not ready to connect yet, Tool Containers start as
a local-only **Local Checkout** — connectable to GitHub later (see 'Connecting a Local Checkout
to a real GitHub repo')."

- **Named an existing repo**: resolve `{{REPO_SLUG}}`/`{{REPO_NAME}}` from it, same as the
  existing-`origin` case above. The named repo must already exist on GitHub — cloning it is what
  populates each Tool Container's workspace. `{{LOCAL_CHECKOUT}}` is `"false"`.
- **Local Checkout**: `{{REPO_SLUG}}` stays empty. `{{REPO_NAME}}` falls back to the local working
  directory's basename (`basename "$(pwd)"`), sanitized to Docker's naming rules (lowercase,
  invalid characters replaced with `-`) — state the resolved name back to the user as part of
  your summary; don't decide it silently. `{{LOCAL_CHECKOUT}}` is `"true"`. Also ask, as a
  separate yes/no question: "Initialize this workspace with `git init`?" Record the answer as
  `{{LOCAL_CHECKOUT_GIT_INIT}}` (`"true"`/`"false"`). If yes, resolve `{{GIT_DEFAULT_BRANCH}}`
  from the host's `git config --global init.defaultBranch` — substitute it as an empty string if
  the host has none configured (the baked-in script checks for that emptiness at runtime to
  decide whether to pass `--initial-branch` to `git init` at all; always substitute this
  placeholder with *something*, even `""`, same as every other placeholder — never leave the
  literal `{{GIT_DEFAULT_BRANCH}}` token in the written file).

Done when you have `{{REPO_SLUG}}` (possibly empty), `{{REPO_NAME}}`, and `{{LOCAL_CHECKOUT}}` —
plus, if Local Checkout, `{{LOCAL_CHECKOUT_GIT_INIT}}` and, if that's yes, `{{GIT_DEFAULT_BRANCH}}`.

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
  later](docs/adding-tool-later.md) for any newly-requested tool,
  and to [Adding SSH to a tool later](docs/adding-ssh-later.md) if the
  request is only to add SSH to an already-existing tool. Do not regenerate
  already-existing tools' files — **except**: for each already-existing
  tool, check whether it predates Private Checkout
  (`jq -e '.onCreateCommand' .devcontainer/<tool>/devcontainer.json`; empty
  or an error means it does). If any do and the user hasn't already asked
  to migrate them, tell them these tools are still on the old shared
  bind-mounted model and point them at [Migrating a Tool Container to
  Private Checkout](docs/migrating-private-checkout.md) — don't
  migrate silently as a side effect of an unrelated request.
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

If `{{LOCAL_CHECKOUT}}` is `"true"` (step 1), skip the SSH Layer question below entirely for
every tool in this run — there's no GitHub repo yet to register deploy/signing keys against. Tell
the user why it's not being offered: "SSH layer isn't available yet — this repo has no GitHub
connection; add it once one exists (see 'Connecting a Local Checkout to a real GitHub repo')."
The YOLO alias and skills-sync questions are unaffected — both are independent of git/GitHub
remote status, ask them normally.

For each **newly** selected tool, ask independently:

- **SSH Layer** (skip if `{{LOCAL_CHECKOUT}}` is `"true"`, per above): Does this repo need
  agent-driven `git push` and signed commits from this tool's Tool Container? (Adds
  deploy-key/signing-key automation — this tool registers and owns its own key pair, not shared
  with any other Tool Container that also has it enabled.)
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
- `{{TOOL_DISPLAY_NAME}}` — the tool's display name for the identity banner (step 6), matching its
  `devcontainer.json` `name` field exactly: `claude-code` → `Claude Code`, `codex` → `Codex`,
  `antigravity` → `Antigravity`, `copilot` → `Copilot`.
- `{{TOOL_NAME}}` — the tool's own folder/service slug (`claude-code`, `codex`, `antigravity`,
  `copilot` — the same value as `<tool>` throughout this skill). Only needed when substituting
  [templates/post-create-ssh-block.sh](templates/post-create-ssh-block.sh) (step 6), which is
  shared across every tool and needs it to name that tool's own SSH deploy/signing keys and
  volume distinctly from every other tool's.

## 5. Build or reuse the shared base image

`{{BASE_IMAGE_VERSION}}` is the bare, human-facing version string (`v1`,
`v2`, ...) — used only in the bump-confirmation prompt below and as the
first field of `.devcontainer/.base-image-version`. `{{BASE_IMAGE_HASH12}}`
is the first 12 hex characters of that file's second field (the content
sha256). Every actual Docker tag is **content-addressed, not just
version-addressed**: `{{BASE_IMAGE_TAG}}` is
`{{REPO_NAME}}-tool-container-base:{{BASE_IMAGE_VERSION}}-{{BASE_IMAGE_HASH12}}`,
and each tool's own tag in step 6 follows the identical `<version>-<hash12>`
shape.

This is deliberate, not decoration: a bare `v1`/`v2` tag is a mutable
pointer, and Docker will happily let a stale local image sit under it if any
run — this skill, an interrupted session resuming by hand, a person
hand-editing the generated files — ever writes `.base-image-version` (or the
`Dockerfile`/`docker-compose.yml` files that reference its tag) without also
re-running this step's `docker build`. Since step 6's Compose services
reference the tag via `image:`, never `build:` (see below), nothing else
would catch that mismatch at container-start time — the container would just
silently run whatever old content happens to already be tagged that way.
Suffixing every tag with the content hash makes that failure mode
structurally impossible: a tag whose hash doesn't match its Dockerfile's
current rendered content simply doesn't exist as a local image yet, so
Compose fails loudly (`Error response from daemon: No such image`) instead
of quietly starting stale content. Never truncate a tag's hash suffix to
fewer than 12 hex characters — that's what keeps two different renders of
`base.Dockerfile` (e.g. one with an unresolved `{{...}}` placeholder, one
without) from ever landing on the same tag by coincidence.

- If `.devcontainer/base.Dockerfile` doesn't exist yet — including a repo
  that has one in git history but deleted, uncommitted, from the working
  tree; treat that identically to never having existed, not as "unchanged":
  write it from [templates/base.Dockerfile](templates/base.Dockerfile),
  substituting `{{REPO_SLUG}}`, `{{LOCAL_CHECKOUT}}`,
  `{{LOCAL_CHECKOUT_GIT_INIT}}`, and `{{GIT_DEFAULT_BRANCH}}` (all from step
  1) — the baked-in Private Checkout clone script needs them to know whether
  to clone, `git init`, or leave the workspace bare. Set
  `{{BASE_IMAGE_VERSION}}` to `v1`, compute `{{BASE_IMAGE_HASH12}}` from the
  file just written (`sha256sum .devcontainer/base.Dockerfile`), and build
  it: `docker build -t {{BASE_IMAGE_TAG}} -f .devcontainer/base.Dockerfile .devcontainer`.
  Record the version and the *full* content hash (not truncated) into
  `.devcontainer/.base-image-version` as `<version> <sha256>`.
- If it already exists: compute the sha256 of
  [templates/base.Dockerfile](templates/base.Dockerfile)'s current rendered
  content and compare it to the hash recorded in
  `.devcontainer/.base-image-version`.
  - **Unchanged**: skip rebuilding. Use the version already recorded in
    `.devcontainer/.base-image-version` as `{{BASE_IMAGE_VERSION}}` and its
    hash's first 12 characters as `{{BASE_IMAGE_HASH12}}` — together they
    resolve `{{BASE_IMAGE_TAG}}` to the exact tag that should already be
    built (verified below, not assumed).
  - **Changed**: tell the user the shared base layer's template has changed
    and this would affect every Tool Container that extends it, and ask
    whether to bump the version (e.g. `v1` → `v2`) and rebuild. Never bump or
    rebuild silently.
    - **Confirmed**: overwrite `.devcontainer/base.Dockerfile`, compute the
      new full hash and its `{{BASE_IMAGE_HASH12}}`, build and tag the
      bumped version at `{{BASE_IMAGE_TAG}}`, update
      `.devcontainer/.base-image-version` with the new version and full
      hash, and use the new version as `{{BASE_IMAGE_VERSION}}`. A version
      bump also forces every already-generated tool's image to rebuild in
      step 6 (their tags embed the base's hash — see below), even though
      their own Dockerfiles didn't change.
    - **Declined**: leave `.devcontainer/base.Dockerfile` and the recorded
      version/hash untouched, and use the existing version as
      `{{BASE_IMAGE_VERSION}}` for this run's new tool(s).

Done when `.devcontainer/base.Dockerfile` exists, `docker image inspect
{{BASE_IMAGE_TAG}}` succeeds, and `.devcontainer/.base-image-version`
records that exact version alongside a full hash whose first 12 characters
are the hash suffix on the image you just confirmed exists — i.e. this step
is never "done" on a recorded version/hash alone; the tag they resolve to
has to actually be a local image, checked explicitly, not inferred.

## 6. Generate the compose file and each selected tool's folder

For **each newly selected tool** (`claude-code`, `codex`, `antigravity`, or `copilot`):

- `.devcontainer/<tool>/Dockerfile` ← [templates/<tool>/Dockerfile](templates/), substitute
  `{{BASE_IMAGE_TAG}}` with the tag resolved in step 5.
- **Build and tag this tool's own image**, at `{{TOOL_IMAGE_TAG}}` —
  `{{REPO_NAME}}-<tool>:{{BASE_IMAGE_VERSION}}-{{BASE_IMAGE_HASH12}}`, the
  same `<version>-<hash12>` shape as `{{BASE_IMAGE_TAG}}` and, today, the
  same hash12 too (every tool's Dockerfile is currently just `FROM
  {{BASE_IMAGE_TAG}}` with no content of its own — see the four templates —
  so it's byte-identical to the base image; if a tool's Dockerfile ever
  grows real content of its own, hash *that rendered file* instead, so its
  tag still changes whenever either the base or its own content does):
  `docker build -t {{TOOL_IMAGE_TAG}} -f .devcontainer/<tool>/Dockerfile .devcontainer`.
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
  answer was yes), substitute `{{REPO_NAME}}`, and write it. Both variants carry
  `onCreateCommand`, which runs `/usr/local/bin/clone-checkout.sh` (baked into
  the base image in step 5) to create this tool's Private Checkout — a fresh
  `git clone` into this tool's own named volume, not the host's checkout.
- `.devcontainer/<tool>/post-create.sh` — generated by
  [scripts/render-tool-container.sh](scripts/render-tool-container.sh), which assembles the fixed
  7-block template order (base identity setup, the identity banner, the shared install-cli skeleton,
  this tool's own install block, its yolo-alias block, and the SSH block pair) deterministically,
  chmod'ing the result +x:

  ```bash
  scripts/render-tool-container.sh \
    --tool <tool> --tool-name <tool> --tool-display-name "<TOOL_DISPLAY_NAME>" \
    --repo-name "{{REPO_NAME}}" --repo-slug "{{REPO_SLUG}}" \
    --out .devcontainer/<tool>/post-create.sh \
    [--ssh] [--yolo] \
    [--git-email-default "<value>"] [--git-name-default "<value>"]
  ```

  Pass `--ssh` / `--yolo` only when this tool's SSH / yolo answers (step 3) were yes. Pass
  `--git-email-default`/`--git-name-default` only when step 4 resolved an actual host default for
  that field — omit the flag entirely (don't pass an empty string) when step 4's `:?`-required case
  applies, since render treats "flag absent" as the signal to emit the hard-require line rather than
  a `-default` fallback. Verify the result with
  [scripts/verify-tool-container.sh](scripts/verify-tool-container.sh), passing it the exact same
  flags:

  ```bash
  scripts/verify-tool-container.sh \
    --file .devcontainer/<tool>/post-create.sh \
    --tool <tool> --tool-name <tool> --tool-display-name "<TOOL_DISPLAY_NAME>" \
    --repo-name "{{REPO_NAME}}" --repo-slug "{{REPO_SLUG}}" \
    [--ssh] [--yolo] [--git-email-default "<value>"] [--git-name-default "<value>"]
  ```

  The SSH block ([templates/post-create-ssh-block.sh](templates/post-create-ssh-block.sh)) never
  fails the build: an under-scoped or missing `GH_TOKEN` (or an unset `DEVCONTAINER_HOST`) degrades
  to skipping the rest of the SSH setup and recording why in `~/.ssh/.ssh-setup-skipped`, rather than
  aborting `postCreateCommand` — which would otherwise also skip every block concatenated after it.
  Registers this tool's own deploy/signing key pair on its own `{{REPO_NAME}}-<tool>-ssh` volume — no
  longer one shared pair per repo — and, on first run against a repo that still has the old
  shared-title deploy key registered, auto-removes it. Immediately after it, the warnings block
  ([templates/post-create-warnings-block.sh](templates/post-create-warnings-block.sh)) appends a
  snippet to `~/.bashrc` that surfaces any of this SSH layer's three standing warnings (setup
  skipped, signing key unregistered, deploy key missing on GitHub) at the top of every new terminal,
  not just once at attach — `postCreateCommand`/`postAttachCommand` each fire once per rebuild/attach,
  not per terminal tab.
- `.devcontainer/<tool>/post-start.sh` (every selected tool gets one — Claude Code, Codex,
  Antigravity, and Copilot all sync skills identically) ←
  [templates/<tool>/post-start.sh](templates/), substituted with that tool's own
  `{{SKILLS_SOURCES_COMMANDS}}` block from step 4 (using that tool's `-a` value, never another
  tool's). Always rewritten (even on an already-existing Tool Container) to ensure skill sync
  stays current.
- Make the new `.devcontainer/<tool>/*.sh` files executable: `chmod +x .devcontainer/<tool>/*.sh`.

Worth knowing before generating any tool's files: every vendor installer already verifies a
checksum or signed digest of its own download before installing, unconditionally — not only when a
version happens to be pinned. And Codex's Tool Container `capAdd`/`securityOpt` grant has two
distinct causes, not one: `SYS_ADMIN`/`seccomp=unconfined` satisfy Docker's own default seccomp/OCI
policy so Codex's Bubblewrap sandbox can create its namespace (not bubblewrap's own stated minimum
requirement, and a narrower grant is plausible but unverified), while `systempaths=unconfined` is a
separate fix for a distinct `/proc`-remount failure under Docker's default masked/read-only path
set. Both facts, and the rest of the per-tool caveats (Antigravity's keyring auth, Copilot's and
Claude Code's pin-revert history), get their full explanation in README.baseline.md's unconditional
"CLI installer notes" section instead of being appended ad hoc here — see the README backfill step
below, which covers them the same way it covers "YOLO aliases" and "Automatic skill sync".

If **any** newly or already-selected tool has the SSH answer yes:

- `.devcontainer/.env.example` gets [templates/env.ssh-block.example](templates/env.ssh-block.example) appended, idempotently, and its `GH_TOKEN` comment gets: `Required permissions: Administration (read/write) — needed to manage deploy keys — plus whatever else you use gh for.`

  ```bash
  scripts/patch-if-absent.sh append .devcontainer/.env.example "DEVCONTAINER_HOST=your-hostname-here" templates/env.ssh-block.example
  ```
- `.devcontainer/README.md` gets [templates/README.ssh-block.md](templates/README.ssh-block.md) appended, idempotently, and the baseline template's closing "SSH deploy key and signing key automation — Not set up here" section is deleted (superseded by the real section):

  ```bash
  scripts/patch-if-absent.sh append .devcontainer/README.md "## SSH deploy key and signing key" templates/README.ssh-block.md
  scripts/patch-if-absent.sh delete-section .devcontainer/README.md "## SSH deploy key and signing key automation"
  ```

If step 5 bumped `{{BASE_IMAGE_VERSION}}` (and so `{{BASE_IMAGE_HASH12}}`) this run (the
**Confirmed** branch), rebuild and retag **every already-existing tool's image** too, at its new
`{{TOOL_IMAGE_TAG}}` — same build command as above, run again for each tool that already has a
Tool Container even though none of its own files (Dockerfile, devcontainer.json, post-create.sh)
need rewriting (its rendered `Dockerfile` content still changes, since its `FROM` line embeds
`{{BASE_IMAGE_TAG}}`). Their Compose service's `image:` reference embeds the base's hash, so
without this their tag would point at an image that was never built.

Always (every run, regardless of which tools are new):

- `.devcontainer/docker-compose.yml` ← rebuilt from [templates/docker-compose.yml](templates/docker-compose.yml): concatenate every currently-selected tool's [templates/<tool>/compose-fragment.yml](templates/) (substituted `{{REPO_NAME}}`, `{{BASE_IMAGE_VERSION}}`, and `{{BASE_IMAGE_HASH12}}` — each fragment's `image:` line must resolve to that tool's exact `{{TOOL_IMAGE_TAG}}` from step 6, not just the bare version) under `services:`, and list one `{{REPO_NAME}}-<tool>-config:` volume line **and** one `{{REPO_NAME}}-<tool>-checkout:` volume line per selected tool, **plus** one `{{REPO_NAME}}-<tool>-ssh:` volume line per SSH-enabled tool (one per tool now, not one shared line for the whole repo), under `volumes:`. The checkout volume backs that tool's Private Checkout — the named volume `onCreateCommand`'s clone script populates, replacing the old shared bind mount. **Safely rebuild, don't hand-edit around**: since this file only ever holds what this skill generated, it's fine to regenerate it wholesale from the current set of selected tools each run — never drop an already-existing tool's service just because this particular run didn't ask about it again.
- `.devcontainer/post-attach.sh` ← [templates/post-attach.sh](templates/post-attach.sh), substituted. Every selected tool gets this and its `postAttachCommand` wiring — not just SSH-enabled ones — since it carries Private Checkout's staleness hint (a static reminder to `git fetch`, shown on every attach) unconditionally; the SSH-specific logic inside guards itself when that particular tool's SSH layer isn't enabled. Write once (identical content across every tool); `chmod +x` it.
- `.devcontainer/.env.example` ← [templates/env.baseline.example](templates/env.baseline.example), substituted, if it doesn't already exist.
- `.devcontainer/README.md` ← [templates/README.baseline.md](templates/README.baseline.md), substituted, if it doesn't already exist. If it already exists, update `{{SELECTED_TOOLS_SUMMARY}}`'s rendered value in place, and **backfill the "Automatic skill sync", "CLI installer notes", and "YOLO aliases" sections** (matching heading) from the current template if any is missing, inserting each at the same position it holds in the current template — a README from before these sections existed should end up with them added, not left stale. Render each with current values regardless of what's configured this run (e.g. `{{SKILLS_SOURCES_SUMMARY}}` renders as "none configured" when no source is set up), the same as the rest of the baseline template already does for tools that aren't selected — "CLI installer notes" in particular always documents all four tools regardless of which are selected this run, same convention "YOLO aliases" already uses. If a section is already present, leave it as-is — this backfill only inserts what's missing, it doesn't reconcile wording drift in a section that already exists (a pre-existing "CLI installer notes" section from before the Codex-rationale correction stays as it was; only a missing section gets today's wording). Render each candidate section's current content to a scratch file first (substituted, same as the rest of this step), then, **in this order** (YOLO aliases before CLI installer notes before Automatic skill sync, so each later insert's anchor is guaranteed present even backfilling into a README old enough to be missing all three):

  ```bash
  scripts/patch-if-absent.sh insert-before .devcontainer/README.md "## YOLO aliases" "## Gotchas fixed here (and why)" <rendered-yolo-aliases-section>
  scripts/patch-if-absent.sh insert-before .devcontainer/README.md "## CLI installer notes" "## YOLO aliases" <rendered-cli-installer-notes-section>
  scripts/patch-if-absent.sh insert-before .devcontainer/README.md "## Automatic skill sync" "## CLI installer notes" <rendered-skill-sync-section>
  ```
- Add `.devcontainer/.env` to `.gitignore` if it isn't already ignored.
- Remove `.claude/worktrees/` from `.gitignore` if a prior run of this skill added it (check for
  the exact line and delete it; leave every other line untouched). It existed only because
  `claude --worktree` used to create isolated git worktrees directly inside the *bind-mounted*
  `/workspace`, which the host saw as untracked noise in `git status` since the mount was the same
  filesystem, not container-isolated. Now that every Tool Container has its own Private Checkout,
  a worktree created inside one lives only in that tool's own volume — invisible to the host, so
  nothing to gitignore. This is a no-op for a fresh repo (the line was never added); for a repo
  migrating from before Private Checkout, this actively cleans it up.

Done when every file above exists, every tool's `devcontainer.json` parses as valid JSON
(`jq empty .devcontainer/<tool>/devcontainer.json`) with a non-null `onCreateCommand`
(`jq -e '.onCreateCommand' .devcontainer/<tool>/devcontainer.json`), `docker-compose.yml` parses
as valid YAML with exactly one service per selected tool and one `{{REPO_NAME}}-<tool>-checkout:`
volume line per selected tool (plus one `{{REPO_NAME}}-<tool>-ssh:` line per SSH-enabled tool),
every selected tool's image actually exists at the exact tag its Compose service references
(`docker image inspect {{TOOL_IMAGE_TAG}}` succeeds for each — this is the check that actually
catches a stale/never-rebuilt image, since with content-addressed tags "inspect succeeds" and
"content matches what's on disk" are the same fact), the clone-checkout script landed executable
in the base image
(`docker run --rm {{BASE_IMAGE_TAG}} test -x /usr/local/bin/clone-checkout.sh`),
every with-ssh `devcontainer.json`'s `mounts` entry references *that tool's own* SSH volume (not
another tool's, and not a stale shared name), no `{{...}}` placeholder remains in any written file
(`grep -rn '{{' .devcontainer/`), and every selected tool's `post-create.sh` passes
[scripts/verify-tool-container.sh](scripts/verify-tool-container.sh) for the exact flags it was
rendered with (stronger than the blanket `{{` grep above: also checks the right blocks landed for
this tool's ssh/yolo combination and that the git-identity lines took the right shape).

Runtime behavior — the clone actually succeeding, SSH keys actually registering, the staleness
hint actually appearing — is intentionally **not** part of this per-run check; it can only be
confirmed by actually attaching a container, same scope boundary this checklist already draws for
skill-sync and yolo-alias behavior. Cross-container isolation (two Tool Containers' Private
Checkouts genuinely independent of each other) is a one-time sanity check worth doing yourself the
first time you use more than one tool in a repo, not something to re-verify on every subsequent
`setup-devcontainer` run — see the README's "Running tools concurrently" section.

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
   Key, then `touch ~/.ssh/.signing-key-registered`. Do this **once per
   SSH-enabled Tool Container** — each tool has its own key pair and its own
   registration marker now, so this doesn't carry over between tools.}}
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

For a repo that already has Tool Container(s) from a prior run of this skill and now wants an
additional tool. See [docs/adding-tool-later.md](docs/adding-tool-later.md).

## Adding SSH to a tool later

For a tool that already has a Tool Container and now needs agent-driven `git push` / signed
commits. See [docs/adding-ssh-later.md](docs/adding-ssh-later.md).

## Migrating a Tool Container to Private Checkout

For a tool whose `devcontainer.json` predates Private Checkout (step 2's detection: no
`onCreateCommand`) — moving it from the old shared bind-mounted workspace to its own isolated
clone, opt-in per tool, never automatic. See
[docs/migrating-private-checkout.md](docs/migrating-private-checkout.md).

## Connecting a Local Checkout to a real GitHub repo

For a repo generated as Local Checkout (step 1) that now has a real GitHub repository to push
to. Needs no skill-level regeneration — see
[docs/connecting-local-checkout.md](docs/connecting-local-checkout.md).
