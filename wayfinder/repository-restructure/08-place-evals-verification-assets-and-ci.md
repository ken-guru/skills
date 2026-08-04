# Place evals, verification, generated assets, and CI

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by:

- [Choose the canonical collection, suite, and Skill source tree](02-choose-the-canonical-source-tree.md)
- [Define collection, suite, and Skill artifact ownership](03-define-artifact-ownership-rules.md)
- [Inventory current presentation paths and references](04-inventory-current-paths-and-references.md)

## Question

Where should presentation evals, verification packages, fixtures, approved baselines, generated documentation assets, and CI workflows live, and how should their ownership and path contracts be expressed?

## Resolution

Place evals and verification according to the behavior they protect, while keeping cross-Skill acceptance as one deep suite-level Module:

- Put a Skill's routing evals under `skills/presentation/<skill>/evals/`.
- Put genuine cross-Skill routing or interaction evals under `skills/presentation/evals/`.
- Reserve root `evals/` for Collection behavior spanning independent Artifact Owners. Move the current `build-presentation`, `discover-presentation`, and `generate-slides` eval files into their owning Skill directories; cross-Skill negative cases remain there when they define that Skill's exclusion interface.
- Move the intact theme acceptance package to `skills/presentation/verification/presentation-themes/`. Keep its package manifest, lockfile, tests, fixtures, scripts, libraries, and ordinary visual baselines together.
- Preserve four distinct output classes:
  - Reviewed visual-regression baselines and their manifest remain verification-owned.
  - Gallery source fixtures remain verification-owned.
  - Approved public gallery images and their manifest move to `skills/presentation/docs/assets/`.
  - Reproducible `.generated/`, `reports/`, and installed dependencies remain ignored working output inside the verification package.
- Preserve separate approval interfaces: baseline approval changes only verification evidence, while gallery approval changes only public documentation assets. Each command must refuse to cross-write the other destination.
- Move the historical throwaway theme prototype beside its owning completed map at `skills/presentation/wayfinder/presentation-themes/assets/prototype/`; exclude it from active verification commands and update its context pointer.
- Retain `.github/workflows/presentation-theme-contracts.yml` and `.github/workflows/presentation-theme-rendering.yml` as thin suite-owned adapters because GitHub fixes their seam at repository root. Preserve their triggers, runner split, permissions, and artifact behavior; update path wiring and delegate substantive orchestration to verification package scripts.
- Move presentation verification ignore rules into `skills/presentation/verification/presentation-themes/.gitignore`. Keep other working-output rules with their narrowest owner; root `.gitignore` contains only Collection-wide patterns.
- Introduce one verification-owned path Module that resolves from its own source location and exposes named suite paths for member Skill sources, fixtures, baselines, working output, reports, and public documentation assets. Scripts and tests consume this interface instead of repeating upward traversal or repository-root derivation.
- Store suite-relative logical paths in fingerprint manifests rather than machine-specific or repository-depth paths.

Acceptance must prove eval discovery and case preservation; fast and full verification from the new package location; byte-for-byte movement of existing approved baselines without implicit reapproval; separate approval write boundaries; passing thin CI adapters; owner-local ignore behavior; exclusion of the historical prototype; use of the verification path Module for external paths; and reproducible public gallery assets linked from suite documentation.
