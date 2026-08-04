# Repository restructuring around portable Skill Suites

Status: **Approved on 2026-08-04**

Implementation issue:
[Restructure the repository around portable Skill Suites](https://github.com/ken-guru/skills/issues/51)

Decision history:
[Restructure the repository around portable Skill Suites](../../wayfinder/repository-restructure/map.md)

Detailed migration evidence:
[Repository restructuring Migration Manifest](../../wayfinder/repository-restructure/migration-manifest.md)

## 1. Purpose

Restructure this repository from a presentation-centric flat Skill tree into a
Collection that can own standalone Skills and cohesive Skill Suites. The current
presentation workflow becomes the Presentation Skill Suite at
`skills/presentation/`.

The restructuring must:

- make Collection, Skill Suite, and Skill ownership visible in the source tree;
- preserve all seven presentation Skill names and their current behavior;
- preserve the `presentation-skills` Claude plugin identity and supported install
  journeys;
- allow each individually advertised member Skill to run from an isolated install;
- keep suite integration, documentation, verification, and history local to the
  Presentation owner;
- leave a simple, enforceable contribution path for future standalone Skills and
  Skill Suites;
- ship as a documented compatible `presentation-skills` 1.1.0 release.

## 2. Scope

This specification includes:

- the target repository tree;
- Artifact Owner rules;
- discovery, navigation, distribution, and compatibility behavior;
- the portable Shared Module and Skill Dependency contract;
- domain documentation, eval, verification, generated-asset, and CI placement;
- contribution templates, indexes, root adapters, and structural checks;
- the path-family Migration Manifest;
- the ordered implementation and release-acceptance sequence.

This specification does not include:

- implementation of the migration;
- new presentation features or behavior changes, except changes strictly required
  for equivalent behavior after relocation;
- a new non-presentation Skill or Skill Suite;
- package-per-suite publishing or generalized multi-plugin automation;
- native Codex plugin packaging or new agent-ecosystem adapters.

## 3. Architectural model

### 3.1 Collection

The repository is the Collection. It owns cross-owner discovery, navigation,
contribution policy, distribution registries, architecture, Collection tooling, and
Collection-wide planning.

The Collection is not a Skill Suite and is not invokable.

### 3.2 Skill Suite

A Skill Suite is a cohesive ownership slice, not a published package or invokable
Skill. Its root contains `skill-suite.json` and no `SKILL.md`.

Presentation is the first Skill Suite. A future suite must have at least two real
member Skills, shared responsibility, suite documentation and context, and genuine
cross-Skill verification before it receives a suite boundary.

### 3.3 Skill

A standalone Skill lives at `skills/<stable-name>/`.

A suite member lives at `skills/<suite-id>/<stable-name>/`. Presentation member
nesting stops at this level so default `npx skills` discovery can find it.

The presence of `SKILL.md` identifies a Skill directory. A suite Orchestrator, such
as `build-presentation`, remains an ordinary member Skill.

### 3.4 Artifact Owner

Every canonical artifact has exactly one Artifact Owner: the narrowest stable
Collection, Skill Suite, or Skill scope whose responsibility fully explains why it
exists.

- A Skill owns artifacts defining, running, documenting, or verifying only that
  Skill.
- A Skill Suite owns shared domain language, workflow, integration, documentation,
  Shared Modules, or verification across members.
- The Collection owns behavior spanning independent Skills and Skill Suites.
- Tests, evals, fixtures, baselines, and generated artifacts belong to the behavior
  or purpose they protect, not automatically to their producer or importer.
- Broader owners index narrower detail rather than mirror authoritative content.
- Externally fixed root files are thin adapters; semantic ownership and substantive
  behavior stay with the narrow owner.
- Mixed files are split at ownership seams.
- Ownership changes only when responsibility changes. A transfer moves the
  authority and updates dependants atomically.

## 4. Target tree

```text
/
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json                         # Presentation-owned root adapter
├── .github/
│   ├── pull_request_template.md
│   └── workflows/
│       ├── collection-contracts.yml
│       ├── presentation-theme-contracts.yml
│       └── presentation-theme-rendering.yml
├── .gitignore
├── AGENT.md
├── CONTRIBUTING.md
├── CONTEXT.md
├── CONTEXT-MAP.md
├── LICENSE
├── README.md
├── root-adapters.json
├── docs/
│   ├── contributing/
│   │   ├── ownership-transfer.md
│   │   ├── skill-suite.md
│   │   ├── standalone-skill.md
│   │   └── suite-member-skill.md
│   └── specs/
│       └── repository-restructure.md
├── tools/
│   ├── .gitignore
│   ├── package-lock.json
│   ├── package.json
│   ├── collection-contracts/
│   │   ├── cli.mjs
│   │   ├── schemas/
│   │   └── tests/
│   └── skill-dependencies/
│       ├── cli.mjs
│       ├── schemas/
│       └── tests/
├── wayfinder/
│   └── repository-restructure/
└── skills/
    ├── <future-standalone-skill>/
    │   ├── SKILL.md
    │   ├── skill-dependencies.json
    │   └── evals/
    └── presentation/
        ├── skill-suite.json
        ├── README.md
        ├── CONTEXT.md
        ├── build-presentation/
        │   ├── SKILL.md
        │   ├── EXIT_CRITERIA.md
        │   ├── skill-dependencies.json
        │   ├── dependency-snapshot/
        │   └── evals/
        ├── discover-presentation/
        │   ├── SKILL.md
        │   ├── skill-dependencies.json
        │   ├── dependency-snapshot/
        │   └── evals/
        ├── structure-agenda/
        │   ├── SKILL.md
        │   ├── skill-dependencies.json
        │   ├── dependency-snapshot/
        │   └── evals/
        ├── generate-slides/
        │   ├── SKILL.md
        │   ├── skill-dependencies.json
        │   ├── dependency-snapshot/
        │   ├── evals/
        │   ├── scripts/
        │   └── themes/
        ├── generate-images/
        │   ├── SKILL.md
        │   ├── skill-dependencies.json
        │   ├── evals/
        │   └── scripts/
        │       ├── src/
        │       ├── generate-images.js       # committed verified bundle
        │       ├── package.json
        │       └── package-lock.json
        ├── generate-diagrams/
        │   ├── SKILL.md
        │   ├── skill-dependencies.json
        │   └── evals/
        ├── proofread-presentation/
        │   ├── SKILL.md
        │   ├── skill-dependencies.json
        │   └── evals/
        ├── shared/
        │   ├── restart-guard/
        │   │   ├── shared-module.json
        │   │   ├── restart-guard.md
        │   │   └── presentation-theme-invalidation.mjs
        │   └── state-schema/
        │       ├── shared-module.json
        │       └── state-schema.md
        ├── docs/
        │   ├── adr/
        │   ├── assets/presentation-themes/
        │   ├── history/
        │   ├── migration-1.1.md
        │   └── presentation-themes.md
        ├── verification/
        │   └── presentation-themes/
        │       ├── .gitignore
        │       ├── baselines/
        │       ├── fixtures/
        │       ├── lib/
        │       │   └── presentation-paths.mjs
        │       ├── scripts/
        │       └── tests/
        └── wayfinder/
            ├── optional-media/
            ├── presentation-pipeline/
            ├── presentation-theme-documentation/
            └── presentation-themes/
                └── assets/prototype/
```

Support directories are created only when artifacts exist. Empty `evals/`, `docs/`,
`verification/`, and `wayfinder/` directories are not placeholders.

## 5. Discovery, navigation, and distribution

### 5.1 Stable identities

Preserve these Skill frontmatter and invocation names:

- `build-presentation`
- `discover-presentation`
- `structure-agenda`
- `generate-slides`
- `generate-images`
- `generate-diagrams`
- `proofread-presentation`

Preserve the `presentation-skills` plugin name, repository source, and version
lineage. The restructuring release is version 1.1.0.

### 5.2 Navigation

Navigation has three levels:

1. Root README indexes Skill Suites and standalone Skills.
2. `skills/presentation/README.md` is the Presentation landing page and member index.
3. Each member directory owns its Skill interface and supporting detail.

Root README must have `## Skill Suites` and `## Standalone Skills` tables with
`Name` and `Description`.

Every suite README must have a `## Member Skills` table with `Skill`,
`Installation`, and `Description`. `Installation` is exactly `Individual` or
`Suite-only`, derived from Skill Dependencies.

### 5.3 `npx skills`

`skills/presentation/` appears as the **Presentation** group. Group selection and
the deterministic explicit seven-Skill command install the complete suite.

The six phase Skills remain individually selectable by stable name.
`build-presentation` remains visible but suite-only and is never documented as a
focused install.

### 5.4 Claude plugin

`.claude-plugin/marketplace.json` remains Collection-owned and sources the plugin
from `"./"`.

`.claude-plugin/plugin.json` remains a Presentation-owned root adapter and lists:

```json
[
  "./skills/presentation/build-presentation",
  "./skills/presentation/discover-presentation",
  "./skills/presentation/structure-agenda",
  "./skills/presentation/generate-slides",
  "./skills/presentation/generate-images",
  "./skills/presentation/generate-diagrams",
  "./skills/presentation/proofread-presentation"
]
```

No second plugin or generalized plugin-release mechanism is introduced.

### 5.5 Compatibility

Old repository paths are not compatibility contracts. Remove them without stubs,
redirect directories, or duplicate copies.

`skills/presentation/docs/migration-1.1.md` is the only maintained old-to-new path
mapping. It records stable identities, source-path changes, and replacement
installed-command guidance.

Rewrite maintained and historical links as portable relative links. Old paths may
appear only as quoted source entries in the migration mapping or necessary
non-link archival discussion.

## 6. Portable dependency contract

### 6.1 Dependency Declaration

Every Skill owns strict `skill-dependencies.json` beside `SKILL.md`, including
Skills with no dependencies:

```json
{
  "schemaVersion": 1,
  "sharedModules": [
    "presentation/restart-guard"
  ],
  "skillDependencies": []
}
```

Both arrays are required, unique, lexically sorted, and direct-only. Paths, hashes,
transitive entries, aliases, ranges, optionality, and installation policy are
forbidden.

### 6.2 Shared Module

Each canonical Shared Module is a complete directory owning strict
`shared-module.json`:

```json
{
  "schemaVersion": 1,
  "id": "presentation/restart-guard",
  "sharedModules": []
}
```

IDs are explicit, Collection-unique `<suite>/<module>` identities using lowercase
kebab-case segments. IDs are never inferred from paths.

A Shared Module includes every regular file beneath its root. Symlinks and path
escapes are forbidden. It may depend only on lower Shared Modules in the same suite.
It cannot depend on a Skill. The complete graph is acyclic and downward-only.

Cross-suite Shared Module edges are forbidden. A need shared across suites triggers
an explicit ownership decision.

### 6.3 Dependency Snapshot

Materialize each consumer's complete Shared Module closure at:

```text
dependency-snapshot/
├── snapshot.json
└── shared-modules/
    └── <suite>/
        └── <module>/
```

Runtime links and imports use only the Skill-local snapshot. Canonical source paths
are provenance and are never consulted at runtime.

`snapshot.json` records:

- schema version;
- consumer kind and stable Skill name;
- SHA-256 of canonicalized semantic Dependency Declaration JSON;
- generator name and format version;
- declared Skill Dependencies;
- every resolved Shared Module, sorted by ID;
- direct/transitive status, canonical provenance, dependency edges, aggregate
  content hash, and sorted per-file paths, hashes, and executable bits.

Hashes cover normalized POSIX-relative paths, exact bytes, and executable bits.
Timestamps, write permissions, and Git IDs are excluded.

Snapshots are validation-enforced read-only. `sync` replaces an intact stale
snapshot but refuses to overwrite files changed from their recorded hashes. There
is no force option.

### 6.4 Initial graph

| Skill | Shared Modules | Skill Dependencies | Installation |
|---|---|---|---|
| `build-presentation` | `presentation/state-schema` | All six phase Skills | Suite-only |
| `discover-presentation` | `presentation/restart-guard`, `presentation/state-schema` | None | Individual |
| `structure-agenda` | `presentation/restart-guard` | None | Individual |
| `generate-slides` | `presentation/restart-guard` | None | Individual |
| `generate-images` | None | None | Individual |
| `generate-diagrams` | None | None | Individual |
| `proofread-presentation` | None | None | Individual |

Project Folder artifacts passed between phases are not Skill Dependencies.

### 6.5 Dependency tooling

The Collection-owned interface is:

```sh
node tools/skill-dependencies/cli.mjs sync --skill <stable-name>
node tools/skill-dependencies/cli.mjs sync --all
node tools/skill-dependencies/cli.mjs check --skill <stable-name>
node tools/skill-dependencies/cli.mjs check --all
node tools/skill-dependencies/cli.mjs check --all --format json
```

`sync` validates the complete registry and graph before staging and atomically
replacing selected valid snapshots. It never edits authored declarations or
canonical Shared Modules and makes no partial changes after a selected failure.

`check` reuses the same resolver read-only. It validates manifests, identities,
directions, cycles, closure, hashes, stale or modified snapshots, undeclared
canonical references, escaping paths, isolated installs, complete-suite installs,
Skill Dependency availability, and advertising policy.

Diagnostics have stable codes and actionable remedies. Exit `0` means valid, `1`
means contract violations, and `2` means malformed invocation or tooling failure.

## 7. Installed Skill self-location

There is no universal cross-installer Skill-directory environment variable.

Command-bearing Skills use this contract:

```markdown
Resolve `<skill-dir>` to the directory containing this invoked `SKILL.md`.
In Claude Code, `${CLAUDE_SKILL_DIR}` is that directory. In other supported
hosts, use the actual Skill path supplied by the host. Then run:

node "<skill-dir>/scripts/example.mjs" …

Never derive `<skill-dir>` from the current working directory or an agent-home path.
```

After launch, ESM code uses `import.meta.url`; CommonJS code uses `__dirname` for
bundled inputs. `process.cwd()`, `$HOME`, `CODEX_HOME`, `.agents/skills`,
`.codex/skills`, and `.claude/skills` must not locate bundled content.

`${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are restricted to
Claude-plugin-owned adapters and state. They are not member-Skill contracts.

Installed Skill directories are treated as read-only. `generate-images` therefore
ships a committed, reproducibly verified bundle containing its pinned
`@google/genai` runtime dependency. It does not run `npm install` inside the
installed Skill.

## 8. Documentation, decisions, evals, and history

- Root `CONTEXT.md` contains only Collection language.
- `CONTEXT-MAP.md` reaches root and suite contexts.
- Presentation pipeline and visual language lives in
  `skills/presentation/CONTEXT.md`.
- Presentation ADRs live under `skills/presentation/docs/adr/`.
- Presentation public documentation and approved public gallery assets live under
  `skills/presentation/docs/`.
- Skill-specific protocols and examples stay inside their member Skill.
- Collection-wide specs and contribution guidance live under root `docs/`.
- Presentation Wayfinder maps move beneath `skills/presentation/wayfinder/`.
- This restructuring map remains Collection-owned at root.
- `IMPLEMENTATION_SUMMARY.md` and `VERIFICATION_CHECKLIST.md` move to suite history
  with non-authoritative archival banners.

Existing eval files move to their three owning Skills without changing cases or
stable names. Add owner-local positive, negative, and boundary routing evals for
`structure-agenda`, `generate-images`, `generate-diagrams`, and
`proofread-presentation` so every member satisfies the contribution contract.

Root `evals/` is reserved for behavior spanning independent Artifact Owners.
Suite-level `skills/presentation/evals/` is created only when a genuine cross-Skill
eval exists.

## 9. Verification, generated artifacts, and CI

Move the active acceptance package intact to
`skills/presentation/verification/presentation-themes/`.

Preserve four output classes:

1. Reviewed visual baselines and `baseline-manifest.json` remain verification-owned.
2. Gallery source fixtures remain verification-owned.
3. Approved public gallery PNGs and their manifest are documentation-owned.
4. `.generated/`, `reports/`, and installed dependencies are ignored working output
   inside verification.

The historical prototype moves to
`skills/presentation/wayfinder/presentation-themes/assets/prototype/` and is
excluded from active verification.

`lib/presentation-paths.mjs` resolves from its own module and exposes named suite
paths for member sources, Theme Packages, canonical Shared Modules, fixtures,
baselines, working output, reports, suite documentation, and public assets.
Verification code must not repeat upward traversal or derive a repository root.

Fingerprint manifests use suite-relative logical paths. The migration:

- preserves all 48 baseline PNGs and `baseline-manifest.json` byte-for-byte;
- preserves all 12 public gallery PNGs and their asset metadata/hashes;
- mechanically recomputes only the gallery manifest's path-derived
  `sourceFingerprint`;
- does not change approval metadata or invoke gallery approval.

Baseline approval may write only verification baselines. Gallery approval may write
only public documentation assets. Both commands refuse cross-writes.

The two existing Presentation workflows remain root adapters. Preserve their
triggers, permissions, runner split, timeout, Ghostscript behavior, and failure
artifacts; update paths and delegate substantive commands to the relocated package.

The new Collection workflow installs pinned `tools/` dependencies and runs the
whole-Collection check.

## 10. Contribution and structural governance

### 10.1 Suite marker

`skills/presentation/skill-suite.json` is strict:

```json
{
  "schemaVersion": 1,
  "id": "presentation",
  "displayName": "Presentation"
}
```

Membership is discovered from the tree, not repeated in this marker.

### 10.2 Root adapters

`root-adapters.json` is strict:

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

Owner identities are `collection`, `skill-suite:<suite-id>`, or
`skill:<stable-skill-name>`. Paths are normalized repository-relative POSIX paths
without traversal.

The final registry contains the two Presentation workflows and
`.claude-plugin/plugin.json`. The marketplace registry and Collection workflow are
Collection-owned and need no exception.

Each registered format has a specific validator. A registry entry cannot exempt an
unknown format or substantive root implementation.

### 10.3 Contribution Paths

Root `CONTRIBUTING.md` routes:

1. standalone Skill changes;
2. existing suite-member changes;
3. new Skill Suites;
4. ownership transfers.

Owner-local guidance links back and adds only domain-specific requirements.

A standalone Skill requires:

- stable Collection-unique name;
- `SKILL.md`;
- empty Dependency Declaration arrays;
- positive, negative, and boundary routing evals;
- root index entry;
- portable links and self-location;
- isolated-install verification.

A new Skill Suite requires:

- at least two real members;
- `skill-suite.json`, README, and context;
- ordinary member contracts;
- genuine cross-Skill verification;
- root README and context-map entries.

A member with no Skill Dependencies is `Individual` and must pass isolation. A
member with any Skill Dependencies is `Suite-only`, is not advertised for focused
installation, and reports missing dependencies actionably.

An ownership transfer names old and new owners, moves the canonical artifact,
updates all consumers and evidence, removes the old authority, and adds a migration
note for documented public paths. Shims and duplicate authorities require a
separate explicit decision.

### 10.4 Whole-Collection contract

The only public Collection-check interface is:

```sh
node tools/collection-contracts/cli.mjs check
node tools/collection-contracts/cli.mjs check --format json
```

It is read-only, offline, whole-repository, and resolves the repository from its own
module rather than cwd. It has no target, diff, fix, force, or extension modes.

Locally it includes tracked and untracked non-ignored contribution files. It:

1. establishes the candidate file set;
2. validates strict schemas;
3. discovers owner identities and builds one ownership graph;
4. classifies every relevant artifact;
5. validates the closed root and format-specific root adapters;
6. validates Contribution Path guarantees;
7. invokes dependency checking through its canonical JSON interface;
8. validates curated indexes, contexts, distribution manifests, links, obsolete
   paths, generated-artifact rules, eval kinds, installation treatment, and portable
   self-location.

It does not install packages, access registries, render presentations, or run
expensive suite acceptance. Owner-local behavioral workflows remain separate merge
gates.

Diagnostics preserve dependency codes and use stable `COLLECTION_*` codes for
Collection contracts. They include owner, path, rule, and remedy; sort
deterministically; and support schema-versioned JSON. Exit codes are `0`, `1`, and
`2`.

Automation proves structural facts. Authors and reviewers decide semantic ownership
and whether tests or prose are meaningful.

## 11. Normative path-family Migration Manifest

The following table is the consolidated implementation mapping. The
[detailed decision asset](../../wayfinder/repository-restructure/migration-manifest.md)
adds counts and per-family evidence without changing these targets.

| Current family | Target | Action |
|---|---|---|
| `README.md` | Root Collection index plus `skills/presentation/README.md` | Split, Index |
| `CONTEXT.md` | Root Collection glossary plus `skills/presentation/CONTEXT.md` | Split |
| `AGENT.md`, `LICENSE` | Same paths | Retain |
| Root `.gitignore` | Collection rules; verification rules move owner-local | Split |
| `.claude-plugin/marketplace.json` | Same path | Retain, Collection |
| `.claude-plugin/plugin.json` | Same path with nested Skill paths | Adapter, Presentation |
| Two Presentation workflows | Same paths delegating to relocated verification | Adapter |
| `skills/<seven stable names>/` | `skills/presentation/<same names>/` | Move |
| `skills/shared/restart-guard.md` and invalidation script | `skills/presentation/shared/restart-guard/` | Move, combine |
| `skills/shared/state-schema.md` | `skills/presentation/shared/state-schema/` | Move |
| `skills/shared/image-spec-diff.md` | `skills/presentation/generate-slides/IMAGE_SPEC_DIFF.md` | Transfer |
| `skills/shared/validation.md` | None | Retire |
| Three current root evals | Corresponding member `evals/` directories | Move |
| Missing evals for four members | Corresponding member `evals/` directories | Add |
| `docs/adr/` | `skills/presentation/docs/adr/` | Move |
| `docs/presentation-themes.md` | `skills/presentation/docs/presentation-themes.md` | Move |
| `docs/assets/presentation-themes/` | `skills/presentation/docs/assets/presentation-themes/` | Move |
| `IMPLEMENTATION_SUMMARY.md`, `VERIFICATION_CHECKLIST.md` | `skills/presentation/docs/history/` | Move, archive |
| Active verification package | `skills/presentation/verification/presentation-themes/` | Move |
| Verification prototype | Suite Presentation Themes Wayfinder assets | Move |
| Ignored verification outputs | Regenerated beneath relocated package | Do not migrate |
| Root presentation pipeline Wayfinder files | `skills/presentation/wayfinder/presentation-pipeline/` | Move |
| Three named Presentation Wayfinder directories | Corresponding suite Wayfinder directories | Move |
| `wayfinder/repository-restructure/` | Same path | Retain, Collection |
| Empty obsolete source paths | None | Retire |
| Collection contribution, context-map, tooling, schemas, and workflow | Decided root paths | Add |
| Final specification | `docs/specs/repository-restructure.md` | Add |

Direct moves preserve bytes unless an explicit row requires link, provenance,
manifest, bundle, or archive-banner changes. Old canonical paths are removed in the
same migration PR.

## 12. Implementation sequence

Use one migration pull request containing five ordered, reviewable wave commits.
Nothing reaches `main` until the complete PR passes.

### Wave 1 — Baseline evidence

- record tracked-file and reference inventory;
- record current routing, fast/full verification, discovery, and plugin behavior;
- hash reviewed baselines and public gallery assets;
- record public names and install journeys.

### Wave 2 — Collection foundations

- add contribution guidance, schemas, tooling package, both Collection Modules,
  bundle support, and fixture tests;
- do not enable the repository-wide gate.

### Wave 3 — Coordinated active-owner cutover

- move active Skills, Shared Modules, verification, docs/assets, ADRs, and evals;
- add declarations, snapshots, missing evals, bundle, and path Module;
- split active root content;
- update plugin, workflows, adapters, links, imports, fingerprints, and installed
  commands atomically;
- require active fast and rendered verification.

### Wave 4 — History and Collection closure

- move planning history, prototype, and archives;
- rewrite historical links;
- update agent guidance and ignore rules;
- retire validation and obsolete paths;
- enable the whole-Collection workflow.

### Wave 5 — Release acceptance

- execute the complete acceptance matrix;
- fix or revert a failed wave before proceeding;
- merge only the complete shim-free PR;
- release `presentation-skills` 1.1.0.

## 13. Acceptance criteria

The specification is implemented only when:

### Accounting and ownership

- every tracked source artifact reconciles with the Migration Manifest;
- every artifact resolves to one valid owner;
- the root contains only Collection material and registered thin adapters;
- contexts, ADRs, histories, evals, tests, fixtures, baselines, public assets, and
  ignore rules reside with their owners;
- no old canonical source directory, stub, redirect, or duplicate authority remains.

### Identity, navigation, and compatibility

- all seven Skill names and `presentation-skills` remain unchanged;
- plugin version is 1.1.0;
- root, suite, and Skill navigation works in both directions;
- curated indexes cover discovered owners exactly once;
- migration-1.1 maps every public old path;
- maintained and historical links resolve without absolute `file:` URLs.

### Dependency portability

- all declarations and Shared Module manifests satisfy strict schemas;
- dependency graph, closure, provenance, and snapshots validate;
- each Individual Skill installs and runs in isolation;
- Build reports missing phase Skills when installed alone;
- no installed runtime reaches a sibling, suite root, repository root, agent-home
  path, or cwd for bundled content;
- scripts work when Skill and project paths contain spaces;
- the committed image-generation bundle reproduces from pinned inputs.

### Discovery and installation

- `npx skills --list` shows Presentation and every stable Skill exactly once;
- Presentation group and explicit seven-Skill installation produce the complete
  suite;
- focused copy and symlink installs work for all six phase Skills;
- supported Codex and Claude Code discovery works;
- Claude validates and installs the managed plugin from its cache.

### Verification and approved evidence

- all existing eval cases are preserved and all seven Skills have positive,
  negative, and boundary coverage;
- relocated verification passes fast and full gates;
- approved baseline and gallery PNG hashes match baseline evidence;
- gallery provenance changes only as specified;
- baseline and gallery approvals retain disjoint write boundaries;
- CI adapters preserve their prior behavior and artifact handling.

### Governance

- dependency and whole-Collection checks pass with human and JSON output;
- the Collection check also passes from an unrelated cwd;
- Contribution Paths, templates, PR declaration, suite markers, root adapters, and
  curated index contracts validate;
- owner-local behavioral CI and the Collection structural gate are both required.

## 14. Approval and execution gate

This document was explicitly approved in
[Approve the repository restructuring specification](../../wayfinder/repository-restructure/12-approve-the-repository-restructuring-specification.md)
on 2026-08-04 and is the implementation authority for the restructuring.

The approval gate required:

- an explicit human approval;
- a complete target architecture and Migration Manifest;
- measurable compatibility, portability, governance, and acceptance contracts.

Approval authorizes the implementation handoff:

- update the issue with the approved specification;
- apply `ready-for-agent`;
- create one migration branch and pull request;
- implement only the five approved waves and acceptance contract.
