# Set gallery accessibility and freshness criteria

Map: [Document the presentation theme gallery](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex

Blocked by: [Define the theme documentation architecture and promise](01-define-documentation-architecture-and-promise.md), [Define the gallery asset pipeline](03-define-gallery-asset-pipeline.md)

## Question

What accessibility, responsive-layout, image-description, provenance, and freshness checks must the README and gallery pass, and which theme, composition, fixture, or approved-baseline changes should require an explicit documentation screenshot refresh?

## Resolution

Make the theme gallery pass a fast static gate on every verification run and a full rendered gate for presentation-theme changes. Keep public screenshots reviewed and immutable by default: verification reports staleness but never updates documentation assets automatically.

### Portable responsive structure

Use ordinary Markdown headings, paragraphs, links, and full-width images. Do not use HTML tables, fixed-width image attributes, custom layout HTML, or a three-column grid.

The README presents Editorial, Signal, and Field Notes as three consecutive blocks. The dedicated gallery groups screenshots by Slide Archetype and presents the three themes beneath each archetype heading in stable catalog order. This trades simultaneous columns for portability across GitHub, narrow mobile screens, rendered Markdown viewers, and repository browsers.

The full check renders both documentation files through a pinned Markdown renderer at 320, 768, and 1280 CSS pixels. It blocks when an image exceeds its content container or any tested viewport gains horizontal overflow. Completion also requires human inspection of the actual GitHub pull-request rendering; the local renderer is a cross-surface guard, not a claim of exact GitHub parity.

### Image descriptions and textual equivalence

Every screenshot has unique, purpose-based alternative text that:

- Names the Theme and Slide Archetype.
- Describes the distinguishing palette, typography, framing, and composition relevant to comparison.
- Avoids transcribing all slide copy when the surrounding documentation already provides context.
- Is neither empty nor generic, filename-like, or equivalent to “screenshot.”

Example:

> Editorial title slide with a warm cream canvas, large serif headline on the left, and a softly framed portrait on the right.

All selection guidance, behavioral promises, stable-versus-variable boundaries, media ownership, and AI provenance remain real Markdown text. Essential information never exists only inside screenshot pixels.

The visible AI disclosure appears once immediately before the first comparison in both README and gallery. The asset manifest supplies machine-readable provenance. Repeating the same disclosure beneath all twelve screenshots is unnecessary.

### Fast documentation gate

Include a browser-free gallery check in `npm test`. It validates:

- One clear page title and correctly nested headings.
- Unique and meaningful alt text on every expected screenshot reference.
- Required textual guidance and AI-provenance disclosure.
- Every local image and documentation link resolves.
- README links to the gallery, and the gallery links back to the presentation workflow.
- Exactly the twelve expected semantic filenames and three README title references are used.
- Every approved image is 1280×720, satisfies its SHA-256 manifest entry, and stays below the agreed size ceilings; soft-target overruns are reported for review.
- The manifest contains complete theme, archetype, fixture, renderer, source-media, and provenance fields.
- The recorded gallery dependency fingerprint matches the current source inputs.

Slide-level semantics, color contrast, font sizing, geometry, collisions, media orientation, and crop integrity remain the responsibility of the existing production render acceptance suite. Do not attempt to infer those properties from PNG pixels.

### Freshness dependency fingerprint

At explicit gallery approval, compute and record one deterministic source fingerprint over:

- Theme Catalog order.
- The three selected Theme Manifests and Theme CSS files.
- Semantic markup and slide-composition code used by the fixture.
- Gallery fixture content and selected slide mapping.
- `IMAGE_SPEC.md` and the approved portrait bytes.
- Pinned Marp and browser-rendering versions.
- Screenshot viewport, capture, naming, and gallery-render logic.

Any change to those inputs makes the gallery stale and requires rerendering, human review, and explicit reapproval even when the resulting pixels happen to look unchanged. Manual edits to an approved documentation PNG fail its individual SHA-256 check.

Do not invalidate the gallery for unrelated PDF baseline changes, ordinary edits to unshown fixture slides, or documentation copy alone unless a shared fingerprinted source also changed. HTML/PDF parity remains independently covered by the production acceptance suite.

### Full rendered gate

The full check:

1. Regenerates the gallery fixture from committed inputs.
2. Renders all three themes through production Marp HTML.
3. Reuses the existing Axe, contrast, semantic, geometry, collision, font, orientation, and media checks for the selected slides.
4. Captures the twelve full-slide screenshots at 1280×720.
5. Compares fresh renders against approved documentation assets using the existing visual-regression contract: Pixelmatch threshold `0.2` and at most `1.5%` changed pixels.
6. Generates the ignored 3×4 review matrix.
7. Runs the 320, 768, and 1280 pixel Markdown previews.

Exact SHA-256 equality applies to committed asset files. The pixel tolerance applies only when a fresh pinned-environment render is compared with its approved asset.

### Blocking refresh and paid-generation boundary

When a freshness check fails, list the changed dependencies and report this recovery sequence:

1. Regenerate the gallery fixture and HTML renders.
2. Run the full gallery checks.
3. Inspect the 3×4 review matrix and GitHub Markdown preview.
4. Run `npm run approve-gallery -- --approve`.
5. Re-run fast and full verification.

No test, render, CI, or baseline-approval command may update public screenshots.

A normal gallery refresh always reuses the committed portrait and incurs no image-generation cost. If the approved portrait is missing or its Image Spec has intentionally changed, fixture, render, check, and approval tooling must stop and report that a new paid generation is required. They must never call an image-generation API.

Only a separate `generate-images` session may replace the portrait. It must show the generation scope and pricing notice and obtain explicit user confirmation immediately before calling Gemini, then follow the one-at-a-time review flow. A newly accepted portrait makes the gallery stale and requires the complete reviewed screenshot refresh above.

This decision adds no new presentation-domain term and requires no ADR; it defines documentation acceptance criteria at existing verification and approval seams.
