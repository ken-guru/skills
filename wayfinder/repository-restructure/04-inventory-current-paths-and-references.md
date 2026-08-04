# Inventory current presentation paths and references

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:task`
Status: Closed
Assignee: Codex
Blocked by: None

## Question

What complete inventory of current presentation-owned paths, imports, links, scripts, workflows, manifests, generated assets, and verification commands must later migration decisions classify?

## Resolution

The current Presentation Skill Suite footprint spans all 45 tracked files under
`skills/`, 21 under `docs/`, three eval files, the 95-file theme verification
package, 28 historical Wayfinder files, two presentation workflows, two plugin
manifests, exact ignore rules, and presentation-owned or mixed root documentation.

The migration cannot be treated as a directory-only move. The verification package
imports and fingerprints Skill sources, derives repository-root paths, produces two
separate approved artifact sets, and asserts public documentation paths. The README,
domain context, historical documents, plugin manifest, CI workflows, ignored output
paths, and installed `generate-images` commands also embed paths or suite-specific
content that must be classified explicitly.

### Context pointer

[Current presentation path and reference inventory](current-presentation-path-inventory.md)
