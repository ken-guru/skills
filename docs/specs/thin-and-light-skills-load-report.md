# Thin and light Skills load report

This report compares the implementation baseline at `main` with the completed
Skill refactor. Word counts are a proxy for context load; they do not by
themselves establish quality.

## Context load

| Always-loaded Skill | Before | After | Change |
|---|---:|---:|---:|
| Orchestrator | 1,040 words | 424 words | −616 (−59.2%) |
| Image Media Renderer | 634 words | 664 words | +30 |
| Diagram Media Renderer | 656 words | 688 words | +32 |

The Media Renderers carry a concise self-contained protocol summary so they can
remain independently usable. Their provider procedures remain local. The largest
always-loaded branch—the Orchestrator—now discloses Git and state-specific
dialogue conditionally.

## Disclosure and cognitive load

- Orchestrator branch references: 0 → 2 (`GIT_CHECKPOINTS.md` and `ROUTING.md`).
- Shared Media Renderer authoring reference: 0 → 1 (`MEDIA_RENDERING.md`).
- Lifecycle vocabulary: four phases were previously named in the glossary while
  six state records existed; the model now names four lifecycle phases and two
  media phases consistently.
- Duplicated authoritative rule families: 1 → 0. The two renderer workflows now
  share one authoring protocol; their local runtime summaries are intentional
  copies of the small interface required for self-contained installation.
- Routing eval cases: 29 existing cases → 54 cases, adding renderer triggers,
  missing-spec behavior, cancellation, failure, media-pending, proofread-pending,
  and ambiguous-state coverage.

## Interpretation

The refactor trades a small amount of local renderer prose for a substantial
reduction in the Orchestrator's always-loaded context and clearer branch
disclosure. The acceptance bar is behavior preservation plus lower total
attention cost; removing required provider or approval behavior would not count
as a successful reduction.

## Measurement method

Word counts use `wc -w` against the baseline and final Skill documents. Pointer
counts are the conditional references in the Orchestrator and suite-owned
authoring references added by the refactor. Routing counts are the parsed cases
in the existing and new eval JSON files. Duplicated authoritative rule families
are counted by auditing repeated behavior contracts across owners; provider-local
instructions and intentionally embedded self-contained interfaces are excluded.
