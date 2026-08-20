# Presentation source-path migration 1.1

Version 1.1 moves the complete Presentation Skill Suite beneath one owner without
changing any public Skill name or the `presentation-skills` Claude plugin name.

## Skill paths

| Before 1.1 | From 1.1 |
|---|---|
| `skills/build-presentation/` | `skills/presentation/build-presentation/` |
| `skills/discover-presentation/` | `skills/presentation/discover-presentation/` |
| `skills/structure-agenda/` | `skills/presentation/structure-agenda/` |
| `skills/generate-slides/` | `skills/presentation/generate-slides/` |
| `skills/generate-images/` | `skills/presentation/generate-images/` |
| `skills/generate-diagrams/` | `skills/presentation/generate-diagrams/` |
| `skills/proofread-presentation/` | `skills/presentation/proofread-presentation/` |
| `skills/presentation-validation/` | `skills/presentation/presentation-validation/` |

Old source paths have no redirect or compatibility shim. Install the complete suite
by selecting the Presentation group or all eight stable names. Individual member
selection may be exposed by an installer but is unsupported.

## Other active paths

| Before 1.1 | From 1.1 |
|---|---|
| `docs/adr/` | `skills/presentation/docs/adr/` |
| `docs/presentation-themes.md` | `skills/presentation/docs/presentation-themes.md` |
| `docs/assets/presentation-themes/` | `skills/presentation/docs/assets/presentation-themes/` |
| `evals/<member>.json` | `skills/presentation/<member>/evals/<member>.json` |
| `verification/presentation-themes/` except `prototype/` | `skills/presentation/verification/presentation-themes/` |
| `skills/shared/state-schema.md` | `skills/presentation/docs/state-schema.md` |
| `skills/shared/image-spec-diff.md` | `skills/presentation/generate-slides/MEDIA_SPEC_DIFF.md` |
| `skills/shared/restart-guard.md` | `skills/presentation/discover-presentation/RESTART-GUARD.md`, `skills/presentation/structure-agenda/RESTART-GUARD.md`, and `skills/presentation/generate-slides/RESTART-GUARD.md` |
| `skills/shared/presentation-theme-invalidation.mjs` | `skills/presentation/discover-presentation/scripts/presentation-theme-invalidation.mjs` and `skills/presentation/generate-slides/scripts/presentation-theme-invalidation.mjs` |
| `skills/shared/validation.md` | Retired (no replacement) |

The prototype remains at `verification/presentation-themes/prototype/`. The former
Restart Guard and invalidation contracts are now owner-local; the former shared
validation authority is retired.

## Baseline evidence

The pre-cutover snapshot is commit `1f82a4e`.

- `presentation-skills` was version `1.0.0` with the same seven names.
- `npx skills --list` found exactly seven Presentation members.
- A disposable complete selection installed all seven for Codex and Claude Code.
- Claude marketplace/plugin validation passed.
- Fast verification passed 35 tests.
- Full rendered verification passed 24 capacity slides and 12 gallery slides.
- The pre-cutover verification used 48 visual baseline hashes recorded in
  `baseline-manifest.json`. Those browser-dependent baselines are historical
  evidence only and are no longer part of the active verification suite.
- The twelve gallery hashes and protected metadata are recorded in the gallery
  manifest; its pre-cutover SHA-256 is
  `2e9a48d0051c2a44421d7e5db8277201212a5b74604fc9b79338b92e12d36e98`.

Only the gallery manifest's source fingerprint may change because its source paths
are part of the fingerprint.
