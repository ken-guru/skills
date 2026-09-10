# Research: pre-#109 documented Shared Container collision problems

## Question

Issue [#246](https://github.com/ken-guru/skills/issues/246) asks: before issue
[#109](https://github.com/ken-guru/skills/issues/109) ("Split up devcontainers
into one container per ai cli," implemented by PR
[#127](https://github.com/ken-guru/skills/pull/127), merged ~2026-09-02), what
**concretely documented collision problems** existed between AI CLI tools
sharing one Shared Container (`skills/setup-devcontainer`'s pre-split single
`devcontainer.json` + `post-create.sh` installing multiple CLIs together)?
Specifically: PATH conflicts, yolo-alias/shell-alias collisions,
permission-grant interference (e.g. `SYS_ADMIN`/`seccomp=unconfined` from one
tool affecting another), install-script assumptions broken by a second tool's
install, or anything else that concretely motivated the #109 split — versus
the split having been motivated primarily by theoretical/preventive
reasoning. This feeds the new wayfinder map
[#241](https://github.com/ken-guru/skills/issues/241) ("Split
setup-devcontainer into a base skill plus interconnected per-CLI skills"),
which is reconsidering whether the per-CLI isolation #109 introduced is still
needed, and specifically ticket
[#245](https://github.com/ken-guru/skills/issues/245) ("Decide multi-CLI
composition rules inside one shared container").

Sources consulted: issue #109's full body; its 8 sub-issues (#111–#118, via
`gh api repos/ken-guru/skills/issues/109/sub_issues`); spec issue #119; PR
#127 (description + diff); `git log --all --oneline -- skills/setup-devcontainer`
and full-text `git log --all --grep` searches across "collision", "shared
container", "PATH", "conflict", "yolo"; `git show` on every pre-split commit
that touched the Shared Container's templates/scripts; the pre-split
`post-create-*-block.sh` / `devcontainer.baseline.json` files as they existed
at the last pre-split commit; the earlier wayfinder map #102 and its
sub-issues #103–#106 (yolo-alias permission-posture port from an external
ADR); and the current `skills/setup-devcontainer/CONTEXT.md`.

## Findings

### Bottom line

**Theoretical/architectural reasoning, not an observed incident.** Across
issue #109, its 8 sub-issues, spec #119, PR #127, the entire pre-split commit
history, and full-text search of every issue/PR/commit for "collision",
"shared container", "PATH", "conflict", and "yolo", there is **no** bug
report, issue, PR, or commit message describing an actual observed failure
where one AI CLI's presence, install, alias, or permission grant broke or
interfered with another CLI already running or installed in the same Shared
Container. Every citable piece of "collision" reasoning is forward-looking
structural/security reasoning ("this *would* affect...", "this *has real
cost* for...") written during architecture planning (#106, #109/#119) — never
a "we hit X, here's what broke" narrative. The one post-split appearance of
"collision"-adjacent risk (issue #212) comes from an automated Socket
security scanner flagging blast-radius risk, not from a user-reported
incident.

### Verdict by collision type

**PATH conflicts between tools' binaries — no evidence found.**
The only PATH-related bug in the pre-split history, commit `c8d722b` ("fix
Codex/Antigravity install idempotency and fault isolation"), is a
*single-tool* idempotency bug, not a cross-tool PATH collision:
`postCreateCommand` runs as a non-login shell whose `PATH` excludes
`~/.local/bin`, so `command -v codex` / `command -v agy` always missed an
already-installed binary and re-ran the network installer on every rebuild.
This affected Codex and Antigravity identically and independently of each
other — nothing about it involves one tool's binary shadowing, conflicting
with, or displacing another tool's binary or PATH entry.

**Yolo-alias / shell-alias collisions — no evidence found.**
There were bugs *within* individual aliases' own flag choices (see "Old
Shared Container script comments" below), and one alias-naming
inconsistency in commit `c524385` (SKILL.md prose referred to a tool's
folder name instead of its actual CLI command name for `claude-yolo` /
`agy-yolo` — a documentation bug, not a runtime collision). No two tools'
aliases were found to clash, silently overwrite each other, or interfere at
runtime.

**Permission-grant interference (`SYS_ADMIN` / seccomp) — the strongest
category, but still architectural reasoning, never an observed incident.**
- Wayfinder map #102 / sub-issue #106 (decided 2026-09-01, still inside the
  Shared-Container era) reasoned: *"granting `SYS_ADMIN` + unconfined
  seccomp/systempaths has real container-security cost for every repo that
  runs this skill, most of which have no way to independently verify the
  bwrap sandbox is actually confining anything."* This is preventive framing
  ("has real... cost"), not "this caused problem Y."
- The mitigation applied at that time (commit `9b7efac`, still inside the
  Shared Container architecture) injected the grant only when Codex was
  opted into the container — which itself confirms the grant was
  container-wide (it would apply to Claude Code / Antigravity / Copilot
  processes too, if any of those were also selected alongside Codex in the
  same container). No bug report shows that combination actually being
  exercised and causing harm to a co-resident tool.
- Spec #119's Problem Statement and the split's merge commit `500999f` both
  state the collision as a structural fact: *"Codex's Bubblewrap sandbox
  needs a container-wide `SYS_ADMIN`/`seccomp=unconfined` grant that applies
  to every process in the container, not just Codex's"* — framed as "needs
  to apply to every process," not "did apply and broke X."
- Post-split, issue #212 shows a Socket security scanner (not a user report)
  flagging this grant as a "MEDIUM finding (significant blast-radius risk)";
  #212's own research concludes the grant's necessity is only
  "plausible-but-untested to narrow" — i.e. still unverified even once the
  containers were isolated.

**Install-script assumptions breaking under a second tool's install — yes,
one concrete case, though not a runtime cross-tool collision.**
Commit `c8d722b` ("fix Codex/Antigravity install idempotency and fault
isolation") is the one genuinely concrete, citable failure mode from the
Shared Container era:

> "Combined with `set -euo pipefail` in the baseline script, a flaky
> installer (interactive prompt, self-check network call) could hard-fail
> the entire postCreateCommand and block unrelated baseline setup (git
> identity, SSH keys, YOLO aliases)."

This is real evidence that one optional CLI's installer failing could abort
setup steps needed by *every* tool sharing that script (git identity, SSH
keys, yolo aliases for all tools) — the closest thing to a documented
"install-script assumption broke because of a second tool" finding. It was
fixed by making install failures warnings instead of fatal errors. Note the
caveat: this is a sequencing/fault-isolation bug within one shared script,
not one CLI's *runtime* interfering with another CLI's *runtime* once both
are installed.

**Other real bugs found in the Shared Container era, for completeness — not
cross-tool collisions:**
- `bf30e5f` — `.gemini`/`.codex` config volumes root-owned on first mount, so
  each tool independently hit "permission denied" (same bug class already
  fixed for `.claude`; not caused by tools co-residing together).
- `30004df` — Codex's Bubblewrap sandbox needs unprivileged user namespaces
  that Docker's default seccomp/AppArmor blocks; rather than widening the
  whole container's confinement, the fix at that point was a zero-sandbox
  `codex-yolo` alias — explicitly pre-emptive, and predates the
  `SYS_ADMIN`/seccomp grant being added at all.
- `ac7a0fd`, `79c4c87` — vendor install-command bugs (wrong npm package
  name; `curl | sh </dev/null` silently no-op'ing via EPIPE; a stale
  Antigravity download URL) — single-tool vendor bugs, not cross-tool.
- `c524385` — includes an SSH deploy-key generation *race*, but that race is
  between two concurrent **Tool Containers** (post-split architecture)
  racing on one shared ssh-config volume — a Concurrent Workspace bug, not a
  Shared-Container-era, single-container bug.

### What #109, #119, and PR #127 actually said

Issue #109's body defines the vocabulary and gives its flagship example in
explicitly hypothetical terms:

> "Multiple Tool Containers run **concurrently** against the same repo
> checkout without **collisions** (e.g. Codex's container-wide
> `SYS_ADMIN`/`seccomp=unconfined` grant staying scoped to Codex's own
> container) — a **Concurrent Workspace**, confirmed achievable via Docker
> Compose."
>
> "**Collision**: cross-tool interference from co-residing in one Shared
> Container (e.g. a permission grant or install step from one tool affecting
> another)."

The definition itself is phrased as a hypothetical example ("e.g."), not a
citation of an actual occurrence.

Spec #119's Problem Statement is the most direct rationale text, and it is
explicitly structural rather than incident-based:

> "Because everything lives in one container, the tools collide: Codex's
> Bubblewrap sandbox needs a container-wide `SYS_ADMIN`/`seccomp=unconfined`
> grant that applies to every process in the container, not just Codex's;
> per-tool config volumes, install scripts, and permission postures are all
> interleaved in one `devcontainer.json`/`post-create.sh`, so updating or
> reasoning about one tool risks touching the others."

"Risks touching," not "touched" — the maintainability half of the
motivation ("updating or reasoning about one tool risks touching the
others") is stated alongside the security/blast-radius half, and both are
preventive.

PR #127's description reinforces the same framing, and its verification
confirms the *new* isolated architecture works rather than reproducing an
old collision:

> "Per-tool Dockerfile/devcontainer.json/post-create.sh/Compose service, so
> a permission grant ... never reaches another tool's container — verified
> live: Codex's container carries `CAP_SYS_ADMIN`, every other container
> does not."

Sub-issue #111 (concurrency-feasibility research for the *new* design) flags
only theoretical caveats: a documented VS Code Compose project-name bug
(`vscode-remote-release#5716`, unrelated to AI-CLI collisions), UID/GID
drift risk, and low-probability git `index.lock` contention — again nothing
about an observed Shared-Container collision. Sub-issues #112–#118 (Copilot
install method, shared base layer mechanism, Tool Container layout
convention, rewritten SKILL.md flow, verification checklist, an ADR-0047
revision-note check, and CONTEXT.md formalization) are pure forward-design
decisions with no retrospective collision evidence.

### Old Shared Container script comments (pre-split git history)

Reading the actual shell/JSON as of the last pre-split commit (`c8d722b`),
the comments explain single-tool quirks, never "avoid conflicting with tool
Y":
- `post-create-codex-block.sh`: *"Checked by binary path, not `command -v`
  — this non-login script's PATH doesn't include `~/.local/bin`..."* — about
  Codex's own idempotency check, not about another tool.
- `post-create-antigravity-block.sh`: same pattern, Antigravity-only.
- `devcontainer.baseline.json` / SKILL.md (as of `c8d722b`): *"these are the
  minimum container runtime settings Bubblewrap needs, without making the
  whole container privileged"* — a design justification for scoping the
  grant as narrowly as possible while still inside a shared container,
  written prospectively.
- SKILL.md's yolo-alias caveats explain why each alias's own flags were
  chosen (e.g. an earlier `claude-yolo` flag combination "triggers Claude
  Code's own bwrap sandbox, whose mount-namespace view of the repo conflicts
  with git's worktree identity check") — a real bug, but internal to that
  one tool's own flag combination, not caused by a second tool's presence.
  This came from an external source (the-words-are-snake's ADR-0047),
  ported via wayfinder map #102 / issues #103–#106 and PR #107.

### CONTEXT.md's current framing (verbatim)

From `skills/setup-devcontainer/CONTEXT.md`:

> **Shared Container**: The single devcontainer.json + post-create.sh that
> installed multiple AI CLIs together, superseded by one Tool Container per
> tool. _Avoid_: baseline container, combined container
>
> **Collision**: Cross-tool interference from co-residing in one Shared
> Container — e.g. a permission grant or install step from one tool
> affecting another. _Avoid_: conflict, interference

Both definitions are framed with an illustrative "e.g.", matching the rest
of the research: the term "Collision" was coined descriptively/preventively
during the #109 planning, not to label a specific incident that had already
happened.

### Corroborating signal: the new map concedes the same thing

Issue #241 itself — the map reconsidering the #109 split — states in its own
body:

> "Justified by concurrent multi-CLI usage not occurring in practice for
> this user."

This is the map author's own acknowledgment that the isolation the #109
split bought was never actually exercised: not just "no collision was
documented," but "the concurrent-use scenario the isolation was built to
protect against didn't happen in practice."

## Conclusion for #245

For the sibling ticket #245 ("Decide multi-CLI composition rules inside one
shared container"): there is no concretely observed collision incident to
design defenses around. The one real, citable failure (`c8d722b`'s
install-fault-isolation bug) is about **script fault-isolation** (`set -e`
propagating a flaky installer's failure into unrelated baseline setup steps)
and is already solved by making installer failures non-fatal — that fix
generalizes cleanly to a shared-container-with-layered-installs design
regardless of how many tools are layered in. The `SYS_ADMIN`/seccomp
grant-scoping concern is real and worth carrying forward as a *design
constraint* (only grant it when Codex is actually selected, as the
Shared-Container era already did), but there is no evidence it needs
per-tool container isolation to be handled safely — the pre-split code
already conditionally scoped it within one container. PATH and alias
collisions, the two other categories #246 asked about, have no supporting
evidence at all, pre- or post-split.

## Source citations

- Issue [#109](https://github.com/ken-guru/skills/issues/109) — "Split up
  devcontainers into one container per ai cli" (Collision definition,
  SYS_ADMIN example)
- Issue [#111](https://github.com/ken-guru/skills/issues/111) — concurrency
  feasibility research (VS Code Compose caveats)
- Issues [#112](https://github.com/ken-guru/skills/issues/112)–[#118](https://github.com/ken-guru/skills/issues/118)
  — forward-design sub-decisions (Copilot install method, shared base layer,
  Tool Container layout, SKILL.md flow, verification checklist, ADR-0047
  revision-note check, CONTEXT.md formalization)
- Issue [#119](https://github.com/ken-guru/skills/issues/119) — spec,
  Problem Statement quoted above
- PR [#127](https://github.com/ken-guru/skills/pull/127) — implementation,
  "verified live" quote above
- Issue [#102](https://github.com/ken-guru/skills/issues/102) (wayfinder
  map) and sub-issues [#103](https://github.com/ken-guru/skills/issues/103)–[#106](https://github.com/ken-guru/skills/issues/106)
  — yolo-alias permission-posture port from external ADR-0047; #106 contains
  the "real container-security cost" blast-radius language
- PR [#107](https://github.com/ken-guru/skills/pull/107) — ports #103–#106's
  fixes
- Commit `c8d722b` — install idempotency/fault-isolation fix (the one
  concrete "second tool's install breaking shared setup" evidence)
- Commit `bf30e5f` — config-volume chown fix (single-tool, not cross-tool)
- Commit `30004df` — codex-yolo bwrap-vs-bypass tradeoff (pre-emptive,
  predates the grant being added)
- Commit `9b7efac` — ADR-0047 port; introduces conditional `capAdd`/
  `securityOpt` injection scoped to Codex being selected
- Commits `ac7a0fd`, `79c4c87` — vendor install-command bugs (single-tool)
- Commit `c524385` — SSH deploy-key generation race (post-split,
  cross-*container*, not cross-tool-in-one-container) plus a
  yolo-alias-naming documentation fix
- Commit `500999f` — the split itself, PR #127's merge commit
- Issue [#212](https://github.com/ken-guru/skills/issues/212) — post-split
  Socket-scanner-driven investigation into narrowing the SYS_ADMIN/seccomp
  grant ("MEDIUM finding," "plausible-but-untested to narrow")
- Issue [#241](https://github.com/ken-guru/skills/issues/241) — new
  wayfinder map reconsidering the split; contains the "not occurring in
  practice for this user" admission
- Issue [#246](https://github.com/ken-guru/skills/issues/246) — this
  research ticket
- `skills/setup-devcontainer/CONTEXT.md` — current Shared Container /
  Collision definitions (quoted verbatim above)
