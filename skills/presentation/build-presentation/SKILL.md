---
name: build-presentation
description: "Orchestrator for the installed presentation skill suite. Use when the user wants a guided end-to-end presentation workflow."
---

# Build Presentation (Orchestrator)

Coordinates the Presentation Skill Suite by routing from Project Folder state to
the next valid action. It does not contain phase capabilities; each Phase Skill
remains independently callable.

## Output voice

Apply the [human-output guidance](../../unslop/SKILL.md) to routing explanations,
decision summaries, and completion reports. Keep the guidance lightweight:
prefer concrete state and next actions, preserve the user's requested tone, and
leave Project Folder paths, commands, and state names exact.

## Installation boundary

Install this Orchestrator with the complete Presentation Skill Suite. The suite
distribution contract keeps each member independently usable after installation.

## Startup

1. Confirm the Project Folder is readable.
2. If it exists, require `PROJECT.json` with `projectType: "presentation"`.
3. Read the Project Folder state and named artifacts directly.
4. When state is ambiguous or corrupt, report the ambiguity and pause before
   mutation. Direct the user to inspect or repair the Project Folder.

When the Project Folder is Git-backed, load the conditional
[Git checkpoint protocol](GIT_CHECKPOINTS.md) before invoking a Phase Skill.

## Routing interface

Detect the first incomplete state in this order:

| State | Condition | Next action |
|---|---|---|
| Nothing started | `PROJECT.json` is missing | Offer `discover-presentation` |
| Discovery pending | Discovery is not done | Complete or redo `discover-presentation` |
| Structure pending | Discovery is done and Structure is not done | Offer `structure-agenda` |
| Generation pending | Structure is done and required presentation outputs are incomplete | Offer `generate-slides` |
| Media pending | A Media Spec exists and its owned media phase is not done or skipped | Offer the matching Media Renderer |
| Proofread pending | Presentation and required media are complete, Proofread is pending | Offer `proofread-presentation` |
| Complete | Proofread is done or skipped | Report completion and offer an explicit rerun path |

Use the detailed state-specific dialogue and recovery options in
[routing guidance](ROUTING.md) only for the detected branch.

Before advancing from Discovery to Structure or Structure to Generation, verify
the applicable [Exit Criteria](EXIT_CRITERIA.md). Advance only after every
condition passes and the user has chosen the next action where approval is
required.

## Sequential invocation

When the user chooses a next action, pass the Project Folder path to the selected
Skill. Each Skill reads `DISCOVERY.json` and `PROJECT.json` and owns its own
preflight, Restart Guard, writes, and completion rule.

After a successful Phase Skill invocation, apply the Git checkpoint protocol when
enabled, then read state again before offering the next action. Preserve every
unrelated phase record.

The supported sequence is:

```text
discover-presentation → structure-agenda → generate-slides →
generate-images/diagrams → proofread-presentation
```

Media phases may be skipped or run independently when their Media Specs exist.
