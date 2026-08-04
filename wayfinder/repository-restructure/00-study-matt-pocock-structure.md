# Study Matt Pocock's skills repository structure

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:research`
Status: Closed
Assignee: Codex
Blocked by: None

## Question

What repository organization, ownership, installation, discovery, and packaging patterns from `mattpocock/skills` should constrain the scope of this repository's restructuring specification?

## Resolution

Use Matt Pocock's repository as the model for collection and discovery, not as a complete template for suite internals:

- Keep one repository as the collection and source for individually selectable Skills.
- Organize canonical Skill sources beneath a taxonomy without turning every group into a separately versioned package.
- Keep one curated repository-level Claude plugin surface for the current promoted set.
- Colocate Skill-owned references and scripts with their Skill.
- Add an explicit Presentation Skill Suite ownership boundary for cross-skill documentation, context, ADRs, evals, verification, shared modules, assets, and history, because Matt's looser collection has no equivalent integrated workflow to model.
- Defer package-per-suite, generalized multi-plugin releases, and native Codex packaging until concrete requirements justify them.

### Context pointer

[Matt Pocock skills repository: structural findings](research-matt-pocock-structure.md)
