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
