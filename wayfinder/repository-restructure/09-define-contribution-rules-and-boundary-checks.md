# Define contribution rules and ownership boundary checks

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by:

- [Define the portable Skill Suite dependency contract](05-define-the-portable-suite-dependency-contract.md)
- [Define discovery, packaging, and compatibility policy](06-define-discovery-packaging-and-compatibility.md)
- [Place domain documentation, decisions, and planning history](07-place-domain-docs-decisions-and-history.md)
- [Place evals, verification, generated assets, and CI](08-place-evals-verification-assets-and-ci.md)
- [Specify dependency declarations and Dependency Snapshot layout](13-specify-dependency-declarations-and-snapshot-layout.md)
- [Research portable installed Skill self-location](14-research-portable-skill-self-location.md)

## Question

What repeatable contribution rules, templates, indexes, and automated checks should govern new standalone Skills, new Skill Suites, and changes to the Presentation Skill Suite so domain-specific material does not leak back into collection-level locations?

## Resolution

Use explicit Contribution Paths, structurally derived Artifact Owners, curated-but-validated indexes, and one read-only Collection contract checker. Automation proves observable repository structure; authors and reviewers remain responsible for semantic ownership and meaningful verification.

### Contribution guidance and templates

Create one Collection-owned root `CONTRIBUTING.md` as the mandatory entry point. Its ownership decision tree routes contributors into four Contribution Paths:

1. Add or change a standalone Skill.
2. Add or change a member of an existing Skill Suite.
3. Add a new Skill Suite.
4. Transfer an artifact between owners.

Owner-local READMEs may add domain-specific instructions, but they link back to `CONTRIBUTING.md` and do not restate Collection rules.

Keep Collection-owned blueprints at:

```text
docs/contributing/
├── standalone-skill.md
├── suite-member-skill.md
├── skill-suite.md
└── ownership-transfer.md
```

Each blueprint shows its required target tree, authored manifests, indexes to update, applicable checks, and review evidence. It links to canonical rules and schemas rather than copying them. Add `.github/pull_request_template.md` requiring the Contribution Path, claimed Artifact Owner, generated artifacts changed, and checks run. Defer executable scaffolding until repeated contributions demonstrate that it would provide real leverage.

### Machine-readable ownership

Derive ordinary ownership from the canonical tree:

- `skills/<skill>/SKILL.md` identifies a standalone Skill.
- `skills/<suite>/skill-suite.json` identifies a Skill Suite.
- `skills/<suite>/<skill>/SKILL.md` identifies a member Skill.
- Artifacts below those roots belong to their nearest Artifact Owner unless an established artifact rule assigns them to the suite.

Every strict `skill-suite.json` uses:

```json
{
  "schemaVersion": 1,
  "id": "presentation",
  "displayName": "Presentation"
}
```

Membership and artifacts are discovered and validated from the tree rather than repeated in the marker.

Treat the repository root as a closed structural contract. Recognized Collection-owned slots include `README.md`, `CONTRIBUTING.md`, `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/`, `wayfinder/`, `tools/`, contribution templates, and ordinary repository configuration. The checker owns this closed set and its interface-level fixtures; adding a new root role is an explicit Collection architecture change rather than an allowlist edit.

Externally fixed domain-specific root artifacts must be registered in strict root `root-adapters.json`:

```json
{
  "schemaVersion": 1,
  "adapters": [
    {
      "path": ".github/workflows/presentation-theme-contracts.yml",
      "owner": "skill-suite:presentation",
      "delegatesTo": "skills/presentation/verification/presentation-themes"
    }
  ]
}
```

Owner identities are `collection`, `skill-suite:<suite-id>`, or `skill:<stable-skill-name>`. Paths are unique normalized repository-relative POSIX paths without traversal. Both manifest schemas reject unknown fields and require a schema-version change for semantic additions.

A registry entry is not a generic exemption. Each supported external seam has format-specific validation:

- GitHub workflows may own platform triggers, permissions, runners, and third-party actions at the fixed root seam, while repository-owned commands, working directories, caches, and artifact paths delegate to the registered owner.
- Claude plugin files may contain required plugin metadata, while Skill paths and owner-specific resources resolve inside the registered Skill Suite.
- Unknown adapter formats fail until the Collection checker gains an explicit parser and interface fixtures for that seam.

### Contribution guarantees

A standalone Skill must provide:

- `skills/<stable-name>/SKILL.md` with a Collection-unique stable name;
- mandatory `skill-dependencies.json` with empty `sharedModules` and `skillDependencies`, because a standalone Skill has no suite-owned or callable Skill dependencies;
- at least one positive, one negative, and one meaningful boundary routing eval;
- owner-local scripts, references, assets, tests, and ignore rules only where needed;
- a root README index entry;
- passing schema, link, routing, portable-self-location, and isolated-install checks from an unrelated working directory.

Documented external tools and credentials may remain prerequisites when the installed Skill's own contract is complete.

A new Skill Suite must provide:

