# Define proportionate acceptance and deferred-complexity triggers

Map: [Simplify the repository restructuring before implementation](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Define the direct shared and runtime dependency contract](02-define-the-direct-shared-and-runtime-dependency-contract.md), [Choose the active artifact migration boundary](03-choose-the-active-artifact-migration-boundary.md)

## Question

What smallest acceptance matrix proves current behavior and supported distribution,
and what concrete future events should trigger reconsideration of focused installs,
dependency manifests, structural schemas, root-adapter registration, or Collection
contract tooling?

The acceptance set must cover stable Skill identities, full-suite discovery and
installation, Claude plugin validation, maintained links, existing fast and rendered
verification, reviewed asset hashes, and the portable `generate-images` bundle.

## Resolution

Use a small behavior-focused acceptance matrix. Separate permanent behavioral gates
from one-time migration evidence.

### Permanent gates

Keep the two existing Presentation workflows and update only their paths:

- the fast contract and documentation workflow runs the relocated package's existing
  `npm test`;
- the rendered workflow runs the relocated package's existing `npm run test:full`,
  preserving its macOS runner, browser, Ghostscript, timeout, and failure reports.

Add the `generate-images` bundle build/check to the appropriate existing
Presentation contract workflow. It is owner-local runtime verification, not a
Collection structural check.

Do not add a Collection checker, structural workflow, generic link workflow, or
permanent migration-accounting command.

### Baseline evidence

Before moving files, record:

- all seven Skill frontmatter names;
- plugin name and current version;
- current `npx skills --list` output;
- a complete seven-Skill installation in a disposable target;
- current Claude plugin validation;
- current fast and rendered Presentation verification results;
- SHA-256 values for all 48 baseline PNGs and `baseline-manifest.json`;
- SHA-256 values for all 12 gallery PNGs and the gallery manifest's protected
  metadata.

Installer checks must use disposable locations and must not modify the user's live
installed Skills.

### Tracked-file and identity accounting

At final acceptance:

- reconcile every tracked source family as moved, changed, retained, added, or
  retired in the revised Migration Manifest;
- verify all seven Skill names and the `presentation-skills` plugin name are
  unchanged;
- verify plugin version is 1.1.0;
- confirm the seven old flat Skill directories and `skills/shared/` are absent;
- confirm retained historical paths and the prototype remain present;
- confirm no duplicate canonical Skill or shared authority remains.

This is migration PR evidence, not a permanent registry or checker.

### Distribution

In disposable targets:

- verify `npx skills --list` shows the Presentation group and all seven stable names
  exactly once;
- verify interactive Presentation-group selection installs all seven Skills;
- verify the explicit seven-Skill command installs all seven Skills;
- verify disposable Codex and Claude Code targets discover the complete installed
  set;
- verify every installed Skill's Markdown links and script paths resolve inside that
  Skill directory;
- validate the Claude plugin at version 1.1.0;
- install the plugin through Claude's managed cache and verify all seven invocations
  are discoverable.

Do not test or imply support for focused member installation.

### Active paths and links

Check all maintained root, suite, member, active documentation, active verification,
workflow, and plugin links after the move.

Check historical files only for links that the migration newly breaks. Do not require
cleanup of pre-existing legacy prose or absolute historical references.

Active installed instructions and scripts must contain:

- no `~/.claude/skills`, `.agents/skills`, `.codex/skills`, or other agent-home
  locator for bundled material;
- no path to a sibling member, suite parent, repository root, or retired
  `skills/shared/`;
- no cwd-derived path for bundled resources;
- quoted Skill and project paths that work when directories contain spaces.

### Existing behavior

- preserve all cases and stable names in the three moved routing-eval files;
- run the relocated package's complete fast and rendered verification;
- require both existing GitHub workflows to pass with their prior behavior and
  failure artifacts;
- exercise baseline and gallery approval commands in a disposable checkout to prove
  their relocated destinations and separate write scopes;
- do not approve or change reviewed evidence in the real migration workspace.

Do not add four new routing-eval suites as a restructuring gate.

### Approved evidence

- compare all 48 final baseline PNG hashes and `baseline-manifest.json` with the
  baseline snapshot;
- compare all 12 final gallery PNG hashes with the baseline snapshot;
- preserve gallery dimensions, hashes, provider/model fields, and approval
  timestamps;
- allow only the documented path-derived gallery source fingerprint to change;
- verify ignored `.generated/`, `reports/`, and `node_modules` were regenerated or
  installed rather than migrated.

### `generate-images` bundle

From a clean dependency install:

- rebuild the committed bundle from `scripts/src/generate-images.js` and the pinned
  lockfile;
- require a byte-identical result;
- verify the committed bundle has no runtime `node_modules` dependency;
- copy the installed Skill to a disposable path containing spaces;
- launch the bundle from an unrelated cwd with a dummy credential and a nonexistent
  spec, proving that the bundled Google client loads before the expected local
  missing-spec error without calling the image API;
- verify the smoke test writes nothing inside the installed Skill.

No paid image-generation call is required for migration acceptance.

## Deferred-complexity triggers

Reconsider a deferred mechanism only when concrete evidence appears. A trigger opens
a new design decision; it does not automatically reinstate the old specification.

### Focused installation

Reconsider when a real user-facing distribution path promises one Presentation
member independently, or when a member is transferred to another owner or repository.
At that point add focused-install documentation and tests for that member.

### Dependency manifests or generated snapshots

Reconsider only when at least two independently distributed Skills need the same
versioned runtime material and owner-local copies have produced repeated drift or
release coordination failures. One extraction alone should use ordinary owner-local
files.

### Suite markers or structural schemas

Reconsider when a second real Skill Suite or standalone domain creates an automation
consumer that cannot reliably infer the tree, or when human-maintained indexes have
repeatedly drifted. A hypothetical second suite is not sufficient.

### Root-adapter registry

Reconsider when externally fixed root adapters owned by at least two independent
owners make delegation or ownership ambiguous in practice. One Presentation-owned
plugin manifest and two clearly named Presentation workflows do not justify a
registry.

### Collection contract tooling

Reconsider when the Collection has multiple independent owners and the same
cross-owner structural defect repeatedly escapes ordinary review. Implement only the
smallest checker for the observed failure; do not pre-encode hypothetical rules.

### Contribution framework

Reconsider multiple blueprints or a structured pull-request contract when real
standalone, suite-member, new-suite, or ownership-transfer contributions recur and
the concise `CONTRIBUTING.md` guidance repeatedly fails.

### Separate suite packaging or plugins

Reconsider when a second domain must be installed or released independently. Base
the package and plugin seams on that domain's actual assets and distribution needs.
