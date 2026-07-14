---
name: build-presentation
description: "Orchestrator. Use when the user wants to build a presentation, or mentions slides or marp."
---

# Build Presentation (Orchestrator)

Coordinates the full presentation pipeline. Detects what has already been done and guides the user to the next step.

## Gotchas
- Advance phases only when the current exit criteria are fully satisfied.
- Require structure to be complete before calling `generate-slides`. Process requests sequentially; always build the agenda first.

## Startup

Before proceeding:
1. Run `which marp` — if not found, abort: ❌ `marp-cli` not installed. Run `npm install -g @marp-team/marp-cli`
2. Confirm the project folder is writable — if not, abort: ❌ Cannot write to `<path>`
3. Run `which node` — if not found, warn but continue: ⚠️ `node` not found — source fetching may fail

## State detection

Read the project folder to determine current state per [../shared/state-schema.md](../shared/state-schema.md):

| State | Condition |
|-------|-----------|
| Nothing started | `PROJECT.json` missing |
| Discovery done | `PROJECT.json` exists, `phases.discovery.status == "done"` |
| Structure done | `AGENDA.md` exists, `phases.structure.status == "done"` |
| Generation done | `PRESENTASJON.html` exists, `phases.generation.status == "done"` |
| Media done | Media specs exist and corresponding `phases.images.status` and/or `phases.diagrams.status` are "done" or "skipped" |
| Proofread done | `phases.proofread.status == "done"` |

## User guidance (based on state)

### Nothing started
> "This looks like a new project. Would you like to start by gathering requirements? (discover-presentation)"

→ Call `discover-presentation`, then continue.

Before advancing to structure-agenda, verify [exit criteria](EXIT_CRITERIA.md#discovery-exit-criteria).

### Discovery done, no agenda
> "Discovery is complete. Would you like to build the agenda now? (structure-agenda)"

Options:
- **Yes** — call `structure-agenda`
- **Redo discovery** — call `discover-presentation` again. `discover-presentation` will invoke the restart guard, prompting the user to clean up stale downstream files before re-running.

Before advancing to generate-slides, verify [exit criteria](EXIT_CRITERIA.md#agenda-exit-criteria).

### Structure done, no slides
> "The agenda is approved. Would you like to generate the presentation now? (generate-slides)"

Estimated token cost: **~high** (fetches sources, writes all slides)

Options:
- **Yes** — call `generate-slides`
- **Continue editing agenda** — call `structure-agenda` again. `structure-agenda` will invoke the restart guard, prompting the user to clean up stale generation outputs before re-running.

### Generation done, media pending

> "The presentation slides have been generated. I see media specifications that haven't been rendered yet."

Check which specs exist and aren't done:
- If `IMAGE_SPEC.md` exists and `phases.images.status != "done"`, offer: **Generate AI Images** (call `generate-images`)
- If `DIAGRAM_SPEC.md` exists and `phases.diagrams.status != "done"`, offer: **Generate D2 Diagrams** (call `generate-diagrams`). If D2 is unavailable, that skill offers a consented installation or lets the user install it themselves before rendering.

Options:
- **Generate** — call the respective skill(s). After successful generation, mark the corresponding phase status as "done" in `PROJECT.json`.
- **Skip** — mark the media phase(s) as "skipped".

### Media done, not proofread
> "The presentation and its media have been generated. Would you like to run a proofreading pass now?"

Options:
- **Yes** — call `proofread-presentation` to run the proofreading pass against the existing `PRESENTASJON.md`, report all findings, and mark `phases.proofread.status = "done"` in `PROJECT.json`
- **Skip** — mark proofread as skipped (not recommended — warn the user)

### Proofread done
> "The presentation is complete ✅"

Options:
- **Regenerate** — re-run `generate-slides` from existing agenda. `generate-slides` will invoke the restart guard to handle any existing media files before regenerating.
- **Revise agenda** — go back to `structure-agenda`. `structure-agenda` will invoke the restart guard, prompting the user to clean up stale generation outputs before re-running.
- **Start over** — call `discover-presentation`. `discover-presentation` will invoke the restart guard, giving the user the option to delete all generated files before starting fresh.

## Sequential invocation

When calling phase skills in sequence, pass the project folder path. Each skill reads `DISCOVERY.json` and `PROJECT.json` to find all paths and settings.

The full pipeline is:
```
discover-presentation → structure-agenda → generate-slides → generate-images/diagrams → proofread-presentation
```

Do not advance to the next phase until the current phase's exit criteria are satisfied (see guidance sections above).

## Token cost hints

Display estimated effort before calling expensive operations:

| Operation | Estimated cost |
|-----------|---------------|
| `discover-presentation` | Low — conversational only |
| `structure-agenda` | Low-medium — iterative drafting |
| `generate-slides` | High — source fetching + full slide generation |
| `generate-images` | High — API image generation (if not skipped) |
| `generate-diagrams` | Low — local D2 rendering |
| Proofread pass | Low — reads existing files only |
