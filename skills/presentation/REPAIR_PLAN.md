# Repair Plan protocol

This is the authoring source of truth for the Repair Plan. Each Skill that proposes
or consumes one embeds the small part it needs, so installed Skills remain
operationally self-contained.

A Repair Plan is one Decision Prompt for a fix that spans phases. It lives only in
the conversation: nothing is written to the Project Folder, so a fresh session or
another harness sees every downstream prompt again.

## Proposing (Proofread, Orchestrator)

When a fix needs more than one Phase Skill, present one Decision Prompt that lists:

1. Every edit, by file. When a Media Spec changes, include the full Media Spec
   diff for the changed entries, in the `generate-slides` Media Spec diff format.
2. Every rerender: the Media Renderer and the Media Scope it renders, by slide.
3. The files overwritten and the files preserved.
4. The phases reset to `pending`.
5. The Skills that run, in order.

When a diagram's layout must change, name `generate-diagrams` in the plan and let
it offer the layout options; it checks each one against the diagram media box
before offering it.

On approval, invoke each named Skill in order. Each Skill keeps its own writes,
state changes, and checks.

## Consuming

An approved Repair Plan in this conversation answers:

| Downstream Decision Prompt | Owner | Answered when |
|---|---|---|
| Media Scope menu | `generate-diagrams`, `generate-images` | Always: the plan names the scope |
| Restart Guard, "regenerate presentation text" | `generate-slides` | The overwritten files match the plan's list exactly |
| Media Spec approval | `generate-slides` | The plan showed the full diff for every changed entry |
| Git checkpoint reset confirmation | `build-presentation` | Always: the commit message names the Repair Plan |

Every other Decision Prompt runs as usual. An approved Repair Plan never answers
deleting media, a Theme Package refresh, or Agenda approval.

## Deviation

The plan answers a downstream Decision Prompt only while reality matches it. When a
file outside the plan would be overwritten, a render fails, a diagram check
rejects the planned D2, or a new design choice comes up, run that Decision Prompt
as usual and report `Repair Plan exceeded: <reason>`.

## Manual replay

Check a change to this protocol against the field run that motivated it:

1. Proofread finds a diagram that fails Effective Text Size.
2. It proposes one Repair Plan naming `generate-diagrams` (slide scope),
   `generate-slides` (overwrite Markdown, HTML, and PDF; keep media), and
   Proofread again.
3. After approval, `generate-diagrams` renders without a Media Scope menu and
   prints its overwrite notice.
4. `generate-slides` regenerates without a Restart Guard prompt.
5. Proofread reruns. The only Decision Prompt in steps 3–5 is any design choice
   `generate-diagrams` offers because a render failed.
