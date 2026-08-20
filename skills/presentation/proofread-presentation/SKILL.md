---
name: proofread-presentation
disable-model-invocation: true
description: "Run quality validation and proofreading passes..."
---

# Proofread Presentation

Validate an existing themed `PRESENTASJON.md`, safely fix mechanical issues, report content concerns, and update Proofread state only when blocking checks pass.

## Startup

Require `DISCOVERY.json`, `PROJECT.json`, `PRESENTASJON.md`, Node.js, and Marp CLI. Read the project-local `themes/theme-lock.json`, its selected Theme Manifest, declared CSS, and assets. Recompute the lock's SHA-256 fingerprints and validate the manifest contract described below before changing anything. A missing, modified, or incompatible Theme Package is fatal. Do not depend on another phase skill being installed.

Read the locked Theme Manifest and validate against its interface rather than hard-coding Editorial, Signal, or Field Notes behavior.

When the complete Presentation Skill Suite is installed, invoke the read-only `presentation-validation` dispatcher with the `proofread` profile before completion. If it is unavailable, report that full validation cannot run under the suite installation contract; do not install it automatically.

## Safe mechanical fixes

- Add missing purpose-based `alt` text to meaningful media when intent is unambiguous from the Agenda and Media Specs.
- Use empty `alt` text for explicitly decorative images.
- Strip trailing whitespace from presenter notes.
- Correct a missing semantic Content Slot class when the slide's existing archetype and content make the intended slot unambiguous.

Never convert media to `img-right`, add `class: invert`, insert inline theme CSS, change an archetype, choose another variation, rewrite Media Intent, or delete content as an automatic fix.

## Blocking validation

### Theme and markup

- Front matter contains `marp: true`, the resolved theme ID, `size: 16:9`, `paginate: true`, and the presentation language.
- Front matter contains no copied theme CSS. Only the generated External Font Override style is permitted.
- Every slide declares exactly one supported Slide Archetype, one supported Archetype Variation, and the Theme Manifest's tonal state.
- Every populated node uses shared Semantic Slide Markup and Content Slots; no theme-specific semantic wrappers exist.
- Classification agrees with the Agenda and Media Spec visual type.

### Accessibility and readability

- Meaningful Pictures, charts, and Diagrams have purpose-based alternative text; decorative media is absent from reading order.
- DOM order is heading, body or takeaway, media, then caption.
- Essential wording is real text rather than raster content.
- Computed contrast is at least 4.5:1 for body/supporting text, 3:1 for large headings, and 3:1 for meaningful non-text graphics.
- On the 1280×720 reference slide, titles are at least 54 px, headings 36 px, body and metric labels 28 px, captions and attribution 20 px, and pagination/context labels 18 px.
- Body line height is 1.25–1.5; display line height is at least 1.0. All-caps is limited to short labels and brief Signal headings.

### Capacity, collision, and media

- Content does not exceed the selected composition's declared Content Capacity.
- No text or semantic media leaves the slide, overlaps another protected Content Slot, clips, scrolls, truncates, or sits within 32 px of an edge.
- Essential text never overlays raster media.
- Picture dimensions agree with Intended Media Orientation.
- Raster media is not enlarged beyond native size; fallback raster output is at least 2× displayed dimensions.
- Cropping preserves Media Intent; Diagram labels and chart values remain legible at 100% view.
- Theme grading preserves semantic colors and required contrast.

Any failure above blocks completion and is reported with slide numbers and the relevant archetype/slot.

## Non-blocking content warnings

Report with slide numbers:

- Code fences or progressive-reveal syntax.
- More bullets than the archetype permits.
- Missing presenter notes or notes not in bullet format.
- A video sharing a slide with other content.
- A slide without a semantic heading.
- Mixed language, inconsistent glossary terminology, unexplained abbreviations, grammar concerns, or encoding problems.
- Expected media placeholders that have not yet been rendered.

## Reference integrity

- Every Agenda Picture filename matches one `IMAGE_SPEC.md` entry and every Picture used by slides exists in that spec.
- Every Agenda Diagram filename matches one `DIAGRAM_SPEC.md` entry and every Diagram used by slides exists in that spec.
- No orphan Media Spec entry exists.
- Every source link used by slides has a successful source summary or appears in the reported fetch failures.
- Slide count remains within the confirmed estimate unless the user approved a different count.

## Export parity

When HTML and PDF exist, confirm equal slide counts, 16:9 dimensions, text, media, and pagination. Compare PDF visually with the HTML Accessible Reference Output for layout shift, clipping, missing decoration, materially different color, and illegible media. A mismatch is blocking.

## Completion

Report fixed issues, blocking failures, warnings, and reference results. Mark `phases.proofread.status = "done"` with a timestamp only when no blocking issue remains. Otherwise keep it pending.
Require `PROJECT.json` to have `projectType: "presentation"` and preserve every
unrelated phase record when updating Proofread.

The validation dispatcher must return zero before Proofread may be marked complete. A zero validator result is necessary but does not replace this Skill's mechanical-fix, user-review, and state-preservation requirements.
