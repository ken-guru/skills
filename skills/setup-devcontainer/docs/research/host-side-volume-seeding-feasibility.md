# Host-side volume seeding feasibility — research input

Serves [issue #238](https://github.com/ken-guru/skills/issues/238). **This document is
research legwork, not a decision.** It gathers primary-source facts about one candidate
mechanism — copying the host's current working tree (including uncommitted changes,
`.gitignore`-respecting) into each Tool Container's private named volume from the host side,
via `initializeCommand`, before the container starts — so a future session/maintainer can
adopt, amend, or reject it. Nothing here changes `setup-devcontainer`'s behavior on its own.
It does not evaluate whether this mechanism is the *right* fix for the Private Checkout
staleness pain (a separate, concurrent research pass on ecosystem conventions, issue #237,
covers that framing) — only whether it *works*.

Research date: 2026-09-10. All URLs below were fetched live on that date; vendor/spec docs
are living pages and can change without notice. `WebSearch` was unavailable for most of this
session (returned "tool unavailable" on repeated attempts after the first two calls); findings
below rely on direct `WebFetch` of primary sources plus the small number of search results that
did come back, and gaps caused by this are flagged explicitly rather than papered over.

---

## Verdict

**The mechanism is technically sound in its core shape, with one real gap (cross-platform
shell assumption) and one component that needs to deviate from the "obvious" recipe (`.git`
handling, and to a lesser extent the exact copy tool).** It is buildable today. Concrete recipe:

