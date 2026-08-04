# Define collection, suite, and Skill artifact ownership

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: None

## Question

Which kinds of artifacts belong to the collection, a Skill Suite, or an individual Skill, and what rules decide ownership when an artifact is shared across several suite Skills?

## Resolution

Every canonical artifact has exactly one **Artifact Owner**: the narrowest stable Collection, Skill Suite, or Skill scope whose responsibility fully explains why the artifact exists.

Apply these rules:

- A Skill owns artifacts that define, run, document, or verify that Skill's behavior alone.
- A Skill Suite owns artifacts that define shared domain language, workflow, integration, or verification across member Skills.
- The Collection owns artifacts that govern discovery, contribution, distribution, or architecture across independent Skills and Skill Suites.
- A shared artifact becomes a suite-owned **Shared Module** with an explicit interface; it is not jointly owned by its consuming Skills.
- Generated artifacts are owned according to their purpose, not their producer. Public documentation output belongs to documentation, while visual-regression baselines belong to verification.
- Tests, evals, fixtures, and baselines belong to the scope of the behavior they protect. Importing a narrower-owned Module does not transfer its ownership to the test.
- Broader scopes index and link to narrower-owned detail rather than maintaining mirrored authoritative copies.
- When tooling mandates a root location, the root file is a thin adapter at that seam. Semantic ownership stays at the narrowest responsible scope and substantive logic remains with its owner.
- Mixed-scope artifacts are split at ownership seams so each authoritative section has one owner.
- Ownership changes only when responsibility changes, not when consumer counts fluctuate. A transfer moves the canonical artifact and updates dependents explicitly.

Physical location and the number of consumers are evidence when applying the rule, but neither determines ownership by itself. Exact placement, dependency packaging, and migration mechanics remain with their dedicated tickets.
