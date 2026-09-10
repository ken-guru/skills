# Research: does the Dev Containers ecosystem already solve this repo's problem?

Ticket: [#237](https://github.com/ken-guru/skills/issues/237), feeding map [#236](https://github.com/ken-guru/skills/issues/236).

**Problem restated**: N Tool Containers (one per AI CLI) must run concurrently against one
host repo, each isolated from the others' uncommitted edits/branches (Cross-Container
Leakage), while still seeing the *current* host workspace state (respecting `.gitignore`)
without requiring a `git push` to `origin` first.

## Verdict

**No.** The Dev Containers ecosystem has standard answers to two *adjacent* problems, but not
to this repo's actual combined problem:

- **Isolation from the host bind mount**: yes — VS Code's own "Clone Repository in Container
  Volume" feature. But it works exactly like this repo's Private Checkout already does: it
  clones **from a git remote**, not from host state. It does not solve "see uncommitted host
  changes without a push" — it has the identical limitation this ticket exists to fix.
- **Running multiple containers against one workspace concurrently**: yes, via Docker Compose
  (which this repo already uses) — but VS Code's own docs describe this as multiple
  *bind-mount* containers in separate windows, which is the Shared Checkout model this repo
  deliberately moved away from. Compose itself has no isolation feature; isolation is
  something you layer on by giving each service its own volume (i.e., what Private Checkout
  already does).
- **One-shot, `.gitignore`-aware copy of host state into a volume**: not found anywhere in the
  spec, VS Code docs, or this repo's own prior research. Nothing standard does this.

So: the ecosystem confirms Private Checkout's clone-into-named-volume shape *is* the standard
isolation pattern (VS Code ships the same idea as a first-class feature) — but neither the
spec nor VS Code offer any standard primitive for the specific gap this repo hit: getting
**current, possibly-uncommitted, gitignore-respecting host state** into an isolated volume
without a push. That part is not "ecosystem practice this repo missed" — it appears to be
genuinely uncovered territory, and if this repo builds it, it would be building something the
ecosystem doesn't otherwise provide.

## 1. What the spec says about workspace delivery

