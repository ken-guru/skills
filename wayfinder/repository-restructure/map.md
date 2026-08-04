# Restructure the repository around portable Skill Suites

Labels: `wayfinder:map`
Status: Closed

## Destination

Produce one consolidated, implementation-ready repository architecture and migration specification that makes the Presentation Skill Suite a clear ownership boundary, leaves room for standalone Skills and future Skill Suites, and preserves each presentation Skill's ability to be extracted later.

## Notes

- Domain: A collection of independently discoverable agent Skills, including both standalone Skills and cohesive Skill Suites.
- Consult the `grilling`, `domain-modeling`, and `codebase-design` skills when resolving design tickets; use `research` for facts outside this repository.
- Follow Matt Pocock's model for collection and discovery: one repository, individually selectable Skills, and one curated repository-level plugin surface.
- A Skill Suite is an internal ownership boundary, not automatically a separately published package.
- Keep `presentation-skills` as the current Claude bundle during this restructuring. Defer multi-plugin packaging until a real second domain provides concrete requirements.
- Preserve current public presentation Skill names as the baseline. Any proposed rename must present a concrete benefit and receive explicit user approval.
- The Presentation Skill Suite owns all presentation-specific Skills, documentation, domain context, ADRs, evals, verification, shared modules, assets, and planning history.
- Each member Skill must retain a self-contained contract and explicit dependencies so it can later become standalone without disentangling unrelated presentation internals.
- Preserve presentation workflow behavior. Structural refactoring is allowed; feature changes are not, except where strictly necessary to preserve behavior after moving files.
- The final specification must include a target tree, artifact-ownership rules, a path-by-path migration manifest, affected references and tooling, sequencing, compatibility treatment, and acceptance checks.
- Planning only: this map produces the specification but does not perform the repository migration.

## Decisions so far

- [Study Matt Pocock's skills repository structure](00-study-matt-pocock-structure.md) — Use Matt's collection and discovery model, while adding an internal Presentation Skill Suite ownership boundary for this repository's tightly integrated assets and verification.
- [Verify nested Skill discovery and Claude plugin paths](01-verify-nested-discovery-and-plugin-paths.md) — Put member Skills at `skills/presentation/<stable-name>`; preserve public names, explicitly list nested Claude paths, and keep the marketplace plugin sourced from the repository root.
- [Choose the canonical collection, suite, and Skill source tree](02-choose-the-canonical-source-tree.md) — Use `skills/presentation/` as a non-invokable vertical suite root, keep standalone Skills flat, colocate suite support, and reserve repository-root paths for collection-owned material.
- [Define collection, suite, and Skill artifact ownership](03-define-artifact-ownership-rules.md) — Give every artifact one narrow, stable owner; use suite-owned Shared Modules for shared behavior, purpose-based ownership for generated output, and thin adapters where tooling fixes a root seam.
- [Inventory current presentation paths and references](04-inventory-current-paths-and-references.md) — Inventory the full suite footprint and its path-sensitive links, imports, manifests, workflows, generated evidence, approval boundaries, installed-runtime commands, and verification gates.
- [Define the portable Skill Suite dependency contract](05-define-the-portable-suite-dependency-contract.md) — Keep individually advertised Skills self-contained through consumer declarations and hashed Dependency Snapshots, distinguish callable Skill Dependencies, enforce an acyclic downward graph, and verify isolated installs.
- [Define discovery, packaging, and compatibility policy](06-define-discovery-packaging-and-compatibility.md) — Preserve names and install journeys, use collection-to-suite-to-Skill navigation, keep one presentation-specific Claude bundle, replace old and agent-home paths cleanly, and gate the minor release on installer and link checks.
- [Place domain documentation, decisions, and planning history](07-place-domain-docs-decisions-and-history.md) — Split Collection and Presentation contexts, colocate public docs, ADRs, and Wayfinder maps with their owners, archive legacy summaries explicitly, and place the final specification in Collection docs.
- [Place evals, verification, generated assets, and CI](08-place-evals-verification-assets-and-ci.md) — Colocate evals with protected behavior, keep one suite theme-acceptance Module, separate approved output classes, move prototype history and ignore rules to their owners, and retain root CI as thin adapters.
- [Specify dependency declarations and Dependency Snapshot layout](13-specify-dependency-declarations-and-snapshot-layout.md) — Use strict direct Dependency Declarations, stable suite-scoped Shared Module identities, deterministic Skill-local snapshots, and one deep Collection-owned `sync`/`check` interface.
- [Research portable installed Skill self-location](14-research-portable-skill-self-location.md) — No universal Skill-directory variable exists; resolve resources from the host-supplied `SKILL.md` location, make scripts module-relative, and keep Claude path variables adapter-specific.
- [Define contribution rules and ownership boundary checks](09-define-contribution-rules-and-boundary-checks.md) — Route changes through explicit Contribution Paths, derive owners from strict tree markers, validate curated indexes and registered root adapters, and enforce structural contracts through one whole-Collection read-only check.
- [Decide the migration manifest and implementation sequence](10-decide-the-migration-manifest-and-sequence.md) — Use one exhaustive path-family Migration Manifest and a single shim-free migration PR with five gated waves from baseline evidence through 1.1.0 release acceptance.
- [Draft the consolidated repository restructuring specification](11-draft-the-consolidated-restructuring-specification.md) — Consolidate the approved target tree, ownership, dependency, portability, governance, Migration Manifest, implementation waves, and acceptance gates into one review-ready Collection specification.
- [Approve the repository restructuring specification](12-approve-the-repository-restructuring-specification.md) — Approve the consolidated specification as the implementation authority and release its documented issue and pull-request handoff.

## Not yet specified

## Out of scope

- Implementing the repository migration described by the final specification.
- Changing presentation discovery, generation, themes, media, proofreading, or other user-visible workflow behavior.
- Creating or designing a new non-presentation Skill or Skill Suite.
- Generalized package-per-suite publishing, multi-plugin release automation, or deciding how a hypothetical second domain is bundled.
- Native Codex plugin packaging or adapters for additional agent ecosystems, except ensuring the proposed structure does not unnecessarily foreclose them.
