# Presentation Domain Glossary

## Phase Skill

A Presentation Skill that operates on a persistent Project Folder. It reads and
writes state files, can be invoked independently, and can be sequenced by the
Orchestrator.
_Avoid_: pipeline skill, workflow step

## Phase

One logical step in the content creation pipeline. The lifecycle phases are:

1. **Discovery** — gather requirements from the user (topic, audience, duration, language, occasion)
2. **Structure** — build and iterate on the content outline
3. **Generation** — render the final output files
4. **Proofread** — quality check the generated output; skippable but recommended

**Media phases** — independently invokable Presentation Skills for producing
images and diagrams. They have their own Project Folder state and completion
rules, but remain media work associated with the Structure-to-Generation flow.

## Project Type

The category of content a pipeline produces (e.g., presentation). Determines default values, output templates, and validation rules for all phase skills.
_Avoid_: content type, project kind

## Project Folder

The on-disk directory that Phase Skills use to exchange state and presentation artifacts for one project.
_Avoid_: working directory, output folder

## Orchestrator

A Phase Skill that coordinates a full pipeline — detecting project state and routing the user to the next phase.
_Avoid_: coordinator, controller, runner

## Exit Criteria

The conditions an orchestrator verifies before advancing from one phase to the next. Defined per phase transition; all conditions must pass before the next phase skill is called.
_Avoid_: completion checklist, done criteria

## Restart Guard

A protocol invoked at phase startup when re-running that phase would make downstream files stale. Presents the user with an explicit inventory of affected files and a choice before any modifications are made.
_Avoid_: cleanup prompt, stale file handler

## Eval

A test case that documents expected skill routing behaviour for a given query. Three types:
- **positive** — the skill should load
- **negative** — the skill should not load
- **boundary** — correct routing depends on project state

## Trigger

The `description` field in a skill's frontmatter. Written as a `Load when…` instruction that the agent uses to decide which skill to invoke for a given user request.
_Avoid_: activation condition, routing description

---

## Presentation-specific terminology

**Slide** — One page in the final rendered output.

**Slide Archetype** — A theme-independent semantic role assigned to a Slide from its content and media intent, such as title, section, text-only, text-plus-image, data, diagram, or quotation. A Presentation Theme composes an archetype but does not reclassify it.
_Avoid_: layout, slide template, slide type

**Archetype Variation** — A named composition within one Slide Archetype, selected deterministically from content shape, media orientation, and other declared applicability rules. It changes presentation without changing semantic role.
_Avoid_: alternate template, random layout

**Content Slot** — A theme-independent named part of a Slide Archetype, such as title, body, media, caption, metric, or attribution. Presentation Themes arrange populated slots but do not invent content to fill them.
_Avoid_: placeholder, content region

**Content Capacity** — The maximum content an archetype composition guarantees it can display without clipping, hiding, or compressing text below approved readability limits. Generation must restructure content that exceeds this limit.
_Avoid_: character limit, overflow allowance

**Semantic Slide Markup** — The theme-independent Marp and HTML structure that declares a Slide's archetype, variation, and populated Content Slots in accessible reading order. Every Theme Package must compose this shared structure without requiring theme-specific markup.
_Avoid_: slide HTML, layout markup, theme markup

**Decorative Element** — A theme-supplied shape, texture, rule, number, or ornamental mark that carries no information and is excluded from the Slide's reading order. It must not imply meaning or obstruct content or media.
_Avoid_: visual cue, data decoration

**Agenda** — The structured outline containing sections, slide topics, image placeholders, source references, and a glossary. Produced during the Structure phase and consumed by Generation.

**Media Specs** — Files produced during the Structure phase (`IMAGE_SPEC.md` and `DIAGRAM_SPEC.md`) that map slides to visual assets. `IMAGE_SPEC.md` contains AI image generation prompts; `DIAGRAM_SPEC.md` contains D2 source code for diagrams.
_Avoid_: image plan, prompt file, media plan

**Media Intent** — The communicative job of a visual and the subjects, labels, relationships, or encodings that must remain perceptible. Presentation Theme treatment may change its framing but must preserve this intent.
_Avoid_: visual style, image purpose

**Intended Media Orientation** — The portrait or landscape orientation declared for a Picture before rendering. It selects the matching text-plus-image Archetype Variation and guides media generation; an existing asset's dimensions must agree with it.
_Avoid_: image shape, layout direction

**Media Scope** — The subset of Media Spec entries targeted for generation in a given run: all entries, missing-only entries, or a user-specified subset by slide number.
_Avoid_: image set, generation targets

**Media Renderer** — A Presentation Skill that turns an approved Media Spec into
media assets and updates the corresponding media phase in the Project Folder.
Image and Diagram Media Renderers share the scope, review, reporting, and state
preservation protocol while retaining distinct provider behavior.

_Avoid_: media generator, rendering helper

**Generation Mode** — How media (images or diagrams) is produced within a run. **Batch**: all media in scope are generated sequentially without pausing. **Interactive**: one visual is generated at a time, pausing after each for user review before proceeding.
_Avoid_: run mode, output mode, step-by-step mode

**Narrative structure** — The logical flow of a presentation (e.g., "problem → solution → implications")

**Glossary** (Begreper og definisjoner) — Canonical definitions of all domain-specific terms used in the presentation

**Agenda-time diagram briefing** — The collaborative discussion of a slide's diagram intent and content while its agenda entry is being drafted, before any diagram specification or D2 source is generated.

**Diagram brief** — The named block on a Diagram agenda entry that records its Message, Show, and Takeaway. It is the single source of truth for a diagram's intent and content.

**Presentation Theme** — A presentation-wide visual system that composes Slide Archetypes through palette, typography, spacing, decorative geometry, and media treatment without changing content or Media Intent. One applies to an entire presentation; its fonts are offline-safe unless the user explicitly requests an external font.
_Avoid_: style, skin, template

**Theme Package** — A versioned, self-contained definition of one Presentation Theme, including its composition rules, media treatment, metadata, and Marp CSS. Generation snapshots the selected package into the Project Folder so every rendering surface consumes the same visual system.
_Avoid_: theme files, CSS theme, theme assets

**Theme Manifest** — The declarative interface of a Theme Package, defining its identity, compatibility, composition rules, Content Capacity, typography, media treatment, and required semantic slide classes. Generation and validation consume the manifest rather than inferring behavior from CSS.
_Avoid_: theme config, style metadata

**Theme Catalog** — The installed registry of bundled Presentation Themes, defining their stable order, default, package locations, and supported Semantic Slide Markup version. Theme-specific behavior remains in each Theme Manifest.
_Avoid_: theme list, theme registry

**Theme Resolution** — The deterministic operation that combines persisted theme selection, the installed Theme Catalog, and any locked project snapshot into one validated Theme Package or a precise blocking error.
_Avoid_: theme loading, theme lookup

**Theme Acceptance Suite** — The non-shipping verification corpus that exercises Theme Resolution, project generation, and rendered-deck acceptance with canonical fixtures and reviewed visual baselines.
_Avoid_: theme tests, visual test deck

**External Font Override** — An optional, explicitly requested typeface for slide-rendered text that replaces a Presentation Theme's default typography while retaining its offline-safe fallback stack. It does not apply inside images or diagrams, and bundled themes never require one.
_Avoid_: custom font, theme font

**Accessible Reference Output** — The HTML presentation used to evaluate semantic headings, reading order, text alternatives, and visual accessibility. PDF and PPTX are visual derivatives and are not assumed to preserve equivalent accessibility semantics.
_Avoid_: accessible deck, canonical export
