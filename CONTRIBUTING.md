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

## Extracting a suite member

When a member becomes independently distributed:

1. copy or move its complete self-contained directory;
2. promote required suite documentation into owner-local documentation;
3. rewrite links and language that assume Presentation ownership;
4. update Collection, suite, plugin, and installation indexes atomically;
5. add focused-install documentation and verification;
6. remove the old suite authority only after the new Artifact Owner explicitly
   accepts its files and tests.

This ownership transfer is the point at which focused installation becomes a
supported contract.
