# Define the portable Skill Suite dependency contract

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by:

- [Choose the canonical collection, suite, and Skill source tree](02-choose-the-canonical-source-tree.md)
- [Define collection, suite, and Skill artifact ownership](03-define-artifact-ownership-rules.md)
- [Inventory current presentation paths and references](04-inventory-current-paths-and-references.md)

## Question

What dependency and ownership rules let presentation Skills collaborate through suite-level modules today while remaining practical to extract as standalone Skills later?

## Resolution

Use explicit consumer declarations plus generated Dependency Snapshots to keep suite members portable:

- Every member Skill advertised for individual installation must run from an isolated installation with no unresolved sibling or repository-root paths.
- Shared Modules remain canonical under `skills/presentation/shared/`. Each consuming Skill owns a machine-readable declaration of the Shared Modules it requires.
- Suite tooling materializes the declared transitive closure as a committed, read-only Dependency Snapshot inside the consuming Skill. Runtime instructions and code use only this Skill-local snapshot in both individual and full-suite installations.
- Dependency relationships are never inferred from Markdown links, imports, or directory proximity.
- Each Dependency Snapshot records stable Shared Module identifiers and canonical content hashes. Shared Module interface changes update affected consumers, snapshots, and interface-level tests atomically; independent semantic versions are unnecessary until a Module gains its own release lifecycle.
- Extracting a member Skill promotes its snapshots into Skill-owned canonical material or replaces them with deliberately extracted independent dependencies. An extracted Skill retains no hidden path back into the Presentation Skill Suite.
- Callable Skill Dependencies are declared by stable Skill name, checked before execution, and never hidden inside Dependency Snapshots. A Skill with required Skill Dependencies is not advertised for individual installation; `build-presentation` remains the suite-only Orchestrator installed with its phase Skills.
- The dependency graph is acyclic and downward-only: an Orchestrator may depend on member Skills, member Skills may depend on Shared Modules, and Shared Modules may depend on lower Shared Modules. Shared Modules never depend on member Skills.
- External tools, credentials, and libraries remain part of each consuming Skill's interface. Shared preflight logic may be a Shared Module, but the external dependency itself does not become suite-owned.

The dependency contract must validate declarations, missing or undeclared dependencies, transitive closure, hashes, cycles, forbidden dependency directions, stale snapshots, runtime path assumptions, isolated individual installations, complete-suite installations, and actionable Skill Dependency failures.

The exact declaration schema and on-disk Dependency Snapshot layout are a newly surfaced implementation-readiness decision.
