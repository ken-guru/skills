# Routing guidance

Read only the branch that matches the detected Project Folder state.

## Nothing started

Tell the user:

> This looks like a new project. Would you like to start by gathering requirements? (`discover-presentation`)

After Discovery, verify the Discovery Exit Criteria.

## Discovery done, no Agenda

Tell the user:

> Discovery is complete. Would you like to build the Agenda now? (`structure-agenda`)

Offer:

- **Yes** — call `structure-agenda`.
- **Redo Discovery** — call `discover-presentation`; its Restart Guard handles stale downstream files.

Before Generation, verify the Agenda Exit Criteria.

## Structure done, no presentation outputs

Tell the user:

> The Agenda is approved. Would you like to generate the presentation now? (`generate-slides`)

Offer:

- **Yes** — call `generate-slides`.
- **Continue editing the Agenda** — call `structure-agenda`; its Restart Guard handles stale outputs.

## Generation done, media pending

Tell the user:

> The presentation slides have been generated. I see Media Specs that have not been rendered yet.

Offer the matching Media Renderer for each pending spec:

- `IMAGE_SPEC.md` → `generate-images`.
- `DIAGRAM_SPEC.md` → `generate-diagrams`.

Offer **Generate** or **Skip** for each pending media phase. Skipping marks that
phase skipped; successful rendering marks it done.

## Media complete, Proofread pending

Tell the user:

> The presentation and its media have been generated. Would you like to run a proofreading pass now?

Offer:

- **Yes** — call `proofread-presentation`.
- **Skip** — mark Proofread skipped and explain that proofreading is recommended.

## Complete

Tell the user:

> The presentation is complete.

Offer explicit rerun paths:

- **Regenerate** — call `generate-slides`; its Restart Guard handles existing outputs and media.
- **Revise the Agenda** — call `structure-agenda`; its Restart Guard handles stale generation outputs.
- **Start over** — call `discover-presentation`; its Restart Guard handles all generated files.

Each rerun must complete its Restart Guard before mutation and must re-check state
before the next action is offered.
