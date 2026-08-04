# Define the direct shared and runtime dependency contract

Map: [Simplify the repository restructuring before implementation](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Choose the minimum viable Collection tree and distribution contract](01-choose-the-minimum-viable-collection-tree-and-distribution-contract.md)

## Question

How should suite-installed member Skills reference shared Presentation material
directly, and what narrowly scoped packaging is required for runtime dependencies,
without Dependency Declarations, Dependency Snapshots, or Collection-wide dependency
tooling?

The answer must include the `generate-images` self-location and reproducible-bundle
contract and a deliberate extraction procedure for any member that later becomes
standalone.

## Resolution

Every installed member Skill is self-contained and may reference runtime instructions,
scripts, and supporting files only within its own directory.

This corrects an assumption in the minimum-tree decision: selecting the complete
seven-Skill set with `npx skills` still installs seven separate Skill directories. It
does not preserve the `skills/presentation/` parent or a sibling `shared/` directory.
Direct suite-sibling runtime references would therefore break a supported full-suite
installation.

Do not create `skills/presentation/shared/`, Dependency Declarations, Dependency
Snapshots, a synchronization command, or dependency manifests.

### State interface

Move the existing state schema into suite documentation as the maintainer-facing
overview of the Project Folder interface. Installed Skills do not link to it.

Each member embeds only the state fields, invariants, and preconditions it reads or
writes. Cross-phase integration tests exercise the actual Project Folder handoffs and
protect compatibility between these owner-local contracts.

### Restart behavior

Expand the three existing owner-local restart protocols:

- Discovery owns theme, font, and general Discovery restart behavior.
- Structure owns downstream invalidation after Agenda changes.
- Generate Slides owns theme refresh and regeneration behavior.

Retire the canonical shared restart-guard document. Bundle the small theme-invalidation
implementation independently inside Discovery and Generate Slides, the two Skills
that execute it. Verify both implementations against the same suite-owned behavioral
fixtures; do not introduce a synchronization manifest or command.

### Other former shared material

- Move `image-spec-diff.md` into Generate Slides as its owner-local Media Spec diff
  procedure and align it with the existing behavior for both image and diagram specs.
- Retire `validation.md`. Each member already owns the startup checks for the external
  tools and project state it actually uses.

No runtime material remains to justify a suite `shared/` directory.

### `generate-images` runtime

Use one narrow owner-local package:

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

- `src/generate-images.js` is authored source.
- `generate-images.js` is the committed self-contained runtime bundle, including the
  pinned Google client.
- Repository verification rebuilds from the lockfile and requires a byte-identical
  bundle.
- Installed execution never runs `npm install` and never writes inside the Skill.
- Instructions resolve the directory containing the invoked `SKILL.md`, quote its
  absolute bundle path, and never infer it from cwd or an agent-home convention.
- After launch, the script resolves bundled material from its own module location.

### External prerequisites

Each member owns its own preflight:

- Generate Slides checks for Marp and Node.
- Generate Diagrams checks for D2.
- Generate Images checks for Node and the Gemini credential.
- Other members check only what they use.

Installing the suite does not run a bootstrapper or install global tools.

### Later extraction

Document extraction as an ownership-transfer checklist in `CONTRIBUTING.md`:

1. copy or move the complete self-contained member directory;
2. promote any required suite documentation into owner-local documentation;
3. rewrite links and terms that still assume Presentation ownership;
4. update Collection, suite, plugin, and installation indexes atomically;
5. add focused-install verification when focused distribution becomes supported;
6. remove the old suite authority only after the new owner accepts its files and
   tests.

The transfer needs no permanent extraction manifest.

Remove `Shared Module`, `Dependency Declaration`, `Dependency Snapshot`, and
`Skill Dependency` from the Collection glossary because they no longer describe the
chosen architecture.
