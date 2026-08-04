# Proportionate restructuring Migration Manifest

This is the normative path-family handoff for the revised minimum viable Collection.
The superseded plan and earlier manifest formerly under
`wayfinder/repository-restructure/` are removed from the active tree and must not
guide implementation. Their complete record remains in the
[immutable pre-removal tree](https://github.com/ken-guru/skills/tree/8c87d6b/wayfinder/repository-restructure).

## Actions

- **Move** — relocate the canonical artifact without retaining the old authority.
- **Split** — divide a mixed artifact or contract between its resulting owners.
- **Retain** — keep the path; change only what the revised structure requires.
- **Index** — replace owner-specific detail with navigation to its owner.
- **Retire** — remove obsolete material with no replacement authority.
- **Add** — create a newly approved minimal contract.
- **Regenerate** — do not migrate ignored working content; reproduce it at the target.

## Path families

| Current family | Target | Action | Required coupled change | Acceptance |
|---|---|---|---|---|
| `LICENSE` | Same path | Retain | None | Byte-identical |
| `AGENT.md` | Same path | Retain | Document flat standalone and one-level suite members | Documented tree matches final paths |
| `README.md` | Root README and `skills/presentation/README.md` | Split, Index | Root becomes Collection index; suite owns Presentation catalog, install, themes, security, and prerequisites | Maintained links resolve; complete-install command names all seven Skills |
| `CONTEXT.md` | Root `CONTEXT.md` and `skills/presentation/CONTEXT.md` | Split | Root retains Collection terms; suite receives Presentation terms | Both remain glossary-only; `CONTEXT-MAP.md` reaches both |
| — | `CONTEXT-MAP.md` | Add, Index | Link Collection and Presentation contexts | Both links resolve |
| — | `CONTRIBUTING.md` | Add | Document tree convention, stable names, owner-local evidence, extraction, and evidence threshold for shared tooling | Guidance matches revised specification |
| `.gitignore` | Same path | Retain | Replace active verification working-output paths; keep unrelated rules | Ignored outputs remain untracked at target |
| `.claude-plugin/marketplace.json` | Same path | Retain | Keep root source; make Collection description non-presentation-exclusive | Marketplace validation passes |
| `.claude-plugin/plugin.json` | Same path | Retain | Preserve name; set 1.1.0; point to seven nested member paths | Plugin validates, caches, and discovers seven invocations |
| Two Presentation workflows | Same paths | Retain | Update verification working, cache, Marp, report, and artifact paths; add bundle check to existing contract workflow | Prior triggers, permissions, runners, timeouts, Ghostscript behavior, and failure artifacts remain |
| `skills/build-presentation/**` | `skills/presentation/build-presentation/**` | Move, Split | Preserve name; inline only required state-routing contract; move its eight-case eval owner-local | Complete install, links, routing cases, and behavior pass |
| `skills/discover-presentation/**` | `skills/presentation/discover-presentation/**` | Move, Split | Preserve name; inline state fields and full local restart contract; bundle local invalidation implementation; move its eight-case eval | Complete install, local paths, routing cases, and restart integration pass |
| `skills/structure-agenda/**` | `skills/presentation/structure-agenda/**` | Move, Split | Preserve name; expand local restart contract | Complete install, local paths, and integration pass |
| `skills/generate-slides/**` | `skills/presentation/generate-slides/**` | Move, Split | Preserve name, scripts, and themes; expand restart contract; own Media Spec diff; bundle local invalidation implementation; move its fourteen-case eval | Theme/generation, local paths, routing cases, and verification pass |
| `skills/generate-images/**` | `skills/presentation/generate-images/**` | Move, Split | Preserve name; move authored script to `scripts/src/`; commit reproducible self-contained bundle; replace agent-home and runtime-install guidance | Bundle byte check and disposable path-with-spaces smoke pass |
| `skills/generate-diagrams/**` | `skills/presentation/generate-diagrams/**` | Move | Preserve name and owner-local D2 preflight | Complete install and local links pass |
| `skills/proofread-presentation/**` | `skills/presentation/proofread-presentation/**` | Move | Preserve name and behavior | Complete install and local links pass |
| `skills/shared/state-schema.md` | `skills/presentation/docs/state-schema.md` plus member-local fields | Move, Split | Suite document becomes maintainer overview; installed members do not link to it | Cross-phase integration tests pass |
| `skills/shared/restart-guard.md` and invalidation script | Three local restart protocols and two member-local invalidation scripts | Split, Retire | Remove canonical shared runtime authority | Installed members have no sibling path; common fixtures cover both implementations |
| `skills/shared/image-spec-diff.md` | Generate Slides owner-local Media Spec diff procedure | Move | Cover existing image and diagram diff behavior | Generation instructions link locally |
| `skills/shared/validation.md` | None | Retire | Keep startup checks inside actual consumers | No maintained references remain |
| `evals/build-presentation.json` | Build member `evals/` | Move | Preserve eight cases and stable name | Count and content match baseline |
| `evals/discover-presentation.json` | Discovery member `evals/` | Move | Preserve eight cases and stable name | Count and content match baseline |
| `evals/generate-slides.json` | Generate Slides member `evals/` | Move | Preserve fourteen cases and stable name | Count and content match baseline |
| Missing evals for four members | None | Retain absence | Do not create framework-driven coverage | No new eval requirement |
| `docs/adr/*.md` | `skills/presentation/docs/adr/` | Move | Preserve seven files and repair maintained links | Seven decisions remain |
| `docs/presentation-themes.md` | `skills/presentation/docs/presentation-themes.md` | Move | Rewrite active member and asset links | Documentation checks pass |
| Twelve gallery PNGs | `skills/presentation/docs/assets/presentation-themes/` | Move | Preserve bytes | SHA-256 values match baseline |
| Gallery manifest | Same target gallery directory | Move, Split | Preserve protected metadata; recompute only path-derived source fingerprint | Gallery checks pass; protected fields unchanged |
| — | `skills/presentation/docs/migration-1.1.md` | Add | Map old public source paths and replace focused-install guidance | Every maintained old path maps once; no shim exists |
| Active verification package excluding `prototype/` and ignored output | `skills/presentation/verification/presentation-themes/` | Move | Update imports, documentation destinations, workflows, fingerprints, and reports; do not introduce a generic path registry | Fast/full gates pass from target; approved hashes match |
| Verification baselines and manifest | Target verification `baselines/` | Move | Preserve bytes | 48 PNGs and manifest match baseline hashes |
| `verification/presentation-themes/prototype/**` | Same path | Retain | Exclude from relocated package | Historical assets unchanged; active commands exclude it |
| Active verification `.generated/`, `reports/`, `node_modules/` | Same names under target package | Regenerate | Do not copy local ignored contents | Clean install/render regenerates ignored output |
| `IMPLEMENTATION_SUMMARY.md` and `VERIFICATION_CHECKLIST.md` | Same paths | Retain | Repair only migration-caused broken links | Historical prose and structure unchanged |
| 28 completed pre-restructuring Wayfinder files | Same paths | Retain | Repair only migration-caused broken links | No relocation or modernization |
| `wayfinder/repository-restructure/**` | Immutable Git history only | Retire | Remove the superseded plan from the active tree; preserve commit `8c87d6b` as its historical record | Directory is absent; maintained documents use the immutable tree link |
| `wayfinder/repository-restructure-proportionality/**` | Same paths | Retain | Preserve revised decisions and normative manifest | Final approval links resolve |
| `docs/specs/repository-restructure.md` | Same path | Retain, replace authority | Replace prior design with proportionate specification | Final human approval recorded |
| Empty old `skills/shared/`, `evals/`, flat Skill paths, and active verification paths | None | Retire | Remove only after accounting and link scans | No obsolete active authority remains |

## Explicit non-additions

The migration adds no suite marker, dependency declaration, snapshot, shared-module
manifest, dependency tool, root-adapter registry, structural schema, Collection
checker, Collection workflow, PR template, contribution blueprint set, or framework-
driven eval suite.

## Checkpoints

1. **Baseline:** record names, disposable discovery/install, plugin validation,
   behavioral results, tracked-family accounting, and reviewed hashes.
2. **Coordinated cutover:** move active owners, localize runtime contracts, update
   adapters and paths, preserve history, and remove obsolete active paths.
3. **Acceptance:** reconcile this manifest, run supported distribution and behavioral
   gates, compare evidence, and release `presentation-skills` 1.1.0 only after the
   complete migration passes.
