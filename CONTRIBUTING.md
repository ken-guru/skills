# Contributing

Keep changes with their narrowest stable Artifact Owner.

## Placement

- Add a Standalone Skill at `skills/<name>/SKILL.md`.
- Add a Presentation member at `skills/presentation/<name>/SKILL.md`.
- Add another Skill Suite at `skills/<suite>/` with a suite `README.md`, no root
  `SKILL.md`, and members one level beneath it.
- Preserve published Skill names unless a migration explicitly changes the public
  contract.

Owner-local instructions, scripts, tests, evals, and member documentation belong
inside the owning Skill. Cross-member domain documentation and verification belong
inside the suite. Collection navigation, contribution guidance, distribution
adapters, and cross-domain specifications remain at the repository root.

Update the root and suite indexes, relevant behavioral checks, and externally fixed
distribution paths together. Shared tooling requires demonstrated repetition across
independent owners; do not add a registry, schema, or checker for hypothetical scale.

## Versions and releases

Every Release Unit (a Standalone Skill, or a Skill Suite as a whole) carries one
semantic version and one `CHANGELOG.md`. release-please derives both from commit
messages, so the commit type is the release decision.

**What the bump means** (decided in
[#429](https://github.com/ken-guru/skills/issues/429)):

- **Major:** something a consumer already has breaks unless they act. That
  includes a renamed or removed Skill or invocation, an earlier Project Folder or
  generated devcontainer the new version can't read or update, a removed script
  flag or output field, a new or raised tool requirement, broken compatibility with
  another unit, and a new blocking check that rejects what used to pass.
- **Minor:** the promise changes, but nothing existing breaks. That includes a
  deliberate prose-only change to what an agent does.
- **Patch:** the Skill is brought in line with what it already promised.

A suite takes the highest bump among its members. A breaking change to
setup-devcontainer's output is major there, and each affected
setup-`<tool>`-devcontainer Skill takes at least a patch that widens its
`metadata.requires-setup-devcontainer` range.

**Commit types:**

- `fix` → patch, `feat` → minor, `!` after the type or a `BREAKING CHANGE:` footer
  → major.
- `docs`, `test`, `ci` and `chore` never release. Use them only for changes that
  leave every installed Skill's behavior unchanged. **A change to a `SKILL.md`, or
  to anything it loads, is never `docs`.**
- A breaking commit carries a `BREAKING CHANGE:` footer that says what the
  consumer must do; it becomes the changelog's upgrade note.
- A mis-typed commit is corrected in the Release PR (edit its body, or add a
  `Release-As:` override), never by rewriting history. The `release-units` check
  warns about both cases on every PR.

**Adding a Skill or suite:** register it as a Release Unit in the same PR: a
package in `release-please-config.json` (with `component` set to its folder name
and every `SKILL.md` listed in `extra-files`), an entry in
`.release-please-manifest.json` at `1.0.0`, a `CHANGELOG.md`, and
`metadata.version` (annotated `# x-release-please-version`) plus
`metadata.changelog` in each `SKILL.md`. The `release-units` check fails until it
is registered.

**Frontmatter shape:** `metadata` stays a flat map of quoted strings; Antigravity
silently drops a Skill whose `metadata` value isn't a string. Whenever the shape
changes (a new `metadata` key or annotation form), re-run the four-harness loading
test by hand before merging: load throwaway Skills with the new frontmatter in
Claude Code, Copilot CLI (`copilot skill list --json`), Codex
(`codex debug prompt-input`) and Antigravity (check its CLI log for parse errors),
as in [#437](https://github.com/ken-guru/skills/issues/437).

## Dependency updates and rendered-gallery fingerprints

The Presentation Theme verification suite fingerprints its source inputs, including
the suite `package-lock.json`. A dependency-only change can therefore invalidate
the approved gallery manifest even when no CSS or rendering code changed. A stale
fingerprint is a required follow-up, not a reason to weaken the check.

For Dependabot updates in `skills/presentation/verification/presentation-themes`:

1. Install from the lockfile with `npm ci`.
2. Regenerate the gallery fixtures and renders with `npm run fixtures:gallery` and
   `npm run render:gallery`.
3. Review the rendered output. Update the tracked source fingerprint in
   `skills/presentation/docs/assets/presentation-themes/manifest.json` only after
   confirming the reviewed gallery remains valid.
4. Run `npm run check-gallery` and `npm test`, then include the manifest update in
   the same PR as the lockfile update.

Do not commit the generated `reports/` or `.generated/` files. If the dependency
update changes the rendered pixels, stop and obtain explicit visual approval before
replacing the public gallery assets.

## Diagram media boxes

A Theme Package's `archetypes.diagram.mediaBox` must match the diagram slot its
CSS renders. After changing diagram, heading, or caption layout, run
`npm run fixtures && node scripts/check-diagram-media-box.mjs` in
`skills/presentation/verification/presentation-themes`
and update the declaration; CI's `Diagram media box` job enforces it.

## Extracting a suite member

When a member becomes independently distributed:

1. copy or move its complete self-contained directory;
2. promote required suite documentation into owner-local documentation;
3. rewrite links and language that assume Presentation ownership;
4. update Collection, suite, plugin, and installation indexes atomically;
5. register the extracted Skill as its own Release Unit, continuing from the
   suite's current version with a major bump (leaving the suite is a rename or
   removal for the suite's consumers), and remove it from the suite's
   `extra-files`;
6. add focused-install documentation and verification;
7. remove the old suite authority only after the new Artifact Owner explicitly
   accepts its files and tests.

This ownership transfer is the point at which focused installation becomes a
supported contract.
