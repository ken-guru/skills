# Assess the cost and implications of the approved design

Map: [Simplify the repository restructuring before implementation](map.md)
Labels: `wayfinder:task`
Status: Closed
Assignee: Codex

## Question

What implementation effort, permanent maintenance burden, cognitive cost, failure
surface, and future optionality does each major mechanism in the approved
specification introduce, and which costs are supported by present repository needs?

Compare the approved design, a minimum viable Collection, and leaving the current
layout unchanged. Identify which mechanisms solve current problems, which protect
withdrawn guarantees, and which speculate about future scale.

## Resolution

Completed the
[Repository restructuring implications assessment](implications-assessment.md).

The approved specification is disproportionate because it couples a useful
Presentation ownership move to permanent dependency and Collection-governance
frameworks primarily justified by the withdrawn focused-install guarantee and
hypothetical future owners.

The recommended option is a minimum viable Collection. It retains the
`skills/presentation/` seam, stable public identities, full-suite installation,
active-owner locality, existing behavior, reviewed evidence, and the targeted
`generate-images` portability fix. It removes or defers dependency declarations and
snapshots, generic graph tooling, structural schemas and registries, Collection
checking, uniform new eval requirements, historical relocation, and the exhaustive
acceptance matrix.

Leaving the current layout unchanged is viable and cheapest, but it leaves the
Presentation relationship implicit and active ownership scattered. The minimum
viable Collection provides current locality at substantially lower permanent cost
than the approved design.