1. **Hook:** `initializeCommand` in each per-tool `devcontainer.json`. Per the containers.dev
   spec's own phase ordering, `initializeCommand` executes during the **Initialization** phase,
   which is a distinct, earlier phase than **Image Creation** (where "Pull/build/execute of the
   defined container orchestration format to create images" happens) and **Container Creation**
   — i.e. it is guaranteed to run and complete *before* `docker compose` ever touches the
   service or its volumes ([containers.dev implementors/spec](https://containers.dev/implementors/spec/),
   primary). This resolves the ordering worry in Question 1 directly: there is no race between
   a host-side pre-seed and compose's own lazy volume creation, because the pre-seed step
   finishes first, by spec-defined sequencing, not by luck.

2. **Race/conflict with compose's lazy volume creation — also resolved, by Docker's own
   documented behavior**, not just the ordering: Docker Compose only creates a named volume "if
   it doesn't already exist. Otherwise, the existing volume is used"
   ([Docker Compose file reference, `volumes` top-level element](https://docs.docker.com/reference/compose-file/volumes/),
   primary). So the recipe is: in `initializeCommand`, run `docker volume create <name>`
   (idempotent) then, only if that volume is still empty, populate it via a throwaway helper
   container. When compose later starts the service, it finds a volume that already exists and
   reuses it as-is — it does not wipe or re-populate it. (Docker's separate note that mounting
   an *empty* volume into a container with existing content at the mountpoint triggers an
   auto-copy — [Docker Engine storage docs, "Populate a volume using a container"](https://docs.docker.com/engine/storage/volumes/)
   — is the mechanism that would apply if the volume were still empty when compose starts it;
   pre-seeding first means that auto-copy path is simply never triggered, avoiding any
   ambiguity about which content wins.)

3. **Copy tool + recipe, host side, run from inside `initializeCommand`:**
   ```sh
   docker volume create <vol> >/dev/null
   # only seed if empty — cheap, idempotent, avoids clobbering a volume from a prior run
   if [ -z "$(docker run --rm -v <vol>:/dest alpine sh -c 'ls -A /dest')" ]; then
     git -C "${localWorkspaceFolder}" ls-files -z --cached --others --exclude-standard \
       | tar --null -T - -cf - -C "${localWorkspaceFolder}" \
       | docker run --rm -i -v <vol>:/dest alpine sh -c 'tar -xf - -C /dest'
   fi
   ```
   This is Docker's own officially documented pattern for moving data into/out of a named
   volume via a throwaway helper container with `-v` mounts and `tar`
   ([Docker Engine storage docs, "Back up, restore, or migrate data volumes"](https://docs.docker.com/engine/storage/volumes/#back-up-restore-or-migrate-data-volumes),
   primary, showing the `docker run --rm -v ... ubuntu tar cvf/xvf ...` idiom this recipe
   adapts). `alpine` is sufficient for the container side (`tar` and `sh` are present in
   Alpine's base) — no extra install needed inside the throwaway container. The file *selection*
   is done by `git ls-files` on the **host**, not by rsync or any reimplementation of
   `.gitignore` semantics inside the container — see Question 2 for why this is the more
   correct choice than rsync's gitignore-style filters.

4. **`.git` handling: do NOT copy the host's live `.git` directory verbatim.** Keep the
   existing in-container `gh auth setup-git && git clone` (or an in-container `git init` +
   `git remote add` + fetch) as the source of the container's own `.git`, and use the host-side
   copy only for the *working-tree content* (tracked + untracked-non-ignored files, per the
   `git ls-files` invocation above), copied on top of that clone/init. See Question 3 for the
   concrete, primary-source-grounded reasons a raw `.git` copy is unsafe (lock files,
   in-progress merge/rebase state, git's own admitted lack of a complete concurrent-access
   story). This does mean the recipe is a *hybrid* of today's clone mechanism (for `.git`) and
   the new host-copy mechanism (for working-tree content layered on top) — not a full
   replacement of the clone step.

5. **Performance, at this repo's measured scale, is a non-issue** (Question 4): 17 MB / 246
   tracked files, one-time, local-disk-to-local-disk. Even accounting for Docker Desktop's
   virtualized-filesystem overhead on macOS/Windows, this is a sub-few-seconds operation,
   comparable to or faster than a network clone.

6. **The real gap is cross-platform (Question 5): `initializeCommand`, given as a plain
   string (as this repo's devcontainer.json templates already do), is specified to run in
   `/bin/sh`** ([containers.dev implementors/json_reference](https://containers.dev/implementors/json_reference/),
   primary — quoted below). `/bin/sh` is not native to a bare Windows host without WSL2; this
   repo's own existing `initializeCommand` (the `.env` bootstrap line) already implicitly
   depends on this today, so the *general* risk isn't new, but a Docker-CLI-invoking recipe
   raises the stakes (a failure here isn't a missing `.env` file, it's a container that starts
   from an unseeded/partially-seeded volume). This wasn't resolvable to full primary-source
   certainty in this pass — see Question 5 and Open Questions.

**If this doesn't hold up under further scrutiny, the load-bearing places to re-check first**
are: (a) whether VS Code's Dev Containers *extension* (not just the `devcontainers/cli` spec)
actually honors the spec's phase ordering in the compose path specifically — the spec is clear,
but this research did not find a maintainer-confirmed statement or changelog entry pinning the
extension's compose-path behavior to it (see Open Questions); and (b) exact Windows-native
(non-WSL2) behavior of `initializeCommand`, which this research could not confirm from a
primary source either way.

---

## Question 1: Can `initializeCommand` populate a named volume before compose creates it?

**Yes, by spec-defined phase ordering, with the extension-implementation caveat noted above.**

- The containers.dev implementors' spec lays out dev container creation as an explicit ordered
  sequence of phases: **Initialization → Image Creation → Container Creation → Post Container
  Creation.** The Initialization phase's own bullet list is: "Validate access to the container
  orchestrator specified by the configuration. Execution of `initializeCommand`." Image Creation
  is described as "Pull/build/execute of the defined container orchestration format to create
  images" — i.e. this is where `docker compose` itself gets invoked. Container Creation is
  "Create the container(s) based on the properties specified above."
  ([containers.dev implementors/spec](https://containers.dev/implementors/spec/), primary,
  fetched directly.) Because `initializeCommand` is scoped to the *first* phase and compose
  invocation is scoped to the *second*, a host-side `docker volume create` + populate step run
  from `initializeCommand` is guaranteed to finish before compose ever runs — not a race.
- Separately, `initializeCommand`'s own reference entry: "A command string or list of command
  arguments to run on the **host machine** during initialization, including during container
  creation and on subsequent starts," with an explicit warning: "The command is run wherever the
  source code is located on the host. For cloud services, this is in the cloud."
  ([containers.dev implementors/json_reference](https://containers.dev/implementors/json_reference/),
  primary.) This confirms host-side execution (so a local Docker CLI is reachable, the same CLI
  the Dev Containers tooling itself needs installed) and — notably for a script relying on
  idempotency — that it can run again "on subsequent starts," not just once at creation. The
  recipe above is already written idempotently (empty-check before seeding) for exactly this
  reason.
- Docker Compose's own volume-creation behavior is lazy and non-destructive of existing content:
  "Running `docker compose up` creates the volume if it doesn't already exist. Otherwise, the
  existing volume is used." ([Docker Compose file reference — `volumes` top-level element](https://docs.docker.com/reference/compose-file/volumes/),
  primary.) This is what makes "pre-create and pre-seed, then let compose start normally" safe:
  compose does not truncate or re-populate a volume that's already there.
- Docker's own "populate a volume using a container" behavior — auto-copying a target
  directory's contents into an empty volume the first time it's mounted — is documented at
  [Docker Engine storage docs, "Populate a volume using a container"](https://docs.docker.com/engine/storage/volumes/),
  primary. This is the mechanism that *would* have been a live concurrency concern (does
  compose's own container-start-time mount trigger a second, conflicting auto-copy from the
  image's `/workspace` layer, if any exists there?) — but since the recipe seeds the volume
  before compose ever starts the container, this auto-copy path (which only fires against an
  *empty* volume) never triggers a second time.
- **Real-world prior art / community confirmation found:** searches turned up
  [`h4l/dev-container-docker-compose-volume-or-bind`](https://github.com/h4l/dev-container-docker-compose-volume-or-bind)
  (secondary — a community template, not vendor-official) as a genuine example of
  `initializeCommand` driving host-side setup logic ahead of a compose-based devcontainer, but
  on inspection it does *not* populate a volume with copied content — it generates environment
  variables that let one compose file conditionally bind-mount vs. volume-mount the workspace,
  which is a different technique addressing a different problem. No third-party example was
  found that does exactly "host-side copy of file content into a named volume via
  `initializeCommand`" end-to-end; the recipe above is synthesized from the primary Docker/spec
  building blocks above, not copied from a proven full example. Flagged as an open question
  below (untested against real VS Code Dev Containers extension behavior in this pass).
  [`devcontainers/spec` discussion #104](https://github.com/devcontainers/spec/discussions/104),
  which looked promising by title ("options to use dev containers with named volume"), turned
  out to be a single unanswered post with no maintainer engagement and no working recipe — not
  useful as confirmation either way.
  [`microsoft/vscode-remote-release` issue #7366](https://github.com/microsoft/vscode-remote-release/issues/7366)
  reports a *related* ordering complaint (a user's `initializeCommand`-generated `.env` file
  wasn't available in time for `docker-compose config` validation in the VS Code extension,
  though it worked correctly via the standalone `devcontainer` CLI) — this is a secondary data
  point suggesting the VS Code *extension's* compose-path timing has, at least once, diverged
  from the spec's clean phase ordering in practice, even though the CLI's did not. It was closed
  as needing more information, with no maintainer confirmation of root cause visible in this
  pass. This is the single piece of evidence in this research that argues for validating the
  ordering guarantee empirically (a real prototype) rather than trusting the spec text alone for
  the VS Code-extension code path specifically, as opposed to the `devcontainers/cli` path.

---

## Question 2: What tool correctly respects `.gitignore` for a working-tree copy?

**`git` itself, via `git ls-files --cached --others --exclude-standard`, is the most correct
choice — not rsync, and not `git archive`.**

- **`git archive` is disqualified outright for capturing uncommitted state.** Its synopsis takes
  a `<tree-ish>` argument, and its description is explicit: "Creates an archive of the specified
  format containing the tree structure for the named tree." It operates on committed objects
  (commits/trees/tags), not the working tree directly.
  ([git-scm.com/docs/git-archive](https://git-scm.com/docs/git-archive), primary.)
- **The `git stash create` + `git archive` combo (a real technique for the *tracked, committed*
  portion of working-tree state) has the documented gotcha the task description anticipated, and
  it's worse than just "needs a flag":** `git stash create`'s full synopsis is `git stash create
  [<message>]` — it accepts **no other options at all**, not `--include-untracked`/`-u`, not
  anything. Those flags exist only on `git stash push`/`git stash save`.
  ([git-scm.com/docs/git-stash](https://git-scm.com/docs/git-stash), primary — synopsis lines
  for `create`, `push`, and `store` confirmed directly.) There is also no clean two-step
  workaround: `git stash push --include-untracked` both stashes *and* runs the equivalent of
  `git clean` on untracked files as part of stashing them, mutating the working tree, and it
  already stores the stash in the ref namespace itself (making a separate `git stash store` step
  redundant and not "non-mutating"). So "uncommitted + untracked + gitignore-respecting, without
  disturbing the host's working tree or stash list" is **not achievable via `git stash
  create`/`git archive` at all** — this rules out that whole approach, not just complicates it.
- **`git ls-files --cached --others --exclude-standard` is the correct, git-native file-set
  resolver, and it's what the recipe in the Verdict uses.** Per primary docs: `--others` "Show
  other (i.e. untracked) files in the output"; `--exclude-standard` "Add the standard Git
  exclusions: `.git/info/exclude`, `.gitignore` in each directory, and the user's global
  exclusion file" — explicitly covering all three tiers gitignore precedence has (per-directory
  `.gitignore`, repo-local `.git/info/exclude`, and `core.excludesFile`/global excludes,
  confirmed via [git-scm.com/docs/gitignore](https://git-scm.com/docs/gitignore), primary).
  Because this is git's own exclusion-resolution engine doing the filtering — not a
  reimplementation — it cannot diverge from git's own gitignore semantics by construction. The
  docs also note `--exclude-standard` is the recommended way to "emulate the way Porcelain
  commands work" — i.e. it's the same logic `git status`/`git add .` use.
  ([git-scm.com/docs/git-ls-files](https://git-scm.com/docs/git-ls-files), primary.) `-z`
  (NUL-terminated, unquoted output) makes the file list safe to pipe into `tar -T -` /
  `cpio` regardless of filenames containing spaces or unusual characters — confirmed in the same
  doc's OUTPUT section. Note this lists file *names*, and (for `--cached` entries) the *current
  working-tree content* is what gets read when `tar` opens each path — so a modified-but-not-yet-
  staged tracked file is still captured with its current (uncommitted) content, which is exactly
  the "uncommitted changes" requirement.
- **rsync's `--filter=':- .gitignore'` (or `-C`/CVS-exclude mode) is a real, documented feature,
  but it is rsync's own reimplementation of gitignore-*like* semantics, not git's** — the rsync
  manpage documents a `-C`/CVS-exclude mode "for ignoring the same files that CVS would ignore,"
  and per-directory merge-file filtering syntax including the `:-`/`:C` idiom
  ([rsync(1) manpage](https://download.samba.org/pub/rsync/rsync.1), primary, fetched directly
  — though the fetched excerpt did not fully spell out precedence-ordering details or confirm
  whether it reads `.git/info/exclude` or `core.excludesFile` automatically; this is flagged as
  **not fully confirmed** rather than asserted either way). What is not in question, though, is
  the structural point the task anticipated: rsync's filter engine is a general-purpose,
  CVS-heritage exclusion mechanism that happens to accept `.gitignore`-shaped pattern files — it
  is not literally invoking git's own exclusion resolver, so any edge case where git's actual
  precedence rules (documented at
  [git-scm.com/docs/gitignore](https://git-scm.com/docs/gitignore), primary: command-line
  patterns highest, then nested `.gitignore` files high-to-low, then `.git/info/exclude`, then
  `core.excludesFile` lowest, with last-match-wins within a tier) diverge from rsync's own filter
  semantics is a latent correctness bug that `git ls-files` cannot have by construction.
- **Practicality for a throwaway helper-container context:** the recipe above does the
  git-aware part (`git ls-files`) on the **host**, where the real git binary and the real
  repository/config already are — this sidesteps the "does the throwaway container need git
  installed" question entirely. The throwaway container (`alpine`) only needs to run `tar`,
  which ships in Alpine's base image, so no extra package install step is needed inside it.

---

## Question 3: How should `.git` be handled?

**Do not copy the host's live `.git` directory. Keep an in-container clone (or init) as the
source of `.git`; layer the host-copied working-tree content on top of it.**

- **Git's repository layout docs confirm the structural building blocks that make a raw
  filesystem copy of a *live* `.git` risky**, though the specific page fetched
  ([git-scm.com/docs/gitrepository-layout](https://git-scm.com/docs/gitrepository-layout),
  primary) did not itself enumerate `index.lock`/`MERGE_HEAD`/`rebase-merge/` in the excerpt
  retrieved — it did confirm the `hooks/` directory's purpose ("Hooks are customization scripts
  used by various Git commands... This directory is ignored if `$GIT_COMMON_DIR` is set") which
  is directly relevant: a copied `hooks/` directory could contain scripts with host-only
  absolute paths or host-installed-tool dependencies that silently fail or behave differently
  inside the container.
- **`MERGE_HEAD` — confirmed via `git-merge` docs (primary,
  [git-scm.com/docs/git-merge](https://git-scm.com/docs/git-merge)):** "The `MERGE_HEAD` ref is
  set to point to the other branch head" during a merge, and its presence is what a subsequent
  `git commit` checks to know "whether there is an (interrupted) merge in progress"; resolving
  it requires either `git merge --continue` or `git merge --abort`. If a host happens to be
  mid-merge (or mid-rebase, mid-cherry-pick — same category of state, tracked via
  `rebase-merge/`/`CHERRY_PICK_HEAD`, not independently re-confirmed against a primary doc in
  this pass, flagged below) at the moment `initializeCommand` fires, copying `.git` verbatim
  would carry that interrupted-operation state into a container the user never asked to
  continue that operation in — a confusing, unintended side effect a fresh `git clone` (today's
  mechanism) structurally cannot have, since a fresh clone has no merge/rebase history at all.
- **Lock files and concurrent-access safety are a real, git-acknowledged soft spot, not
  something this research is overstating.** `git gc`'s own docs state plainly: "these features
  fall short of a complete solution, so users who run commands concurrently have to live with
  some risk of corruption (which seems to be low in practice)"
  ([git-scm.com/docs/git-gc](https://git-scm.com/docs/git-gc), primary, NOTES section). That's
  git's own maintainers describing residual risk from *git commands run concurrently with each
  other* — a raw filesystem `cp`/`tar` of `.git` while the host might be mid-write (e.g.
  `index.lock` present because some other git process, or an editor's git integration, is
  actively writing) is a strictly less-safe operation than two git processes coordinating via
  git's own locking convention, since a filesystem copy has no awareness of `.lock` files at
  all — it would simply copy a stale or in-progress lock file into the container, or copy a
  torn/partially-written object.
- **Net effect on the "independent commit/push ability per container" requirement:** keeping the
  clone-based `.git` (today's mechanism) preserves exactly the property called out in the task
  background — each container gets its own independent clone, own remote-tracking state, no
  shared locks with the host or with other containers. Layering host-copied working-tree content
  on top of that clone (overwriting tracked files with their current-on-host content, adding
  untracked-non-ignored files) gives the *contents* freshness this mechanism is meant to solve,
  without inheriting the host's live, potentially-mid-operation `.git` state. One second-order
  consequence worth flagging: after the overlay, `git status` inside the container will
  correctly show the host's uncommitted changes as uncommitted (since the clone's index reflects
  a clean checkout and the overlaid files now differ from it) — which is the desired behavior,
  matching what a user would see if they'd made those edits directly in a bind-mounted
  container.

---

## Question 4: Performance, at this repo's scale

**Practically a non-issue at this repo's current size; grounded in this repo's own numbers.**

- Tracked-file size (tighter measurement than the task's `du -sh .` upper bound, run in this
  repo): `git ls-files | xargs du -ch | tail -1` → **17M total, 246 files.**
- `.git` pack size (from background, already measured): ~26 MB packed, 324 loose+packed objects.
- **Host-side copy cost:** 17 MB across 246 files, local disk to local disk (through a Docker
  Desktop bind-mount/volume bridge on macOS/Windows, or directly on Linux). Even with Docker
  Desktop's documented file-sharing overhead — "File sharing introduces overhead as any changes
  to the files on the host need to be notified to the Linux VM," with VirtioFS on macOS having
  "reduced the time taken to complete filesystem operations by up to 98%" relative to the older
  backend ([Docker Desktop settings/file-sharing docs](https://docs.docker.com/desktop/settings-and-maintenance/settings/),
  primary) — 246 small-to-medium files at 17 MB total is well within "a few seconds at most" for
  any modern host, dominated more by fixed per-container-startup latency (pulling/starting the
  `alpine` helper image once, then reusing its cached layers on subsequent runs) than by byte
  count.
- **Clone cost, for comparison:** a `git clone` of a repo this size over HTTPS from GitHub
  transfers roughly the pack size (~26 MB, likely less after GitHub's own server-side pack
  optimization for a shallow or fresh clone) plus fixed overhead: TLS handshake, `gh auth
  setup-git` credential setup, git's smart-HTTP protocol negotiation. For a repo this small, that
  fixed per-request latency (typically low-single-digit seconds against GitHub from a reasonable
  connection) likely dominates over the actual byte transfer time, similar in order of magnitude
  to the host-copy path.
- **Reasoning on scale crossover:** the two mechanisms scale differently along different axes.
  Host-copy cost scales with **working-tree size and file count** (bytes to move locally, plus a
  roughly-constant per-file overhead through any virtualized filesystem bridge). Clone cost
  scales with **full pack/history size** (everything ever committed, not just the current
  tree) *plus* network latency/bandwidth to GitHub, which is independent of local disk speed.
  Concretely:
  - A repo with a **large history but a small current working tree** (e.g. lots of churn,
    binary assets since removed, deep history) would make host-copy comparatively *better*,
    since it only ever touches the current working tree, never the accumulated history a clone
    must transfer.
  - A repo with a **huge number of small files** (e.g. a large `node_modules`-shaped tree, or
    tens of thousands of tracked files) would make host-copy comparatively *worse* relative to a
    clone, because per-file overhead through a virtualized bind-mount bridge (real, per the
    Docker Desktop file-sharing note above) accumulates per file, whereas git's own wire protocol
    batches many files into a small number of pack-transfer round-trips regardless of file count.
  - On a **slow/high-latency network connection to GitHub** (or GitHub being unreachable/rate-
    limited), host-copy wins categorically, independent of size, since it has no network
    dependency at all — this is arguably a bigger practical advantage than raw speed at this
    repo's modest scale.
  This repo, at 17 MB / 246 files / ~26 MB of history, sits comfortably in the "both are fine,
  pick on other merits" zone — neither approach is a clear performance loser here. The crossover
  points above are reasoned from the measured numbers and general knowledge of how each transfer
  mechanism scales, not independently benchmarked in this pass (no prototype was built or timed
  as part of this research).

---

## Question 5: Cross-platform consistency (macOS / Linux / Windows+WSL2)

**Partially confirmed; the shell-invocation question is the one real, primary-source-grounded
gap. Several other risks are real but structurally avoided by the recipe in the Verdict, not by
platform-specific luck.**

- **Shell invocation is spec'd, and it's Unix-shaped:** "For each command property, if the value
  is a single string, it will be run in `/bin/sh`."
  ([containers.dev implementors/json_reference](https://containers.dev/implementors/json_reference/),
  primary, confirmed directly — this exact sentence was retrieved from the live page.) This
  repo's own existing `initializeCommand` (the `.env` bootstrap: `test -f ... || cp ...`) is
  already written as a `/bin/sh`-compatible string, so this is an existing, already-accepted
  dependency, not a new one introduced by this candidate mechanism — but a Docker-CLI-driving
  recipe raises the stakes of it failing silently or behaving unexpectedly on a bare native
  Windows host (no WSL2, no Git Bash on `PATH`) if VS Code's own tooling doesn't transparently
  supply a POSIX shell there. **This research could not confirm, from a primary source, exactly
  what VS Code Dev Containers does on a native (non-WSL2) Windows host to satisfy this `/bin/sh`
  requirement** — repeated `WebSearch` attempts on this specific question failed ("tool
  unavailable") for most of the session, and no primary Microsoft/containers.dev page fetched in
  this pass addressed it directly. Flagged as an open question, not asserted either way.
- **Docker Desktop file-sharing/path-translation on macOS and Windows is real and documented,**
  and matters for the `-v "${localWorkspaceFolder}":/src:ro` bind-mount half of the recipe (the
  host source side of the copy): Docker Desktop's settings docs describe VirtioFS as the current
  macOS file-sharing backend, and separately document a **case-sensitivity divergence** as a
  concrete, named risk: "By default, Mac file systems are case-insensitive while Linux is
  case-sensitive... Docker Desktop enforces accessing shared files by their original case"
  and mismatched-case access "will fail with 'No such file or directory' errors."
  ([Docker Desktop settings/file-sharing docs](https://docs.docker.com/desktop/settings-and-maintenance/settings/),
  primary.) This is a real, primary-source-confirmed macOS-specific risk for the recipe's
  bind-mount source path, independent of the copy tool chosen.
- **CRLF/LF line-ending risk is real and structurally different from today's clone-based
  mechanism, confirmed via git's own normalization docs:** the `text` attribute in
  `.gitattributes` triggers normalization "when a matching file is added to the index" (LF in
  the index) and again "when the file is copied from the index to the working directory" (CRLF
  or LF depending on `eol`/config/platform) — i.e. normalization is tied to git's own
  checkin/checkout machinery ([git-scm.com/docs/gitattributes](https://git-scm.com/docs/gitattributes),
  primary). A raw filesystem copy (the candidate mechanism) bypasses checkout entirely, so it
  carries over **whatever line endings already exist in the host's working tree** — which
  depend on the host's own `core.autocrlf`/`.gitattributes` resolution at the time the host
  originally checked those files out. A fresh in-container `git clone` (today's mechanism)
  always re-normalizes per `.gitattributes` at checkout time, in the container's own Linux
  environment, regardless of what the host's line endings look like. This is a genuine new
  failure mode the candidate mechanism introduces that today's mechanism structurally avoids —
  worth calling out explicitly rather than assuming "it's just a copy, bytes are bytes."
- **Exec-bit/file-mode fidelity:** git tracks the executable bit via `core.fileMode`
  (confirmed present as a real, documented boolean config variable via
  [git-scm.com/docs/git-config](https://git-scm.com/docs/git-config), primary, though the
  specific fetched excerpt did not include the variable's full prose description — only its
  presence in the EXAMPLES section as a real, settable option was confirmed directly). Since the
  candidate recipe's file selection (`git ls-files`) and copy (`tar`) both operate on the raw
  filesystem, not through git's checkout machinery, exec bits present on the host's actual files
  on disk get carried through as real Unix permission bits via `tar`, which preserves file
  mode — a bind-mount source that's already a Linux/macOS filesystem (ext4, APFS, or Docker
  Desktop's VirtioFS-backed share) should preserve them correctly. This wasn't independently
  stress-tested in this pass (no prototype built), but nothing in Docker's or git's docs
  suggests a fidelity problem here specific to this recipe; the more plausible fidelity risk
  is the Windows-native-filesystem case (NTFS has no native Unix exec bit at all), which is a
  pre-existing Docker-Desktop-on-Windows characteristic independent of this recipe, not
  something this recipe introduces.

---

## Caveats / open questions

- **No prototype was built or timed in this research pass.** The Verdict's recipe is
  synthesized from primary-source building blocks (spec phase ordering, Docker's documented
  volume-migration pattern, git's own file-listing tooling) that are each independently
  confirmed, but the *combination* — specifically run through VS Code's Dev Containers
  extension (not just the spec text or the standalone CLI) against this repo's actual
  `docker-compose.yml` — has not been exercised end to end. [Issue #7366](https://github.com/microsoft/vscode-remote-release/issues/7366)'s
  report of a related ordering discrepancy between the VS Code extension and the standalone
  `devcontainer` CLI is a specific, concrete reason not to treat the spec's phase-ordering
  guarantee as proven-in-the-extension without a real test.
- **`WebSearch` was unavailable for nearly this entire research session** (repeated "tool
  unavailable" errors after the first two calls, across many retries at different points in the
  session). This meant several questions that would normally be triangulated with multiple
  search results (especially Question 5's Windows-native shell-invocation question, and a
  from-scratch search for prior art combining `initializeCommand` with volume-seeding
  specifically) relied on whatever primary-source pages could be reached directly by URL, plus
  the two search result sets that did return early in the session. This is a genuine coverage
  gap, not just a caveat — a future pass with working search should specifically re-attempt
  Question 5's Windows-native question and do a fresh prior-art search for this exact
  combination of techniques.
- **rsync's precise divergence from git's gitignore precedence was not fully pinned down** — the
  fetched rsync manpage excerpt confirmed the `-C`/CVS-exclude feature exists and is a distinct,
  general-purpose mechanism, but did not yield a clean quotable statement on whether it reads
  `.git/info/exclude` or `core.excludesFile` automatically. This doesn't change the Verdict
  (this research recommends `git ls-files`, not rsync, specifically to sidestep needing this
  answered precisely) but it means the "rsync diverges from git in the following specific ways"
  framing in the original ask is only partially substantiated, not fully.
- **`rebase-merge/` and `CHERRY_PICK_HEAD` specifically** (as opposed to `MERGE_HEAD`, which was
  confirmed directly) were not independently re-confirmed against a primary git doc page in this
  pass — the reasoning in Question 3 treats them as the same category of risk as `MERGE_HEAD` by
  analogy (git's general pattern of marker refs/directories for interrupted multi-step
  operations), which is a reasonable inference but wasn't given the same direct-quote treatment.
- **This document does not address whether host-side copying is desirable relative to other
  candidate fixes** (e.g., simply deleting/recreating the volume more often, or a lighter-weight
  "sync `.devcontainer/` only" partial fix) — that framing question, and the ecosystem-standards
  survey, is explicitly out of scope here per the task and is being handled by the concurrent
  research pass on issue #237.
