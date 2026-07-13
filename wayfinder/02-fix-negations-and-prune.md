## Question

What is the exact phrasing for replacing negations in `generate-slides` and `build-presentation`, and how should we prune the descriptions for `build-presentation` and `discover-presentation`? 

We need to rewrite:
1. The `Gotchas` in `generate-slides` (e.g., "Never use `![alt](path)`") to be positive.
2. The orchestrator rules in `build-presentation` (e.g., "Do not advance phases until...") to be positive.
3. The descriptions in `build-presentation` and `discover-presentation` to remove duplicated synonyms and already-documented identity.

Let's draft the new exact lines before we apply them.

Labels: `wayfinder:task`

## Resolution

**1. Negations replaced with Positive Phrasing**
In `generate-slides`:
- "Never use `![alt](path)` on content slides..." -> "Use `<img class="img-right">` on content slides. Restrict `![alt](path)` to title slides."
- "Never use `![bg](path)`..." -> "Place images inline using `<img class="img-right">` to preserve layout integrity."
- "No code blocks in slides..." -> "Represent code visually by suggesting an image or video instead of using code fences."

In `build-presentation`:
- "Do not advance phases until..." -> "Advance phases only when the current exit criteria are fully satisfied."
- "Never call generate-slides before structure is done..." -> "Require structure to be complete before calling `generate-slides`. Refuse requests to skip the agenda."

**2. Pruned Descriptions**
- `build-presentation`: "Orchestrator for the presentation pipeline. Use when the user wants to build a presentation, or mentions slides or marp."
- `discover-presentation`: "Gather presentation requirements through a structured interview and write DISCOVERY.json. Use when starting a new presentation or updating requirements."

(CLOSED)
