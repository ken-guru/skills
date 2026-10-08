# Presentation Skill Suite quarry: which lessons real use proved

Research for [#483](https://github.com/ken-guru/skills/issues/483), a child of the rebuild map [#481](https://github.com/ken-guru/skills/issues/481).

**Question.** Which problems that the old Presentation Skill Suite solved were proven by real use, and which were anticipated but never observed? What reusable assets does the suite hold, what do they depend on, and how tied are they to the Project Folder state?

**Snapshot.** `main` at `878e311` (2026-10-08). Sizes are line counts of the files on that commit.

## Answer in short

- **Real use shows up in five recorded runs.** All were the maintainer's own Norwegian decks, and four of them ran under Copilot CLI. Almost every recorded field finding is about the **media and export end** of the pipeline: D2 diagrams, legibility, validation that passes broken output, stale or failing exports, and prompts that repeat. Nothing in the record tests the **front end** (Discovery, Agenda drafting, source fetching) beyond the number of questions it asks.
- **Proven by real use:**
  - Mechanical steps must be tested scripts. Prose-only steps lead agents to improvise commands that fail.
  - Diagram style has to be injected from the theme, not described in the spec.
  - Diagram legibility has to be measured against the real slot size.
  - A green validator isn't proof that a slide looks right.
  - Marp's PDF export needs a browser fallback.
  - Exports go stale after a media fix.
  - Batch independent questions, but keep the Agenda and Media Spec approvals. The user valued those.
  - Harness invocation and permission behaviour differ, and the command shape decides most Permission Prompts.
- **Anticipated, never observed:**
  - phase separation saving tokens;
  - Orchestrator token-cost hints;
  - reusing the phase skills for other project types;
  - prompt-injection skipping of sources;
  - collect-and-continue on failed fetches;
  - provider choice when both keys are set;
  - Interactive image mode;
  - switching themes, refreshing a theme, and External Font Overrides;
  - Git-checkpoint rollback.

  The state machinery (the Restart Guard, `PROJECT.json` phases, the theme lock) has field evidence only as a **cost**: prompts, file-edit approvals, and a hand-edited locked theme. No run shows it preventing harm.
- **Most reusable code:** the pure slide-markup core (`slide-composition.mjs`, `semantic-markup.mjs`), the image-provider adapters, the D2 call with role styling and the Effective Text Size measure, Marp export with its browser fallback, the validator's export detectors (PDF stream inflation, media references, page and slide parity, fingerprints), the theme CSS, and the test stubs and fixtures.
- **Most tied to the Project Folder:** `presentation-validation.mjs` (reads 11 kinds of state file and imports another Skill's module), the theme resolution, lock and invalidation scripts, and `generate-images`' `PROJECT.json` persistence.

## Evidence base

Evidence grades used below:

| Grade | Meaning |
|---|---|
| **Field** | Observed in a recorded run on a real deck with a real model. |
| **Field (inferred)** | A field run exposed the gap, but the harm was reasoned rather than seen. |
| **Live test** | The maintainer called a real external API or tool outside a deck run. |
| **Dev** | Found while building or testing: unit tests, CI, code review. |
| **Anticipated** | A design decision with no recorded observation behind it. |

The recorded field runs:

| Run | Harness | What ran | Record |
|---|---|---|---|
| F1 (Aug 2026) | not stated | A Proofread run on a real deck. | Map [#82](https://github.com/ken-guru/skills/issues/82), fixed in [PR #90](https://github.com/ken-guru/skills/pull/90). |
| F2 (Sep 2026) | Copilot CLI | A full Discovery → Proofread run, with a written retrospective in Norwegian. | Map [#379](https://github.com/ken-guru/skills/issues/379), first comment. |
| F3 (Sep–Oct 2026) | Copilot CLI (`npx skills`) | Proofread, then fixes; it counted five Decision Prompts and listed the commands. | Map [#450](https://github.com/ken-guru/skills/issues/450), first comment. |
| F4 (2026-10-07) | Copilot CLI | A planted sub-20 px diagram fixed through Proofread. | [#467](https://github.com/ken-guru/skills/issues/467), first comment. |
| F5 (2026-10-08) | Copilot CLI | Part 1: the same scenario on a Compact Signal deck. Part 2: a diagram on the title archetype. | [#467](https://github.com/ken-guru/skills/issues/467), later comments; [#464](https://github.com/ken-guru/skills/issues/464) comments. |

F4 and F5 were seeded reruns: temp copies of a real deck with one defect planted. They measure the repair paths, not first-time authoring.

## Lessons

### Proven by real use

| # | Lesson | Grade | Evidence | What the old suite did |
|---|---|---|---|---|
| 1 | **Mechanical steps described only in prose get improvised, and the improvisations fail.** The agent hand-wrote Node programs to split `DIAGRAM_SPEC.md` (the first regex missed an entry), built slide objects in a large inline `node` program, wrote `node -e` to get an invalidation plan, and chained `mktemp && marp && rm` for slide images. | Field | F2 §1 and §5; F3 (`node -e JSON.parse`); F4/F5 command tables | `render-diagrams.mjs` ([#389](https://github.com/ken-guru/skills/issues/389), PR [#421](https://github.com/ken-guru/skills/pull/421)), `slide-markup.mjs` (PR [#419](https://github.com/ken-guru/skills/pull/419)), the invalidation CLI (PR [#461](https://github.com/ken-guru/skills/pull/461)). Proofread's slide-image step was still prose at the freeze. |
| 2 | **Repeated ad hoc fixes for one validator failure mean the check is wrong.** | Field | F1: compressed PDF object streams hid pages and the MediaBox; JS strings in `<script>` counted as media; the bullet counter matched `-` while the generator emits `<li>`. | Detector fixes and the Maintenance "promotion policy" in PR [#90](https://github.com/ken-guru/skills/pull/90). |
| 3 | **Renderer output and validator expectations must be tested together.** D2 writes an `<?xml …?>` prolog; the validator required `<svg` first and blocked three valid diagrams. | Field | F2 §1 | The validator skips a valid prolog: [#380](https://github.com/ken-guru/skills/issues/380), PR [#388](https://github.com/ken-guru/skills/pull/388). |
| 4 | **Know the real CLI.** `d2 --validate` doesn't exist; it's `d2 validate <file>`. | Field | F2 §1 | Built into the render script. |
| 5 | **A palette described in prose doesn't reach the diagram.** The spec said "aubergine and coral"; the D2 code had no styles, so D2's default blue rendered. | Field | F2 §2 | Theme manifests declare Diagram Roles; spec D2 uses only `class: <role>`; the renderer injects the styling ([#384](https://github.com/ken-guru/skills/issues/384), PR [#421](https://github.com/ken-guru/skills/pull/421)). |
| 6 | **Diagram legibility depends on the slot, not the SVG.** A 2281×842 SVG with 36 px text became unreadable once scaled into the slide. | Field | F2 §2; then hit again in F3 (14.5 px) and planted in F4/F5 (4.6 px) | A 20 px Effective Text Size rule (font size × contain scale into a manifest-declared media box), blocking at render, validation and Proofread ([#385](https://github.com/ken-guru/skills/issues/385)). A CI job checks each theme's declared box against rendered CSS ([PR #423](https://github.com/ken-guru/skills/pull/423)). |
| 7 | **Only one archetype has a diagram slot.** A title-slide diagram was measured against the diagram archetype's box. Moving it off the cover led to a cover with no visual that no title archetype can render. | Field | F3 ([#454](https://github.com/ken-guru/skills/issues/454)); F5 Part 2 ([#479](https://github.com/ken-guru/skills/issues/479), open) | "Every Diagram gets its own Diagram slide" plus a validation **warning** (PR [#462](https://github.com/ken-guru/skills/pull/462)). |
| 8 | **A green validator isn't proof that slides look right.** Validation reported zero errors on blue, tiny diagrams. | Field | F2 §6 | Proofread renders slide PNGs with `marp --images png` and inspects one slide per archetype plus every media slide ([#393](https://github.com/ken-guru/skills/issues/393), PR [#420](https://github.com/ken-guru/skills/pull/420)). |
| 9 | **Verification that downloads at run time breaks.** D2's PNG output tried to install a Playwright driver and got a 404. | Field | F2 §6 | Avoided: slide images reuse the browser that Marp's PDF export already needs. |
| 10 | **Marp's browser auto-selection can pick a broken browser.** On macOS it picked Chrome Canary and the PDF failed; the agent improvised `--browser-path`. | Field | F3 | `export-presentation.mjs` retries stable Chrome, Chromium, Edge, then Firefox, and saves the one that works to `.marprc.yml` (PR [#462](https://github.com/ken-guru/skills/pull/462)). |
| 11 | **A media fix leaves the PDF stale, and page-count parity doesn't notice.** | Field (inferred) | F4 → [#470](https://github.com/ken-guru/skills/issues/470) ("nobody has opened the PDF from the run") | `export-lock.json` with SHA-256 fingerprints of the Markdown, media and theme CSS, an `exports.freshness` block, and an export-only refresh path (PR [#473](https://github.com/ken-guru/skills/pull/473)). |
| 12 | **Ask independent questions together; keep the real checkpoints.** One-at-a-time questions (goal, concern, takeaways; three diagram briefs × three fields; batch-or-interactive) caused many interruptions. The separate Agenda and Media Spec approvals "gave the user real control". | Field | F2 summary and §3 | Discovery in three rounds, all diagram briefs in one form, Batch as the default (PR [#418](https://github.com/ken-guru/skills/pull/418)). |
| 13 | **Don't re-ask what the user already answered.** A scope menu followed by "which slides?", and a Restart Guard after the user had approved the rebuild. | Field | F3 (5 prompts); F5 Part 1 and 2 (the guard asked again: [#476](https://github.com/ken-guru/skills/issues/476), open) | A named Media Scope skips the menu; a Proofread fix answers the guard's non-destructive option (PRs [#462](https://github.com/ken-guru/skills/pull/462), [#468](https://github.com/ken-guru/skills/pull/468)). The exact-match rule still misses fixes that rerender media. |
| 14 | **Steering text decides agent behaviour.** "Offer layouts after an Effective Text Size failure" made the agent offer layouts even when rerendering the correct spec would fix it. | Field | F4 → [#469](https://github.com/ken-guru/skills/issues/469) | Layouts only after the Skill's own render fails (PR [#474](https://github.com/ken-guru/skills/pull/474)); confirmed fixed in F5. |
| 15 | **Harnesses load Skills differently.** `/proofread-presentation` returned "not found" in Copilot because of `disable-model-invocation: true` (a Copilot bug since 1.0.74). Codex ignores the key. | Field | F2 §4; research [#381](https://github.com/ken-guru/skills/issues/381), [#387](https://github.com/ken-guru/skills/issues/387) | The flag was removed and a real trigger written (PR [#420](https://github.com/ken-guru/skills/pull/420)). |
| 16 | **Command shape decides Permission Prompts.** In Copilot, `&&` chains, `$(…)`, heredocs and `"$PWD"` arguments get only Yes or No. A single command with literal paths can be approved for the repo. File edits are the biggest single group, and one "don't ask again for file operations" answer removes them. The suite's own wording ("print one `Overwriting` line") produced `printf … && node …`. | Field | F4 (10 prompts), F5 Part 1 (17), Part 2 (25): [#464](https://github.com/ken-guru/skills/issues/464) comments; [#477](https://github.com/ken-guru/skills/issues/477) (open) | Not fixed; superseded by #481. Branch `feat/presentation-prompt-reduction` holds unused Skill Executables. |
| 17 | **The manifest, the generator and the validator must agree on slots.** Every manifest's `diagram` archetype omits `takeaway`; the generator always renders it; validation doesn't compare. Proofread raised a false blocker and later withdrew it. | Field | F5 Part 1 → [#475](https://github.com/ken-guru/skills/issues/475) (open) | Not fixed. |
| 18 | **The bundled themes have legibility defects, and a locked theme invites hand-editing.** Pagination at 14 px (below an 18 px rule) and low caption contrast; Proofread proposed editing the locked theme CSS and lock. | Field | F5 Part 2 → [#478](https://github.com/ken-guru/skills/issues/478) (open) | Not fixed. |
| 19 | **A structural repair replays everything.** Repairing through `structure-agenda` repeated the narrative-arc choice, every diagram brief, and refetched every source. | Field | F5 Part 2 → [#480](https://github.com/ken-guru/skills/issues/480) (open) | Not fixed. |
| 20 | **`PROJECT.json` phase bookkeeping is visible cost.** Phase timestamps produced 2–3 file-edit prompts per run, and the agent added a redundant `node -e JSON.parse` check after commit. | Field | F3; F4; F5 | Unchanged. |
| 21 | **Image APIs don't do what the docs say.** Gemini image models return JPEG whatever you ask (`image/png` gives a 400); the Interactions API warns it's experimental. JPEG bytes in a `.png` file broke nothing downstream, because Chromium sniffs bytes. | Live test | [PR #139](https://github.com/ken-guru/skills/pull/139), map [#138](https://github.com/ken-guru/skills/issues/138), [PR #145](https://github.com/ken-guru/skills/pull/145) | `generateContent`, then transcode to real PNG with `jpeg-js` and `pngjs`. |
| 22 | Text-only slides without a label rendered the word `undefined`. | Field (reporter not recorded) | [#53](https://github.com/ken-guru/skills/issues/53), [PR #55](https://github.com/ken-guru/skills/pull/55) | The empty slot is omitted. |

### Found in development, not in a field run

| # | Lesson | Evidence |
|---|---|---|
| 23 | A script's "am I main?" check compared `import.meta.url` with an unresolved `argv[1]`. Through a symlink (macOS `/var`, a symlinked install) the validator exited 0 silently, which looked like a pass. | [PR #461](https://github.com/ken-guru/skills/pull/461) |
| 24 | Pixel and rendered-acceptance gates in CI were flaky across machines. Theme looks became a human review; only deterministic checks stayed in CI. | Commits `fac50e8`, `8f71bd7`, `c64050f` |
| 25 | Committing a reproducible bundle beats `npm install` on first use, which mutates the installed Skill and needs network. | ADR-0005, revised from [PR #15](https://github.com/ken-guru/skills/pull/15). No failed field install is recorded. |
| 26 | Live testing caught the wrong research answer about Gemini PNG output (the Interactions API), which unit tests couldn't. | [PR #145](https://github.com/ken-guru/skills/pull/145) |

### Anticipated, never observed

| Lesson or mechanism | Source | What the record shows |
|---|---|---|
| Splitting phases saves tokens and lets a user iterate on one phase. | ADR-0001 | No measurement. Field runs used single Skills only as repair steps inside Proofread fixes (F3–F5). |
| The Orchestrator shows a token-cost estimate per operation. | ADR-0003 | Never mentioned in any run. |
| The phase skills are generic and get reused by other project types (`build-prd` and so on). | ADR-0002 | Never happened. |
| Skip and report sources that contain directive-like text. | ADR-0006, [PR #17](https://github.com/ken-guru/skills/pull/17) (prompted by a Snyk finding; its test plan is unchecked) | No run hit it. |
| Collect failed source fetches and report them at the end. | ADR-0003 | No recorded failed fetch. |
| Both API keys set → Gemini wins; persist the provider, hard-error on drift. | ADR-0008, PR [#139](https://github.com/ken-guru/skills/pull/139) | Live-tested once per provider by the maintainer; no deck run used OpenAI. |
| An Interactive (one-at-a-time) Generation Mode. | ADR-0004 | F2 asked for Batch by default; nobody asked for Interactive. |
| Choose from four themes, refresh a theme, External Font Override, theme invalidation plans. | PR [#49](https://github.com/ken-guru/skills/pull/49), `theme-resolution.mjs` | Field decks used Editorial (F2) and Compact Signal (F5). No run switched or refreshed a theme. The lock showed up only as friction (lesson 18). |
| The Restart Guard prevents stale files when a phase is rerun. | [PR #6](https://github.com/ken-guru/skills/pull/6) | Field evidence is all cost: it re-asked after approvals in F3 and three times across F5 (once in Part 1, twice in Part 2). No run shows it saving work that would otherwise be lost. |
| Git checkpoints allow a rollback. | Commit `df6dd7f` | Reset commits were created in runs; no rollback is recorded. |
| Persona depth questions, Norwegian language guidance (Språkrådet). | PRs [#2](https://github.com/ken-guru/skills/pull/2), [#3](https://github.com/ken-guru/skills/pull/3) | The field decks were Norwegian, but no run comments on the quality of either. |
| Smart routing from `PROJECT.json` state. | ADR-0003, `build-presentation/ROUTING.md` | No run reports routing problems or benefits. |

### Confirmed to work in the field

These are positive observations, which are also evidence:

- The Agenda and Media Spec approvals are valued checkpoints (F2 summary). In F5 Part 2 the Media Spec diff was shown for a real change and judged "legitimate".
- `render-diagrams.mjs --check --candidate` measured two layouts (30.5 px and 31.0 px) without writing anything (F4).
- A named Media Scope removed the menu and printed the `Overwriting` line (F5 Part 1).
- `export-presentation.mjs` wrote HTML, PDF and `export-lock.json` with real Marp on macOS, and freshness passed (PR [#473](https://github.com/ken-guru/skills/pull/473), F5 Part 1).
- The bundled validator shim ran without a Permission Prompt in F3, and could be approved for the repo once it got a literal path in F5 Part 2.

## ADRs at a glance

| ADR | Decision | Evidence |
|---|---|---|
| 0001 Phase separation with hybrid file state | Split phases; `PROJECT.json`, `DISCOVERY.json` and the rest are the source of truth | Anticipated. Its state files are the main source of file-edit prompts (lesson 20). |
| 0002 Presentation-specific naming | Presentation names; phases generic inside | Anticipated; reuse never happened. |
| 0003 Smart Orchestrator and error recovery | State routing, token hints, collect-and-continue fetches | Anticipated. |
| 0004 In-session image prompts, silent redo | Conversational scope and mode, later folded into one pre-spend confirmation | The amendment (#401) is field-driven (lesson 12); the original is anticipated. |
| 0005 Bundle `@google/genai` | Committed reproducible esbuild bundle | Dev. |
| 0006 Prompt-injection defence | Skip suspicious sources; no per-URL confirmation | Anticipated. |
| 0007 Optional media and D2 | Picture / Diagram / None; D2 with ELK over Mermaid | D2 is used in every field run. Its pitfalls (lessons 3–7) are all field-proven. Mermaid's cost was never measured. |
| 0008 Provider auto-detection | Detect from the key; Gemini wins ties | Anticipated (live-tested once). |

## Reusable assets

"Coupling" means coupling to the Project Folder state: `PROJECT.json`, `DISCOVERY.json`, `AGENDA.md`, `IMAGE_SPEC.md`, `DIAGRAM_SPEC.md`, `themes/theme-lock.json`, `export-lock.json`, `.marprc.yml`, and the hard-coded `PRESENTASJON.*` filenames.

| Asset | What it does | Dependencies | Size | Coupling |
|---|---|---|---|---|
| **Theme CSS**: `generate-slides/themes/{editorial,signal,field-notes,compact-signal}/theme.css` | Marp themes for a 1280×720 canvas. Each is keyed to a class contract (`archetype-{title,section,text-only,text-plus-image,data,quotation,diagram}`, `slot-*`, `variation-*`, `tone-*`). | Marp (`/* @theme */`, `@import "default"`, `data-marpit-pagination`); system fonts only, so it works offline; the class names that `semantic-markup.mjs` emits | 130 / 265 / 234 / 223 lines | **None** with the Project Folder; **tight** with the markup class contract. Known field defects: lessons 17 and 18. |
| **Theme manifests**: `theme.json` ×4, `catalog.json`, `theme.schema.json` | Palette, font stacks, picture and diagram treatments, Diagram Roles (fill, stroke, font colour, dash, font size per role), and per-archetype slots and media boxes | JSON Schema; consumed by theme-resolution, the renderer and the validator | ~97 lines each; schema 182; catalog 23 | Low in themselves. The media boxes are what makes Effective Text Size computable. |
| **Theme gallery**: `docs/assets/presentation-themes/*.png` (32) and `manifest.json` | A sample of every theme × archetype | — | 32 PNGs | None. A useful reference for a "default look" decision. |
| **D2 renderer**: `generate-diagrams/scripts/render-diagrams.mjs` | Parses spec entries; rejects inline styling outside the roles; injects a role preamble from the locked manifest; `d2 validate`; renders with `--layout=elk --theme=<tone>`; checks the SVG root and Effective Text Size against the media box; atomic rename; `--check` and `--candidate` dry runs; exit codes 0/1/2/130 | Node built-ins only; the `d2` binary (CI pins a version) | 445 lines; tests 376 + 83 lines with a stub `d2` | **Medium.** Reads the `DIAGRAM_SPEC.md` format, `DISCOVERY.json` (only `paths.themes`, optional), `theme-lock.json` and the locked `theme.json`. It never writes `PROJECT.json`. The D2 call, role preamble and legibility measure separate cleanly. |
| **Image providers**: `generate-images/scripts/src/generate-images.js` and its committed bundle | Gemini (`generateContent`, then JPEG → PNG) and OpenAI GPT Image adapters; key auto-detection; `--provider`, `--model`, `--slide(s)`, `--force`, `--delay`; separate errors for moderation blocks and organisation verification | `@google/genai` 1.52.0, `openai` 7.9.0, `jpeg-js` 0.4.4, `pngjs` 7.0.0; esbuild bundle (~1.0 MB) with a reproducibility check (`check-bundle.mjs`) | 319 lines of source | **High at the edges.** It parses `IMAGE_SPEC.md` and reads and writes `PROJECT.json` `phases.images` (provider and model persistence, drift errors). The provider adapters and transcoding are a self-contained core. |
| **Validation**: `presentation-validation/scripts/presentation-validation.mjs` and its `sh` shim | Read-only dispatcher with 28 named checks across `env`, `structure`, `media`, `theme`, `exports` and `sources`; profiles `generation` and `proofread`; JSON or human report | Node built-ins (`zlib` for PDF FlateDecode); `marp` and `d2` on `PATH` depending on profile; **imports `../../generate-slides/scripts/theme-resolution.mjs`**, crossing a Skill boundary | 925 lines; tests 389 + 154 lines; Marp export fixture (HTML, PDF, media) | **Highest.** It reads every state file listed above. Portable detectors inside it: `pdfSearchableText` and `countPdfPages` (compressed streams), `pdfPageSizes`, `mediaReferences` (strips `<script>` and `<style>`), `svgRootTag` (accepts a prolog), `effectiveTextSize` (duplicated in the renderer), slide-text and media parity, pagination, export-fingerprint comparison. |
| **Export**: `generate-slides/scripts/export-presentation.mjs` | Marp HTML and PDF in one call; stable-browser fallback saved to `.marprc.yml`; writes `export-lock.json` | Node built-ins; Marp CLI; a Chromium-family browser or Firefox | 244 lines; tests 208 lines with a stub `marp` | **Medium.** Hard-coded `PRESENTASJON.{md,html,pdf}`; reads `DISCOVERY.json`; owns `.marprc.yml` and `export-lock.json`. The browser-fallback logic is portable. |
| **Slide-markup core**: `slide-composition.mjs`, `semantic-markup.mjs` | Classifies a slide object into an archetype and plans it (`slide-composition.mjs`); renders escaped semantic HTML-in-Markdown with slot classes and collects every error at once (`semantic-markup.mjs`) | None (pure functions) | 118 + 114 lines; tests 276 lines (shared with the CLI) | **None** with the Project Folder; tight with the theme class contract. The cleanest salvage. |
| **Slide-markup CLI**: `slide-markup.mjs` | Slide objects as JSON on stdin; `--check` or `--write`; front matter from the locked theme | The core above, `prepare-theme.mjs`, `theme-resolution.mjs` | 270 lines | **High.** Requires `DISCOVERY.json` and a prepared Project Folder; writes `PRESENTASJON.md`. |
| **Theme resolution and lock**: `theme-resolution.mjs`, `prepare-theme.mjs`, `check-theme.mjs`, `presentation-theme-invalidation.mjs` (byte-identical copies in two Skills) | Catalog lookup and schema checks; snapshots the theme into the project with a hash lock; writes front matter and `.marprc.yml`; plans what a theme or font change invalidates | Node built-ins | 450 + 188 + 44 + 83 (×2) lines | **Highest.** It is the Project Folder machinery: `DISCOVERY.json`, `theme-lock.json`, `PROJECT.json` phases. Little evidence that its features were needed (see above). |
| **Verification harness**: `verification/presentation-themes/` | Capacity-deck fixtures, rendered geometry, accessibility and parity checks (local only), gallery approval and fingerprints, the diagram media-box CI check, Skill contract tests (prose regexes) | devDeps `@marp-team/marp-cli` 4.5.0, `playwright-core` 1.55.0, `@axe-core/playwright`, `markdown-it`, `pngjs` | ~2,000 lines of lib and scripts (`check-renders.mjs` alone is 581); 17 test files | Medium: fixtures generate Project Folders. The media-box check and the fixtures carry over; pixel gates already proved flaky (lesson 24). |
| **Test doubles and fixtures** | `stub-d2.mjs`, `stub-marp.mjs`, a real Marp export (HTML and PDF), diagram-legibility SVGs (exact threshold, just under, relative or attribute font sizes, unsized text, wide, tall) | — | small | None. High value for any rebuild's tests. |
| **Prose assets** | `CONTEXT.md` glossary (1,625 words); `PROVIDERS.md` setup guide (829); `SOURCES.md` injection rules; `QUESTIONS.md` and `DEFAULTS.md` for Discovery; `DRAFT_AGENDA.md` diagram-brief form; `IMAGE_SPEC_FEEDBACK_EXAMPLES.md`; one eval JSON per Skill | — | ~26,000 words across all `.md` in the suite; the biggest are `generate-slides/SKILL.md` (1,605) and `proofread-presentation/SKILL.md` (1,428) | The prose is written against the Project Folder and its phases throughout. The evals are documented, not executed ([#457](https://github.com/ken-guru/skills/issues/457)). |

### Coupling notes

- **Hidden cross-Skill import.** `presentation-validation` imports `generate-slides`' `theme-resolution.mjs` by relative path. So `presentation-validation` can't be installed alone, which breaks the rebuild's standalone rule as it stands.
- **Duplication.** `presentation-theme-invalidation.mjs` exists in two Skills, and `effectiveTextSize` exists in both the renderer and the validator. Each copy was made to keep Skills self-contained.
- **Norwegian filenames.** `PRESENTASJON.*` is hard-coded in the export, the slide-markup CLI, theme preparation and the validator.
- **Spec formats as interfaces.** The renderer and image generator are tied to the `DIAGRAM_SPEC.md` and `IMAGE_SPEC.md` Markdown entry formats. These are the narrowest seams to replace, for example with a file argument or JSON on stdin.

## New questions this raises

1. **Seed a standalone diagram skill from `render-diagrams.mjs`?** The theme lock dependency would become a role-style file argument, and the 20 px rule a parameter.
2. **Does the media box move with the CSS?** Effective Text Size needs a declared media box per slot. If the theme mechanism changes, where does that number live, and how is it verified (today: the CI browser job, [PR #423](https://github.com/ken-guru/skills/pull/423))?
3. **Is any persisted phase state needed at all?** Field evidence shows only its costs (lesson 20, the Restart Guard). The rebuild could derive state from the artifacts on disk, like the export fingerprint does.
4. **One run over the untested front end.** No field run shows Discovery, Agenda drafting or source fetching failing or succeeding on quality. The evals-first baseline in #481 is the first chance to get that evidence.
5. **Permission ergonomics as a design constraint.** Should single commands with literal paths, and no chaining, be a rule for every new skill from day one (lesson 16)?
6. **Default theme choice.** Editorial and Compact Signal are the only themes used in the field, and both carry open defects (lessons 17 and 18). Which one becomes the polished default, and are those defects fixed in the quarried CSS?
7. **Open issues on the frozen suite** ([#475](https://github.com/ken-guru/skills/issues/475)–[#480](https://github.com/ken-guru/skills/issues/480), [#467](https://github.com/ken-guru/skills/issues/467)): close as superseded, or keep as requirements for the rebuild?
