# Current presentation path and reference inventory

Snapshot: 2026-08-04, before the repository restructure.

This is an inventory for the later migration manifest, not a placement decision. Every
family below must eventually be classified as move, split, retain, replace with an
index/adapter, or retire.

## Presentation-owned source paths

### Member Skills and suite-shared material

The current `skills/` tree is entirely presentation-owned: 45 tracked files.

| Current path | Tracked files | Contents and exceptional files |
|---|---:|---|
| `skills/build-presentation/` | 2 | `SKILL.md`, `EXIT_CRITERIA.md` |
| `skills/discover-presentation/` | 5 | `SKILL.md` plus four directly referenced interview/write protocols |
| `skills/structure-agenda/` | 5 | `SKILL.md` plus defaults, drafting, iteration, and restart protocols |
| `skills/generate-slides/` | 20 | `SKILL.md`; six supporting Markdown protocols/examples; five `.mjs` scripts; `themes/catalog.json`, `themes/theme.schema.json`, and three theme packages of `theme.json` + `theme.css` |
| `skills/generate-images/` | 6 | `SKILL.md`, `PROVIDERS.md`, generator script, local `package.json`/`package-lock.json`, and `scripts/.gitignore`; ignored local `scripts/node_modules/` currently exists |
| `skills/generate-diagrams/` | 1 | `SKILL.md` |
| `skills/proofread-presentation/` | 1 | `SKILL.md` |
| `skills/shared/` | 5 | Four Markdown contracts/protocols plus `presentation-theme-invalidation.mjs` |

All seven public Skill names are frontmatter names and user-facing invocation names.
They are also referenced textually across the Skill contracts, README, ADRs, evals,
historical artifacts, and plugin manifest.

### Documentation, decisions, and public assets

| Current path | Tracked files | Contents |
|---|---:|---|
| `docs/adr/` | 7 | ADRs 0001–0007; all concern presentation pipeline architecture, naming, image generation, source security, or optional media |
| `docs/presentation-themes.md` | 1 | Public matched theme gallery and links back to two member Skills |
| `docs/assets/presentation-themes/` | 13 | 12 approved PNGs (3 themes × 4 archetypes) plus `manifest.json` |
| `CONTEXT.md` | 1 mixed file | Repository terms followed by a large presentation-domain glossary; requires splitting rather than a whole-file move |
| `IMPLEMENTATION_SUMMARY.md` | 1 | Presentation implementation history for optional media and image-spec feedback |
| `VERIFICATION_CHECKLIST.md` | 1 | Presentation implementation verification history |
| `README.md` | 1 mixed file | Collection identity plus presentation theme marketing, Skill catalog, shared-module links, security notes, install commands, and D2 setup |

`LICENSE` and `AGENT.md` are collection-owned inputs to classification, not
presentation-owned files. `AGENT.md` nevertheless describes only the current flat
`skills/<skill>/SKILL.md` shape and must be updated when the structure changes.

### Evals

`evals/` contains three presentation-owned routing suites:

- `evals/build-presentation.json` — 8 cases.
- `evals/discover-presentation.json` — 8 cases.
- `evals/generate-slides.json` — 14 cases.

The JSON `skill` fields and expected-result prose use stable Skill names rather than
source paths; moving the files does not itself require changing those names.

### Verification project and generated evidence

`verification/presentation-themes/` is one presentation-owned Node package with 95
tracked files:

| Family | Tracked files | Notes |
|---|---:|---|
| Package root | 3 | `README.md`, `package.json`, `package-lock.json` |
| `baselines/` | 49 | 48 approved PNGs (3 themes × HTML/PDF × 8 slides) plus `baseline-manifest.json` |
| `fixtures/` | 10 | Capacity deck, project templates, three common SVGs, gallery agenda/spec, and the approved gallery portrait PNG |
| `lib/` | 8 | Theme catalog and gallery contract, files, approval, documentation, preview, review-matrix, and slide-acceptance modules |
| `scripts/` | 9 | Fixture/gallery generation and rendering, render/gallery/documentation checks, and explicit baseline/gallery approval |
| `tests/` | 8 | Capacity, project generation, theme resolution, composition, invalidation, gallery source/approval/documentation |
| `prototype/` | 8 | Historical throwaway theme prototype, including two PNG assets and `run.sh` |

Ignored/reproducible working paths currently present are:

