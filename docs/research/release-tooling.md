# Release tooling for per-unit versions and changelogs

Research for [#428](https://github.com/ken-guru/skills/issues/428), part of map [#424](https://github.com/ken-guru/skills/issues/424).

**Question:** Can off-the-shelf release tooling version this repo's Release Units (each Standalone Skill at `skills/<name>/`, and each Skill Suite at `skills/<suite>/` as one unit) from Conventional Commits, and what would it take?

This note records facts from each tool's own docs and source. It does not recommend a tool.

Sources were read on 2026-09-29. Versions at that time: `release-please` 17.11.2 (npm), `googleapis/release-please-action@v4`, `@changesets/cli` 3.0.3 (npm `latest`; 2.31.1 on `maintenance-v2`), `semantic-release` 25.0.9.

## Summary

| | release-please (manifest mode) | Changesets | semantic-release + `semantic-release-monorepo` |
|---|---|---|---|
| Input that drives the bump | Conventional Commit messages | Hand-written changeset files in `.changeset/`. Commit messages are not read. | Conventional Commit messages |
| Unit defined by | a directory path in `release-please-config.json` | a `package.json` found by workspace discovery | a `package.json` directory |
| Non-npm units | yes (`simple` type plus `extra-files`) | only with a `package.json` per unit and `privatePackages.version: true` | npm-oriented |
| Version stored in | the manifest, plus any file you point it at (JSON path, YAML path, or annotated line) | `package.json` `version` only | `package.json` |
| Per-unit `CHANGELOG.md` | yes, `<path>/CHANGELOG.md` by default | yes, `<pkg dir>/CHANGELOG.md` | via plugins |
| Default tag | `<component>-v<version>`, for example `unslop-v1.2.0` | `<name>@<version>`, for example `unslop@1.2.0` | `<name>-v<version>` |
| CI flow | a Release PR, which tags and releases when merged | a "Version Packages" PR, then publish/tag on merge | release on every push, no PR |

## release-please (manifest mode)

### Non-npm units defined by a path

- Manifest mode keeps its config in `release-please-config.json` and the last-released versions in `.release-please-manifest.json`. Each key under `packages` is "the relative path from the repo root to the folder that contains all the files for that package", and "should be a directory and not a file". ([manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md))
- `release-type` can be set per package. `simple` is "A repository with a version.txt and a CHANGELOG.md". ([README](https://github.com/googleapis/release-please#strategy-language-types-supported)) The `simple` strategy rewrites `version-file` (default `version.txt`) with `createIfMissing: false`, so it does not create that file. ([src/strategies/simple.ts](https://github.com/googleapis/release-please/blob/main/src/strategies/simple.ts), [schemas/config.json](https://github.com/googleapis/release-please/blob/main/schemas/config.json) `version-file`: "Used by `ruby` and `simple` strategies")
- `extra-files` updates the version in other files: ([customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md#updating-arbitrary-files))
  - `{"type": "json", "path": ..., "jsonpath": "$.version"}` updates a JSON field, which covers `plugin.json`.
  - `{"type": "yaml", ...}` takes a `jsonpath` into a YAML file.
  - A plain path uses the Generic updater. It replaces the version on any line annotated `x-release-please-version`, or inside a block that runs from `x-release-please-start-version` to `x-release-please-end`. Because of that, a YAML frontmatter line such as `version: "1.2.0" # x-release-please-version` inside `SKILL.md` can be targeted.
- `extra-files` paths are relative to the package path unless they start with `/`. A leading `/` resolves from the repo root, and `..` or `~` is rejected. ([`addPath` in src/strategies/base.ts](https://github.com/googleapis/release-please/blob/main/src/strategies/base.ts)) So the `skills/presentation` unit can update `/.claude-plugin/plugin.json` at the root.
- On the Agent Skills side, the spec allows only `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools` as frontmatter fields. `metadata` is "a map from string keys to string values", and the spec's own example puts `version: "1.0"` under `metadata`. ([agentskills.io/specification](https://agentskills.io/specification))
- Bootstrapping works in one of two ways. You can seed `.release-please-manifest.json` with a unit's current version (for example `"skills/presentation": "1.1.0"`), and it "will use "1.1.0" as the last-released/current version". Or you can set `bootstrap-sha` to limit how far back commits are read. ([manifest-releaser.md, Bootstrapping](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#bootstrapping))

### Per-unit changelog and tag format

- `changelog-path` is "relative to the *package* directory", with default `CHANGELOG.md`. `skip-changelog` turns it off. ([manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md))
- The default tag is `<component-name>-v<release-version>`. `include-component-in-tag` (default `true`), `include-v-in-tag` (default `true`), and `tag-separator` change it. ([manifest-releaser.md, Subsequent Versions](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md#subsequent-versions); [schemas/config.json](https://github.com/googleapis/release-please/blob/main/schemas/config.json))
- The component name comes from `component`, then `package-name`, and is empty otherwise. `simple` has no package-name lookup. ([`getComponent` in src/strategies/base.ts](https://github.com/googleapis/release-please/blob/main/src/strategies/base.ts)) The manifest docs say `package-name` is "Required for all other packages" whose type has no lookup. So each unit needs `"component": "unslop"` (or a `package-name`) to get `unslop-v1.2.0`.
- By default it creates one GitHub Release per package. `skip-github-release` turns that off, but "Release-Please still requires releases to be tagged". ([schemas/config.json](https://github.com/googleapis/release-please/blob/main/schemas/config.json))

### Mapping commits to units

- `CommitSplit` looks at the files each commit touched. A file belongs to the longest configured package path it sits under (`file.indexOf(p + "/") === 0`, with paths sorted longest first). A commit is added once to every package it touched. So one commit that touches `skills/unslop/` and `skills/presentation/` counts toward both units. ([src/util/commit-split.ts](https://github.com/googleapis/release-please/blob/main/src/util/commit-split.ts))
- Commits that touch only paths outside the configured packages are ignored. Files at the top level (no `/`) are skipped. Package paths "must be unique and non-overlapping". (same file) So a commit that changes only `.claude-plugin/plugin.json` does not count toward `skills/presentation`.
- The special `"."` package gets every commit. `exclude-paths` drops a commit from a package when "all files from commit belong to one of the paths". ([manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md); [schemas/config.json](https://github.com/googleapis/release-please/blob/main/schemas/config.json))
- An empty commit (`--allow-empty`) applies to all packages only when `includeEmpty` is set. ([src/util/commit-split.ts](https://github.com/googleapis/release-please/blob/main/src/util/commit-split.ts))
- One commit can carry several conventional messages through footers. `BEGIN_COMMIT_OVERRIDE` / `END_COMMIT_OVERRIDE` in a merged PR body replaces its message, and only works with squash-merge. `Release-As: x.y.z` in a commit body forces a version. ([README](https://github.com/googleapis/release-please#what-if-my-pr-contains-multiple-fixes-or-features))

### CI flow, permissions, secrets

- The flow is the Release PR. release-please keeps one PR up to date. Merging it updates the changelog and version files, tags the commit, and creates a GitHub Release. ([README](https://github.com/googleapis/release-please#whats-a-release-pr)) By default one combined PR covers all packages. `separate-pull-requests: true` opens one per package. ([manifest-releaser.md](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md))
- Action: `googleapis/release-please-action@v4`, triggered on `push` to `main`, with `config-file` and `manifest-file` inputs. Required workflow permissions are `contents: write`, `issues: write`, and `pull-requests: write`. You may also need to enable "Allow GitHub Actions to create and approve pull requests". ([release-please-action README](https://github.com/googleapis/release-please-action#workflow-permissions))
- Secrets: the default is `GITHUB_TOKEN`. Tags and PRs created with `GITHUB_TOKEN` "will not trigger future GitHub actions workflows". A PAT (as the `token` input) is needed "if you want GitHub Actions CI checks to run on Release Please PRs". ([release-please-action README](https://github.com/googleapis/release-please-action#other-actions-on-release-please-prs))
- Outputs include `releases_created`, `paths_released` (a JSON array of the package paths released), and per-path outputs, which later steps can use. ([release-please-action README](https://github.com/googleapis/release-please-action#outputs))
- It tracks releases with PR labels (`autorelease: pending` / `autorelease: tagged`). ([customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md#release-lifecycle-labels))

### Commit types that don't bump

- "A releasable unit is a commit to the branch with one of the following prefixes: "feat", "fix", and "deps". (A "chore" or "build" commit is not a releasable unit.)" ([README](https://github.com/googleapis/release-please#step-1-ensure-releasable-units-are-merged))
- In the code, no Release PR is built for a package whose generated release notes are empty ("No user facing commits found … skipping"). ([`buildReleasePullRequest` / `changelogEmpty` in src/strategies/base.ts](https://github.com/googleapis/release-please/blob/main/src/strategies/base.ts)) What counts toward the notes is set by `changelog-sections`. Each entry has `type`, `section`, and `hidden`. ([schemas/config.json](https://github.com/googleapis/release-please/blob/main/schemas/config.json))
- Without `changelog-sections`, the default comes from the conventionalcommits preset (the docs link it as https://git.io/JqCZL). It shows `feat`, `feature`, `fix`, `perf`, and `revert`, and hides `docs`, `style`, `chore`, `refactor`, `test`, `build`, and `ci`. ([conventional-changelog-conventionalcommits constants](https://github.com/conventional-changelog/conventional-changelog/blob/master/packages/conventional-changelog-conventionalcommits/src/constants.js)) So by default `ci`, `docs`, and `test` commits do not open a release.
- Bump size under the `default` versioning strategy: breaking changes bump major, `feat`/`feature` bump minor, and anything else releasable bumps patch. `bump-minor-pre-major` and `bump-patch-for-minor-pre-major` change this below 1.0.0. ([src/versioning-strategies/default.ts](https://github.com/googleapis/release-please/blob/main/src/versioning-strategies/default.ts); [customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md#versioning-strategies))

## Changesets

The Changesets repo `main` branch is v3, and `@changesets/cli` `latest` on npm is 3.0.3. The in-repo `docs/` are marked outdated and point to https://changesets.dev.

### Non-npm units

- "The only requirement is that the project has a `package.json` file to manage the versions and dependencies within the repo. It should have at least `name`, `private` and `version` set." You also need `privatePackages.version: true`, and `privatePackages.tag: true` to get tags. ([changesets.dev/guide/beyond-npm](https://changesets.dev/guide/beyond-npm); [config](https://changesets.dev/guide/config))
- "Changesets only versions NPM package.json files". Other formats have to be driven by workflows that trigger on the tags or releases Changesets creates. ([docs/versioning-apps.md](https://github.com/changesets/changesets/blob/main/docs/versioning-apps.md)) So `plugin.json`, `SKILL.md` frontmatter, or a `VERSION` file would need a custom step (for example a `version-script` in the action) that copies the version out of each `package.json`.
- Packages are found by `@manypkg/get-packages`, which supports "Yarn, npm, Lerna, pnpm, Bun, Rush and single-package repos". Without a workspace config, the root package is the only package. ([manypkg get-packages README](https://github.com/Thinkmill/manypkg/blob/main/packages/get-packages/README.md)) So each unit would need a `package.json`, and the root would need a workspaces declaration listing `skills/*`.

### Per-unit changelog and tag format

- `changeset version` writes `CHANGELOG.md` in each package directory (`path.resolve(dir, "CHANGELOG.md")`) and updates `package.json`. ([packages/apply-release-plan/src/index.ts](https://github.com/changesets/changesets/blob/main/packages/apply-release-plan/src/index.ts))
- Tags are `${name}@${version}` in a multi-package repo and `v${version}` for a single root package. ([packages/cli/src/utils/gitTags.ts](https://github.com/changesets/changesets/blob/main/packages/cli/src/utils/gitTags.ts)) The docs show no option that changes the format.

### Mapping changes to units

- The author picks the units. A changeset is a Markdown file whose YAML front matter lists packages and bump types (`"pkg": major|minor|patch`), and its body becomes the changelog entry. One changeset can name several packages. ([docs/detailed-explanation.md](https://github.com/changesets/changesets/blob/main/docs/detailed-explanation.md))
- Commit messages are not read. Changed files are used only by `changeset status --since=main`, which "will exit with exit code 1 if there are changed packages but no new changesets". `changedFilePatterns` (picomatch globs, default `["**"]`) sets which files mark a package as changed. ([docs/automating-changesets.md](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md); [config](https://changesets.dev/guide/config))
- `fixed` groups get the same bump together. `linked` groups align to the highest version when one of them bumps. ([config](https://changesets.dev/guide/config))

### CI flow, permissions, secrets

- `changesets/action` "creates a `version` PR, then keeps it up to date". Once that PR merges, a publish step can run, and `create-github-releases` / `push-git-tags` control tags and releases. ([changesets/action README](https://github.com/changesets/action); [docs/automating-changesets.md](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md))
- Required permissions are `contents: write` and `pull-requests: write`, plus `id-token: write` only for npm trusted publishing. "Allow GitHub Actions to create and approve pull requests" must be enabled. A custom token goes in the `github-token` input. ([changesets/action README](https://github.com/changesets/action#requirements))
- The optional [changeset-bot](https://github.com/apps/changeset-bot) GitHub App comments on PRs that lack a changeset. ([docs/automating-changesets.md](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md))

### Commit types that don't bump

- Commit types have no effect. A PR releases nothing unless it adds a changeset. For changes such as tests or build tooling, `changeset --empty` adds "a special changeset that does not release anything". ([docs/automating-changesets.md](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md))

## semantic-release (with a monorepo plugin)

- Core semantic-release reads Conventional Commits by default. Breaking changes produce a major release, `feat` a minor, and `fix`/`perf` a patch. "refactoring or changing code style would not" trigger a release. ([semantic-release FAQ](https://semantic-release.gitbook.io/semantic-release/support/faq))
- Its official docs describe no multi-package support. Monorepo use relies on community plugins such as [`semantic-release-monorepo`](https://github.com/pmowrer/semantic-release-monorepo). That plugin counts a commit toward a package "if a commit touched a file in or below a package's root". "A single commit can belong to multiple packages". It sets `tagFormat` to `<package-name>-v<version>`. It works per npm package (`package.json`).
- The flow is to release on every CI run of the release branch, with no release PR.

## Facts specific to this repo

- The Release Units are `skills/unslop/`, `skills/setup-devcontainer/`, the four `skills/setup-*-devcontainer/`, and the Skill Suite `skills/presentation/`. None of them has a `package.json`, `CHANGELOG.md`, or `VERSION` file today.
- The Suite's version (`1.1.0`) lives in `/.claude-plugin/plugin.json`, outside `skills/presentation/`. With release-please, that file can be updated through a root-relative `extra-files` entry (`/.claude-plugin/plugin.json`, `jsonpath: $.version`). Commits that touch only that file are not attributed to the Suite. With Changesets, it would take a custom version script.
- No unit path sits inside another (the Suite's member skills are not units of their own), so the paths meet release-please's "unique and non-overlapping" rule. The repo has no root `package.json`.
