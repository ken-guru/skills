---
id: scaffold-suite-root
title: Scaffold devcontainer-setup Skill Suite root
status: open
type: task
assignee: null
blocked_by: []
created: 2026-08-10
---

## Question

Not a decision — manual/mechanical work that unblocks every module-scope
ticket by giving them a directory to land files in. Create the suite root
at `skills/devcontainer-setup/`, mirroring Presentation's precedent
(`skills/presentation/`) per `docs/specs/repository-restructure.md` §4-5:

- `skills/devcontainer-setup/README.md` — suite purpose, complete-install
  instructions, six-member catalog (once named — see
  [skill-suite-structure-and-naming](skill-suite-structure-and-naming.md)),
  and the fact that focused (single-member) installation is *also*
  supported here, unlike Presentation.
- `skills/devcontainer-setup/CONTEXT.md` — suite-local glossary: Scaffolding
  Skill, Add-on Skill, Target Devcontainer (definitions in the map's
  Notes), plus the artifact-ownership and retrofit-contract conventions
  from [cross-cutting-conventions](cross-cutting-conventions.md).
- `skills/devcontainer-setup/docs/adr/0001-focused-installation.md` — the
  ADR owed by
  [skill-suite-structure-and-naming](skill-suite-structure-and-naming.md)'s
  resolution: why this suite consciously trips the "focused installation"
  deferred-complexity trigger from
  `docs/specs/repository-restructure.md` §13, diverging from Presentation.
- Update root `CONTEXT-MAP.md` to link the new suite `CONTEXT.md`.
- Update root `README.md`'s Skill Suites table to list devcontainer-setup.

Resolved when the files above exist and are internally consistent with
the decisions already recorded on this map. Answer should record the
final six-member catalog as written into the README (in case naming
changes slightly during actual authoring versus the ticket that decided
it).