- `verification/presentation-themes/.generated/` — 96 current files; generated deck
  state, copied theme packages/media, Markdown, HTML, and PDF.
- `verification/presentation-themes/reports/` — 98 current files; screenshots,
  contact sheets, diffs/acceptance data, and gallery review artifacts.
- `verification/presentation-themes/node_modules/` — installed package dependencies.

These ignored paths require updated ignore patterns and path resolution after a move,
but their current contents are not migration payload.

### Historical planning

There are 28 tracked Markdown files in the pre-existing `wayfinder/` history, all
presentation-owned:

- Root presentation-pipeline map and six tickets: 7 files.
- `wayfinder/optional-media/`: map plus five tickets (6 files).
- `wayfinder/presentation-themes/`: map plus eight tickets (9 files).
- `wayfinder/presentation-theme-documentation/`: map plus five tickets (6 files).

`wayfinder/repository-restructure/` is collection-owned and must remain outside the
Presentation Skill Suite. It is untracked work in progress in this snapshot and is
not included in the 28-file count.

## Path-sensitive references

### Markdown links and prose paths

Inbound references from collection-level surfaces:

- `README.md` links to all seven current `skills/<name>/SKILL.md` paths, three
  `skills/shared/*.md` modules, `docs/presentation-themes.md`, three gallery title
  PNGs, and ADR 0006.
- `README.md` publishes the complete and individual `npx skills` commands using all
  seven stable names.
- `CONTEXT.md` points to `skills/shared/state-schema.md`.
- `IMPLEMENTATION_SUMMARY.md` and `VERIFICATION_CHECKLIST.md` contain historical
  exact paths under `skills/shared/`, `skills/generate-slides/`,
  `skills/structure-agenda/`, `skills/discover-presentation/`,
  `skills/generate-diagrams/`, and `docs/adr/`.
- `AGENT.md` assumes each direct child of `skills/` is a Skill.

Links within material that will likely move together:

- `docs/presentation-themes.md` links to
  `../skills/build-presentation/SKILL.md` and
  `../skills/discover-presentation/SKILL.md`.
- `build-presentation/SKILL.md`, `discover-presentation/WRITE_DISCOVERY.md`, and the
  three member `RESTART-GUARD.md` files link to `../shared/*.md`.
- Historical Presentation Theme tickets link to root `CONTEXT.md` and
  `verification/presentation-themes/prototype/README.md`.
- Historical maps `wayfinder/map.md` and `wayfinder/optional-media/map.md` use
  absolute `file:///Users/ken/Workspace/ken-guru/skills/...` links; relocation alone
  will break them and the migration must rewrite them to portable relative links.

Project-artifact paths such as `docs/`, `docs/sources/`, `images/`, `PROJECT.json`,
and `PRESENTASJON.*` inside Skill contracts describe generated user projects, not
repository locations. They must not be mechanically rewritten during the repository
move.

### Code imports and repository-root literals

The verification project reaches outside itself through these source seams:

- Six files import `generate-slides` modules with
  `../../../skills/generate-slides/...`:
  `fixtures/capacity-deck.mjs`, `scripts/generate-fixtures.mjs`,
  `scripts/generate-gallery-fixtures.mjs`, `tests/capacity-fixture.test.mjs`,
  `tests/project-generation.test.mjs`, and `tests/slide-composition.test.mjs`.
- `tests/theme-resolution.test.mjs` imports `theme-resolution.mjs` and resolves the
  installed themes using the same `../../../skills/generate-slides/...` shape.
- `tests/state-invalidation.test.mjs` imports
  `../../../skills/shared/presentation-theme-invalidation.mjs`.
- `lib/theme-catalog.mjs` resolves
  `../../../skills/generate-slides/themes/catalog.json`.
- `scripts/generate-fixtures.mjs` and `scripts/generate-gallery-fixtures.mjs`
  additionally construct repository-relative
  `skills/generate-slides/themes` paths.

The gallery producer/validator has a repository-root contract:

- `lib/gallery-files.mjs` derives the repository root as `../..`, fingerprints an
  explicit list of `skills/generate-slides/**`,
  `verification/presentation-themes/**`, and package files, and writes approved
  assets to `docs/assets/presentation-themes/`.
- `lib/gallery-markdown-preview.mjs` reads root `README.md` and
  `docs/presentation-themes.md`.
