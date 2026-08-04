# Remove the superseded original restructuring plan

Map: [Simplify the repository restructuring before implementation](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Approve the revised proportionate restructuring specification](06-approve-the-revised-proportionate-restructuring-specification.md)

## Question

Should the superseded original restructuring plan remain in the active tree after
the proportionate specification becomes the sole implementation authority?

## Resolution

No. Remove `wayfinder/repository-restructure/` before migration begins.

Keeping two detailed and contradictory restructuring plans in the working tree
creates avoidable ambiguity and a needless link-maintenance obligation. The approved
specification, normative Migration Manifest, implications assessment, and
proportionality decision map contain the active requirements and rationale needed for
implementation.

The deletion does not destroy the earlier record. Its decisions, research, inventory,
and manifest remain recoverable in Git and browsable through the
[immutable pre-removal tree](https://github.com/ken-guru/skills/tree/8c87d6b/wayfinder/repository-restructure).

Retain the other completed Wayfinder history and the proportionality decision record.
The human explicitly approved this post-approval amendment.
