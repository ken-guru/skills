# Repository restructuring Migration Manifest

This manifest is the exhaustive implementation handoff for moving the current
presentation-only repository layout into a Collection containing the Presentation
Skill Suite. It records path families rather than enumerating homogeneous files such
as every approved PNG. Counts and hashes protect those families against accidental
loss or reapproval.

## Actions

- **Move** — relocate one canonical artifact without retaining the old path.
- **Split** — divide a mixed artifact at its ownership seams.
- **Retain** — keep the path and update content only where the new architecture requires it.
- **Index** — replace detailed content with broader navigation to the owning scope.
- **Adapter** — retain an externally fixed path as a thin adapter to its semantic owner.
- **Retire** — remove obsolete material without a replacement authority.
- **Add** — create a newly decided Collection, suite, Skill, or tooling contract.

## Migration waves

1. **Baseline evidence** — capture behavior, discovery, inventory, and approved hashes.
2. **Collection foundations** — add schemas, contribution guidance, tooling, bundle support,
   and fixture-level tests without enabling the repository-wide gate.
3. **Active-owner cutover** — move every active path-sensitive presentation artifact and
   update its consumers atomically.
4. **History and Collection closure** — relocate archives and planning, remove obsolete
   paths, and enable the Collection gate.
5. **Release acceptance** — prove every supported install and verification interface before
   releasing `presentation-skills` 1.1.0.

## Path manifest

