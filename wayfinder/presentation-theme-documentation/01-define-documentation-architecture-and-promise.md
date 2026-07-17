# Define the theme documentation architecture and promise

Map: [Document the presentation theme gallery](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex

## Question

What exact information belongs in the concise README theme preview versus the dedicated gallery, and what user-facing language accurately promises a stable, recognizable Presentation Theme while explaining content-dependent layout variation, Media Spec ownership, the Editorial default, and theme selection during Discovery?

## Resolution

Use a two-level documentation architecture that introduces Presentation Themes prominently, then expands the comparison and behavioral contract without turning the root README into the complete reference.

### Root README

Place a `Presentation themes` section immediately after the repository introduction and before the skill inventory. This makes the shipped visual capability visible before readers encounter the pipeline's individual skills.

Keep the section concise and include:

1. This expectation statement:

   > Each theme is a deterministic visual system with consistent typography, palette, spacing, decoration, image treatment, and composition rules. Exact layouts respond to slide content and media, so the examples are representative rather than fixed templates.

2. One matched production-rendered comparison showing the same slide in Editorial, Signal, and Field Notes.
3. The canonical one-sentence description and lightweight, non-exclusive affinity for each theme.
4. A note that Editorial is the default, new presentations choose a theme during Discovery, and existing presentations change themes by rerunning Discovery.
5. A link to the dedicated theme gallery.

Do not place detailed restart behavior, the full comparison matrix, implementation concepts, or manual state-editing instructions in the README.

### Dedicated gallery

Create `docs/presentation-themes.md` with this reading order:

1. How Presentation Themes behave.
2. The matched four-archetype comparison gallery.
3. Editorial, Signal, and Field Notes selection guidance.
4. What remains stable versus what varies.
5. How themes treat media without controlling generated-image style.
6. How to select or change a theme through Discovery.

The expanded behavior explanation distinguishes:

- **Stable visual system:** presentation-wide palette, offline-safe typography, spacing, decorative geometry, media treatment, and deterministic archetype composition rules.
- **Content-dependent output:** the Slide Archetype, content length, Media Intent, and intended media orientation can select another declared composition or split content, so screenshots are representative rather than pixel-identical templates.
- **Media ownership:** a theme controls placement, crop, framing, palette guidance, and treatment while the approved Media Spec controls what an image or diagram communicates and, for generated imagery, its artistic prompt. Sample imagery is not a bundled theme asset or guaranteed theme output.

### Selection guidance

Use the existing canonical theme descriptions unchanged and add these explicitly non-exclusive affinities:

- **Editorial** — “Warm, typographic, and composed like a modern magazine.” Best suited for polished narratives, proposals, strategy, and reports.
- **Signal** — “Bold, high-contrast, and structured for energy, systems, and data.” Best suited for energetic launches, system explanations, and data-forward stories.
- **Field Notes** — “Tactile, natural, and shaped like a documented working session.” Best suited for workshops, research, retrospectives, and human-centered stories.

State that these are selection suggestions, not subject-matter restrictions. Editorial remains the documented default.

### User workflow

- New presentations choose a theme during Discovery immediately after visual preference.
- Existing presentations change themes by rerunning Discovery.
- The dedicated gallery explains that a theme change can regenerate Media Specs and presentation outputs, and that the skill reports affected artifacts and requests confirmation first.
- Documentation directs users through skills rather than telling them to edit identifiers, `DISCOVERY.json`, locks, snapshots, or project-local CSS manually.

This documentation decision introduces no new domain term and does not change the existing definitions of Presentation Theme, Theme Package, Slide Archetype, or Media Specs in `CONTEXT.md`.
