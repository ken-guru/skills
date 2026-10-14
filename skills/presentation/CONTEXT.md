# Presentation Domain Glossary

The language of the Presentation suite and the general-purpose skills it uses. Terms are defined once here; skills use them without redefining them.

## Process

**Interview** — Finding out what the person means: audience, goal, occasion, length, constraints, look, and premises, in rounds of questions until nothing important is unclear. Produces the Brief.
_Avoid_: discovery, intake

**Research** — Finding out what the world says: reading supplied sources, finding credible ones, judging credibility, and putting conflicting claims to the person. Produces the Source Set.
_Avoid_: source fetching

**Storyline stage** — Arranging the argument from the Source Set. Produces the Storyline.

**Draft** — Writing each slide's heading, body, speaker notes, and Visual Intent. Produces the Deck Source.

**Visuals** — Turning Visual Intents into Media.

**Render** — Applying the look and exporting the formats. Produces the Rendered Deck.

**Review** — Checking facts and traceability, language, legibility, timing, and the rendered result. Produces Findings.

**Gate** — A point where the person must approve before work continues: the Brief, the Source Set with its conflict rulings, the Storyline, and the visuals plan. Recorded as `approved: true` in the file; a missing approval warns and never blocks.
_Avoid_: checkpoint, exit criteria

## Artifacts

**Deck Folder** — One folder per presentation holding its artifacts under fixed names. The files are the only state.
_Avoid_: project folder, output folder

**Brief** — The confirmed description of the talk: audience, goal, occasion, length, constraints, look, editorial preferences, language, sources in hand, and any research waiver. `brief.md`.

**Source Set** — The vetted sources the deck may rely on, each with a credibility note and the claims it supports, plus every conflict with the person's ruling. `sources.md`.
_Avoid_: bibliography, references

**Storyline** — The approved argument: key message, narrative arc, sections, and slide topics. `storyline.md`.
_Avoid_: agenda, outline (an outline is what a person may bring; the Storyline is what they approve)

**Deck Source** — The single editable source of truth for the slides: one Marp Markdown file with speaker notes and citations in HTML comments. Every rendered output is regenerated from it. `deck.md`.

**Visual Intent** — The job a slide's visual must do and what must remain perceptible in it. The set of Visual Intents is the visuals plan the person approves.
_Avoid_: image prompt, media spec

**Media** — The diagrams, charts, and images made from Visual Intents, kept in `media/`.

**Rendered Deck** — The outputs in `dist/`: HTML, tagged PDF, and the speaker-notes script, plus a slide-picture PPTX and PNG slide images on request.

**Findings** — Review results, grouped by the stage that owns each fix.

## Look

**Theme** — One Marp CSS file whose values are CSS custom properties on `:root`. Editorial (light) and Editorial Inverse (dark) ship; the deck's chosen theme is copied into its Deck Folder as `theme.css`.
_Avoid_: theme package, skin

**Brand Theme** — A theme that imports Editorial or Editorial Inverse and overrides only colours, fonts, and an optional title-slide logo.
_Avoid_: template, organisation theme

**Theme Values** — A theme's custom properties as JSON, passed to `creating-diagrams` and `creating-charts` so visuals match the slides.

**Layout Class** — The one Marp class a slide uses: default, `title`, `section`, `split`, `visual`, or `quote`. Each declares the slot its visual fills.
_Avoid_: archetype, slide template

**Slot** — The space a visual fills on a 1280×720 slide reference, used to check that its text stays legible.

**Diagram Role** — The fixed styling classes a diagram uses instead of colours: `base`, `emphasis`, `muted`, `risk`, `boundary`, `flow`, `optional-flow`, `risk-flow`.

## Quality

**Accessibility Bar** — The single accessibility standard every deck meets: WCAG 2.2 AA, with visual criteria (contrast, colour not the only signal, 20 px minimum text) and structural criteria (headings, alt text, reading order, language, link purpose). Stated in `docs/accessibility-bar.md`.

**Effective Text Size** — The size the smallest text in a visual reaches in its slot on the 1280×720 reference. Must be at least 20 px.

**Generated Visual** — Media made by an AI image provider. Always carries a visible label, alt text starting "AI-generated:", and a sidecar recording provider, model, prompt, and date.
