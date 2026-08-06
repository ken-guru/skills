# Simplify the repository restructuring before implementation

Labels: `wayfinder:map`
Status: Closed

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
- Move active Presentation-owned artifacts and leave useful completed planning
  history and archives at their existing paths, except for the superseded original
  restructuring plan removed by the post-approval amendment.
- Replace exhaustive structural acceptance with behavior-focused evidence.
- Planning only: no migration wave begins until this map closes with explicit approval.
- GitHub issue 51 is paused without `ready-for-agent`; pull request 52 is a draft
  planning baseline.

## Decisions so far

- [Assess the cost and implications of the approved design](00-assess-the-cost-and-implications-of-the-approved-design.md) — Prefer a minimum viable Collection: retain the useful Presentation ownership seam and present behavior, but remove permanent machinery justified only by withdrawn focused installs or hypothetical future scale.
- [Choose the minimum viable Collection tree and distribution contract](01-choose-the-minimum-viable-collection-tree-and-distribution-contract.md) — Use the conventional flat-standalone/one-level-suite tree, human-maintained indexes and contribution guidance, two scoped contexts, and complete-suite distribution through `npx skills` and the existing Claude plugin without structural manifests or registries.
- [Define the direct shared and runtime dependency contract](02-define-the-direct-shared-and-runtime-dependency-contract.md) — Make every installed member self-contained, localize state and restart contracts, remove the runtime shared directory and dependency framework, bundle `generate-images`, keep external preflights owner-local, and defer focused-install guarantees until an explicit extraction.
- [Choose the active artifact migration boundary](03-choose-the-active-artifact-migration-boundary.md) — Move active Skills, owner documentation, existing evals, verification, and required adapters under the simplified suite contract while leaving planning history, archives, and the prototype in place and preserving approved image bytes.
- [Define proportionate acceptance and deferred-complexity triggers](04-define-proportionate-acceptance-and-deferred-complexity-triggers.md) — Keep permanent CI focused on existing Presentation behavior and bundle reproducibility, require one-time migration evidence for identity, distribution, paths, and hashes, and reintroduce deferred machinery only after concrete repeated needs.
- [Draft the revised proportionate restructuring specification](05-draft-the-revised-proportionate-restructuring-specification.md) — Replace the withdrawn dependency/governance design with one review-ready specification and normative Migration Manifest covering the minimum tree, self-contained runtime, active cutover, three checkpoints, proportionate acceptance, and evidence triggers.
- [Approve the revised proportionate restructuring specification](06-approve-the-revised-proportionate-restructuring-specification.md) — Approve the proportionate specification and Migration Manifest as the sole implementation authority after confirming their benefits, trade-offs, deferred-complexity triggers, migration detail, and acceptance evidence.
- [Remove the superseded original restructuring plan](07-remove-the-superseded-original-restructuring-plan.md) — Remove the contradictory original plan from the active tree before migration while preserving its complete record at immutable commit `8c87d6b`.

## Not yet specified

## Out of scope

- Implementing either restructuring design.
- Adding a second Skill Suite or a new standalone Skill.
- Preserving focused installation merely for backward compatibility; the install
  base is small and the guarantee has been explicitly withdrawn.
- General package-per-suite publishing or multi-plugin release automation.
