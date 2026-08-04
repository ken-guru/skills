# Specify dependency declarations and Dependency Snapshot layout

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Define the portable Skill Suite dependency contract](05-define-the-portable-suite-dependency-contract.md)

## Question

What exact machine-readable declaration schema, Shared Module identity convention, consumer-local Dependency Snapshot layout, provenance record, synchronization command, and validation interface should implement the portable Skill Suite dependency contract?

## Resolution

Implement the portable dependency contract through strict Dependency Declarations, directory-grained Shared Module manifests, deterministic consumer-local Dependency Snapshots, and one Collection-owned synchronization and validation Module.

### Authored declarations

Every Skill owns `skill-dependencies.json` beside `SKILL.md`, including Skills with no dependencies:

```json
{
  "schemaVersion": 1,
  "sharedModules": [
    "presentation/restart-guard"
  ],
  "skillDependencies": []
}
```

- Both arrays are required, unique, and lexically sorted.
- They contain direct dependencies only; paths, hashes, transitive entries, aliases, ranges, optionality, and installation policy are excluded.
- Shared Modules and callable Skill Dependencies remain distinct dependency kinds. Skill Dependencies are validated but never copied into a Dependency Snapshot.

Each canonical Shared Module is one directory and owns `shared-module.json` at its root:

```json
{
  "schemaVersion": 1,
  "id": "presentation/restart-guard",
  "sharedModules": [
    "presentation/state-schema"
  ]
}
```

- Stable Shared Module IDs use the Collection-unique `<suite>/<module>` convention with lowercase kebab-case segments.
- Identity is explicit and is never inferred from a filesystem path, so a canonical directory may move without changing its ID.
- The whole directory is the Module content boundary. Every regular file is included; symlinks and path escapes are forbidden.
- `sharedModules` contains direct lower Shared Modules only. A Shared Module cannot declare a Skill Dependency.
- Shared Module graphs are acyclic, downward-only, and confined to one Skill Suite. Cross-suite sharing requires a new explicit ownership decision rather than a dependency edge.

Version-one schemas are strict and closed: unknown properties and unsupported versions are errors, semantic additions require a new schema version, and there is no generic extension field. Their JSON Schemas live inside the Collection-owned dependency tooling. Authored and generated files omit repository-relative `$schema` references so extraction creates no hidden back-path.

### Consumer-local snapshot

Materialize each Skill's complete Shared Module closure at:

```text
<skill>/
├── SKILL.md
├── skill-dependencies.json
└── dependency-snapshot/
    ├── snapshot.json
    └── shared-modules/
        └── <suite>/
            └── <module>/
                ├── shared-module.json
                └── ...
```

Runtime Markdown links, imports, and scripts use only `./dependency-snapshot/shared-modules/<suite>/<module>/...`. The stable ID maps directly to the local path, avoiding aliases and mount-collision rules. Canonical source paths are provenance only and are never consulted at runtime.

`snapshot.json` records:

- `schemaVersion`;
- the consumer kind and stable Skill name;
- a SHA-256 hash of canonicalized semantic declaration JSON;
- generator name and snapshot format version;
- declared Skill Dependencies;
- Shared Modules sorted by ID, including ID, direct/transitive status, canonical source path, dependency edges, aggregate content hash, and a sorted inventory of relative file paths, SHA-256 hashes, and executable bits.

Module hashes cover sorted POSIX-relative paths, exact file bytes, and executable bits. Timestamps, filesystem write permissions, and Git commit IDs are excluded, making snapshots deterministic from both clean and dirty working trees.

A Dependency Snapshot is validation-enforced read-only rather than permission-protected. Contributors edit canonical Shared Modules and regenerate. Validation rejects manual snapshot changes, and synchronization refuses to overwrite files that no longer match their recorded hashes.

### Tooling interface

Place one deep, Collection-owned dependency Module behind this canonical Node CLI:

```sh
node tools/skill-dependencies/cli.mjs sync --skill <stable-skill-name>
node tools/skill-dependencies/cli.mjs sync --all
node tools/skill-dependencies/cli.mjs check --skill <stable-skill-name>
node tools/skill-dependencies/cli.mjs check --all
node tools/skill-dependencies/cli.mjs check --all --format json
```

Skill selection uses Collection-unique stable Skill names rather than paths. CI, package scripts, and other entry points are thin adapters over this interface.

`sync` validates the complete identity registry and graph, resolves selected closures in memory, stages complete snapshots, and atomically replaces only valid results. It never edits Dependency Declarations or canonical Shared Modules. It may replace an intact but stale snapshot after canonical source changes; it refuses to overwrite a manually modified snapshot. There is no force-overwrite option in the baseline. If any selected consumer fails, the operation makes no partial changes.

`check` reuses the same resolver without writes. A targeted check validates the global registry and graph plus the selected Skill's declaration, snapshot, runtime references, advertising policy, and isolated-install view. `--all` also validates the complete-suite installation and every callable Skill Dependency.

Validation covers manifest schemas, duplicate and unknown identities, cycles, forbidden directions and cross-suite edges, exact transitive closure, deterministic provenance, missing/stale/extra/modified snapshot files, undeclared canonical references, paths escaping a Skill, resolvable Markdown links and executable imports in isolation, complete-suite resolution, missing Skill Dependencies, and suite-only Skills advertised for individual installation.

Diagnostics use stable error codes and actionable human-readable remedies by default, with structured output through `--format json`. Exit status `0` means valid, `1` means validation failures, and `2` means malformed invocation or an internal tooling failure.
