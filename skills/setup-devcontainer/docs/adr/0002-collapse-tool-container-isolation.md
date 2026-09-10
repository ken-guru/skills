# ADR-0002: Collapse per-CLI Tool Container isolation back to a shared devcontainer

**Status:** Accepted
**Date:** 2026-09-10
**Supersedes:** [ADR-0001](0001-per-container-ssh-keys.md)

## Context

Issue #109 (2026-09) split `setup-devcontainer` into one fully isolated Tool Container per AI CLI,
justified by preventing cross-tool "Collision" (a permission grant or install step from one tool
affecting another) and enabling a Concurrent Workspace (multiple Tool Containers open at once).

Exhaustive git-history research (`research/pre-109-shared-container-collisions` branch, ken-guru/skills)
found no concretely observed collision incident, before or after the split — every citable piece
of "collision" reasoning was forward-looking structural reasoning, never a "we hit X" narrative.
The Concurrent Workspace use case this architecture was built to protect has also not occurred in
practice for this repo's primary user.

Separately, the isolated-container era's real, measured cost accumulated: a 535-line `SKILL.md`,
~1142 lines of scripts, 8 `devcontainer.json` variants across 4 tools, one Dockerfile per tool, one
Docker Compose service per tool, and one SSH key pair per tool.

## Decision

Collapse back to one shared devcontainer. Replace the single `setup-devcontainer` skill
(generating N isolated Tool Containers) with a base `setup-devcontainer` skill (owns the shared
`devcontainer.json`/`Dockerfile`/SSH) plus four standalone per-CLI skills
(`setup-claude-devcontainer`, `setup-codex-devcontainer`, `setup-antigravity-devcontainer`,
`setup-copilot-devcontainer`) that layer their install onto it via an idempotent Own-Block
Contract: each CLI skill patches only its own marker-keyed block, via a shared, idempotent
append/insert/delete-section primitive, never anything the base skill or another CLI skill owns.

Docker Compose, per-tool Dockerfiles, and per-tool SSH keys are dropped entirely. The workspace
checkout reverts to VS Code's default bind-mount (not the clone-based named-volume mechanism the
isolated-container era used, which was independently causing real version-pinning/staleness
problems and only ever existed to solve a multi-container isolation problem that no longer
applies).

The one real, narrow security cost this reintroduces — Codex's `SYS_ADMIN`/seccomp sandbox grant
becoming container-wide instead of scoped to Codex's own container — is handled via a Capability
Seam: a generic, explicitly-named `runArgs` extension point any CLI skill may idempotently append
to, via a JSON-aware primitive distinct from the line-oriented one used everywhere else. This
directly continues a pre-#109 precedent: the original Shared Container already granted this only
when Codex was selected.

## Alternatives considered

### A) Keep Tool Container isolation (previous state)

- Pro: closes any theoretical cross-tool blast radius; supports genuinely concurrent multi-CLI
  usage against the same repo checkout.
- Con: real, measured cost (above) for a security benefit that exhaustive research found was
  never actually exercised, protecting against a concurrent-multi-CLI use case that doesn't occur
  in practice for this repo's primary user.

### B) Shared devcontainer + per-CLI skills (chosen)

- Pro: collapses 8 `devcontainer.json` variants to 2, drops Compose/per-tool Dockerfiles/per-tool
  SSH keys entirely, retires four now-empty domain terms (Tool Container, Private Checkout,
  Concurrent Workspace, Collision) plus two more that only made sense with multiple containers
  (Cross-Container Leakage, Committed Scaffold).
- Con: reintroduces Codex's capability grant at container scope, mitigated by the Capability Seam.

## Consequences

- Tool Container, Private Checkout, Concurrent Workspace, Collision, Cross-Container Leakage, and
  Committed Scaffold are retired from `CONTEXT.md`. Shared Container and Shared Checkout are
  revived from "superseded" to current.
- ADR-0001 is superseded — SSH reverts to one shared deploy key, one shared signing key, one
  shared volume for the single container, the same shape ADR-0001's own "Alternative A" described
  and moved away from, now correct again given there's only one container.
- Migration for already-generated old-architecture repos is a separate, not-yet-decided
  follow-on — explicitly out of scope for the effort that produced this decision.
- If concurrent multi-CLI usage becomes a real need again, [herdr](https://github.com/gambtho/herdr-devcontainer)
  (a terminal multiplexer purpose-built for exactly that, whose own devcontainer plugin already
  assumes one shared container) is the natural thing to evaluate next — not a reintroduction of
  Tool Container isolation.