| Current path | Target path | Action | Resulting owner | Wave | Coupled updates and preservation rule | Acceptance evidence |
|---|---|---|---|---:|---|---|
| `LICENSE` | `LICENSE` | Retain | Collection | 4 | No semantic change. | Byte-identical. |
| `AGENT.md` | `AGENT.md` | Retain | Collection | 4 | Replace the flat-Skill description with Collection → Skill Suite → Skill navigation and the canonical contract commands. | Collection check accepts the documented tree and commands. |
| `README.md` | `README.md` and `skills/presentation/README.md` | Split, Index | Collection and Presentation Skill Suite | 3 | Root retains Collection identity, `Skill Suites`, `Standalone Skills`, and top-level navigation. Presentation workflow, themes, member catalog, security, D2, and install detail move to the suite. | Required tables cover discovered owners exactly once; all links resolve. |
| `CONTEXT.md` | `CONTEXT.md` and `skills/presentation/CONTEXT.md` | Split | Collection and Presentation Skill Suite | 3 | Root retains Collection language. Pipeline and visual-domain language moves to Presentation. | Both files are glossary-only and contain no duplicate canonical terms. |
| — | `CONTEXT-MAP.md` | Add, Index | Collection | 2 | Index Collection and Presentation contexts and their relationship. | Every context appears exactly once and resolves. |
| — | `CONTRIBUTING.md` | Add, Index | Collection | 2 | Route standalone Skill, suite-member, new-suite, and ownership-transfer Contribution Paths. | Contribution links and required guarantees pass the Collection check. |
| — | `docs/contributing/{standalone-skill,suite-member-skill,skill-suite,ownership-transfer}.md` | Add | Collection | 2 | Add the four canonical contribution blueprints without copying schemas. | Blueprint presence and links pass the Collection check. |
| — | `.github/pull_request_template.md` | Add | Collection | 2 | Require Contribution Path, Artifact Owner, generated changes, and verification evidence. | Template contract check passes. |
| — | `root-adapters.json` | Add | Collection | 2 | Register externally fixed Presentation-owned root paths with strict owner and delegation records. | Schema and format-specific adapter checks pass. |
| — | `tools/{package.json,package-lock.json,.gitignore}` | Add | Collection | 2 | Establish one pinned dependency boundary for Collection tooling. | `npm ci --prefix tools` succeeds from a clean checkout. |
| — | `tools/skill-dependencies/` | Add | Collection | 2 | Implement the strict `sync` and `check` dependency Module and schemas. | Interface fixtures, whole-graph check, and deterministic snapshot tests pass. |
| — | `tools/collection-contracts/` | Add | Collection | 2 | Implement one read-only whole-Collection `check [--format json]` interface. | Interface fixtures pass from an unrelated working directory. |
| — | `.github/workflows/collection-contracts.yml` | Add | Collection | 4 | Install `tools/` dependencies and run the canonical Collection check. | Workflow passes on the final tree. |
| `.gitignore` | `.gitignore` | Split | Collection | 4 | Retain only Collection-owned `.vscode/` and `.envrc`; move verification working-output rules to their owner. | Ignored-output fixtures pass and no tracked artifacts are hidden. |
| `.claude-plugin/marketplace.json` | `.claude-plugin/marketplace.json` | Retain | Collection | 3 | Keep marketplace name, owner, and root source; change the Collection description so the repository is not presented as presentation-only. | Claude marketplace validation succeeds. |
| `.claude-plugin/plugin.json` | `.claude-plugin/plugin.json` | Adapter | Presentation Skill Suite | 3 | Keep `presentation-skills`; update all seven paths to `./skills/presentation/<stable-name>` and set version `1.1.0`. Register the root adapter. | Claude plugin validation/install succeeds with unchanged public identity. |
| `.github/workflows/presentation-theme-contracts.yml` | Same path | Adapter | Presentation Skill Suite | 3 | Preserve triggers, permissions, Ubuntu runner, timeout, and test intent; update working directory, cache lockfile, and commands. | Contract workflow passes and adapter delegation validates. |
| `.github/workflows/presentation-theme-rendering.yml` | Same path | Adapter | Presentation Skill Suite | 3 | Preserve triggers, permissions, macOS runner, Ghostscript, timeout, and artifacts; update working directory, cache, Marp, reports, and upload paths. | Full rendered workflow passes and uploads failures from the new owner path. |
| — | `skills/presentation/skill-suite.json` | Add | Presentation Skill Suite | 3 | Add strict suite ID `presentation` and display name `Presentation`. | Suite marker and two-or-more-member guarantees pass. |
| `skills/build-presentation/**` | `skills/presentation/build-presentation/**` | Move | `build-presentation` Skill | 3 | Preserve files and public name. Add Dependency Declaration, state-schema snapshot, and six Skill Dependencies. | Suite-only classification, preflight, routing evals, and complete-suite install pass. |
| `skills/discover-presentation/**` | `skills/presentation/discover-presentation/**` | Move | `discover-presentation` Skill | 3 | Preserve owner-local protocols. Add state-schema and restart-guard declarations/snapshots. | Isolated install, links, routing evals, and restart behavior pass. |
| `skills/structure-agenda/**` | `skills/presentation/structure-agenda/**` | Move | `structure-agenda` Skill | 3 | Preserve owner-local protocols. Add restart-guard declaration/snapshot. | Isolated install, links, and routing evals pass. |
| `skills/generate-slides/**` | `skills/presentation/generate-slides/**` | Move | `generate-slides` Skill | 3 | Preserve scripts, Theme Packages, and public name. Add restart-guard declaration/snapshot and owner-local image-spec diff guidance. | Isolated install, theme resolution, generation, links, and routing evals pass. |
| `skills/generate-images/**` | `skills/presentation/generate-images/**` | Move, Split | `generate-images` Skill | 3 | Preserve public behavior; move authored generator to `scripts/src/`, commit a pinned dependency bundle at `scripts/generate-images.js`, and replace agent-home/npm-install instructions with `<skill-dir>`. | Clean rebuild matches bundle; copy/symlink/plugin installs run from unrelated directories without writing to the Skill. |
| `skills/generate-diagrams/**` | `skills/presentation/generate-diagrams/**` | Move | `generate-diagrams` Skill | 3 | Preserve files and public name; add empty Dependency Declaration. | Isolated install and routing evals pass. |
| `skills/proofread-presentation/**` | `skills/presentation/proofread-presentation/**` | Move | `proofread-presentation` Skill | 3 | Preserve files and public name; add empty Dependency Declaration. | Isolated install and routing evals pass. |
| — | `skills/presentation/*/skill-dependencies.json` | Add | Each member Skill | 3 | Add strict declarations to all seven Skills. Only `build-presentation` has Skill Dependencies. | Dependency schema, direction, cycle, and installability checks pass. |
| — | `skills/presentation/{build-presentation,discover-presentation,structure-agenda,generate-slides}/dependency-snapshot/**` | Add | Each consuming Skill | 3 | Materialize deterministic state-schema and/or restart-guard closure from canonical Shared Modules. | Snapshot hashes, provenance, isolation, and no-back-path checks pass. |
| `skills/shared/restart-guard.md` and `skills/shared/presentation-theme-invalidation.mjs` | `skills/presentation/shared/restart-guard/{restart-guard.md,presentation-theme-invalidation.mjs,shared-module.json}` | Move | Presentation Skill Suite | 3 | Form one directory-grained `presentation/restart-guard` Shared Module. | Canonical manifest, consumer snapshots, invalidation tests, and module-relative paths pass. |
| `skills/shared/state-schema.md` | `skills/presentation/shared/state-schema/{state-schema.md,shared-module.json}` | Move | Presentation Skill Suite | 3 | Form `presentation/state-schema`; direct consumers are Build and Discovery. | Canonical manifest and both consumer snapshots pass. |
| `skills/shared/image-spec-diff.md` | `skills/presentation/generate-slides/IMAGE_SPEC_DIFF.md` | Move, transfer | `generate-slides` Skill | 3 | Make the actual consumer the owner and link it from maintained generation instructions. | No Shared Module identity remains; generation contract and links pass. |
| `skills/shared/validation.md` | — | Retire | — | 4 | Remove unused, self-referential, outdated shared guidance and its README entry. Record it in `migration-1.1.md`. | No maintained references or Dependency Declarations remain. |
| `evals/build-presentation.json` | `skills/presentation/build-presentation/evals/build-presentation.json` | Move | `build-presentation` Skill | 3 | Preserve all eight cases and stable name. | Case count and routing behavior match baseline. |
| `evals/discover-presentation.json` | `skills/presentation/discover-presentation/evals/discover-presentation.json` | Move | `discover-presentation` Skill | 3 | Preserve all eight cases and stable name. | Case count and routing behavior match baseline. |
| `evals/generate-slides.json` | `skills/presentation/generate-slides/evals/generate-slides.json` | Move | `generate-slides` Skill | 3 | Preserve all fourteen cases and stable name. | Case count and routing behavior match baseline. |
| — | `skills/presentation/{structure-agenda,generate-images,generate-diagrams,proofread-presentation}/evals/*.json` | Add | Each named member Skill | 3 | Add owner-local positive, negative, and meaningful boundary routing cases required by the approved contribution contract. | All seven member Skills satisfy eval-kind coverage without changing runtime behavior. |
| `docs/adr/*.md` | `skills/presentation/docs/adr/*.md` | Move | Presentation Skill Suite | 3 | Preserve seven filenames and decision status; rewrite maintained links. | Seven ADRs present and linked from suite documentation where applicable. |
| `docs/presentation-themes.md` | `skills/presentation/docs/presentation-themes.md` | Move | Presentation Skill Suite | 3 | Rewrite member and asset links relative to the suite. | Documentation and accessibility checks pass. |
| `docs/assets/presentation-themes/*.png` | `skills/presentation/docs/assets/presentation-themes/*.png` | Move | Presentation Skill Suite documentation | 3 | Move twelve approved PNGs byte-for-byte. | Before/after SHA-256 values match. |
| `docs/assets/presentation-themes/manifest.json` | `skills/presentation/docs/assets/presentation-themes/manifest.json` | Move, provenance update | Presentation Skill Suite documentation | 3 | Preserve asset entries, hashes, dimensions, provider, model, and `approvedAt`; recompute only suite-relative `sourceFingerprint`. | Gallery checks pass without invoking approval and all asset bytes remain unchanged. |
| — | `skills/presentation/docs/migration-1.1.md` | Add | Presentation Skill Suite | 3 | Publish the sole old-to-new path and installed-command compatibility mapping. | Every obsolete public path is mapped once; no shim exists. |
| `IMPLEMENTATION_SUMMARY.md` | `skills/presentation/docs/history/IMPLEMENTATION_SUMMARY.md` | Move | Presentation Skill Suite | 4 | Add a non-authoritative archival banner and portable links. | Archive banner and link checks pass. |
| `VERIFICATION_CHECKLIST.md` | `skills/presentation/docs/history/VERIFICATION_CHECKLIST.md` | Move | Presentation Skill Suite | 4 | Add a non-authoritative archival banner and portable links. | Archive banner and link checks pass. |
| `verification/presentation-themes/{package files,fixtures,lib,scripts,tests,baselines}` | `skills/presentation/verification/presentation-themes/**` | Move | Presentation Skill Suite verification | 3 | Move active package intact except required path rewrites. Preserve 48 baseline PNGs and manifest byte-for-byte. | Package install, fast/full tests, and baseline SHA-256 comparison pass. |
| — | `skills/presentation/verification/presentation-themes/lib/presentation-paths.mjs` | Add | Presentation Skill Suite verification | 3 | Replace repeated repository-root derivation with named, module-relative suite paths. | All external path consumers use the Module; tests run from unrelated cwd. |
| `verification/presentation-themes/prototype/**` | `skills/presentation/wayfinder/presentation-themes/assets/prototype/**` | Move | Presentation Themes planning history | 4 | Exclude the prototype from active verification and update its context pointer. | Prototype is absent from package commands and historical links resolve. |
| `verification/presentation-themes/{.generated,reports,node_modules}/` | Same names beneath relocated verification root when regenerated | Retire, regenerate | Presentation Skill Suite verification working output | 3 | Do not copy local ignored contents. Add owner-local ignore rules and regenerate/install only as needed. | Clean checkout remains clean after checks except documented ignored output. |
| `wayfinder/{map.md,01-*.md…06-*.md}` | `skills/presentation/wayfinder/presentation-pipeline/**` | Move | Presentation Skill Suite | 4 | Preserve seven planning files and rewrite relative links. | Map and ticket links resolve. |
| `wayfinder/optional-media/**` | `skills/presentation/wayfinder/optional-media/**` | Move | Presentation Skill Suite | 4 | Preserve six files and rewrite absolute `file:` links. | No absolute file URL remains. |
| `wayfinder/presentation-themes/**` | `skills/presentation/wayfinder/presentation-themes/**` | Move | Presentation Skill Suite | 4 | Preserve nine files and point to relocated prototype assets. | Map, ticket, and asset links resolve. |
| `wayfinder/presentation-theme-documentation/**` | `skills/presentation/wayfinder/presentation-theme-documentation/**` | Move | Presentation Skill Suite | 4 | Preserve six files and rewrite relative links. | Map and ticket links resolve. |
| `wayfinder/repository-restructure/**` | `wayfinder/repository-restructure/**` | Retain | Collection | 4 | Keep this map, decisions, research, inventory, and Migration Manifest at the owner of the Collection destination. | All context pointers remain relative and resolve. |
| Empty old `skills/shared/`, `evals/`, `verification/`, presentation-only root `docs/` subpaths, and moved Wayfinder directories | — | Retire | — | 4 | Remove only after reference scans and owner checks prove them empty and unused. | No obsolete canonical path exists outside `migration-1.1.md`. |
| — | `docs/specs/repository-restructure.md` | Add | Collection | 2–4 | Consolidate the approved architecture, target tree, this manifest, sequence, compatibility, and acceptance contract. | Final Wayfinder approval confirms the specification before implementation begins. |

## Release acceptance matrix

The migration pull request is not releasable until all of the following pass:

1. Baseline and final tracked-file accounting reconcile every manifest row.
2. All seven Skill frontmatter names and the `presentation-skills` plugin name remain unchanged.
3. Dependency synchronization is clean and the whole dependency graph validates.
4. The whole-Collection contract check passes from the repository and an unrelated working directory.
5. `npx skills --list` shows the Presentation group and each stable Skill exactly once.
6. Group selection and the explicit seven-Skill command install the complete suite.
7. Every phase Skill works through copy and symlink focused installation; Build alone reports its missing Skill Dependencies.
8. Supported Codex and Claude Code discovery work for focused and complete installations.
9. Claude validates and installs the 1.1.0 plugin from its managed cache.
10. Every installed command works when its project path and Skill path contain spaces.
11. Presentation verification passes its fast and full gates from the relocated package.
12. The two approval commands are exercised in a disposable copy and write only their distinct destinations.
13. All reviewed baseline and public gallery image hashes match the baseline evidence.
14. Maintained and historical links resolve without absolute `file:` URLs or hardcoded agent-home paths.
15. The root contains only Collection-owned material and registered thin adapters.
