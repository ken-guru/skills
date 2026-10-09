# Ways an agent can build charts for slide decks

Research for [#493](https://github.com/ken-guru/skills/issues/493), a child of
the map [#481](https://github.com/ken-guru/skills/issues/481). It builds on
[#484](https://github.com/ken-guru/skills/issues/484)
([`slide-rendering-stacks.md`](https://github.com/ken-guru/skills/blob/research/slide-rendering-stacks/docs/research/slide-rendering-stacks.md))
and [#492](https://github.com/ken-guru/skills/issues/492)
([`headless-browser-provisioning.md`](https://github.com/ken-guru/skills/blob/research/headless-browser-provisioning/docs/research/headless-browser-provisioning.md)).
Researched 2026-10-09.

## Question

What are the realistic ways for an agent to build data charts for a slide
deck, as images, SVGs, or embedded interactive charts, and what can and can't
each one do? The options covered are declarative grammars (Vega-Lite,
Observable Plot), code libraries (matplotlib, Plotly, ECharts, Chart.js),
Mermaid's chart types, and native PPTX charts. Each is judged on:

- offline use and install size
- output formats
- how charts survive HTML, PDF, and PPTX exports of a Marp-style deck
- theming
- legibility at slide size
- accessibility
- how easily an agent can write a chart and check it visually
- whether it works the same way in Claude Code, Copilot CLI, and Codex

The note also records what Anthropic's `dataviz` skill already covers.

This note gives evidence and a ranked leaning. The map's grilling ticket
makes the decision.

## Answer in brief

- **Use static SVG first, with an alt text and a data table.** Every Marp
  export keeps a static chart. Interactivity survives only in the HTML export.
  In PDF, PNG, and PPTX, a vega-embed chart is frozen at its first frame
  (measured).
- **Vega-Lite rendered by `vl-convert` fits best overall.** It is one
  self-contained binary or Python wheel with no browser and no Node. The CLI
  is 81 MB, from a 32 MB download. It worked offline, rendered SVG in 0.35 s
  and PNG in 0.57 s, and writes ARIA labels for each mark. The chart is a
  JSON spec that an agent writes and the schema validates. The same spec can
  become interactive in the HTML export through vega-embed (measured).
- **SVG charts stay vector in Marp's PDF.** Their text can be extracted, and
  the Markdown alt text becomes a tagged `Figure` in the PDF. Marp's PPTX
  turns every slide into a picture, so charts can't be edited and the alt
  text is lost. Marp's experimental `--pptx-editable` turns an SVG chart into
  about 30 loose shapes and text boxes. They can be edited, but they are not
  a chart object (measured).
- **Only a PPTX generator can make native, editable charts.** pptxgenjs's
  `addChart` writes a real `c:barChart` part, an embedded Excel data sheet,
  and an alt text in 0.06 s (measured). It belongs to a PPTX pipeline,
  though, not to a Markdown deck, and #484 found pptxgenjs and python-pptx
  unmaintained. Pandoc embeds images but cannot make charts.
- **Mermaid `xychart` is the cheapest chart if Mermaid is already in the
  toolchain.** It handles bar and line charts, can set accessible
  `<title>`/`<desc>`, and is themeable through `themeVariables`. It needs
  `mermaid-cli`: 451 MB of npm packages plus a headless browser. Its default
  font sizes (14 px) are too small for slides (measured).
- **Theming is a mapping step, not something the chart inherits.** A chart
  embedded as an image (`<img>`) does not pick up the deck's CSS. The same
  Vega SVG on a dark slide had unreadable titles (measured). Each renderer
  takes a theme object, so a skill should generate that object from the
  deck's theme tokens. It should also make the chart at the size of its
  slot, so chart pixels equal slide pixels and the 20 px minimum still holds.
- **You can only verify a chart by looking at it.** Three of six renders had
  layout faults that no check would report: an axis label colliding with a
  tick, labels too small, and a device-pixel-ratio mix-up. Every option needs
  a PNG step and a look at the result.
- **Anthropic's `dataviz` skill covers method, not rendering.** It ships with
  Claude Code (not with Copilot CLI or Codex). It covers which form to
  choose, a color formula with a runnable palette validator, mark specs,
  accessibility, and "render it and look". It names no library and defaults
  to interactive HTML with hover. A chart skill should complement it
  (renderer, slide sizing, export survival) rather than repeat it.

## Method

**Measured** on Linux arm64 (Debian), Node 24.21.0, using:

- Marp CLI 4.5.1 (Marp Core 4.4.0)
- `chrome-headless-shell` 155.0.8059.39, passed via `CHROME_PATH` (as in #492)
- LibreOffice 26.2.6.3
- Poppler (`pdftotext`, `pdfinfo -struct`, `pdfimages`)
- `vl-convert` 1.9.0 (release binary)
- vega 6.4.0, vega-lite 6.5.0, vega-cli 6.4.0, vega-embed
- echarts 6.1.0
- @observablehq/plot 0.6.17 with jsdom 30.1.2
- @mermaid-js/mermaid-cli 12.0.0 (Mermaid 12.1.0)
- chart.js 4.5.1 with canvas 3.2.3
- pptxgenjs 4.0.1
- Pandoc 3.12.1

Every renderer drew the same bar chart: four quarters, one series, deck
accent color, 24 px labels. All the charts were put into one 10-slide Marp
deck: SVG and PNG as `<img>`, an inline SVG, a live vega-embed chart, and a
data table. The deck was exported to HTML, PDF, PPTX, PNG, and the
experimental editable PPTX. Separately, a native pptxgenjs chart and a
Pandoc PPTX were built and rendered through LibreOffice. Offline runs used
`unshare -rn`, which removes network access. Install sizes come from clean,
isolated `npm install --ignore-scripts` runs.

**Read, not measured:**

- **matplotlib and Plotly/Kaleido.** PyPI and conda-forge were unreachable
  from this sandbox, so neither could be installed.
- **Behavior in PowerPoint itself.** No Office here. LibreOffice stood in.
- **macOS and Windows.**
- **How each harness shows images to the model.**

## Findings by option

### Vega-Lite via `vl-convert` (declarative grammar)

- **What it is.** A Rust CLI, HTTP server, and Python package. It "embeds
  the official Vega and Vega-Lite JavaScript libraries, so conversions do not
  require a browser or Node.js". It outputs SVG, PNG, JPEG, PDF, HTML, and
  more ([vl-convert README](https://github.com/vega/vl-convert)). Stable
  release v1.9.0 (2026-01-20). v2.0.0 is in release candidates (rc7,
  2026-09-14). The repo is active (last commit 2026-10-01).
- **Install.** One binary for each of linux-64, linux-aarch64, osx-64,
  osx-arm64, and win-64 on the
  [releases page](https://github.com/vega/vl-convert/releases). The arm64
  one is a 32 MB zip that unpacks to 81 MB. Or `uv add vl-convert-python`.
  No browser, Node, or system libraries needed (measured).
- **Offline.** It rendered fine with the network removed (measured). The
  README says the bundled libraries need no network, but a spec can still
  fetch remote data, images, Google Fonts, or plugins. Local files are
  blocked by default, under an `allowed_base_urls` policy. Relative
  sample-data paths go to a CDN by default. So keep data inline, or allow
  the deck folder explicitly.
- **Speed.** SVG in 0.35 s, PNG at 2× in 0.57 s (measured).
- **Theming.** The spec's `config` block, or `--config` / `--theme`, sets
  font, sizes, colors, grid, and background. `--font-dir` adds fonts. Tokens
  map one to one onto a deck theme. The output is fixed colors, so a dark
  slide needs its own render (measured: the light-theme SVG was unreadable
  on a dark slide).
- **Accessibility.** The SVG has `role="graphics-symbol"` and an
  `aria-label` per mark ("quarter: Q1; Sales (k EUR): 42") and per axis.
  Those labels reach assistive technology only when the SVG is inline. When
  it is an `<img>`, the Markdown alt text is what counts. The top-level
  `description` was not written into the SVG (measured).
- **Agent fit.** Data plus encoding as JSON, with a published JSON schema.
  The layout came out right on the first render. Interactivity is the same
  spec passed to vega-embed (see the survival section).
- **vega-cli instead.** `vl2svg` / `vl2png` gave the same SVG in 0.27 s. It
  needs Node plus vega and vega-lite (29 MB, 117 packages). PNG needs the
  native `canvas` package, whose install script npm 11 blocks by default
  until approved (measured).

### Observable Plot (declarative grammar, JavaScript)

- **Status.** v0.6.17 (2025-02-14) is still the latest release, although the
  [repo](https://github.com/observablehq/plot) had commits until 2026-09.
  Releases are slow and it is still pre-1.0.
- **Rendering.** Outside a browser it needs a DOM (jsdom passed as
  `document`). Plot plus jsdom is 35 MB. It rendered SVG offline in 0.5 s
  (measured).
- **Theming.** Through `style`. Axis text uses `currentColor`, so an inline
  SVG can take its color from the slide. But the `style.color` that was set
  overrode it (measured).
- **Accessibility.** Takes `ariaLabel` and `ariaDescription`, and labels
  each mark (measured).
- **Agent fit.** Weaker than Vega-Lite. With 24 px labels the y-axis
  produced 15 crowded ticks and did not round the domain up. After fixing
  that, the axis label overlapped the top tick. Each fix needed a look at
  the render (measured). The chart is code, not a validated data file.

### matplotlib (Python code library)

- **Status.** v3.11.2 (2026-09-11), very active.
- **Read only.** It could not be installed here (PyPI blocked).
- **Install.** No browser. Outputs SVG, PNG, and PDF.
- **Fonts in SVG.** Text is written as paths by default
  (`svg.fonttype: path`). That keeps rendering the same everywhere, but the
  text can't be selected or extracted. `none` keeps real text and relies on
  the viewer's fonts
  ([matplotlibrc](https://github.com/matplotlib/matplotlib/blob/main/lib/matplotlib/mpl-data/matplotlibrc)).
- **Theming.** Through `.mplstyle` files and `rcParams`.
- **Agent fit.** Very familiar to agents. Needs a Python environment, which
  a skill can't take for granted in every harness. Getting slide-size
  legibility means setting `figsize` × `dpi` to the slot.

### Plotly (code library, interactive-first)

- **Status.** plotly.py v7.1.0 (2026-09-15), Kaleido v1.5.0 (2026-10-06),
  plotly.js 4.1.2.
- **Read only.**
- **Needs Chrome.** Static export goes through Kaleido, and "as of version
  1.0.0, Kaleido requires Chrome to be installed". `kaleido_get_chrome` /
  `plotly_get_chrome` fetch it
  ([Kaleido README](https://github.com/plotly/Kaleido);
  [static image export](https://github.com/plotly/plotly.py/blob/main/doc/python/static-image-export.md)).
  So Plotly has the same sandbox problems as #492.
- **Vector output.** Plotly Express switches to WebGL above 1,000 points,
  which rasterizes markers in SVG and PDF unless `render_mode="svg"` is
  set.
- **Interactive HTML.** Needs the plotly.js bundle (`plotly.js-dist-min` is
  6.2 MB unpacked).

### ECharts (code library, server-side SVG)

- **Status.** v6.1.0 (2026-05-19), Apache.
- **Rendering.** Since 5.3.0 it has had "a zero-dependency server-side
  string based SVG rendering solution" (`ssr: true`,
  `renderToSVGString()`). Interaction needs client hydration
  ([ECharts SSR handbook](https://github.com/apache/echarts-handbook/blob/master/contents/en/how-to/cross-platform/server.md)).
- **Install.** One package with no dependencies, but 67 MB. Rendered
  offline in 0.35 s (measured).
- **Theming.** Per component (`textStyle` did not recolor axis labels, which
  kept their default `#54555a`), or through `registerTheme`.
- **Accessibility.** `aria.enabled` wrote no `aria-label` into the SSR SVG
  (measured).
- **Agent fit.** Very broad chart catalog, and the option object is JSON.

### Chart.js (code library, canvas only)

- **Status.** v4.5.1 (2025-10-13), repo active (2026-10).
- **Output.** Canvas only, so no SVG. In Node it needs `canvas` (node-canvas,
  a native addon whose install script must be approved) and gives PNG
  (measured, 0.3 s).
- **Legibility.** The first render came out at 3840×2000 with 24 px fonts
  at half the intended size, because `devicePixelRatio: 2` doubled the
  canvas. Again, only a look caught it (measured).
- **Agent fit.** The weakest fit for decks: raster only, a native
  dependency, and no ARIA.

### Mermaid charts

- **Chart types.** `xychart` (bar and line, legend since v11.17.0), `pie`,
  `quadrantChart`, `sankey`, `radar`, `treemap`, and `venn`
  ([Mermaid syntax docs](https://github.com/mermaid-js/mermaid/tree/develop/docs/syntax)).
  The docs now use `xychart` and still show `xychart-beta`. Mermaid 12.1.0
  is from 2026-10-02.
- **Install.** Rendering needs `mermaid-cli`, which drives a headless
  browser. That is 451 MB of npm packages (194 packages) before the browser.
  Mermaid itself is 126 MB.
- **Offline.** It worked offline only after adding `"pipe": true` to the
  Puppeteer config. Without it, the run failed with an unhelpful
  `[object Object]` in a namespace with no network (measured).
- **Speed.** 0.4 s per chart (measured).
- **Theming.** Covered by `themeVariables.xyChart` (title, axis, and plot
  colors) and `xyChart` config (sizes, `showDataLabel`). The defaults
  (14 px labels, 2 px axis lines) are too small for slides. The last bar
  touched the right edge (measured).
- **Accessibility.** `accTitle` and `accDescr` become SVG `<title>` and
  `<desc>` (measured).
- **Agent fit.** The text is the easiest to write. Its design ceiling is
  low: no sorting, transforms, annotations, or per-bar color.
- **Markdown decks.** Marp does not render Mermaid code blocks. #482 saw
  Copilot ship them unrendered.

### Native PPTX charts

- **pptxgenjs `addChart`.** Writes `ppt/charts/chart1.xml` (`c:barChart`),
  an embedded `Microsoft_Excel_Worksheet1.xlsx`, and `descr` alt text, in
  0.06 s. LibreOffice rendered it cleanly (measured). Install is 8 MB.
  These are the only charts the audience can edit in PowerPoint.
- **Costs.** The deck must be a script that places boxes by coordinates.
  Checks depend on LibreOffice, which substitutes fonts (#484). pptxgenjs's
  last release is 2025-06. python-pptx has charts too, but its last release
  is 2024-08 (#484).
- **Anthropic's `pptx` skill.** The copy synced into this user's Claude Code
  says "Keep charts native… do not fall back to a rendered image". It
  documents pptxgenjs chart traps: `outEnd` labels on stacked charts corrupt
  the file, and secondary axes need both `valAxes` and `catAxes`. #487 rules
  out depending on or duplicating it.
- **Pandoc 3.12.1.** Embeds images, not charts. It put the SVG straight into
  `a:blip`, with no PNG fallback or `svgBlip` extension. Office's own
  writers add those, and whether PowerPoint displays it was not verified.
  It used the file path as `descr` and printed the alt text as a visible
  caption (measured). For Pandoc PPTX, embed PNG and set the alt text
  deliberately.

## How charts survive a Marp deck's exports (measured)

| Embed method | HTML | PDF | PNG slides | PPTX (default) | PPTX `--pptx-editable` |
|---|---|---|---|---|---|
| SVG as `![alt](chart.svg)` | Sharp. Linked file, not inlined, so the folder must travel with the HTML | Vector. Chart text extractable. Alt text becomes a tagged `Figure` | Rasterized | Slide picture. No alt text, not editable | About 30 editable shapes and text boxes. No alt text, not a chart |
| PNG as `![alt](chart.png)` | Linked file | Embedded bitmap. Alt text becomes a tagged `Figure` | Rasterized | Slide picture | Picture |
| Inline `<svg>` (needs `--html`) | Self-contained. Can inherit CSS through `currentColor` | Vector. Per-mark ARIA becomes nested tagged `Figure`s | Rasterized | Slide picture | Shapes |
| vega-embed `<script>` (needs `--html`, local scripts) | **Interactive** | First frame, vector, tagged | First frame | Slide picture | Shapes |

PDF-tagging detail: `pdfinfo -struct` listed `Figure ["Bar chart: sales per
quarter, …"]` for every `<img>`. For the inline and vega-embed SVGs it also
listed `Figure ["quarter: Q1; Sales (k EUR): 42"]` for each bar.

Size detail: Marp's PPTX was 793 KB for 10 slides of PNG. A Markdown data
table survived as a real table in HTML and tagged PDF. In Pandoc's PPTX it
became an `a:tbl`.

## Comparison

"Offline" means no network at render time. "Browser" means a headless
Chromium is needed to render.

| Option | Install (measured unless noted) | Browser | Offline | Outputs | Theming | Accessibility | Agent writes / checks | Same in all 3 harnesses |
|---|---|---|---|---|---|---|---|---|
| **Vega-Lite + vl-convert** | 81 MB binary, or a pip wheel | No | Yes | SVG, PNG, PDF, HTML | `config` JSON, `--theme`, `--font-dir` | ARIA per mark (inline only) | JSON spec plus schema. Right on the first render | Yes. No browser sandbox issues |
| Vega-Lite + vega-cli | 29 MB npm (+ canvas for PNG) | No | Yes | SVG, PNG, PDF | as above | as above | as above | Yes, with Node |
| Observable Plot + jsdom | 35 MB npm | No | Yes | SVG | `style`, `currentColor` | `ariaLabel` / `ariaDescription` | JS code. Needed 2 fixes after looking | Yes, with Node |
| matplotlib | Python + wheels (read) | No | Yes (read) | SVG, PNG, PDF | `.mplstyle` | none by default (read) | Python code. Agents know it well | Only where Python is set up |
| Plotly + Kaleido | Python + Chrome (read) | **Yes** | Yes, once Chrome is present (read) | PNG, SVG, PDF, interactive HTML | templates | — | Python code | Inherits #492 sandbox problems |
| ECharts SSR | 67 MB npm, no dependencies | No | Yes | SVG (PNG with canvas) | per component, `registerTheme` | none in SSR SVG | JSON options | Yes, with Node |
| Chart.js + canvas | 10 MB + native addon | No | Yes | PNG only | defaults / options | none | JS code. DPR trap | Native build risk |
| Mermaid `xychart` (mmdc) | 451 MB npm + 274 MB browser | **Yes** | Yes, with `pipe: true` | SVG, PNG, PDF | `themeVariables` | `accTitle` / `accDescr` | Easiest text. Low ceiling | Inherits #492 sandbox problems |
| Native PPTX (pptxgenjs) | 8 MB npm | No (LibreOffice to check) | Yes | Editable chart in PPTX only | per chart options | `descr` alt text | Coordinate script. LibreOffice to check | Yes, but only for a PPTX pipeline |

## What Anthropic's `dataviz` skill covers

**Where it lives.** It ships inside Claude Code, as a bundled skill under
Claude Code's install (`bundled-skills/<version>/dataviz`), not under
`~/.claude/skills`. It is not part of Copilot CLI or Codex.

**What it covers.** It is explicitly design-system-agnostic and covers
method:

1. Pick the form, or decide it isn't a chart at all.
2. Assign color by its job: categorical, sequential, diverging, or status.
3. Validate the palette with a bundled script, in JS or Python.
4. Apply mark specs.
5. Add a hover layer by default.
6. Do an accessibility pass: legend plus direct labels, a table view, a dark
   mode that is chosen rather than flipped automatically, and texture.
7. Render it and look at it.

It also has an anti-pattern catalog. Its non-negotiables include "one axis,
never dual-axis".

**What it does not cover.**

- It does not pick or ship a rendering library.
- It does not size charts for a slide slot.
- It does not cover what survives a PDF or PPTX export.
- Its "interactive by default" hover rule does not fit static slides.

**What that means for a chart skill.** In Claude Code, `dataviz` will
trigger on any chart work. A deck chart skill should leave form, color, and
validation to it and name it as optional. It should own the parts `dataviz`
leaves out: the renderer, the deck-theme-to-chart-config mapping,
slot-sized output, alt text and data table, and the look-check. In Copilot
CLI and Codex, the skill has to carry a short version of the essentials
itself.

## Ranked recommendation (the map decides)

1. **Vega-Lite rendered by `vl-convert` (pinned 1.9.x), as static SVG.**
   - *Why:* No browser, works offline, one binary or wheel, a declarative
     spec an agent writes and a schema checks, theme config straight from
     deck tokens, vector text in PDF, and an optional interactive upgrade
     in HTML from the same spec.
   - *Trade-offs:* An 81 MB binary for each platform, or Python. v2 is in
     RC, so the pin must be re-checked. A dark slide needs its own render.
     There is no native PPTX chart. Complex specs (layers, facets) take some
     learning.
2. **Mermaid `xychart`, only if `creating-diagrams` adopts Mermaid anyway.**
   - *Why:* Simple bar, line, pie, and quadrant charts come almost free, in
     the same text format, with accessible title and description.
   - *Trade-offs:* Needs a browser (the #492 sandbox problems) and 451 MB of
     npm packages. Default sizes must be raised for slides. Low ceiling. If
     the diagram skill stays on D2, this is pure extra weight.
3. **matplotlib, as a fallback where Python is already present.**
   - *Why:* Agents know it best, and it needs no browser.
   - *Trade-offs:* Needs a Python environment. Text becomes paths by
     default. No ARIA. Not verified here.
4. **Native PPTX charts (pptxgenjs), only if editable PPTX with editable
   charts becomes a requirement.**
   - *Why:* The only path to charts an audience can edit.
   - *Trade-offs:* Not reachable from a Markdown or Marp deck. It needs its
     own generator. The library is unmaintained. Overlaps with Anthropic's
     `pptx`, which #487 rules out duplicating.

**Not recommended for decks:**

- Plotly: needs Chrome, and its interactivity is lost in every export
  except HTML.
- Chart.js: raster only, plus a native addon.
- ECharts: SSR SVG has no ARIA and the package is 67 MB, though it is a
  reasonable alternative to Vega-Lite if a JS-object API is preferred.
- Observable Plot: slow releases and more layout fixing.

**Whatever is chosen, the evidence argues for these practices:**

- Static first. Interactivity only as an HTML-only enhancement.
- Write the alt text in the Markdown image, plus a data table in a slide or
  the speaker notes. Marp's PPTX drops alt text.
- Generate the chart theme from the deck's theme tokens, once per light or
  dark slide class.
- Make charts at the slot's pixel size, so the deck's 20 px minimum applies
  directly.
- Keep data inline, or in an explicitly allowed local file. No CDN data or
  Google Fonts.
- Always render a PNG and look at it before calling the chart done.

## Open questions

- **Charts as a skill.** Is there a chart skill (a general-purpose
  `creating-charts`, like `creating-diagrams`), or is charting a section of
  `creating-diagrams`? This decides whether Mermaid `xychart` comes for free.
- **Editable charts in PPTX.** Is this a requirement? If yes, it drives the
  rendering stack (#484's editable PPTX question), not the chart tool.
- **Python versus a bundled binary.** Can a skill rely on Python
  (`vl-convert-python`, matplotlib) in all three harnesses, or should it
  bundle or download a per-platform binary? Same question as the pinned
  browser's location in #492.
- **Theme tokens.** How does the deck theme expose tokens a script can turn
  into a chart config: CSS custom properties, a manifest? This ties to the
  map's "Theming approach".
- **PowerPoint check.** Does PowerPoint display Pandoc's bare-SVG `a:blip`,
  and Marp's editable-PPTX shape soup? Not verified without Office.
- **matplotlib and Plotly runs.** Not measured here because PyPI was
  blocked. Worth a quick run if either stays in the running.

## Sources

- vl-convert: [README](https://github.com/vega/vl-convert),
  [releases](https://github.com/vega/vl-convert/releases) (v1.9.0, v2.0.0-rc7).
- Vega-Lite [releases](https://github.com/vega/vega-lite/releases) (v6.5.0,
  2026-10-08); vega-cli 6.4.0 (npm).
- Observable Plot [repo and releases](https://github.com/observablehq/plot)
  (v0.6.17).
- matplotlib
  [matplotlibrc](https://github.com/matplotlib/matplotlib/blob/main/lib/matplotlib/mpl-data/matplotlibrc),
  [releases](https://github.com/matplotlib/matplotlib/releases) (v3.11.2).
- Plotly
  [static image export](https://github.com/plotly/plotly.py/blob/main/doc/python/static-image-export.md),
  [Kaleido README](https://github.com/plotly/Kaleido) (v1.5.0).
- ECharts
  [server-side rendering handbook](https://github.com/apache/echarts-handbook/blob/master/contents/en/how-to/cross-platform/server.md),
  [releases](https://github.com/apache/echarts/releases) (6.1.0).
- Chart.js [releases](https://github.com/chartjs/Chart.js/releases) (v4.5.1).
- Mermaid
  [xyChart syntax](https://github.com/mermaid-js/mermaid/blob/develop/docs/syntax/xyChart.md),
  [syntax index](https://github.com/mermaid-js/mermaid/tree/develop/docs/syntax),
  [releases](https://github.com/mermaid-js/mermaid/releases) (12.1.0).
- PptxGenJS [releases](https://github.com/gitbrent/PptxGenJS/releases)
  (v4.0.1).
- Marp CLI [releases](https://github.com/marp-team/marp-cli/releases)
  (v4.5.1).
- Pandoc [releases](https://github.com/jgm/pandoc/releases) (3.12.1).
- Anthropic `dataviz` skill (bundled with Claude Code 2.1.288) and `pptx`
  skill (synced copy), read locally.
- Earlier notes:
  [`slide-rendering-stacks.md`](https://github.com/ken-guru/skills/blob/research/slide-rendering-stacks/docs/research/slide-rendering-stacks.md),
  [`headless-browser-provisioning.md`](https://github.com/ken-guru/skills/blob/research/headless-browser-provisioning/docs/research/headless-browser-provisioning.md),
  [`bare-agent-baseline.md`](https://github.com/ken-guru/skills/blob/research/bare-agent-baseline/docs/research/bare-agent-baseline.md).
