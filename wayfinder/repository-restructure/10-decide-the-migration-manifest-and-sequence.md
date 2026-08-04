# Decide the migration manifest and implementation sequence

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by:

- [Inventory current presentation paths and references](04-inventory-current-paths-and-references.md)
- [Define the portable Skill Suite dependency contract](05-define-the-portable-suite-dependency-contract.md)
- [Define discovery, packaging, and compatibility policy](06-define-discovery-packaging-and-compatibility.md)
- [Place domain documentation, decisions, and planning history](07-place-domain-docs-decisions-and-history.md)
- [Place evals, verification, generated assets, and CI](08-place-evals-verification-assets-and-ci.md)
- [Define contribution rules and ownership boundary checks](09-define-contribution-rules-and-boundary-checks.md)

## Question

What path-by-path move, split, retain, index, compatibility, or retirement decisions and what ordered implementation sequence will migrate the repository safely while preserving behavior and verification?

## Resolution

The exhaustive path-family decisions and acceptance matrix are recorded in the
[Repository restructuring Migration Manifest](migration-manifest.md).
The implementation handoff is persisted as
[Restructure the repository around portable Skill Suites](https://github.com/ken-guru/skills/issues/51).

Implement the shim-free restructuring in one migration pull request containing five ordered,
reviewable wave commits:

1. **Baseline evidence** records current tests, discovery and plugin behavior, tracked-file
   accounting, and hashes of all reviewed baselines and public gallery assets.
2. **Collection foundations** adds contribution guidance, strict schemas, the pinned
   Collection tooling package, dependency and Collection contract Modules, bundle support,
   and interface fixtures without enabling the repository-wide gate.
3. **Coordinated active-owner cutover** moves all seven stable member Skills, canonical
   Shared Modules, active verification, public docs/assets, ADRs, and evals; generates
   Dependency Declarations and Snapshots; bundles `generate-images`; adds the verification
   path Module; splits active root indexes and contexts; and updates plugin paths, workflows,
   adapters, links, imports, fingerprints, and installed commands atomically.
4. **History and Collection closure** moves planning history and the prototype, archives
   implementation summaries, rewrites historical links, updates root guidance and ignore
   rules, removes obsolete paths, and enables the whole-Collection gate.
5. **Release acceptance** proves every supported repository, installer, Codex, Claude Code,
   managed-plugin, verification, approval, link, hash, and path-portability interface before
   releasing `presentation-skills` 1.1.0.

The whole pull request must pass before reaching `main`; no intermediate wave is released.
A failed wave is fixed before proceeding or reverted as a complete checkpoint. Old source
directories, redirects, duplicate authorities, and filesystem compatibility shims are not
created.

The canonical compatibility artifact is
`skills/presentation/docs/migration-1.1.md`. It maps public old paths and commands to the new
tree while preserving all seven Skill names and the `presentation-skills` plugin identity.

The runtime dependency graph begins with:

- `build-presentation`: `presentation/state-schema` plus all six phase Skill Dependencies;
- `discover-presentation`: `presentation/restart-guard` and
  `presentation/state-schema`;
- `structure-agenda`: `presentation/restart-guard`;
- `generate-slides`: `presentation/restart-guard`;
- `generate-images`, `generate-diagrams`, and `proofread-presentation`: empty
  dependency arrays.

`restart-guard.md` and `presentation-theme-invalidation.mjs` form one deep Shared Module.
`state-schema.md` forms another. `image-spec-diff.md` transfers to the actual
`generate-slides` owner, and unused `validation.md` is retired.

Reviewed baseline and gallery image bytes are preserved. Only the gallery manifest's
path-derived `sourceFingerprint` receives a guarded provenance update; it does not change
approval metadata or invoke the gallery approval interface. The installed `generate-images`
runtime becomes a committed, reproducibly verified bundle so focused installs remain
read-only and do not install packages into the Skill directory.

The consolidated specification must be approved before the migration pull request is
opened. The implementation issue may be created earlier, but its first gate is that final
specification approval.
