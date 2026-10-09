# What an agent needs to know to write good D2 diagrams

Research for [#495](https://github.com/ken-guru/skills/issues/495), a child of
the map [#481](https://github.com/ken-guru/skills/issues/481). It follows the
decision in [#488](https://github.com/ken-guru/skills/issues/488), which chose
D2 for `creating-diagrams` on one condition: the skill must document D2
syntax, its pitfalls, and good diagram design well. It also builds on
[#483](https://github.com/ken-guru/skills/issues/483)
([`presentation-suite-quarry.md`](https://github.com/ken-guru/skills/blob/research/presentation-suite-quarry/docs/research/presentation-suite-quarry.md)),
whose D2 field lessons are cited here as "quarry lesson N". Researched
2026-10-09.

## Question

What must `creating-diagrams` bundle, or point to, so that an agent writes
correct, legible, well-designed D2 diagrams? The ticket asks for:

- the D2 syntax agents most often get wrong: shapes, connections, containers,
  classes, sequence diagrams, grids, and escaping
- the layout engines (dagre, ELK, TALA), TALA's licensing, and when to use
  each one
- the official documentation, and any machine-readable or LLM-oriented
  reference that D2 publishes
- how the old suite's `render-diagrams.mjs` and its 20 px legibility check
  worked
- established diagram-design guidance: one message per diagram, label
  density, direction, colour as meaning, accessibility, and text
  alternatives
- how to check a rendered diagram visually
- what belongs in the skill's own reference files, and what should only be a
  pointer to upstream docs, following Anthropic's progressive-disclosure
  guidance

## Answer in brief

- **D2 is now v0.9.0 (2026-09-07), and it changes three of the old
  assumptions.** TALA is open source (MPL-2.0) and bundled, so licensing no
  longer matters. PNG, PDF and PPTX come from a built-in renderer with no
  browser: a PNG took 67 ms with the network proxied to a dead port. That
  removes quarry lesson 9 (D2's PNG export tried to download Playwright).
  The repository moved from `terrastruct/d2` to `d2lang/d2`. The old suite
  pinned 0.7.1. Its renderer passes its real-D2 tests on 0.9.0 unchanged once
  the version assertion is removed (measured).
- **D2 publishes no LLM-oriented reference.** The docs source
  (`terrastruct/d2-docs`) has no `llms.txt` and no plugin that would generate
  one. d2lang.com could not be reached from this sandbox, so the live site
  was not checked. The machine-readable sources that do exist are the
  keyword list in `d2ast/keywords.go`, the shape constants in
  `d2target/d2target.go`, `d2 --help` and `man d2`, `d2 layout <engine>`,
  `d2 themes`, a cheat-sheet PDF, and a language server (`d2lsp`).
- **`d2 validate` is not a sufficient check.** It accepted eight inputs that
  rendering then rejected: reserved keywords used as edge endpoints, style
  typos, invalid colours, unknown shapes, class arrays written with commas,
  references to edges that do not exist, and `near: <object>` under ELK
  (measured). A check step has to render.
- **The worst pitfalls fail silently.** The following all compiled without an
  error or warning, and rendered the wrong diagram (measured):
  - `#` starts a comment, even in the middle of a label, so
    `Step #1 of 3` rendered as "Step".
  - A `;` in a label splits the line into two shapes.
  - A misspelt class name leaves the shape unstyled.
  - A connection that names a shape's label instead of its key creates new
    shapes.
  - `container.a -> b` creates a new top-level `b`.
  - `api.v2` creates a container named `api`.
  - Sequence-diagram actors that appear first inside a group turn the group
    into an actor.
  - `a - b` makes a single shape with the label "a - b".
  - A full-width `：` does not act as a key/label separator.
- **Pick the layout engine by diagram shape.** ELK is the default for flows
  and architectures: orthogonal routes, and the smallest area in all 3
  tests where the engines differed. Dagre gives curved, wider layouts. TALA suits
  non-hierarchical architectures and supports per-container `direction`,
  `near` to an object, and locked `top`/`left`. TALA is deterministic for
  fixed seeds, but adding one node flipped a 3.3:1 layout to 0.9:1, and it
  ignored a global `direction: right` (measured). Use TALA only when the
  author can accept that the layout may change shape.
- **Legibility is bounded by layout, not font size.** D2's defaults are
  16 px for shapes and labels and 28/24/20 px for nested container titles.
  Raising every font to 28/24 px grows the layout as well. A six-step
  pipeline still reached only 16.6 px Effective Text Size in a wide 1126×252
  slot (measured). The levers that work:
  - set `--pad` to 0 or near it (the default 100 px padding cost up to a
    third of the scale)
  - use fewer nodes in a row
  - put a line break in long labels
  - split the diagram
- **The old renderer is a sound core to salvage.** It rejected inline
  styling, injected theme roles as D2 classes plus `theme-overrides`, ran
  `d2 validate`, rendered with ELK, and measured the smallest `<text>` size
  times the contain scale into the slot. Two gaps showed up on 0.9.0:
  - code blocks emit `<text>` with no font size, so the check fails closed
  - the renderer never passed `--pad`
- **Upstream gives no design or accessibility guidance.** D2's SVG has no
  `<title>`, `<desc>` or ARIA except on tooltips (source and measured). The
  skill must carry its own short design rules, and an alt text plus long
  description recipe. The recipe follows W3C's two-part text alternative for
  complex images, and WCAG 1.4.1 (colour) and 1.4.11 (3:1 non-text
  contrast).
- **Check visually with D2's own PNG.** Render the PNG (built in, offline),
  open it, and look. Two more checks need no vision: the `.txt` ASCII export
  and a list of the `<text>` labels in the SVG. Together they catch missing
  or duplicated labels.
- **Recommendation.** Keep the procedure and the hard rules in a short
  SKILL.md. Put four reference files one level deep:
  - D2 essentials and pitfalls
  - layouts
  - design and legibility
  - text alternatives

  Add a few verified example `.d2` files, and a salvaged render-and-check
  script. Point upstream only for the long tail: the full shape and style
  catalogue, icons, themes, imports, layers and animation, and SQL and UML
  shapes.

## Method

**Measured** on Linux arm64 (Debian), Node 24.21.0, with D2 v0.9.0. The
binary was downloaded with `gh release download` from `d2lang/d2`, checked
against `SHA256SUMS`, and unpacked into a scratch directory without sudo.
The archive was 16.6 MB; the unpacked binary is 39,059,616 bytes. The
following were run with throwaway Node scripts:

- 40 small D2 files that exercise likely pitfalls. Each went through
  `d2 validate` and then `d2 --layout=elk`. The SVG output was inspected for
  labels, font sizes and viewBox, and for any `<title>`, ARIA or
  `foreignObject`.
- Five slide-typical diagrams under dagre, ELK and TALA: a six-step
  pipeline, a three-container architecture, a hub and spoke, a sequence
  diagram, and a grid. Recorded for each: time, size, aspect ratio, smallest
  font, and Effective Text Size into two slots. The slots were the old
  Editorial diagram box (1126×252) and a generous 1152×560.
- Determinism: each engine rendered twice and the hashes compared. TALA
  stability: the same diagram with one node added.
- PNG, PDF and ASCII (`.txt`) exports with `HTTP(S)_PROXY` set to a dead
  port. `d2 fmt`.
- Default font sizes per element kind.
- The old suite's tests against 0.9.0. The real-D2 file
  `render-diagrams-d2.test.mjs` ran from a scratch copy with only the version
  assertion removed, and the stub-based `render-diagrams.test.mjs` ran
  unchanged. Nothing under `skills/` was modified.
- Rendered PNGs were opened and looked at: the architecture diagram, the
  TALA variant, and the broken sequence group.

**Read, not measured:**

- The D2 docs, from their source repo `terrastruct/d2-docs` at `5530a5e`
  (2026-10-06), because `d2lang.com` refused connections from this sandbox
  and from the fetch tool. Whether the live site serves an `llms.txt` is
  therefore unverified. The source has none.
- D2 source files in `d2lang/d2`: `d2ast/keywords.go`,
  `d2target/d2target.go`, `d2renderers/d2svg/d2svg.go`.
- Release notes for 0.8.2 and 0.9.0, and the "TALA is open-source" blog post
  (2026-09-07).
- W3C's complex-images tutorial, read from its GitHub source
  (`w3c/wai-tutorials`, archived, last updated 2022-01-17), and the WCAG
  Understanding documents for 1.4.1 and 1.4.11 (`w3c/wcag`). w3.org itself
  was unreachable.
- Anthropic's [Skill authoring best
  practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).
- The old suite: `skills/presentation/generate-diagrams/` (SKILL.md, script,
  tests, evals), the diagram rules in `generate-slides/SKILL.md`, the theme
  manifests' `diagramRoles` and `mediaBox`, ADR 0007, and the legibility
  fixtures under `verification/presentation-themes/`.

**Not covered:** macOS and Windows binaries; D2 inside each harness's
sandbox; the `d2lsp` language server; how Copilot CLI and Codex show a PNG to
the model.

## Findings

### 1. Upstream references, and what is machine-readable

| Source | What it is | Use for an agent |
|---|---|---|
| [d2lang.com/tour](https://d2lang.com/tour/intro) (source: [`terrastruct/d2-docs/docs/tour`](https://github.com/terrastruct/d2-docs/tree/master/docs/tour)) | 66 pages, about 19,000 words. Many examples are imported from `static/d2/*.d2` rather than written inline, so the Markdown alone often lacks the code. | Pointer target for the long tail. Too big to bundle, and the source Markdown is incomplete without the imported examples. |
| [Cheat sheet PDF](https://d2lang.com/documents/d2_cheat_sheet.pdf) (also `docs/assets/cheat_sheet.pdf` in `d2lang/d2`) | One-page visual summary | For humans. A PDF is a poor agent reference. |
| `d2ast/keywords.go` | The authoritative list of reserved keywords, style keywords, `near` constants and label positions | Source for the skill's keyword table; recheck when the pinned version changes. |
| `d2target/d2target.go` | Shape names (`rectangle` … `sequence_diagram`, `hierarchy`) | The same |
| `d2 --help`, `man d2` (shipped in the archive), `d2 layout <engine>`, `d2 themes` | CLI flags, environment variables, engine options (`--elk-algorithm`, `--tala-seeds`), theme IDs | The agent can query these at run time. Don't copy them. |
| [play.d2lang.com](https://play.d2lang.com) | Browser playground (WebAssembly) | For humans |
| `d2lsp` | Language-server completion | Not evaluated |
| `llms.txt` / `llms-full.txt` | Not present in the docs source. The live site could not be checked. | None |

The docs site had no page on design, accessibility or alt text: no hits for
"accessib", "aria" or "alt text" across the tour. Its "Design decisions"
page is about the language, not diagrams.

Sources: [d2-docs tree](https://github.com/terrastruct/d2-docs),
[`keywords.go`](https://github.com/d2lang/d2/blob/master/d2ast/keywords.go),
[`d2target.go`](https://github.com/d2lang/d2/blob/master/d2target/d2target.go).

### 2. What changed in D2 0.8 and 0.9

From the [0.9.0](https://github.com/d2lang/d2/releases/tag/v0.9.0) and
[0.8.2](https://github.com/d2lang/d2/releases/tag/v0.8.2) release notes:

- **0.9.0** (2026-09-07):
  - TALA is open source, bundled, and needs no plugin or licence key.
    Select it with `--layout=tala` or `vars.d2-config.layout-engine: tala`.
  - PNG, GIF, PDF and PPTX use a built-in renderer.
  - Markdown labels render as native SVG instead of `foreignObject`.
  - SVG rendering is about 10× faster and the output about 24% smaller.
  - `--tala-seeds` added.
- **0.8.2** (2026-08-28):
  - Dagre replaced by a native Go port with Dagre 3.1.1 behaviour, and ELK
    by native Go with ELK.js 0.12.0 behaviour. Both "intentionally" change
    coordinates and ordering, so stored snapshots must be regenerated.
  - The ELK `DisCo` algorithm was removed.
  - Release archives are reproducible and come with checksums, provenance
    and SBOM.
- The repository is now `d2lang/d2`; `terrastruct/d2` redirects there.

**Measured on 0.9.0:**

- Every SVG still starts with an `<?xml …?>` prolog (quarry lesson 3).
- Every SVG has a `viewBox`.
- Markdown labels produced `<text>` with a measurable `font-size`
  (`32.000`, `16.000`) and no `foreignObject`.
- The old renderer's preamble still recolours output through
  `theme-overrides`: four themes passed with no default blue.
- The old 20 px failure fixture still fails the same way.

Implications for the skill:

- Pin a D2 version and recheck snapshots when it changes, because the 0.8.2
  release notes say layouts move between versions.
- A layout tuned by hand for one version is not portable to another.

### 3. Syntax agents get wrong (measured on 0.9.0, ELK)

"Silent" means that `d2 validate` and the render both exit 0 while the
diagram is wrong.

| # | Input | What happened | Correct form |
|---|---|---|---|
| 1 | `be: Backend` … `Backend -> Frontend` | **Silent.** Four shapes: the connection created new `Backend` and `Frontend` shapes. | Connect keys: `be -> fe`. Connections reference keys, not labels ([connections](https://d2lang.com/tour/connections)). |
| 2 | `step: Step #1 of 3` | **Silent.** Label rendered as "Step"; `#` starts a comment. | Quote it: `step: "Step #1 of 3"` |
| 3 | `a: first; second` | **Silent.** Two shapes, `a` labelled "first" and a new shape `second`. `;` separates statements. | Quote labels with `;` |
| 4 | `cloud: {web; db}` then `cloud.web -> db` | **Silent.** A second, top-level `db`. | Use full paths: `cloud.web -> cloud.db`, or connect inside the container's map |
| 5 | `api.v2 -> db` | **Silent.** A container `api` holding `v2`; `.` is the nesting operator. | `api_v2: api.v2` (key without dot, label free) |
| 6 | `a - b` | **Silent.** One shape labelled "a - b". | The four connection forms are `--`, `->`, `<-`, `<->` |
| 7 | `b: {class: emphasise}` (class defined as `emphasis`) | **Silent.** The shape rendered unstyled; an undefined class name is ignored. | A script check that every `class` value is defined (the old renderer's role check did this) |
| 8 | `hello世界：مرحبا` | **Silent.** One shape whose key is the whole string; a full-width `：` is not `:` ([troubleshoot](https://d2lang.com/tour/troubleshoot)) | ASCII `:` `;` `.` in syntax positions |
| 9 | Sequence diagram where `alice -> bob` first appears inside group `login: {…}` | **Silent and badly wrong.** `login` became an actor with a self-message; alice and bob were separate top-level actors. | Declare actors at the top first (`alice; bob`), then groups. The docs warn about this ([sequence diagrams](https://d2lang.com/tour/sequence-diagrams)) |
| 10 | `price: Costs $5 (approx)` | Error: `substitutions must begin on {`; `$` starts a variable. | Quote it, or use `${var}` deliberately |
| 11 | `x(int y): []int` / `a: List [draft]` / `b: Map {k: v}` | Errors: `unexpected text after array` / `…unquoted string` | Quote: `"x(int y)": "[]int"` |
| 12 | `label -> shape`, `top -> near` | `validate` passes; the render fails with `reserved keywords are prohibited in edges` | Avoid reserved words as keys (`label`, `shape`, `icon`, `width`, `height`, `top`, `left`, `near`, `direction`, `class`, `style`, `vars`, …), or quote them |
| 13 | `a: {style.fil: red}` / `style.fill: notacolor` / `shape: cilinder` | `validate` passes; the render fails with a clear message | Render to check |
| 14 | `b: {class: [x, y]}` | `validate` passes; the render fails: `class "x, y" not found. Did you mean to use ";"` | Arrays use `;`: `[x; y]` |
| 15 | `(a -> b)[1].style…` with one edge | `validate` passes; the render fails: `indexed edge does not exist` | Edge indexes start at 0 and count repeated connections |
| 16 | `note: {near: a}` under ELK | `validate` passes; the render fails: only TALA supports `near` to an object | Under dagre and ELK, `near` takes only constants (`top-center`, …) |
| 17 | `a => b` / `a: {` without `}` | Errors from both commands | — |
| 18 | `icon: https://…` offline | Render fails, but a **partial SVG is written** | Bundle local icons, or don't use icons offline. Never treat the output file's existence as success. |
| 19 | `a: in -> out`, `a: Time: 10 min`, `front-end -> back-end`, `x: line one\nline two` | Worked as intended | — |

Other rules from the docs that matter for slides:

- **Keys are case-insensitive.** `postgresql` and `postgreSQL` are the same
  shape ([shapes](https://d2lang.com/tour/shapes)).
- **Repeated connections add edges; they don't merge**
  ([connections](https://d2lang.com/tour/connections)).
- **Classes apply left to right, and an object's own attributes override
  its class** ([classes](https://d2lang.com/tour/classes)). Class names are
  also written into the SVG `class` attribute, so they can be used as tags.
- **Under dagre and ELK, `direction` is global only.** A container's own
  `direction` works only in TALA
  ([layouts](https://d2lang.com/tour/layouts)). Measured: under ELK, a
  container's `direction: right` was accepted without an error and,
  judging by the 355×776 result, not applied.
- **Grids** ([grid diagrams](https://d2lang.com/tour/grid-diagrams)):
  - Whichever of `grid-rows` or `grid-columns` comes first sets the fill
    order.
  - Cells in a row share a height, and cells in a column share a width.
  - Under dagre and ELK, edges between cells are straight lines from centre
    to centre.
- **A Markdown label needs the shape declared explicitly**, and Markdown
  that contains HTML must be valid XML (`<br/>`)
  ([text](https://d2lang.com/tour/text),
  [troubleshoot](https://d2lang.com/tour/troubleshoot)).
- **Use a different block-string delimiter** when the code contains `|`:
  `|\`ts … \`|` ([text](https://d2lang.com/tour/text)).
- **Flags and environment variables override `vars.d2-config`.** A script
  that passes `--layout` and `--theme` therefore silently overrides any
  `layout-engine` or `theme-id` the author put in the source
  ([vars](https://d2lang.com/tour/vars)).
- **`d2 fmt` normalises spacing**, for example `a->b` becomes `a -> b`
  (measured). It is safe to run before a diff.

### 4. Layout engines

From the docs ([layouts](https://d2lang.com/tour/layouts),
[dagre](https://d2lang.com/tour/dagre), [ELK](https://d2lang.com/tour/elk),
[TALA](https://d2lang.com/tour/tala)) and the [TALA
announcement](https://d2lang.com/blog/tala-is-open-source):

| Engine | Strengths | Limits |
|---|---|---|
| **dagre** (default) | Fast. Hierarchical layouts. | Strictly hierarchical. Curved multi-segment edges. No container-to-descendant edges. The docs' "unmaintained" note predates 0.8.2's native port. |
| **ELK** (`layered`; also `force`, `stress`, `mrtree`, `radial`) | Orthogonal routes. Fewer crossings. Native container-to-container routing. `width`/`height` on containers. | Strictly hierarchical. Some needless bends. Little symmetry. |
| **TALA** | Orthogonal, not tied to one direction. Symmetry. Per-container `direction`. `near` to an object. `top`/`left` locks. Routes grid edges. The blog says locked coordinates suit agents: "models can draw in 2D space well, but TALA still takes care of routing". | Seeded randomness (default seeds `1,2,3`). One more node can change the whole layout. Weaker on long DAG flows. Slower on large diagrams, scaling non-linearly. |

**Licensing:** as of 0.9.0, TALA is MPL-2.0 like D2 and bundled. `d2 layout`
lists all three engines as "bundled" (measured). Older advice about a
licence key, a watermark or a separate plugin is out of date.

**Measured** (default theme, default pad 100):

| Diagram | dagre W×H | ELK W×H | TALA W×H |
|---|---|---|---|
| 6-step pipeline, `direction: right` | 1705×268 | **1555×268** | 1846×268 |
| 3-container architecture, 7 edges | 2079×669 | **1590×569** | 1764×531 |
| Hub and 6 spokes | 1064×434 | 864×514 | 528×848 (vertical) |
| Sequence (3 actors) / grid (3×2) | identical across engines | | |

- All renders took 16–55 ms. TALA was the slowest, at about 55 ms on the
  architecture.
- All three engines gave byte-identical output on repeat renders.
- After one node was added to the architecture, ELK went from 2.79:1 to
  3.11:1. TALA went from 3.32:1 to 0.91:1 and ignored `direction: right`.

**Rule for the skill:**

- Use ELK by default, as the old renderer did.
- Use TALA only for a non-hierarchical architecture, or when positions are
  locked deliberately. When using it, check the aspect ratio after every
  edit.
- Never rely on dagre-only or TALA-only features without naming the engine.

### 5. How the old renderer worked

`skills/presentation/generate-diagrams/scripts/render-diagrams.mjs` (445
lines, Node built-ins only), with `tests/render-diagrams.test.mjs` (20 tests
against a stub `d2`) and `tests/render-diagrams-d2.test.mjs` (5 tests
against real D2, which CI pinned to 0.7.1):

1. **Input.** It parsed `DIAGRAM_SPEC.md` entries: a `## Slide N — Title`
   heading, a `**Filename:**`, and a fenced `d2` block that may be indented
   under a list item. It reported every malformed entry together and wrote
   nothing.
2. **Theme.** It read the locked theme manifest through `theme-lock.json`.
   Each manifest declares eight **Diagram Roles**:
   - for shapes: `base`, `emphasis`, `muted`, `risk`, `boundary`
   - for edges: `flow`, `optional-flow`, `risk-flow`

   Each role has a fill, stroke, font colour, dash and font size (28 px for
   shapes, 24 px for edges in Editorial). The manifest also declares the
   diagram slot's `mediaBox`, for example 1126×252.
3. **Role check.** It refused D2 that sets `fill`, `stroke`, `font-color` or
   `font-size` directly, uses colour literals, defines `classes`, or uses any
   class name other than a role. This came from quarry lesson 5: a palette
   described in prose never reached the diagram.
4. **Preamble.** It prepended a `vars.d2-config.theme-overrides` block. That
   block maps D2's colour codes (N1–N7, B1–B6, AA*, AB*) to the theme
   palette, so unclassed elements are also on theme. The preamble also adds
   one class per role.
5. **Validate.** It ran `d2 validate` on every entry before writing
   anything. Errors were rewritten to point at the entry's own line numbers,
   with the preamble subtracted.
6. **Render.** It ran `d2 --layout=elk --theme=<0|200 by tone>` to a temp
   file. It checked the SVG root, accepting a prolog, and the `viewBox`.
7. **Effective Text Size.** This was the 20 px check:
   - It takes the smallest `font-size` across all `<text>` elements and
     multiplies it by `min(boxW / svgW, boxH / svgH)`, the scale at which
     the SVG is contain-fitted into the slot.
   - It fails below 20 px.
   - It fails closed when any `<text>` has no measurable px size.
   - The failure message names the aspect mismatch and the fixes:
     `direction`, shorter labels, splitting.
   - `presentation-validation` kept an identical copy. An agreement test
     with nine hand-worked SVG fixtures keeps the two in sync.
8. **Write.** It renamed the file into place atomically, with exit codes
   0/1/2/130. `--check --candidate=<file>` measured proposed layouts without
   writing anything.

**On 0.9.0**, with only the version-pin assertion removed, all five real-D2
tests and all 20 stub tests pass (measured). The quarry already rated the D2
call, the role preamble, and the legibility measure as separable from the
Project Folder.

**Gaps found here:**

- **Code blocks fail closed.** A `|go … |` block renders as `<text
  class="text-mono">` with no `font-size`, so the check refuses any diagram
  that contains code (measured).
- **The renderer never set `--pad`.** D2's default of 100 px on each side
  shrank the contain scale considerably. With `--pad=0` the architecture
  diagram went from 7.1 to 10.9 px in 1126×252, and the hub went from 7.8 to
  12.8 px (measured).
- **It measures size only.** Clipping, overlaps, contrast, and labels that
  rendered as something else (pitfalls 1–9) are not checked.

### 6. Legibility at slide size (measured)

| Diagram (ELK) | Default 16 px, pad 100: ETS in 1126×252 / 1152×560 | 28 px shapes, 24 px edges, pad 0 |
|---|---|---|
| 6-step pipeline | 11.6 / 11.9 | 16.6 / 17.0 |
| Architecture | 7.1 / 11.6 | 15.0 / 17.4 |
| Hub and spoke | 7.8 / 17.4 | **20.5 / 36.8** |
| 3×2 grid | 11.4 / 25.3 | **38.3 / 78.7** |

Larger fonts make the boxes larger too, so the scale falls. Only small or
compact diagrams pass 20 px in a short, wide slot. TALA's hub went vertical
and fell to 9.6 px in the wide slot.

The working levers, in the order the skill should suggest them:

1. Set the pad to 0. The slide already supplies the margin.
2. Match `direction` to the slot's aspect ratio.
3. Cut the nodes in a row to about four.
4. Wrap long labels with `\n`.
5. Split the diagram.
6. Give the diagram a taller slot, or a whole slide.

D2's own default sizes are 16 px for shapes, edge labels, text, Markdown
paragraphs and sequence notes, and 14 px for legend entries. Container
titles are 28/24/20 px by nesting depth. SQL table and UML class bodies are
20 px with 24 px headers.

### 7. Diagram-design guidance

D2 offers none. The skill must carry it, briefly. Grounded rules:

- **One message per diagram.** The old suite required a brief for every
  diagram, with *Message*, *Show* and *Takeaway*, and wrote it into the
  spec. That came from field runs (quarry, prose assets). Keep the brief as
  the input. The takeaway decides which node gets emphasis.
- **Label density.** Short noun labels and verb edge labels, and only where
  an edge needs a name. Legibility (§6) puts a hard cap on node count.
  W3C notes that complex images are hard for people "with low vision,
  learning disabilities, and limited subject-matter experience", and
  suggests reducing "unnecessary complexity in your images"
  ([complex images](https://www.w3.org/WAI/tutorials/images/complex/)).
- **Direction matches reading and slot.** `right` for sequences in a wide
  slot, `down` for hierarchies. Hierarchical engines honour only a global
  direction (§4).
- **Colour as meaning, never alone.** Assign colour by role (emphasis,
  muted, risk), the way the old Diagram Roles did. WCAG 1.4.1 requires that
  information conveyed by colour also be available "through another visual
  means". Pair the risk colour with a dash, a label or a shape:
  - [Understanding 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- **Contrast.** Meaningful lines and shape borders need 3:1 against the
  background, as a threshold that is not rounded:
  - [Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
  - D2 ships theme 8, "Colorblind Clear" (`d2 themes`).
- **Style through classes, not literals**, so that a theme change restyles
  every diagram (quarry lesson 5). Theme values reach D2 through
  `theme-overrides` and generated classes, because a diagram embedded as an
  `<img>` does not inherit deck CSS (#493).
- **Prefer a legend over unexplained encodings.** `vars.d2-legend` renders
  one (measured). Its entries are 14 px, so check them against the 20 px
  rule.

### 8. Accessibility and text alternatives

- **D2's SVG has no accessible name or description.** It writes `<title>`
  only for a shape's tooltip, and has no `role` or ARIA
  ([`d2svg.go`](https://github.com/d2lang/d2/blob/master/d2renderers/d2svg/d2svg.go);
  measured on every output). Marp embeds diagrams as images, so the text
  alternative lives in the deck's Markdown alt text and the notes, not in
  the SVG.
- **W3C's pattern for complex images.** "a two-part text alternative is
  required". The first part is a short description that identifies the image
  and says where the long description is. The second is "a textual
  representation of the essential information conveyed by the image". Where
  structure matters, the long description includes the structure: for a
  diagram, the nodes, the relationships and the direction of flow.
- **Recipe for the skill:**
  - Alt text: one sentence naming the diagram type and its takeaway.
  - Long description: the steps or relationships as a list, in speaker
    notes or next to the image. It can be generated from the D2 source,
    which is itself a structured text form of the diagram.

### 9. Checking a rendered diagram

- **Structural (script):**
  - exit 0
  - `<svg>` root with a `viewBox`
  - every `<text>` measurable
  - Effective Text Size ≥ 20 px in the target slot
  - every `class` defined
  - the label set in the SVG equals the label set the author intended,
    which catches pitfalls 1–9
  - no output kept after a failed render (pitfall 18)
- **Text view (no vision):** `d2 in.d2 out.txt` writes an ASCII rendering
  in about 20 ms. It showed containers, shapes and labelled edges legibly
  for the architecture diagram (measured). It is a cheap way for any agent
  to read the topology back.
- **Visual:** `d2 in.d2 out.png` uses the built-in renderer. It needs no
  browser and works offline: 67 ms, and the PNG came out at twice the
  viewBox width. `--scale` changes that. Reading the PNG showed the
  sequence-group fault and TALA's reorientation at a glance. Neither was
  visible in any exit code.
- **In context:** the slide-level check (Marp PNG of the slide) stays with
  `rendering-slides` and `reviewing-presentation`, as in #493. A diagram that
  passes on its own can still clash with the slot.

## Recommendation

The Anthropic guidance:

- Keep the SKILL.md body under 500 lines.
- Keep references "one level deep from SKILL.md".
- Add a table of contents to any reference over 100 lines.
- Prefer scripts for deterministic operations, and validation loops for
  quality-critical work.
- Avoid time-sensitive information.

Applied here, the files would be:

```
creating-diagrams/
├── SKILL.md                    procedure + hard rules + links (≈150–200 lines)
├── references/
│   ├── d2-essentials.md        syntax core and the pitfall table (TOC; ≈150 lines)
│   ├── layouts.md              engine choice, direction, pad, flags (≈60 lines)
│   ├── design.md               one message, density, roles/colour, legibility levers (≈80 lines)
│   └── text-alternatives.md    alt text + long description recipe with an example (≈40 lines)
├── examples/                   verified .d2 files: flow, architecture, sequence, grid
└── scripts/
    └── render-diagram.mjs      salvaged core: render, check, PNG/ASCII preview
```

**SKILL.md** carries:

- the procedure: brief → D2 → render and check → look at the PNG → alt text
- the rules an agent must never miss:
  - connect keys, not labels
  - quote any label containing `# ; $ [ ] { } |` or a reserved word
  - full paths across containers
  - declare sequence actors before groups
  - classes only, no colour literals
  - ELK unless there is a reason
  - always render to check, since `validate` is not enough
- one line per reference file, saying when to read it

**Bundled:**

- **D2 essentials and pitfalls.** Taken from §3, with a wrong/right pair for
  each. Include only the constructs a slide diagram uses:
  - shapes and the shape list
  - connections and arrowheads
  - containers and `_`
  - classes
  - `near` constants
  - sequence-diagram rules (scope, order, groups, notes, spans)
  - grid basics
  - strings, quoting and block strings
- **The engine table and the layout levers** (§4, §6).
- **Design and accessibility rules**, because upstream has none (§7, §8).
- **Examples** that the skill's tests render, so they stay true when the pin
  changes.

**Pointers to upstream only:**

- the full tour pages for icons, imports, layers, scenarios and steps,
  animation, globs, vars, SQL tables and UML classes, LaTeX, and themes
- the cheat sheet
- the playground

The agent should query the CLI (`d2 --help`, `d2 layout <engine>`,
`d2 themes`) rather than read a copy of it. Pointers should name the topic
and give the URL, without restating version-specific details.

**Script** (salvage from the old renderer, per quarry question 1):

- Take a `.d2` file and a slot size as arguments, and a role or theme file
  instead of the theme lock.
- Pin the D2 version and verify the release `SHA256SUMS`.
- Default to `--pad=0` and ELK.
- Fail on undefined classes.
- Treat code-block text as measurable: the mono font size, or a declared
  default.
- Print the label set and Effective Text Size.
- Write the PNG and `.txt` previews next to the SVG.
- Remove partial output on failure.

## Open questions

1. **Where does the slot size come from** when `creating-diagrams` runs
   alone, without a deck theme? Options: a flag with a sensible default
   (1152×560?), or the caller passes it. This connects to the map's theming
   item, and the old suite had the same question (quarry question 2).
2. **Should the skill keep the strict "roles only" rule** that the old
   renderer enforced, or allow free styling when no theme is given? Strict
   roles prevented off-theme output in the field. Standalone use may want
   colour.
3. **The Effective Text Size threshold for code blocks and legends.** D2
   leaves code text unsized and draws legends at 14 px.
4. **Which D2 version to pin, and how the skill installs it.** 0.9.0 binaries
   are 16–18 MB per platform, with checksums and provenance. This belongs to
   the map's render-environment item.
5. **Is TALA's locked-position mode worth offering?** The blog suggests
   agents can place nodes in 2D while TALA routes the edges. That was not
   tested here.
6. **Pitfall 9 is a D2 behaviour worth reporting upstream:** a group that
   implicitly becomes an actor, with no warning.

## Sources

- D2 docs source: [terrastruct/d2-docs](https://github.com/terrastruct/d2-docs) at `5530a5e` (2026-10-06); pages cited inline at their d2lang.com URLs.
- D2 releases: [v0.9.0](https://github.com/d2lang/d2/releases/tag/v0.9.0), [v0.8.2](https://github.com/d2lang/d2/releases/tag/v0.8.2); [TALA is open-source](https://d2lang.com/blog/tala-is-open-source) (`blog/tala-layouts.mdx`).
- D2 source: [`d2ast/keywords.go`](https://github.com/d2lang/d2/blob/master/d2ast/keywords.go), [`d2target/d2target.go`](https://github.com/d2lang/d2/blob/master/d2target/d2target.go), [`d2renderers/d2svg/d2svg.go`](https://github.com/d2lang/d2/blob/master/d2renderers/d2svg/d2svg.go).
- W3C: [Complex images tutorial](https://www.w3.org/WAI/tutorials/images/complex/) (source `w3c/wai-tutorials@master-2.0:content/images/complex.md`); [Understanding 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html); [Understanding 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) (source `w3c/wcag`).
- Anthropic: [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).
- This repo: `skills/presentation/generate-diagrams/` (SKILL.md, `scripts/render-diagrams.mjs`, tests, evals); `skills/presentation/generate-slides/SKILL.md` (Diagram Roles); `generate-slides/themes/*/theme.json`; `skills/presentation/docs/adr/0007-optional-media-and-d2-diagrams.md`; `skills/presentation/verification/presentation-themes/tests/diagram-legibility-agreement.test.mjs`.
- Prior research: [`presentation-suite-quarry.md`](https://github.com/ken-guru/skills/blob/research/presentation-suite-quarry/docs/research/presentation-suite-quarry.md) (#483), [`charts-for-decks.md`](https://github.com/ken-guru/skills/blob/research/charts-for-decks/docs/research/charts-for-decks.md) (#493).
