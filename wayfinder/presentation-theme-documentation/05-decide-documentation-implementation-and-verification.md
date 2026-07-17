# Decide the documentation implementation and verification plan

Map: [Document the presentation theme gallery](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex

Blocked by: [Define the theme documentation architecture and promise](01-define-documentation-architecture-and-promise.md), [Select the matched production gallery examples](02-select-matched-production-examples.md), [Define the gallery asset pipeline](03-define-gallery-asset-pipeline.md), [Set gallery accessibility and freshness criteria](04-set-gallery-accessibility-and-freshness-criteria.md)

## Question

In what incremental order should the README, dedicated gallery, curated assets, generation or refresh tooling, and verification checks be implemented, and what completion gate proves the documentation is accurate, maintainable, accessible, and ready to publish?

## Resolution

Implement the gallery test-first and producer-before-consumer on the existing `feat/deterministic-presentation-themes` branch. Build and verify the production evidence before public documentation references it, and keep every pushed commit green.

### Public verification seams

Drive implementation through focused tests at these observable seams:

1. **Gallery source resolution:** Given the Theme Catalog, selected slide mapping, gallery fixture, committed portrait, and pinned renderer inputs, return the exact dependency fingerprint and twelve expected semantic output identities or a precise blocking error.
2. **Gallery approval:** Given a reviewed report directory and explicit `--approve`, validate count, identity, dimensions, provenance, and size budgets, then replace only the twelve public PNGs and their manifest. Missing approval, incomplete renders, stale source media, or a paid-generation requirement blocks without writes.
3. **Documentation validation:** Given README, gallery Markdown, approved assets, and manifest, report heading, link, image-reference, alt-text, disclosure, hash, fingerprint, size, and responsive-overflow failures without changing files.
4. **Rendered gallery acceptance:** Given committed inputs, regenerate the gallery through production Marp HTML, apply the selected slide accessibility and geometry checks, compare it with approved documentation assets at the agreed tolerance, and create the ignored 3×4 review matrix.

Tests assert results and error behavior through these seams rather than coupling to incidental helper functions.

### Implementation order

Work in this order and do not push a failing intermediate state:

1. **Capture the completed specification.** Finish and validate this Wayfinder map and its decision tickets on the existing pull-request branch.
2. **Add focused red tests locally.** Cover expected semantic assets, dependency fingerprint inputs, manifest validation, approval refusal without `--approve`, source-image absence or mismatch, paid-generation guardrails, documentation links and alternatives, size budgets, and responsive overflow.
3. **Build the producer path.** Extend `verification/presentation-themes` with the gallery fixture, source resolver, Marp HTML renderer, selected-slide capture, 3×4 comparison matrix, manifest writer, explicit approval command, and fast/full verification scripts. Reuse existing render checks and pinned dependencies where their public behavior matches the gallery contract.
4. **Specify the sample portrait.** Commit the final gallery `IMAGE_SPEC.md` with concept, portrait orientation, protected focal region, alternative description, prompt, filename, and empty generation metadata ready to be completed after acceptance.
5. **Pause for paid generation.** Before any API call, invoke the installed `generate-images` skill in one-at-a-time mode. Show the exact one-image scope and pricing notice and obtain explicit user confirmation. Generate, inspect, and retry only with user-directed approval; then record the actual Gemini model and approval date and commit the accepted PNG. No gallery script calls Gemini.
6. **Produce and approve evidence.** Render the identical gallery fixture in Editorial, Signal, and Field Notes, run full checks, inspect the 3×4 matrix, and explicitly run `npm run approve-gallery -- --approve` to create the twelve documentation PNGs and manifest.
7. **Write public documentation.** Add `docs/presentation-themes.md` in the agreed reading order and the prominent README section using the same three title images, canonical theme descriptions, non-exclusive selection guidance, deterministic-system promise, Media Spec boundary, Discovery workflow, unique alt text, and visible AI disclosure.
8. **Run the complete local gate.** Execute focused tests, `npm test`, the existing 24-slide HTML/PDF acceptance matrix, gallery full render checks, file/fingerprint checks, and 320/768/1280 Markdown previews. Review the generated comparison matrix again after final documentation edits.
9. **Publish to the existing pull request.** Commit and push the finished work to `feat/deterministic-presentation-themes`, update the pull-request description, inspect the actual GitHub README and gallery rendering at narrow and desktop widths, and rerun any affected checks after corrections.

### Commit structure

Add three reviewable, green commits to the existing pull request:

1. `docs: specify presentation theme gallery` — completed Wayfinder map and decisions.
2. `test: add presentation gallery verification` — fixture, final Image Spec and approved sample image, render and approval tooling, manifest checks, and focused tests.
3. `docs: add presentation theme gallery` — twelve approved screenshots and manifest, dedicated gallery, README preview, and final documentation validation.

Tests may be red during local test-driven development, but no red commit is pushed. If implementation boundaries make a small additional corrective commit clearer, preserve the same dependency order and green-commit rule rather than forcing unrelated changes together.

### Completion gate

The destination is complete only when all of the following are true:

- Every Wayfinder decision ticket is closed and the map records all five decision gists.
- The approved portrait and complete final Image Spec are committed, including prompt, provider, exact model, and approval date.
- The image was created only after explicit scope, pricing, and API-call confirmation.
- Exactly twelve approved 1280×720 PNGs exist under their semantic filenames.
- Every image hash, manifest field, dependency fingerprint, soft-target report, and hard size ceiling passes.
- Fast focused tests and the verification package's full test suite pass.
- The existing 24-slide HTML/PDF production acceptance matrix passes unchanged.
- The twelve-slide gallery render passes slide accessibility, contrast, geometry, collision, font, orientation, crop, and visual-regression checks.
- The 3×4 matrix has been reviewed with all three themes remaining recognizably distinct and all content and sample media identical.
- README and gallery pass heading, link, alt-text, textual-equivalence, AI-disclosure, and 320/768/1280 responsive checks.
- The public copy matches the canonical Theme descriptions and agreed stable-versus-variable and Media Spec boundaries.
- All changes are committed and pushed to the existing pull request; no second pull request is opened.
- The pull-request description includes the documentation gallery and its verification results.
- The actual GitHub rendering has been inspected at narrow and desktop widths and any corrections have been reverified.
- The local branch is clean and synchronized with its remote.

After the completion gate passes, mark [Document the presentation theme gallery](map.md) closed. Until implementation, verification, push, and GitHub inspection are complete, the map remains open even though its decision frontier is exhausted.

This implementation plan adds no new presentation-domain term and requires no ADR. It applies the existing Theme, Media Spec, fixture, and explicit-approval vocabulary at documentation seams.