- at least two real member Skills;
- `skill-suite.json`, a suite `README.md`, and a suite `CONTEXT.md`;
- members satisfying the ordinary Skill contract;
- suite-level evals or acceptance checks covering at least one genuine cross-Skill behavior;
- owner-local `docs/`, `shared/`, `verification/`, and `wayfinder/` paths only when corresponding artifacts exist;
- root README and `CONTEXT-MAP.md` entries.

A single Skill remains standalone until another real member and shared responsibility justify the suite. A new suite does not automatically gain a Claude plugin, package, or release surface; such a distribution interface requires a demonstrated need and its own decision.

Every member Skill owns `SKILL.md`, `skill-dependencies.json`, and routing evals. Installation treatment is derived from its Dependency Declaration:

- no Skill Dependencies means `Individual` and requires isolated-install validation;
- one or more Skill Dependencies means `Suite-only`, forbids focused-install documentation, and requires an actionable missing-dependency result at startup;
- Shared Module dependencies require a current committed Dependency Snapshot.

The suite README indexes every member and its derived installation treatment. A Shared Module interface change updates its canonical source, every affected snapshot, and interface-level tests atomically.

Presentation contributions follow an impact-based checklist:

- Skill-only behavior updates that Skill's interface, evals, tests, and isolated-install evidence.
- Shared Module behavior updates the canonical Module, all transitive consumer snapshots, and interface-level tests atomically.
- Cross-Skill workflow behavior updates suite-owned evals or acceptance tests and suite documentation.
- Verification baselines and public gallery assets use their separate owner-specific approval commands.
- Presentation domain language and architecture update the suite context or owner-local ADRs, not Collection documentation.
- Root workflow or Claude plugin wiring stays registered and thin.
- Installed commands follow the portable `<skill-dir>` and module-relative self-location contract.

An ownership transfer names the previous and new owner and explains the responsibility change; moves rather than copies the canonical artifact; updates indexes, contexts, adapters, Dependency Declarations and Snapshots, links, imports, tests, evals, fixtures, and ignore rules; removes the old authority; and adds a migration note when a documented public path changes. Compatibility shims or duplicate authorities require a separate explicit decision. Verification covers both the former and new owner's contracts.

### Curated indexes

Keep human-facing descriptions authored while making coverage machine-checkable:

- root README has `## Skill Suites` and `## Standalone Skills` tables with `Name` and `Description`;
- every suite README has a `## Member Skills` table with `Skill`, `Installation`, and `Description`;
- `Installation` is exactly `Individual` or `Suite-only`, derived from Skill Dependencies;
- names link to the owner's README or `SKILL.md`;
- `CONTEXT-MAP.md` keeps its defined context and relationship lists;
- ecosystem manifests contain exactly the Skills their distribution surface promises.

The checker rejects missing, duplicated, stale, incorrectly classified, or broken index entries while leaving all other prose unconstrained.

### Collection contract checker

Place one deep Collection-owned Module behind:

```sh
node tools/collection-contracts/cli.mjs check
node tools/collection-contracts/cli.mjs check --format json
```

The only operation validates the whole Collection read-only. There are no owner-, suite-, path-, Git-diff-, mutation-, force-, or extension modes. The CLI resolves the repository from its own module location rather than the current working directory. Root package scripts and CI remain optional thin adapters over this canonical command.

Locally, the checker includes tracked files and untracked non-ignored contribution files; owner-local ignored working output remains excluded. CI naturally validates the committed tree.

In dependency order, the checker:

1. establishes the candidate file set;
2. validates marker and registry schemas;
3. discovers stable owner identities and constructs one ownership graph;
4. classifies every relevant artifact;
5. validates the closed root, root adapters, and Contribution Path guarantees;
6. invokes the existing dependency checker through its canonical machine-readable interface without reproducing dependency semantics;
7. validates curated indexes, contexts, distribution manifests, maintained links, and portable self-location rules;
8. returns every independent diagnostic in deterministic order.

The checker enforces structural ownership, strict manifests, root-adapter delegation, index coverage, dependency integrity, generated-artifact rules, required eval kinds, derived installation treatment, link resolution, removal of obsolete paths outside the migration mapping, and the prohibition on agent-home or working-directory lookup for bundled resources.

It remains an offline structural gate: it does not install packages, contact registries, run `npx skills`, render presentations, or execute expensive suite acceptance. It validates that owner-local verification entry points and their thin CI adapters are correctly wired. Behavioral verification remains inside each Artifact Owner's Module and CI workflow, so the merge gate combines the Collection contract check with applicable owner-local checks.

Automation does not claim to decide whether prose is semantically Collection-wide or whether an eval is behaviorally meaningful. `CONTRIBUTING.md`, the pull-request owner declaration, and review own those judgments.

Validation suppresses dependent cascades after malformed prerequisites while continuing across independent owners. Dependency diagnostics retain their original codes. Collection diagnostics use stable `COLLECTION_*` codes and include the path, resolved owner, violated rule, and exact remedy. Results sort by owner, path, and code. Human-readable output is the default; `--format json` returns a schema-versioned report. Exit status `0` means valid, `1` means contract violations, and `2` means malformed invocation or an internal tooling failure.
