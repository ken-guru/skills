# Specify generator integration and theme packaging

Map: [Three engaging presentation themes](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Define the Presentation Theme contract](02-define-presentation-theme-contract.md), [Specify Discovery and project-state theme behavior](04-specify-discovery-and-state-behavior.md), [Specify theme-aware slide composition](05-specify-theme-aware-slide-composition.md), [Set accessibility and Marp export acceptance criteria](06-set-accessibility-and-export-criteria.md)

## Question

How should `generate-slides` translate persisted theme selection into Marp front matter, CSS, slide markup, media prompts, and project assets while keeping regeneration deterministic and the installed skill maintainable?

## Resolution

Treat theming as one deep module. `generate-slides` supplies a persisted theme identifier and theme-independent slide content; a selected, versioned Theme Package supplies all theme-specific composition, typography, media-treatment, decoration, and Marp rendering behavior through one Theme Manifest. Theme knowledge must not be duplicated across generator instructions, scaffold CSS, slide front matter, media renderers, or validators.

### Installed Theme Catalog and packages

The installed skill owns one Theme Catalog and exactly three bundled packages:

```text
skills/generate-slides/themes/
├── catalog.json
├── theme.schema.json
├── editorial/
│   ├── theme.json
│   └── theme.css
├── signal/
│   ├── theme.json
│   └── theme.css
└── field-notes/
    ├── theme.json
    └── theme.css
```

The Theme Catalog is the sole bundled-theme registry. Its ordered entries define Discovery order and package locations; it declares `editorial` as the default and the Semantic Slide Markup version supported by the installed generator. Names, descriptions, composition rules, and visual behavior remain in the packages rather than being repeated in the catalog.

Every Theme Manifest declares at least:

- Stable `id`, untranslated `name`, translatable source `description`, `packageVersion`, and `markupVersion`.
- Offline-safe display, body, and label font stacks, including the final generic fallback used for Content Capacity validation.
- All seven required Slide Archetypes, their Content Slots, shared minimum Content Capacity, supported variations, ordered applicability rules, tonal treatment, and required semantic classes.
- Portrait and landscape variations for text-plus-image.
- Picture and diagram treatment guidance that may style but never rewrite Media Intent.
- The exact Marp theme identifier and CSS entry point.
- An optional, normally empty list of packaged assets and their fingerprints.

`theme.schema.json` validates this interface. The three initial packages do not require or ship theme-owned assets. A future package may include an `assets/` directory only for offline, license-cleared Decorative Elements declared in the manifest. Prefer CSS geometry; never package sample photography, prototype imagery, logos, or semantic media.

### Selection, preflight, and snapshot

Before changing project outputs, Generation:

1. Resolves `DISCOVERY.json.theme.id` through the Theme Catalog. Missing legacy state uses Editorial without mutating Discovery and reports the previously agreed guidance; an unknown present identifier blocks.
2. Validates catalog/manifest ID agreement, supported package and markup versions, complete archetype and variation coverage, Content Slots and capacity rules, declared CSS classes, matching Marp `@theme` metadata, required files, and fingerprints.
3. Reuses a complete matching project snapshot or copies the selected installed package into the Project Folder and writes its lock.
4. Blocks rather than falling back when a known installed package or project snapshot is missing, modified, incompatible, or internally inconsistent.

The Project Folder contains exactly one active snapshot:

```text
.
├── .marprc.yml
├── .vscode/settings.json
├── PRESENTASJON.md
├── PRESENTASJON.html
├── PRESENTASJON.pdf
└── themes/
    ├── theme-lock.json
    └── editorial/
        ├── theme.json
        ├── theme.css
        └── assets/          # optional and absent from initial packages
```

`theme-lock.json` records the theme ID, `packageVersion`, `markupVersion`, and package-file fingerprints. Project outputs never reference the installed skill path. A confirmed theme change removes the prior snapshot before copying the new one, preserving the one-theme-per-presentation invariant.