Source: [containers.dev implementors/json_reference](https://containers.dev/implementors/json_reference/)

> **workspaceMount**: "Requires `workspaceFolder` be set as well. Overrides **the default
> local mount point** for the workspace when the container is created. Supports the same
> values as the Docker CLI `--mount` flag. Environment and pre-defined variables may be
> referenced in the value."

> **workspaceFolder**: "Requires `workspaceMount` be set. Sets the default path that
> `devcontainer.json` supporting services / tools should open when connecting to the
> container. Defaults to the automatic source code mount location."

The word "overrides" confirms there **is** a default local mount point that exists without
any configuration — i.e., bind-mounting the host workspace folder is the spec's own default
behavior when nothing custom is set, and `workspaceMount` exists precisely to replace that
default with something else (such as a named volume).

Source: [containers.dev implementors/spec](https://containers.dev/implementors/spec/), Mounts
section:

> "A default mount should be included so that the source code is accessible from inside the
> container."

The spec does not go further to describe the default's exact mechanics (bind vs. volume,
consistency flags) — that's left to the implementing tool. VS Code's own docs fill that gap
(see §2): its default, when you "open a folder in a container," is a bind mount.

Lifecycle commands relevant to content delivery, all from the same
[json_reference](https://containers.dev/implementors/json_reference/) page:

> **onCreateCommand**: "This command is the first of three (along with `updateContentCommand`
> and `postCreateCommand`) that finalizes container setup when a dev container is created."
> Executes inside the container after it starts for the first time.

> **updateContentCommand**: "This command is the second of three that finalizes container
> setup when a dev container is created." Runs "whenever new content is available in the
> source tree during the creation process."

> **initializeCommand**: executes "on the **host machine** during initialization, including
> during container creation and on subsequent starts." "⚠️ The command is run wherever the
> source code is located on the host. For cloud services, this is in the cloud."

None of these is a content-delivery mechanism in its own right — they're hooks a project can
fill with its own script (which is exactly what this repo already does with
`onCreateCommand` running `clone-checkout.sh`). The spec does not define any built-in
"copy host state into the container, respecting `.gitignore`" primitive; that would have to
be custom scripting inside one of these hooks regardless of which overall approach is chosen.

## 2. VS Code's own multi-container / isolated-volume guidance

Source: [code.visualstudio.com/docs/devcontainers/containers](https://code.visualstudio.com/docs/devcontainers/containers)

**Default is a bind mount**: "Workspace files are mounted from the local file system or
copied or cloned into the container." For the ordinary "open an existing folder in a
container" flow, that default is a bind mount of the local checkout.

**VS Code already ships an isolation feature that matches this repo's Private Checkout
shape almost exactly** — "Clone Repository in Container Volume," triggered via **"Dev
Containers: Clone Repository in Container Volume..."** in the Command Palette:

> "You may want to work with an isolated copy of a repository for a PR review or to
> investigate another branch without impacting your work. Repository Containers use
> isolated, local Docker volumes instead of binding to the local filesystem."

> "In addition to not polluting your file tree, local volumes have the added benefit of
> improved performance on Windows and macOS."

This is the ecosystem's own version of Private Checkout: clone from a git remote/PR into a
named Docker volume instead of bind-mounting the host folder. Its stated rationale is
**performance and not polluting the host file tree for PR review**, not Cross-Container
Leakage prevention specifically — but the mechanism is identical: it clones from the remote,
so it inherits the exact same limitation this ticket is about. It does not, and by design
cannot, deliver uncommitted host-side changes into that volume — you'd still need to push
first. This is strong evidence that "isolate via clone-into-volume" is the ecosystem-standard
shape for isolation, and equally strong evidence that the ecosystem has never solved "and
also see uncommitted host state" for that same isolated-volume model — VS Code's own built-in
feature has the identical gap.

**Multiple concurrent containers on one workspace**: 

> "While you cannot use multiple containers for the same workspace in the same VS Code
> window, you can use multiple Docker Compose managed containers at once from separate
> windows."

This is the sanctioned mechanism for "N containers, 1 workspace, concurrently" — and it is
exactly the Docker Compose approach this repo already uses (one service per Tool Container).
But note what it actually promises: it says *multiple windows can each attach to a Compose
service*, not that Compose provides any isolation between what those services see. Isolation
across services sharing a Compose file is still something each service's own volume
configuration has to provide — which is exactly the job Private Checkout already does. VS
Code's Compose guidance validates the *shape* of this repo's setup (Compose, one service per
tool) without offering anything new on the "deliver current host state without a push"
question.

**Gitignore-aware host-state copy-in**: no such primitive is documented anywhere in this
page or the linked "Advanced Configuration / Improve disk performance" material fetched
during this research. Nothing in VS Code's docs describes a one-shot, gitignore-respecting
copy of host content into a volume distinct from either a live bind mount or a git clone.

## 3. Seeding from host state respecting `.gitignore`

No standard, documented primitive exists for this in the spec or in VS Code's docs (see §2).
The closest built-in mechanisms are:

- A **bind mount** (live, not gitignore-aware — it mirrors everything, gitignored or not, and
  is exactly the Shared Checkout model this repo rejected for leakage reasons).
- A **git clone** (gitignore-irrelevant since it only ever sees committed content, and only
  what's been pushed — VS Code's own volume-clone feature and this repo's Private Checkout
  both work this way).

There is no third built-in option. A "copy host state into a volume, respecting
`.gitignore`, once at creation time" mechanism would be custom scripting (e.g., `rsync
--filter=':- .gitignore'` or `git archive`/`git stash create` tricks run from
`initializeCommand` on the host, writing into the container's volume) regardless of which
path this repo picks — the ecosystem does not ship this as a feature to adopt instead of
building it.

## 4. What this repo already tried/considered/rejected

Read in full: [#170](https://github.com/ken-guru/skills/issues/170) (the Private Checkout
map), [#171](https://github.com/ken-guru/skills/issues/171),
[#172](https://github.com/ken-guru/skills/issues/172),
[#173](https://github.com/ken-guru/skills/issues/173),
[#174](https://github.com/ken-guru/skills/issues/174),
[#180](https://github.com/ken-guru/skills/issues/180),
[#111](https://github.com/ken-guru/skills/issues/111) (research), and PR
[#181](https://github.com/ken-guru/skills/pull/181) (the implementation).

**#170's chartering** states the destination plainly: "A spec for replacing every Tool
Container's shared bind-mounted `/workspace` (Shared Checkout) with its own persistent,
isolated on-disk git clone (Private Checkout) — cloned from `origin` only, default and
uniform across all tools — so no Tool Container can read another's uncommitted work,
in-progress branches, or `claude --worktree` worktrees (Cross-Container Leakage)." The
settled-scope bullets in that same ticket state: "Each Private Checkout clones from `origin`
**only** — no host-state leakage — via the existing baseline `GH_TOKEN`/`gh auth
setup-git` HTTPS credential helper" and "Private Checkouts do **not** auto-sync with each
other or `origin` — manual `git fetch`/`pull` only, at most a staleness hint."

**No mention anywhere in #170–#181 of VS Code's "Clone Repository in Container Volume"
feature, or of any `workspaceMount`-based alternative, or of Docker Compose patterns beyond
what #109/#111 already established.** The clone-vs-bind-mount decision was framed and
resolved entirely in-house, as a security/leakage property ("no Tool Container can read
another's uncommitted work"), not as a comparison against ecosystem precedent. The chosen
design (git-clone-per-container into a named volume, via `onCreateCommand`) independently
converges on the same shape as VS Code's own built-in feature — but that convergence appears
to be coincidental, not the result of having found and adopted that feature.

**#111 ("Research: concurrent multi-devcontainer feasibility")** is this repo's one prior
piece of ecosystem research, and it did look at exactly the multi-container question. Its
own question text: "Can multiple devcontainers run concurrently against the same repo
checkout... Whether a docker-compose-based approach... allows genuinely concurrent,
independently-attachable containers." This is the ticket that established Compose as the
mechanism — consistent with what VS Code's own docs confirm in §2 above — but #111 predates
Private Checkout (#170) by a separate map and its question was scoped to "can they run
concurrently at all," not "how do they get isolated content." It did not investigate content
delivery/isolation mechanisms, only concurrent-attach feasibility.

**#173 ("Design the Private Checkout creation and staleness-hint flow")** is the ticket that
came closest to this exact pain point pre-emptively — it explicitly designed a "staleness
hint" ("no auto-fetch... where it surfaces (e.g. `postAttachCommand` terminal banner)... what
triggers it, and its wording") precisely because the team already knew Private Checkouts
"do not auto-sync... manual `git fetch`/`pull` only." That is: the team foresaw staleness as
a byproduct of the clone-only design and mitigated it with a *hint*, not a fix — the actual
failure mode that triggered #236/#237 (needing a push **and** a manual volume deletion to
force a refresh) was a known, accepted tradeoff at design time, not an oversight.

**#180 (migration path)** confirms the same one-way, clone-only mental model applies to
migrating existing repos too — no alternative content-delivery approach considered there
either.

## Sources consulted

- https://containers.dev/implementors/json_reference/
- https://containers.dev/implementors/spec/
- https://code.visualstudio.com/docs/devcontainers/containers
- `gh issue view 170/171/172/173/174/180/111 --repo ken-guru/skills`
- `gh pr view 181 --repo ken-guru/skills`
- `gh issue view 236/237 --repo ken-guru/skills`
- `/Users/ken/Workspace/ken-guru/skills/skills/setup-devcontainer/CONTEXT.md`
- `/Users/ken/Workspace/ken-guru/skills/skills/setup-devcontainer/docs/migrating-private-checkout.md`
