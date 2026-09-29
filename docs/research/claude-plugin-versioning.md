# How Claude Code plugins and marketplaces use the plugin version

Research for [#426](https://github.com/ken-guru/skills/issues/426), part of [#424](https://github.com/ken-guru/skills/issues/424). Facts only, no recommendations. Sources are the official Claude Code plugin docs at code.claude.com, read on 2026-09-29.

Sources:

- [Plugin loading reference](https://code.claude.com/docs/en/plugins/loading) (loading)
- [Plugin manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference) (manifest)
- [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference) (marketplace)
- [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace) (host)
- [Publish and distribute a plugin](https://code.claude.com/docs/en/plugins/publish) (publish)
- [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference) (cli)
- [Install and manage plugins](https://code.claude.com/docs/en/plugins/install) (install)
- [Plugin dependencies](https://code.claude.com/docs/en/plugins/dependencies) (dependencies)

## 1. Does update use `plugin.json` `version` or the git commit?

It uses a **computed version**. Claude Code compares it with the one it recorded at install time.

- "Claude Code computes a version for every plugin it installs, and that version is how it detects an update. `claude plugin update` and background auto-update compute the version again and skip the plugin when it matches what `installed_plugins.json` records." (loading, Versions and updates)
- Resolution order for every source type except `command` (loading, How Claude Code computes the version):
  1. `version` in the plugin's `plugin.json`
  2. `version` in the plugin's marketplace entry
  3. If neither is set, the version comes from the source type:

| Source type | Version when no `version` field is set |
| :- | :- |
| `github`, `url`, `git-subdir` | Commit SHA of the source, shortened to 12 characters (`git-subdir` also carries a hash of the subdirectory path) |
| `archive` | SHA-256 digest, shortened to 12 characters |
| Relative path inside a Git-hosted marketplace | "The commit SHA of the installed directory" |
| Local directory, not a git repo | `unknown` |
| `npm` | `unknown` |

- For a `command` source the version is always derived from what the command produced (`<hash>` or `<manifest version>-<hash>`), and the entry's `version` is ignored. (loading)
- The version string is "not checked against semver". (manifest, `version`)
- The computed version also names the cache directory: `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`, which is where `${CLAUDE_PLUGIN_ROOT}` points. (loading)

### What happens if the version isn't bumped

- "If you set `"version": "1.0.0"` and push new commits without changing it, users don't receive them." (host, Release a new version)
- `claude plugin update` prints `<name> is already at the latest version (1.0.0).` and users keep the old copy. (publish; cli, plugin update)
- The documented options: "either increase `version` on each release or omit it". If you omit it, "users track your commits instead. Leave `version` out of both `plugin.json` and the marketplace entry." (host)
- The manifest reference says `version` "keeps users on that version until you change it". (manifest)
- Exceptions where the field does not pin: a `command` source, a plugin from a marketplace hosted on claude.ai (the version claude.ai records is used, and the manifest's `version` isn't read), and a plugin loaded in place from a marketplace added as a local directory. That last one "loads your current files at every session start, whatever its version string says". (manifest; loading; host)
- `claude plugin validate --strict` fails on warnings, including a missing `version`. (publish; manifest)

### When updates happen

- Background auto-update is per marketplace. It is **on by default** only for Anthropic's official marketplace names and marketplaces added from claude.ai. It is **off by default** for "every other marketplace, including ... third-party marketplaces". (install, Keep plugins updated)
- "`marketplace.json` has no field to turn it on". A user enables it under `/plugin` > Marketplaces, or an admin sets `"autoUpdate": true` on an `extraKnownMarketplaces` entry in managed settings. (host, Turn on auto-update)
- When auto-update is on, it runs after the first message of an interactive session, following a random delay of up to ten minutes. `DISABLE_UPDATES`, `DISABLE_AUTOUPDATER`, or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` turn it off unless `FORCE_AUTOUPDATE_PLUGINS=1` is also set. (loading, When auto-update runs)
- A manual update is `claude plugin update <plugin>@<marketplace>` or **Update now** in the `/plugin` Installed tab. The running session keeps the old version until `/reload-plugins` runs or a new session starts. (install; cli)
- Previous version directories get an `.orphaned_at` marker and are removed 14 days later. (loading, Cleanup of previous versions)

## 2. Where a user sees the installed version

- `claude plugin list` prints `Version`, `Scope`, and `Status` lines. `/plugin list` shows the same inside a session and requires v2.1.163+. (install; cli)
- `claude plugin list --json` includes a `version` field: "For a marketplace install, the version Claude Code computed at install". The JSON also has `installedAt` and `lastUpdated` timestamps. With `--available`, uninstalled entries show "The entry's version, when it declares one". (cli, plugin list)
- `claude plugin details <name>` prints the plugin's name, version, description, and source. (cli, plugin details)
- On disk, `~/.claude/plugins/installed_plugins.json` records each install's `scope`, `installPath`, and `version`. The cache directory name is the version. (loading)
- A tag-resolved dependency shows as `<version>-<12-char commit>`, for example `2.1.0-8713c5b11005`. (dependencies)
- The `/plugin` install details pane shows **Last updated** only for plugins in Anthropic's official marketplace. (install)

## 3. Can `marketplace.json` entries carry their own `version`, and which wins?

- Yes. A plugin entry has a `version` field, and "An entry also accepts every `plugin.json` field". (marketplace, Plugin entries)
- **`plugin.json` wins.** The manifest reference says "the manifest's `version` overrides the entry's". This precedence is "fixed ... regardless of `strict`". (manifest, Metadata precedence; loading)
- Setting both is documented as a mistake: "Don't set `version` in both ... If you do, Claude Code uses the `plugin.json` value without warning", and `claude plugin validate` warns `Entry declares version "x" but <path>/plugin.json says "y". At install time, plugin.json wins`. That warning is scoped to relative-path entries. (host; marketplace, validation table)
- For non-relative sources, "users see only the entry's own fields until they install the plugin", so the entry's `version` is what shows before install. (marketplace)
- The marketplace file also has a top-level `version` (or `metadata.version`), described as "Marketplace manifest version". This is separate from plugin versions. (marketplace, Top-level fields)
- `claude plugin tag` checks that `plugin.json` and any marketplace entry listing the plugin agree on the version before it tags. (cli, plugin tag)

## 4. Can one repo's marketplace ship several plugins from subdirectories, each with its own version?

- Yes. A marketplace "can list as many plugins as you like". (create-marketplace)
- A relative-path source is "A directory inside the marketplace, resolved from the marketplace root", for example `{ "name": "formatter", "source": "./plugins/formatter" }`. The path must start with `./`. `"."` alone means the root, and `..` fails validation. With `metadata.pluginRoot` (v2.1.239+), bare names such as `"formatter"` resolve under that directory. (marketplace, Relative path plugin source)
- Relative paths resolve only when Claude Code has the marketplace's files, which is true for `github`, `git`, `file`, and `directory` marketplace sources. They don't resolve for a `url` marketplace source (only `marketplace.json` is fetched) and are rejected for `settings`. (marketplace)
- Each plugin gets its own computed version from its own `plugin.json` `version`. With no `version`, a relative-path plugin in a Git-hosted marketplace uses "The commit SHA of the installed directory". (loading)
- Release tags are per plugin: "Tag each release as `<plugin-name>--v<version>` ... The plugin-name prefix lets one marketplace repository host several plugins with independent version histories." For relative-path plugins, the marketplace repository holds the tags. Tags are needed only when other plugins declare a semver range on yours. (dependencies; publish, Tag a release)
- "One marketplace serves one version of each plugin at a time". Release channels mean two marketplaces pointing at different refs. "Claude Code has no release-channel concept". (host)
- Related: when a root-sourced entry (`"."`/`"./"`) lists specific `skills` subdirectories, only those load. (manifest)

## 5. Is there a changelog or release-notes surface for plugins?

- None found. None of the Claude Code plugin pages listed above mention a changelog or release-notes field, file, or UI. That covers overview, install, create, components, dependencies, publish, create-marketplace, host-marketplace, org, troubleshooting, loading, manifest-reference, marketplace-reference, cli-reference, and security.
- The `plugin.json` metadata fields are `name`, `displayName`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, and `$schema`. None is a changelog field. (manifest)
- After an update, the only user-facing signal is `Plugin updated: <name> · Run /reload-plugins to apply`, or `Plugins changed. Run /reload-plugins to activate.` (install)
- The "Claude Code changelog" in the docs index covers Claude Code itself, not individual plugins.

## Relevance to this repo's current manifests (facts only)

- `.claude-plugin/plugin.json` sets `"version": "1.1.0"` for `presentation-skills`. The `.claude-plugin/marketplace.json` entry has `"source": "./"` and no `version`, so the computed version is `1.1.0`, and consumers get new commits only when that string changes.
- The `ken-guru-skills` marketplace is third-party, so auto-update is off by default for its users.
