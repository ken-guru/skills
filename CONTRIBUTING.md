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

## Required checks

`main` accepts changes only through pull requests, and its ruleset requires one
status check: **presentation-skills**. Every other workflow runs without
blocking a merge. A PR opened with `GITHUB_TOKEN`, such as one from a release bot,
triggers no workflows, so a required check never reports on it.

Keep this list in step with the ruleset when either changes. To confirm the
current set:

```bash
gh api repos/ken-guru/skills/rulesets --jq '.[].id' \
  | xargs -I{} gh api repos/ken-guru/skills/rulesets/{} \
      --jq '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context'
```

## Pinned tools and rendered fixtures

The presentation skills download pinned, checksum-verified tools (D2,
`vl-convert`, `chrome-headless-shell`, and Marp CLI from a committed lockfile)
through each skill's `setup`. Moving a pin is a release of that skill:

1. Update the version and checksums in the skill's script (or the Marp CLI
   lockfile under `rendering-slides/scripts/marp-cli/`).
2. Run the skill's `setup`, its tests, and `node --test verification/presentation-skills/*.test.mjs`.
3. Review the fixture deck's rendered slides (the `fixture-slides` CI artifact)
   before merging. There are no pixel baselines: a person looks.

Shared files are copied into each skill that needs them at runtime and kept
identical by CI: `scripts/tools.mjs`, `scripts/deck.mjs`, and the suite's
`docs/accessibility-bar.md` and `docs/deck-folder.md` (copied into
`references/`). Edit the original and copy it to every skill that has one.

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
