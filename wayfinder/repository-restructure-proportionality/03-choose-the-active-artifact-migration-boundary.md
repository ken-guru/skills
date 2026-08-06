# Choose the active artifact migration boundary

Map: [Simplify the repository restructuring before implementation](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Assess the cost and implications of the approved design](00-assess-the-cost-and-implications-of-the-approved-design.md), [Choose the minimum viable Collection tree and distribution contract](01-choose-the-minimum-viable-collection-tree-and-distribution-contract.md)

## Question

Exactly which active Skills, shared files, docs, evals, verification assets, plugin
paths, workflows, and root indexes must move or change for the simpler ownership
model, and which completed planning or archival artifacts should remain untouched?

Define the compatibility treatment and byte-preservation expectations without
turning historical tidiness into a migration requirement.

## Resolution

Move active Presentation artifacts to this owner shape:

```text
/
├── README.md
├── CONTRIBUTING.md
├── CONTEXT.md
├── CONTEXT-MAP.md
├── AGENT.md
├── .claude-plugin/
├── .github/workflows/
├── docs/specs/
├── wayfinder/
├── IMPLEMENTATION_SUMMARY.md
├── VERIFICATION_CHECKLIST.md
├── verification/presentation-themes/prototype/
└── skills/presentation/
    ├── README.md
    ├── CONTEXT.md
    ├── docs/
    │   ├── adr/
    │   ├── assets/presentation-themes/
    │   ├── state-schema.md
    │   ├── migration-1.1.md
    │   └── presentation-themes.md
    ├── build-presentation/
    ├── discover-presentation/
    ├── structure-agenda/
    ├── generate-slides/
    ├── generate-images/
    ├── generate-diagrams/
    ├── proofread-presentation/
    └── verification/presentation-themes/
        ├── baselines/
        ├── fixtures/
        ├── lib/
        ├── scripts/
        └── tests/
```

### Active Skills and former shared material

Move all seven member directories to
`skills/presentation/<stable-name>/`, preserving frontmatter names.

Apply only the owner-local runtime changes decided in
[Define the direct shared and runtime dependency contract](02-define-the-direct-shared-and-runtime-dependency-contract.md):

- inline member-specific state and restart contracts;
- bundle invalidation behavior inside its two consumers;
- move Media Spec diff guidance into Generate Slides;
- add the self-contained `generate-images` runtime bundle;
- retire the old `skills/shared/` authority.

Remove old `skills/<name>/` and `skills/shared/` paths in the same cutover. Add no
redirect directories, duplicate authorities, or shims.

### Active documentation

Move beneath `skills/presentation/docs/`:

- all seven Presentation ADRs;
- `docs/presentation-themes.md`;
- all twelve approved gallery PNGs and their manifest;
- the existing state schema as maintainer-facing suite documentation;
- a concise `migration-1.1.md`.

Root `docs/specs/` remains Collection-owned.

### Evals

Move only the three existing eval suites into their member owners:

- Build Presentation: preserve eight cases;
- Discovery: preserve eight cases;
- Generate Slides: preserve fourteen cases.

Do not add eval suites for the other four Skills merely to satisfy the discarded
contribution framework. Add future evals only for a concrete routing risk or behavior
change.

### Active verification and workflows

Move the active verification package to
`skills/presentation/verification/presentation-themes/`. Preserve its package files,
baselines, fixtures, libraries, scripts, and tests, changing only paths required by
the relocation and new owner-local runtime contract.

Leave `verification/presentation-themes/prototype/` at its historical location.

Update the two existing root workflows for the relocated package. Preserve their
triggers, permissions, runner choices, timeouts, Ghostscript behavior, commands, and
failure artifacts. Do not add a Collection workflow.

### Active root surfaces

- split root README into a Collection index and Presentation suite README;
- split Collection and Presentation glossary content and add `CONTEXT-MAP.md`;
- add one concise `CONTRIBUTING.md`;
- update `AGENT.md` for the flat-standalone/one-level-suite convention;
- update `.gitignore` for relocated verification working output;
- update the marketplace description and seven explicit Claude plugin paths;
- retain `LICENSE` unchanged.

Do not add a root-adapter registry, pull-request template, tooling package, structural
schema, or Collection checker.

### Compatibility

Preserve all seven Skill names and the `presentation-skills` plugin identity. Set the
path-only restructuring release to plugin version 1.1.0.

The concise migration note is the sole maintained old-to-new source-path mapping and
replaces old focused-install guidance. Old source paths are not compatibility
contracts.

### Historical material

Keep these artifacts at their existing paths:

- the 28 completed pre-restructuring Wayfinder files;
- both repository-restructuring planning maps and their research;
- `IMPLEMENTATION_SUMMARY.md`;
- `VERIFICATION_CHECKLIST.md`;
- the theme prototype and its assets.

Do not reorganize or modernize them. Update only links that this migration would
newly break; preserve prose, historical structure, and existing legacy references.
Historical material is excluded from stricter active-documentation rules.

### Byte preservation

- move all 48 verification baseline PNGs and `baseline-manifest.json` byte-for-byte;
- move all 12 public gallery PNGs byte-for-byte;
- preserve gallery hashes, dimensions, provider/model data, and approval timestamps;
- recompute only the gallery manifest's path-derived source fingerprint;
- do not migrate ignored `.generated/`, `reports/`, or `node_modules`;
- regenerate ignored working output beneath the new verification path when needed;
- leave historical prototype assets unchanged.