If a newer installed version exists, regeneration continues with the locked snapshot and reports an optional refresh. Refresh is explicit, never automatic. A refresh conservatively follows theme-change restart behavior: Media Specs and presentation outputs become stale, generated media is preserved with a treatment warning, and affected phases return to pending.

### Marp and surface adapters

All rendering surfaces consume the same project-local `theme.css`:

- `.marprc.yml` registers the locked stylesheet through `themeSet`, enables local files, and permits the semantic HTML used by slides.
- `.vscode/settings.json` registers that exact stylesheet for editor preview.
- `PRESENTASJON.md` uses readable front matter containing `marp: true`, the selected theme ID, 16:9 sizing, pagination, and document language. It contains no copied theme CSS and no universal `class: invert`.
- The README uses the project configuration for `marp -s .`, HTML export, PDF export, and the optional manual PPTX command.

Default Generation writes `PRESENTASJON.md`, exports `PRESENTASJON.html`, and exports `PRESENTASJON.pdf`. PPTX remains documented but is neither generated nor accepted by default. The existing duplicated inline CSS and `themes/custom-image-style.css` are removed from the scaffold.

An External Font Override is the sole permitted generated style override in front matter. It optionally imports the user-approved URL, sets the exact family through shared theme font variables, and retains the selected package's offline fallback stack. It affects slide-rendered text only. A failed font load produces a reported fallback rather than blocking export, mutating state, or entering either Media Spec.

### Semantic Slide Markup and deterministic composition

Every package consumes one shared Semantic Slide Markup vocabulary. Themes may arrange Content Slots differently but cannot require bespoke HTML, theme-specific slot names, or altered reading order. Each slide keeps heading, body or takeaway, media, and caption in the accessible DOM order established by the acceptance criteria. Decorations are CSS-generated or explicitly non-semantic.

Generation classifies slides with this ordered table:

1. Presentation opener → title.
2. Explicit section boundary → section.
3. Diagram visual → diagram.
4. Quantitative content or chart → data.
5. Picture visual → text-plus-image.
6. Explicit quotation → quotation.
7. Everything else → text-only.

The Theme Manifest then selects the first applicable supported variation from declared facts such as content shape and Intended Media Orientation. It may not use randomness or aesthetic improvisation. A Marp local class directive persists the selected archetype, variation, and tonal treatment on each slide, for example:

```markdown
<!-- _class: archetype-text-plus-image variation-portrait tone-light -->
```

This directive is the observable composition record; do not create a duplicate slide-plan artifact. The same Agenda, Media Specs, selected package snapshot, and font state must produce the same classification, classes, Semantic Slide Markup, and outputs.

### Media handoff

`generate-images` and `generate-diagrams` do not load Theme Packages or interpret theme state. Media Specs are the complete, inspectable handoff from Generation:

- Each Picture entry adds Media Intent, Intended Media Orientation, Theme Treatment, and a composed prompt suggestion. Theme Treatment may add palette, texture, photographic treatment, and background compatibility but may not rewrite Concept, Elements, or intent.
- Each Diagram entry retains Message, Show, and Takeaway and adds Theme Treatment plus palette and line guidance before producing D2 source. It must preserve semantic colors, labels, relationships, and encodings.
- External Font Override state never enters either spec.

Theme-driven changes therefore appear in the existing Media Spec diff and approval flow. Renderers remain simple adapters that execute approved complete specifications.

### Validation boundary

Generation and proofreading validate through the Theme Manifest interface rather than maintaining theme-specific rules. Package integrity, Semantic Slide Markup compatibility, required archetypes and variations, declared class presence, snapshot integrity, and Marp theme identity are fatal preflight checks. Render validation then applies the shared accessibility, Content Capacity, media-legibility, collision, and HTML/PDF parity gates already established.

### Context and technical pointers

- [Presentation theme domain glossary](../../CONTEXT.md)
- [Marp CLI theme and configuration documentation](https://github.com/marp-team/marp-cli/blob/main/README.md)