- `scripts/check-gallery-documentation.mjs` reads those same two docs.
- `tests/gallery-documentation.test.mjs` embeds expected paths for
  `docs/assets/presentation-themes`, `docs/presentation-themes.md`, and
  `skills/build-presentation/SKILL.md`.

Imports internal to `skills/generate-slides/scripts/` and internal to the verification
package are relative and should survive if each family moves intact.

### Installed-runtime path literals

`skills/generate-images/SKILL.md` and `PROVIDERS.md` execute and install dependencies
at `~/.claude/skills/generate-images/scripts/...`. These are public installed-layout
assumptions, distinct from repository paths. Nesting the source under
`skills/presentation/` may or may not change the installer’s destination layout, so
the migration must verify these commands rather than rewrite them blindly.

## Discovery and packaging manifests

- `.claude-plugin/plugin.json` defines the stable `presentation-skills` plugin and
  explicitly lists all seven `./skills/<name>` paths. Every entry changes when member
  Skills move; plugin name, Skill frontmatter names, version, and keywords are
  compatibility surfaces.
- `.claude-plugin/marketplace.json` defines the collection marketplace and a single
  `presentation-skills` plugin sourced from `./`. Its source can remain root-level,
  while its collection/presentation-only descriptions need classification.
- Root discovery via `npx skills` currently finds the seven direct children. README
  commands select by stable name; the nested-layout research requires validating
  the post-move selection list.

## Automation, scripts, and verification entry points

Two collection-level workflows are presentation-owned automation:

- `.github/workflows/presentation-theme-contracts.yml` sets the working directory
  and npm cache lockfile path to `verification/presentation-themes`, runs `npm ci`,
  then `npm test`.
- `.github/workflows/presentation-theme-rendering.yml` embeds the verification
  working directory, lockfile, report upload path, and local Marp executable path;
  it installs Ghostscript and runs `npm run test:full`.

The verification package publishes these path-sensitive entry points:

- Producers: `npm run fixtures`, `fixtures:gallery`, `render`, and `render:gallery`.
- Checks: `npm test`/`test:fast`, `check-renders`, `check-gallery`,
  `check-gallery-docs`, and `test:full`.
- Explicit mutation/approval: `npm run approve-baselines -- --approve` and
  `npm run approve-gallery -- --approve`.
- Environment inputs: `PRESENTATION_THEME_MARP` and
  `PRESENTATION_THEME_BROWSER`.

`skills/generate-images/scripts/package.json` and lockfile form a second Node
dependency boundary. Its Skill startup commands run local `npm install
--ignore-scripts` and `node .../generate-images.js`; both installed path and lockfile
must remain coherent.

## Ignore, generated, and baseline coupling

`.gitignore` has three exact presentation verification paths:

- `verification/presentation-themes/.generated/`
- `verification/presentation-themes/reports/`
- `verification/presentation-themes/node_modules/`

The untracked local `skills/generate-images/scripts/node_modules/` is ignored by
`skills/generate-images/scripts/.gitignore` rather than an explicit root
`.gitignore` entry.

Approved artifacts are not interchangeable:

- The 48 `baselines/*.png` files and `baseline-manifest.json` are ordinary HTML/PDF
  visual-regression evidence.
- The 12 `docs/assets/presentation-themes/*.png` files and their `manifest.json` are
  public documentation assets produced only by the gallery approval path.
- `fixtures/gallery/media/collaboration-portrait.png` is the approved source image
  reused to render the gallery.
- `prototype/` assets are historical prototype evidence, not current approved
  baselines or public gallery output.

The migration must preserve those roles, update producer/consumer paths together,
and prove that approval commands cannot cross-write the two approved artifact sets.

## Minimum migration-reference checks

A path-by-path migration manifest should not be considered complete until it has:

1. Classified every tracked family and each mixed root file above.
2. Updated and checked every Markdown link, including historical absolute `file:`
   links.
3. Updated all verification imports, root derivations, fingerprint source lists,
   public asset destinations, and documentation assertions.
4. Updated plugin Skill paths, workflow working/cache/report paths, and ignore rules.
5. Verified `npx skills --list`, individual selection by all seven stable names, and
   Claude plugin validation.
6. Run the verification package’s fast and full gates from its new location.
7. Verified both explicit approval commands against their distinct destinations.
8. Tested the installed `generate-images` dependency and script paths in each
   supported installer layout.
