# Slide-rendering stacks for decks an agent writes and checks

Research for [#484](https://github.com/ken-guru/skills/issues/484), a child of the
map [#481](https://github.com/ken-guru/skills/issues/481). Researched 2026-10-08.

## Question

Which slide-rendering stack best suits a deck an agent writes, checks, and
renders across Claude Code, Copilot CLI, and Codex?

The ticket asks for Marp, Slidev, reveal.js, and pptxgenjs / python-pptx to be
compared on these criteria: speaker notes, HTML / PDF / PPTX export, theming,
offline use, install footprint, how easily an agent writes and checks the
source (including rendering slides to images), and accessibility of the
output. Pandoc (with Quarto as a wrapper around it) was added as a sixth
candidate because it is the one strong contender that writes editable PPTX
with notes from Markdown.

This note gives evidence and a leaning. The decision belongs to the map's
grilling ticket.

## Answer in brief

- **No stack renders slides to images without a browser engine, except one
  that goes through LibreOffice.** Every HTML stack needs Chromium (or
  Firefox) for PDF and PNG output. Every PPTX stack needs LibreOffice plus
  Poppler to make images for checking. The real choice is which renderer the
  skill pins and how it gets one, not whether it needs one.
- **Marp is still the best fit for "an agent writes Markdown, renders it, and
  looks at it."** It needs one CLI. The source is plain Markdown, with notes
  in HTML comments and the theme in one CSS file. It writes HTML, PDF, PPTX,
  and per-slide PNGs, and it is actively maintained (v4.5.1, 2026-09-06).
  Its weak points are PPTX, which is image-only by default and loses notes in
  the experimental editable mode, and browser discovery.
- **The browser-selection pain has a known cause and a known fix.** Marp's
  own macOS Chrome finder checks Chrome Canary before stable Chrome. Its
  `--browser-path` and `CHROME_PATH` let a skill pin a specific binary, such
  as a `chrome-headless-shell` that `npx @puppeteer/browsers install`
  downloads. On Linux that binary still needs system libraries (nss, glib,
  X11), which were missing here.
- **Slidev is the most agent-aware stack.** It ships an MCP server and an
  official agent skill, and it has the best PPTX: `pptx-editable` keeps
  notes and alt text. It is also the heaviest (566 MB of `node_modules` before
  the browser), needs Node ≥ 22.12, and fetches Google Fonts and themes from
  the network by default.
- **reveal.js is a library, not a toolchain.** The agent has to write HTML
  and add DeckTape for PDF and PNG. It has no PPTX path unless it goes
  through Pandoc or Quarto.
- **pptxgenjs and python-pptx give the best native PPTX**, with real notes,
  alt text, and slide masters. They make poor sources for an agent to write
  and check: the deck is a program, and visual checks go through LibreOffice
  with font substitution. python-pptx has had no release since 2024-08-07, and
  pptxgenjs none since 2025-06-26.
- **Pandoc is the strongest add-on candidate.** One 35–42 MB binary works
  offline. It turns Markdown with `::: notes` into editable PPTX (themed by a
  `--reference-doc` .pptx) and into reveal.js HTML. Checking still needs a
  browser or LibreOffice.

## Current incumbent: how Marp is used today

From `skills/presentation/generate-slides/scripts/export-presentation.mjs` and
`skills/presentation/proofread-presentation/SKILL.md` (frozen old suite, read
only):

- HTML export needs no browser. PDF export runs `marp --pdf`. When that
  fails, the script tries each installed stable-channel browser in a fixed
  order (Chrome, Chromium, Edge, then Firefox on macOS and on `PATH`). It
  saves the first browser that works as `browser` and `browserPath` in
  `.marprc.yml`. It names every binary explicitly because "Marp's own
  `chrome` choice can resolve to a Canary or beta build."
- Proofread renders slide images with
  `marp <deck> --images png --allow-local-files`, using the same saved
  browser, and inspects them visually. The PDF is not reviewed separately.
- PPTX is "optional and manual" (`generate-slides/SKILL.md`).

The cause is confirmed in Marp CLI 4.5.1's bundled finder
(`lib/manager-*.js`). On macOS the Chrome candidate list is `CHROME_PATH`,
`LIGHTHOUSE_CHROMIUM_PATH`, Chrome Canary, then Chrome, and in the
`lsregister` scan Canary has the higher weight (`101` against `100`). The
finder also honours `CHROME_PATH` and `FIREFOX_PATH`, and its default
conversion protocol is `webDriverBiDi`.

## Candidates, versions, and maintenance

Versions are from the npm registry, PyPI, and GitHub releases on 2026-10-08.

| Stack | Latest version (date) | Last commit | Licence | Notes on maintenance |
|---|---|---|---|---|
| Marp CLI (`@marp-team/marp-cli`) | 4.5.1 (2026-09-06) | 2026-09-08 | MIT | Steady releases (4.4.0 May, 4.4.1 Jul, 4.5.0 Jul, 4.5.1 Sep 2026); standalone binaries for linux, linux-arm64, mac, win. Marp Core v5 exists; CLI 4.5.1 prefers `@marp-team/marp-core/full` if v5 is installed. |
| Slidev (`@slidev/cli`) | 53.0.0 (2026-09-16) | 2026-10-02 | MIT | Very active; v53 raised the floor to Node ≥ 22.12. |
| reveal.js | 6.0.2 (2026-09-10) | 2026-09-30 | MIT | Active; v6.0.0 (2026-03-11) moved build to Vite, changed plugin/CSS paths, added `@revealjs/react`. |
| DeckTape (PDF/PNG for HTML decks) | 3.16.1 (2026-04-20) | 2026-07-13 | MIT | Active, slower cadence. |
| pptxgenjs | 4.0.1 (2025-06-26) | 2025-06-26 | MIT | No release or commit in 15 months; 303 open issues. |
| python-pptx | 1.0.2 (2024-08-07) | 2024-08-07 | MIT | No release or commit in 26 months; 541 open issues. |
| Pandoc | 3.12.1 (2026-10-08) | — | GPL-2.0+ | Very active. |
| Quarto CLI | 1.10.19 (2026-10-06) | 2026-10-08 | MIT-ish (NOASSERTION on GitHub) | Very active; bundles Pandoc. |

Sources: `npm view <pkg>`; GitHub REST `repos/<repo>` and
`repos/<repo>/releases`; python-pptx
[HISTORY.rst](https://github.com/scanny/python-pptx/blob/master/HISTORY.rst).

## Findings by criterion

### Speaker notes

- **Marp:** notes are HTML comments on a slide (Marpit "presenter notes").
  They appear in the HTML presenter view (press `p`), in PDF as annotations
  with `--pdf-notes`, and in regular PPTX. They are exported as text with
  `--notes`. They are **not** supported in `--pptx-editable`.
  ([marp-cli README](https://github.com/marp-team/marp-cli#readme))
  In the HTML, the notes are embedded as `<div class="bespoke-marp-note">`
  (observed).
- **Slidev:** "The comment blocks at the end of each slide are treated as the
  note of the slide." Notes appear in presenter mode and are included in both
  PPTX modes. The CLI calls pptxgenjs `slide.addNotes(note)`.
  ([syntax.md](https://github.com/slidevjs/slidev/blob/main/docs/guide/syntax.md#notes),
  [exporting.md](https://github.com/slidevjs/slidev/blob/main/docs/guide/exporting.md))
- **reveal.js:** notes go in `<aside class="notes">`, `data-notes`, or a
  Markdown `Note:` separator. The speaker view opens with `S`; "When used
  locally, this feature requires that reveal.js runs from a local web
  server." `showNotes: true | "separate-page"` prints notes into the PDF.
  ([speaker-view.md](https://github.com/reveal/revealjs.com/blob/master/src/speaker-view.md),
  [pdf-export.md](https://github.com/reveal/revealjs.com/blob/master/src/pdf-export.md))
- **pptxgenjs:** `slide.addNotes(notes: string)` adds plain-text notes (from
  `types/index.d.ts` in 4.0.1).
- **python-pptx:** `slide.notes_slide.notes_text_frame` adds full rich-text
  notes, created from the notes master.
  ([notes.rst](https://github.com/scanny/python-pptx/blob/master/docs/user/notes.rst))
- **Pandoc:** a `::: notes` div works for reveal.js, PPTX, and Beamer. "Speaker
  notes in PowerPoint will be available, as usual, in handouts and presenter
  view." ([MANUAL](https://github.com/jgm/pandoc/blob/main/MANUAL.txt), "Speaker notes")

### HTML / PDF / PPTX export

- **Marp:** HTML (no browser), PDF, PPTX, PNG/JPEG (`--images`), and notes as
  TXT. "You have to install any one of Google Chrome, Microsoft Edge, or
  Mozilla Firefox to convert slide deck into PDF, PPTX, and image(s)."
  Regular PPTX "consists of pre-rendered background images". Text cannot be
  edited, but notes are kept. `--pptx-editable` is experimental, needs
  LibreOffice Impress too, has "lower slide reproducibility", and drops notes.
  `--pdf-outlines` adds bookmarks.
- **Slidev:** SPA build (`slidev build`), PDF, PPTX (slides as images, notes
  kept), `pptx-editable` (PowerPoint shapes; SVG, canvas, iframes, video,
  KaTeX, and CSS effects stay as pictures; notes kept; fonts must be installed
  on the viewer's machine), PNG, and Markdown. "All CLI exports require
  `playwright-chromium`."
- **reveal.js:** HTML only, plus browser print (`?print-pdf`), which is "only
  confirmed to work in Google Chrome and Chromium". Command-line PDF and PNG
  go through [DeckTape](https://github.com/astefanutti/decktape)
  (`decktape reveal`, `--screenshots`), which uses Puppeteer and Chrome. There
  is no PPTX.
- **pptxgenjs / python-pptx:** PPTX only. Neither can render PDF or images.
- **Pandoc:** reveal.js (and other HTML slide formats), PPTX (editable, built
  from a reference doc's layouts), and Beamer PDF. PDF from the reveal.js
  output still needs a browser; PDF from PPTX needs LibreOffice.

### Theming and how a user changes the look

- **Marp:** a theme is one CSS file with a `/* @theme name */` comment. It is
  selected with the `theme:` directive, `--theme`, or `--theme-set`, and
  per-slide classes come from `<!-- _class: … -->`. The old suite's whole
  theme catalogue is built on this.
- **Slidev:** a theme is an npm package or a local folder (`theme: seriph`,
  `theme: ../my-theme`). It includes layouts (Vue), styles (UnoCSS), and
  config. If a theme is missing, the dev server asks to install it from npm.
  `slidev theme eject` copies a theme into the project. It is the most
  powerful system and also the most code-heavy for a user to change.
- **reveal.js:** 12 built-in theme stylesheets. "All theme variables are
  exposed as CSS custom properties". A custom theme is Sass or plain CSS.
- **pptxgenjs:** `defineSlideMaster()` builds masters in code. The theme is
  the program.
- **python-pptx / Pandoc:** start from an existing `.pptx` template
  (`Presentation('template.pptx')` / `--reference-doc`). Users change the
  look **in PowerPoint**, the most familiar route for non-developers. Pandoc
  maps content onto seven named layouts (Title Slide, Section Header, Two
  Content, Comparison, Content with Caption, Blank, Title and Content).

### Offline use

- **Marp:** works fully offline once installed, given a local browser. The
  HTML it wrote here was self-contained; its only external URL was a licence
  comment. It blocks local files in browser conversions unless
  `--allow-local-files` is set.
- **Slidev:** needs the network on first run for themes and add-ons, which
  install from npm. Its default theme declares
  `fonts: { sans: 'Avenir Next,Nunito Sans', mono: 'Fira Code', local: 'Avenir Next' }`,
  and the default font provider is Google Fonts over a CDN. Offline, Nunito
  Sans and Fira Code fall back to system fonts unless `fonts.provider: none`
  is set. A `bundle-remote-assets` feature exists.
- **reveal.js:** works offline from local files; the speaker view and external
  Markdown need a local server.
- **pptxgenjs / python-pptx / Pandoc:** fully offline. Rendering images for
  checks needs a local LibreOffice.

### Install footprint

Measured here on Linux arm64 with `npm install`, browser downloads skipped:

| Stack | `node_modules` | Packages (approx.) | Plus |
|---|---|---|---|
| Marp CLI 4.5.1 | 134 MB | 168 | a system browser, or a standalone binary of about 47–49 MB |
| Slidev 53 + default theme + `playwright-chromium` | 566 MB | 711 | Playwright Chromium download; Node ≥ 22.12 (monaco-editor alone is 103 MB) |
| reveal.js 6.0.2 | 6.1 MB | 1 (no dependencies) | DeckTape (86 MB + Chrome) for PDF/PNG |
| pptxgenjs 4.0.1 | 7.8 MB | 19 | LibreOffice + Poppler for images |
| python-pptx 1.0.2 | (pip: lxml, Pillow, XlsxWriter) | — | LibreOffice + Poppler for images |
| Pandoc 3.12.1 | single binary, 35 MB (linux-amd64 tarball) / 42 MB (macOS zip) | — | browser or LibreOffice for images |
| Quarto 1.10.19 | 147 MB (linux tarball) / 248 MB (macOS) | — | same |

A downloaded `chrome-headless-shell@stable` (155.0.8059.39, linux-arm64)
took 274 MB. It did not start here because system libraries were missing
(`libnss3`, `libglib-2.0`, `libX11` and others, reported by `ldd`).

### How easily an agent writes and checks the source

- **Marp:** one Markdown file with front matter and directives. Diffs are easy
  to read, and it can be checked with plain text tools. To check visually, one
  command, `marp --images png`, writes `deck.001.png`… per slide. The renderer
  that makes the check images is the same one that makes the PDF. The old
  suite already has markup checks, a theme check, and an image-review loop
  built on this.
- **Slidev:** Markdown plus optional Vue components. It has the best agent
  integration: a built-in MCP server (`slidev mcp slides.md` over stdio, or
  `/__mcp` on the dev server) with tools to get, update, insert, remove, and
  move slides, and an official agent skill (`npx skills add slidevjs/slidev`).
  ([mcp.md](https://github.com/slidevjs/slidev/blob/main/docs/features/mcp.md),
  [work-with-ai.md](https://github.com/slidevjs/slidev/blob/main/docs/guide/work-with-ai.md))
  Visual checks use `slidev export --format png`. The MCP server only works
  where the harness supports MCP, so a skill cannot rely on it in every
  harness.
- **reveal.js:** the agent writes HTML (or Markdown inside HTML), and
  `decktape reveal --screenshots` gives the images. It is workable, but it
  means more glue and more surface for mistakes.
- **pptxgenjs / python-pptx:** the deck is a script, and the agent places
  every box by coordinates. Anthropic's public `pptx` skill
  ([anthropics/skills](https://github.com/anthropics/skills/blob/main/skills/pptx/SKILL.md))
  shows what this costs. Visual checks need
  `soffice --headless --convert-to pdf` then `pdftoppm`. "Your visual QA
  renders via LibreOffice, which substitutes fonts it doesn't have … your QA
  preview can show text overflow (or fit) that the real deck won't have."
  The skill also lists pptxgenjs traps: it mutates option objects in place,
  and some combo charts produce files PowerPoint rejects as corrupt.
- **Pandoc:** Markdown in, same as Marp. Layouts are chosen from the content's
  shape, not by the author, so fine control is limited. Checks go through
  LibreOffice for PPTX or a browser for reveal.js.

### Accessibility of the output

- **Marp HTML:** keeps real headings (`<h1 id="title">`), `alt` text on
  images, and `lang` on `<html>` and on each `<section>` (observed). Each
  slide sits in an `<svg><foreignObject>` wrapper for scaling. **PDF:** Marp
  calls Puppeteer's `page.pdf()` without `tagged`, and Puppeteer 24's default
  is `tagged: true` (experimental), so PDFs made through Chrome should be
  tagged. Whether that survives Marp's pdf-lib post-processing (used for
  outlines and notes) was not tested. **PPTX:** image-only slides, so screen
  readers get no slide text.
- **Slidev:** the docs tree has no accessibility page. PDF export calls
  Playwright `page.pdf()` without `tagged`, and Playwright's default is
  `false`, so the PDFs are untagged. `pptx-editable` passes image `alt` through
  as `altText`. Content it turns into a picture gets the alt text
  "Rendered as an image because of CSS …".
- **reveal.js:** semantic HTML that the author controls. 6.0.2 "Prevent[s]
  offscreen slides from receiving keyboard focus".
- **pptxgenjs:** `altText` on images and shapes, and a `lang` option on text.
  **python-pptx / Pandoc:** native PowerPoint objects, which PowerPoint's
  Accessibility Checker can audit. PPTX built from native objects is the most
  accessible deliverable in the Office world.

## Comparison table

| Criterion | Marp | Slidev | reveal.js (+DeckTape) | pptxgenjs | python-pptx | Pandoc |
|---|---|---|---|---|---|---|
| Speaker notes | HTML comments; presenter view, PDF annotations, PPTX, TXT | HTML comment at slide end; presenter mode, both PPTX modes | `<aside class="notes">` / `Note:`; speaker view needs local server; PDF via `showNotes` | `addNotes` (plain text) | `notes_slide` (rich text) | `::: notes` → reveal.js, PPTX, Beamer |
| HTML | Yes, self-contained, no browser | SPA build | Native | No | No | reveal.js etc. |
| PDF | Yes (browser) | Yes (Playwright Chromium) | Chrome print or DeckTape | No | No | via Beamer/LaTeX or browser |
| PPTX | Image slides + notes; editable is experimental, needs LibreOffice, no notes | Image slides + notes; `pptx-editable` with notes and alt | No | Native, editable | Native, editable | Native, editable, layouts from reference doc |
| Slide images for checks | `--images png` (browser) | `--format png` (Chromium) | `decktape --screenshots` (Chrome) | LibreOffice + Poppler | LibreOffice + Poppler | browser or LibreOffice |
| Theming | One CSS file per theme | npm/local theme packages (Vue, UnoCSS) | CSS/Sass with custom properties | `defineSlideMaster` in code | .pptx template | `--reference-doc` .pptx |
| User changes look by | Editing CSS | Editing/ejecting a theme package | Editing CSS | Editing code | Editing the template in PowerPoint | Editing the template in PowerPoint |
| Offline | Yes, given a local browser | First run needs npm; default fonts from Google | Yes; notes need local server | Yes | Yes | Yes |
| Footprint | 134 MB npm or ~48 MB binary, + browser | 566 MB + Chromium, Node ≥ 22.12 | 6 MB + DeckTape 86 MB + Chrome | 8 MB (+ LibreOffice to check) | small (+ LibreOffice to check) | 35–42 MB binary |
| Agent writes / checks | Markdown; one-command images; same renderer for check and PDF | Markdown + Vue; MCP server and official skill | HTML; extra glue | Imperative script, coordinates; check fonts differ | Same as pptxgenjs | Markdown; little layout control |
| Accessibility | HTML good (headings, alt, lang); PDF likely tagged via Chrome; PPTX image-only | PDF untagged; editable PPTX has alt | Good HTML, author-controlled | alt, lang | Native objects | Native objects in PPTX |
| Maintenance | Active (Sep 2026) | Very active (Oct 2026) | Active (Sep 2026) | Stalled since Jun 2025 | Stalled since Aug 2024 | Very active (Oct 2026) |

## Recommendation (for the grilling ticket to decide)

**Leaning: keep Marp as the primary renderer, pin the browser explicitly, and
treat editable PPTX as a separate, optional route (Pandoc if it is needed).**

Why:

- It best matches "an agent writes, checks, and renders": one Markdown file,
  one CLI, and one command for per-slide images, with the same browser
  rendering the check images and the PDF. Its behaviour is the same in every
  harness because it needs nothing beyond a shell.
- Its themes are single CSS files, a simple way to deliver "a polished
  default look the user can change" (#481 Notes). The old suite's theme CSS
  can be salvaged.
- It is maintained and stable, and the repo already knows where it breaks.

Trade-offs to weigh:

- **Browser dependency stays.** Every HTML stack shares it. The fix is to make
  browser choice deterministic, not to switch stacks. Options:
  (a) require `--browser-path` or `CHROME_PATH`, chosen once and saved;
  (b) download a pinned `chrome-headless-shell` with
  `npx @puppeteer/browsers install` (274 MB; on Linux it also needs system
  libraries); (c) use the official Docker image `marpteam/marp-cli`.
- **PPTX quality.** Marp's PPTX is image-only, and the editable mode drops
  notes. If an editable PowerPoint is a must-have deliverable, Marp alone does
  not meet it. Pandoc (Markdown with `::: notes` and a reference .pptx) or
  Slidev `pptx-editable` would. Writing a pptxgenjs or python-pptx script is
  the least attractive option because of stalled maintenance and checks that
  depend on LibreOffice fonts.
- **Slidev is the runner-up.** Choose it if the grilling weighs these above
  footprint and offline use: built-in agent tooling (MCP, official skill),
  editable PPTX with notes, and interactive features. Its costs are a
  566 MB+ install, Node ≥ 22.12, network on first run and for default fonts,
  untagged PDFs, and themes that are Vue packages.
- **reveal.js** adds little over Marp for this use, since it is HTML-first and
  needs DeckTape for checks. Its value is mostly indirect, as Pandoc's or
  Quarto's HTML target.

## Open questions surfaced

1. **Is editable PPTX a required deliverable?** This decides between Marp
   alone and Marp plus a PPTX route (Pandoc, or Slidev instead).
2. **How does a skill obtain a browser deterministically in all three
   harnesses?** Options: user-installed with a pinned path,
   `@puppeteer/browsers`, or Docker. Linux sandboxes (Codex, CI) may not have
   Chromium's system libraries.
3. **Marp `--notes` needed a browser here.** In this environment, Marp CLI
   4.5.1 `--notes` failed with "No suitable browser found", although the
   README does not mark notes export as needing one. This was not
   investigated further.
4. **Is Marp's PDF tagged?** Check whether Chrome's tagged-PDF output
   survives Marp's pdf-lib post-processing, if accessible PDF matters.
5. **Marp Core v5.** CLI 4.5.1 now prefers `marp-core/full` when v5 is
   installed. An earlier study found that v5's bare entry point silently drops
   math and code highlighting. Re-check before pinning versions.
6. **Slidev's MCP server is useful only in harnesses with MCP.** Is an
   optional, harness-specific enrichment acceptable under #481's "Harnesses"
   note?

## Method and limits

- Primary sources: the README in the marp-cli 4.5.1 npm tarball and its
  bundled `lib/` code; Slidev's `docs/` on `main` and its 53.0.0 `dist/`;
  the reveal.js docs repo `reveal/revealjs.com` and its GitHub releases; the
  DeckTape README; `types/index.d.ts` from pptxgenjs 4.0.1; python-pptx docs
  and HISTORY; the Pandoc MANUAL; Quarto web docs; Anthropic's public `pptx`
  skill; and the npm, PyPI, and GitHub APIs.
- Tested here (Linux arm64, Node 24): installs and footprints; Marp HTML
  output structure; Marp's failure without a browser; the
  `chrome-headless-shell` download and its missing libraries.
- **Not tested:** PDF, PNG, and PPTX output from any stack, because no
  working browser or LibreOffice could run here; Slidev and DeckTape runs;
  python-pptx and Pandoc output; screen-reader behaviour.
