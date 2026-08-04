# Simplify the repository restructuring before implementation

Labels: `wayfinder:map`
Status: Open

## Destination

Produce and approve a revised, implementation-ready repository restructuring
specification that preserves the useful Collection → Presentation Skill Suite seam
while removing complexity that is not justified by the repository's present needs.
The result must explain the implications of both designs, define what is deliberately
deferred, and provide a proportionate migration and acceptance contract.

## Notes

- Domain: proportional architecture for a small Collection containing one cohesive
  seven-Skill Presentation suite.
- Consult `grilling`, `domain-modeling`, and `codebase-design` when resolving design
  tickets.
- Treat the previously approved specification as one candidate, not as the default.
  Any earlier architectural decision may be revoked by the revised specification.
- Optimize for the repository's current needs and accept a later refactor when a
  second real Skill Suite or standalone-distribution requirement supplies concrete
  evidence.
- Retain the core `skills/presentation/` suite seam, all seven stable Skill names,
  independent invocation within the suite, full-suite installation, the
  `presentation-skills` plugin identity, and current behavior.
- Drop focused installation of individual Presentation Skills as a current guarantee.
- Avoid Dependency Declarations, Dependency Snapshots, dependency-graph tooling,
  custom structural schemas, root-adapter registration, and a Collection checker
  unless this review finds present evidence that one is necessary.
- Keep a localized portability fix for `generate-images`, including a reproducible
  self-contained runtime bundle.
- Move active Presentation-owned artifacts, but leave completed planning history and
  archives at their existing paths.
- Replace exhaustive structural acceptance with behavior-focused evidence.
- Planning only: no migration wave begins until this map closes with explicit approval.
- GitHub issue 51 is paused without `ready-for-agent`; pull request 52 is a draft
  planning baseline.

## Decisions so far

- [Assess the cost and implications of the approved design](00-assess-the-cost-and-implications-of-the-approved-design.md) — Prefer a minimum viable Collection: retain the useful Presentation ownership seam and present behavior, but remove permanent machinery justified only by withdrawn focused installs or hypothetical future scale.
- [Choose the minimum viable Collection tree and distribution contract](01-choose-the-minimum-viable-collection-tree-and-distribution-contract.md) — Use the conventional flat-standalone/one-level-suite tree, human-maintained indexes and contribution guidance, two scoped contexts, and complete-suite distribution through `npx skills` and the existing Claude plugin without structural manifests or registries.
- [Define the direct shared and runtime dependency contract](02-define-the-direct-shared-and-runtime-dependency-contract.md) — Make every installed member self-contained, localize state and restart contracts, remove the runtime shared directory and dependency framework, bundle `generate-images`, keep external preflights owner-local, and defer focused-install guarantees until an explicit extraction.

## Not yet specified

- The final wording needed to supersede or amend the existing implementation issue
  and draft pull request depends on the revised target and acceptance contract.

## Out of scope

- Implementing either restructuring design.
- Adding a second Skill Suite or a new standalone Skill.
- Preserving focused installation merely for backward compatibility; the install
  base is small and the guarantee has been explicitly withdrawn.
- General package-per-suite publishing or multi-plugin release automation.
