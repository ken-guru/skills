# Define discovery, packaging, and compatibility policy

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by:

- [Verify nested Skill discovery and Claude plugin paths](01-verify-nested-discovery-and-plugin-paths.md)
- [Choose the canonical collection, suite, and Skill source tree](02-choose-the-canonical-source-tree.md)
- [Inventory current presentation paths and references](04-inventory-current-paths-and-references.md)

## Question

How should repository navigation, `npx skills` selection, the current `presentation-skills` Claude bundle, stable Skill names, old paths, links, and installation commands behave across the restructuring?

## Resolution

Preserve public identities and installation journeys while allowing repository paths to change cleanly:

- Keep all seven Skill frontmatter and invocation names, the `presentation-skills` Claude plugin identity and version lineage, the `ken-guru/skills` repository source, and the complete-suite and supported individual-install journeys stable.
- Do not treat current source paths such as `skills/generate-slides/` as permanent compatibility contracts. Update maintained links, imports, manifests, workflows, and commands atomically without leaving duplicate files, stubs, or redirect directories.
- Use three-level navigation: the root README is the Collection index, `skills/presentation/README.md` is the canonical Presentation Skill Suite landing page, and each member directory is canonical for its Skill interface. Broader indexes summarize and link rather than mirror detailed content.
- Present `skills/presentation/` as the **Presentation** group in `npx skills`. Group selection installs the complete suite; supported phase Skills remain individually selectable by stable name.
- Keep `build-presentation` visible but suite-only. Documentation never presents it as a focused install, and its startup preflight reports missing Skill Dependencies with the complete-suite command.
- Keep `presentation-skills` as one presentation-specific managed Claude bundle sourced from the repository root (`./`). Explicitly enumerate all seven nested `./skills/presentation/<stable-name>` paths. Do not add hypothetical future Skills or generalize multi-plugin packaging in this effort.
- Document the interactive group-selection flow, the deterministic explicit seven-Skill command, focused phase-Skill installation, and managed Claude plugin installation as distinct supported interfaces.
- Treat installed filesystem paths as implementation details. Remove hardcoded agent-home paths such as `~/.claude/skills/...`; scripts and Dependency Snapshots resolve from the installed Skill's own location.
- Rewrite maintained and historical in-repository links to portable relative paths. Publish a concise old-path to new-path migration table instead of filesystem shims.
- Ship the restructuring as a documented compatible minor release of `presentation-skills`: identities and behavior remain stable, while source layout changes.

Mandatory acceptance checks must prove:

- `npx skills --list` shows the Presentation group and each stable Skill exactly once.
- Group selection and the explicit seven-Skill command install the complete suite.
- Each advertised phase Skill installs and runs in isolation.
- `build-presentation` gives an actionable missing-dependency result when installed alone.
- Claude validates and installs the unchanged plugin identity with nested Skill paths.
- Maintained links resolve, historical absolute `file:` links are removed, and old paths remain only in the migration mapping.
- No runtime instruction or code depends on the old source tree or a hardcoded agent-home location.
- Collection, suite, and member README navigation works in both directions.

The supported cross-installer self-location mechanism is an external fact that must be researched before the implementation specification fixes its exact adapter.
