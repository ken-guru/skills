# Proportionate repository restructuring

Status: **Approved**

Implementation issue:
[Restructure the repository around portable Skill Suites](https://github.com/ken-guru/skills/issues/51)

Draft pull request:
[Restructure repository around portable Skill Suites](https://github.com/ken-guru/skills/pull/52)

Decision history:
[Simplify the repository restructuring before implementation](../../wayfinder/repository-restructure-proportionality/map.md)

Normative path mapping:
[Proportionate restructuring Migration Manifest](../../wayfinder/repository-restructure-proportionality/migration-manifest.md)

Implications:
[Repository restructuring implications assessment](../../wayfinder/repository-restructure-proportionality/implications-assessment.md)

## 1. Authority

This specification replaces the earlier approved restructuring design and is the
sole implementation authority. The earlier dependency-snapshot and
Collection-governance design is withdrawn from implementation.

[Approve the revised proportionate restructuring specification](../../wayfinder/repository-restructure-proportionality/06-approve-the-revised-proportionate-restructuring-specification.md)
records the explicit human approval.

GitHub issue 51 is ready for implementation. Pull request 52 remains draft until
Checkpoints 1 and 2 are complete and Checkpoint 3 is ready for review.

## 2. Outcome

Restructure the repository into a Collection with one clear Presentation Skill Suite
at `skills/presentation/`, while adding only machinery justified by current behavior.

The restructuring must:

- preserve all seven public Skill names;
- preserve the `presentation-skills` Claude plugin identity;
- preserve current presentation behavior and reviewed visual evidence;
- support complete-suite installation and independent member invocation after
  installation;
- make each installed member self-contained;
- colocate active Presentation artifacts with their owner;
- leave room for flat standalone Skills and future one-level Skill Suites;
- fix the existing `generate-images` installation-path and runtime-dependency defect;
- accept later refactoring when concrete distribution or multi-suite needs arise.

## 3. Deliberately removed complexity

Do not implement:

- focused-install guarantees or focused-install acceptance;
- `skill-suite.json`;
- Dependency Declarations or generated Dependency Snapshots;
- Shared Module manifests or dependency graphs;
- dependency synchronization tooling;
- `root-adapters.json`;
- structural schemas or a Collection checker;
- a Collection tooling package or Collection CI workflow;
- four contribution blueprints or a pull-request contract;
- new routing evals created only for uniform coverage;
- relocation or modernization of completed planning history;
- generalized package-per-suite or multi-plugin automation.

These mechanisms may return only under the evidence triggers in section 13.

## 4. Source-tree contract

```text
/
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json
├── .github/workflows/
│   ├── presentation-theme-contracts.yml
│   └── presentation-theme-rendering.yml
├── .gitignore
├── AGENT.md
├── CONTRIBUTING.md
├── CONTEXT.md
├── CONTEXT-MAP.md
├── LICENSE
├── README.md
├── docs/
│   └── specs/
│       └── repository-restructure.md
├── skills/
│   ├── <future-standalone-skill>/
│   │   └── SKILL.md
│   └── presentation/
│       ├── README.md
│       ├── CONTEXT.md
│       ├── build-presentation/
│       ├── discover-presentation/
│       ├── structure-agenda/
│       ├── generate-slides/
│       ├── generate-images/
│       ├── generate-diagrams/
│       ├── proofread-presentation/
│       ├── docs/
│       │   ├── adr/
│       │   ├── assets/presentation-themes/
│       │   ├── migration-1.1.md
│       │   ├── presentation-themes.md
│       │   └── state-schema.md
│       └── verification/
│           └── presentation-themes/
├── verification/
│   └── presentation-themes/
│       └── prototype/                 # retained historical path
└── wayfinder/                         # retained planning paths
```

Support directories exist only when they contain real artifacts.

The structural convention is:

- `skills/<name>/SKILL.md` is a standalone Skill;
- `skills/<suite>/<name>/SKILL.md` is a suite member;
- a suite root has `README.md` and no `SKILL.md`;
- nesting stops at one suite level beneath `skills/`.

The tree and human-readable indexes are the interface. No registry or schema repeats
them.

## 5. Ownership and navigation

The repository is the Collection. It owns cross-domain discovery, navigation,
contribution guidance, distribution entry points, Collection language, specifications,
and Collection planning.

Presentation is a Skill Suite and is not invokable. It owns the presentation domain,
workflow, active cross-member documentation, active verification, and public gallery.

Each member Skill owns its invocation instructions and every supporting file needed
after installation.

Navigation is:

1. Root README has **Skill Suites** and **Standalone Skills** tables.
2. Presentation README owns its purpose, complete-install instructions, seven-member
   catalog, external prerequisites, and active documentation links.
3. Each member `SKILL.md` owns its invocation contract.

Root `CONTEXT.md` contains Collection terminology.
`skills/presentation/CONTEXT.md` contains Presentation terminology.
`CONTEXT-MAP.md` links the two.

One concise `CONTRIBUTING.md` documents:

- flat standalone and one-level suite-member placement;
- stable Skill names;
- owner-local instructions, tests, and documentation;
- index and behavioral-check updates;
- the extraction checklist in section 8;
- the rule that shared tooling needs demonstrated repetition.

## 6. Distribution contract

The supported distribution unit is the complete Presentation suite.

Preserve these Skill names:

- `build-presentation`
- `discover-presentation`
- `structure-agenda`
- `generate-slides`
- `generate-images`
- `generate-diagrams`
- `proofread-presentation`

Support:

- interactive selection of the **Presentation** group;
- one deterministic `npx skills` command explicitly selecting all seven names;
- the `presentation-skills` Claude plugin.

An installer may expose individual selection, but focused installation is unsupported
and must not be documented or tested as a product guarantee.

Keep `.claude-plugin/marketplace.json` sourced from `"./"`. Keep the root
`presentation-skills` plugin and update its seven paths to:

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

The restructuring release is plugin version 1.1.0.

## 7. Self-contained installed Skills

Complete `npx skills` selection installs seven member directories, not their suite
parent. Every member must therefore reference runtime instructions, scripts, and
supporting files only inside its own installed directory.

No installed member may reach:

- a sibling Skill;
- the suite parent;
- the repository root;
- `skills/shared/`;
- cwd for bundled content;
- an agent-home convention such as `~/.claude/skills`, `.agents/skills`, or
  `.codex/skills`.

### 7.1 Project state

Move the existing state schema to `skills/presentation/docs/state-schema.md` as the
maintainer overview of the Project Folder interface. Installed Skills do not link to
it.

Each member embeds only the fields, invariants, and preconditions it reads or writes.
Existing integration tests protect the Project Folder handoffs.

### 7.2 Restart behavior

Expand the owner-local restart protocols:

- Discovery owns theme, font, and general Discovery restart behavior.
- Structure owns downstream invalidation after Agenda changes.
- Generate Slides owns theme refresh and regeneration behavior.

Bundle the small theme-invalidation implementation independently inside Discovery and
Generate Slides. Test both implementations against the same verification fixtures.
Retire the old canonical shared restart-guard document and script.

### 7.3 Other former shared files

Move `image-spec-diff.md` into Generate Slides as its Media Spec diff procedure,
covering the existing image and diagram behavior.

Retire `validation.md`. Each member owns its actual startup checks.

No runtime material remains under `skills/presentation/shared/`.

## 8. Runtime dependencies and extraction

Each member owns its external preflight:

- Generate Slides checks for Marp and Node.
- Generate Diagrams checks for D2.
- Generate Images checks for Node and the Gemini credential.
- Other members check only what they use.

Suite installation runs no bootstrapper and installs no global tools.

### 8.1 `generate-images`

Use:

```text
generate-images/
├── SKILL.md
├── PROVIDERS.md
└── scripts/
    ├── src/generate-images.js
    ├── generate-images.js
    ├── package.json
    └── package-lock.json
```

`src/generate-images.js` is authored source. `generate-images.js` is the committed
self-contained bundle containing the pinned Google client.

Repository verification rebuilds from the lockfile and requires a byte-identical
bundle. Installed execution runs no `npm install` and writes nothing inside the
Skill.

Instructions resolve the directory containing the invoked `SKILL.md`, quote the
absolute bundle path, and never infer it from cwd or an agent-home path. After launch,
the script resolves bundled material from its own module location.

### 8.2 Later extraction

When a member becomes independently distributed:

1. copy or move its complete directory;
2. promote required suite documentation into owner-local documentation;
3. rewrite links and terms that assume Presentation ownership;
4. update Collection, suite, plugin, and installation indexes atomically;
5. add focused-install documentation and verification;
6. remove the old suite authority only after the new owner accepts its files and
   tests.

This is a contribution checklist, not a permanent manifest.

## 9. Active and historical artifacts

Move active Presentation artifacts:

- all seven member Skill directories;
- seven Presentation ADRs;
- active theme documentation and its twelve public gallery PNGs;
- the three existing routing-eval files into their member owners;
- active Presentation verification, excluding the prototype;
- path-sensitive workflow, plugin, root navigation, context, and ignore entries.

Move only the three existing eval suites and preserve their 8, 8, and 14 cases. Do
not add evals for the other four Skills during restructuring.

Keep at existing paths:

- the 28 completed pre-restructuring Wayfinder files;
- both restructuring maps and their research;
- `IMPLEMENTATION_SUMMARY.md`;
- `VERIFICATION_CHECKLIST.md`;
- `verification/presentation-themes/prototype/` and its assets.

Do not modernize historical prose or reorganize history. Repair only links that this
migration newly breaks. Exclude historical material from stricter active-documentation
rules.

## 10. Compatibility and evidence preservation

Public Skill names and the plugin name are compatibility contracts. Old source paths
are not.

Remove old flat Skill directories and `skills/shared/` without stubs, redirect
directories, or duplicate authorities.

`skills/presentation/docs/migration-1.1.md` is the sole maintained old-to-new
source-path mapping and replaces focused-install guidance.

Preserve:

- all 48 baseline PNGs and `baseline-manifest.json` byte-for-byte;
- all 12 public gallery PNGs byte-for-byte;
- gallery hashes, dimensions, provider/model fields, and approval timestamps.

Only the gallery manifest's path-derived source fingerprint may change.

Do not migrate ignored `.generated/`, `reports/`, or `node_modules`. Regenerate or
install them beneath the relocated verification package.

## 11. Migration checkpoints

Use the existing draft pull request as one coordinated, shim-free migration. Review
three checkpoints:

### Checkpoint 1 — Baseline

- record tracked-family accounting;
- record stable names and plugin identity;
- record disposable installer and plugin validation;
- run current fast and rendered verification;
- record reviewed-asset hashes and protected gallery metadata.

### Checkpoint 2 — Coordinated cutover

- add minimal Collection navigation, context map, and contribution guidance;
- move active member, documentation, eval, and verification families;
- localize former shared runtime contracts;
- build and commit the `generate-images` bundle;
- update links, imports, workflows, plugin paths, fingerprints, and ignore rules;
- retain historical paths and remove obsolete active paths atomically.

The repository must not advertise or release a partially migrated layout.

### Checkpoint 3 — Acceptance

- reconcile the Migration Manifest;
- run the complete one-time acceptance matrix in section 12;
- require both existing Presentation workflows to pass;
- fix or revert a failed cutover before merge;
- merge only the complete migration and release plugin version 1.1.0.

## 12. Acceptance

### 12.1 Permanent CI

- relocated `npm test` passes in the existing fast workflow;
- relocated `npm run test:full` passes in the existing rendered workflow;
- the owner-local `generate-images` bundle rebuild is byte-identical.

No Collection structural workflow is added.

### 12.2 Accounting and identity

- every tracked source family maps to one Migration Manifest action;
- all seven Skill names and the plugin name are unchanged;
- plugin version is 1.1.0;
- old flat Skill directories and `skills/shared/` are absent;
- retained historical paths and the prototype remain;
- no duplicate canonical authority remains.

### 12.3 Distribution

In disposable targets:

- `npx skills --list` shows Presentation and all seven names exactly once;
- group selection installs all seven Skills;
- the explicit command installs all seven Skills;
- Codex and Claude Code discover the complete set;
- installed links and script paths resolve inside each Skill;
- the Claude plugin validates and installs through its managed cache;
- all seven plugin invocations are discoverable.

No focused-install evidence is required.

### 12.4 Paths and behavior

- maintained active links resolve;
- historical links newly broken by this migration are repaired;
- installed paths contain no sibling, suite-parent, repository-root, cwd, retired
  shared, or agent-home dependency;
- Skill and project paths containing spaces work;
- existing eval cases and names are unchanged;
- relocated fast and rendered verification passes;
- baseline and gallery approval commands, exercised in a disposable checkout, write
  only to their distinct relocated destinations;
- the real migration workspace does not reapprove reviewed evidence.

### 12.5 Approved evidence

- 48 baseline PNG hashes and the baseline manifest match the baseline snapshot;
- 12 gallery PNG hashes match the baseline snapshot;
- gallery protected metadata is unchanged;
- only the documented source fingerprint changes;
- ignored working output was regenerated or installed, not migrated.

### 12.6 `generate-images`

From a clean dependency install:

- rebuild the committed bundle and require a byte match;
- verify it has no runtime `node_modules` dependency;
- copy the Skill to a disposable path containing spaces;
- launch from an unrelated cwd with a dummy credential and nonexistent spec;
- reach the expected missing-spec error without an image API call;
- write nothing inside the installed Skill.

## 13. Deferred-complexity triggers

A trigger opens a new design decision. It does not automatically reinstate the
earlier specification.

- **Focused installation:** a real distribution path promises one member
  independently, or a member changes owner.
- **Dependency manifests or snapshots:** at least two independently distributed
  Skills share versioned runtime material and owner-local copies repeatedly drift or
  fail releases.
- **Suite markers or schemas:** another real domain creates an automation consumer
  that cannot infer the tree, or human indexes repeatedly drift.
- **Root-adapter registry:** fixed root adapters owned by at least two independent
  owners create recurring ambiguity.
- **Collection checker:** multiple independent owners repeatedly allow the same
  cross-owner structural defect through review.
- **Contribution framework:** real contributions across multiple paths repeatedly
  fail under concise guidance.
- **Separate suite packaging or plugins:** another domain must install or release
  independently.

Implement only the smallest response to observed evidence.

## 14. Approval gate

This specification was approved through the final proportionality approval ticket.

Before approval:

- issue 51 remains paused without `ready-for-agent`;
- pull request 52 remains draft;
- no migration checkpoint begins.

The approval transition completed:

- this document is marked approved;
- issue 51 and pull request 52 identify this document and its Migration Manifest as
  the sole implementation authority;
- issue 51 has `ready-for-agent`;
- the pull request remains draft until Checkpoints 1 and 2 are complete and
  Checkpoint 3 is ready for review.
