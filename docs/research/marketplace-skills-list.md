# Research: does a marketplace entry's `skills` list suppress the default `skills/` scan?

Issue: ken-guru/skills#542. Date: 2026-10-20. Claude Code tested: 2.1.304.

## Answer

- **Entry `skills` list suppresses the default scan: yes, when `source` is `./`.** The manifest reference says so directly, and an isolated install confirmed it.
- **Entry `skills` and `plugin.json` `skills` are not merged in the observed behavior.** The docs say strict-mode entries are "appended" to `plugin.json`, but the test showed the entry list replaced the manifest's skill.
- **A skill listed in both `plugin.json` and under `skills/` loads once.** Not stated in the docs; observed once in the component inventory.

## Sources

### Docs

1. `manifest-reference.md`, section "Marketplace entries and the manifest" (https://code.claude.com/docs/en/plugins/manifest-reference.md):
   > When a marketplace entry whose `source` is the marketplace root lists specific `skills` subdirectories, only those subdirectories load, and the plugin's default `skills/` directory isn't scanned. A `skills` key in the manifest instead adds to the default.

2. `manifest-reference.md`, Fields table, `skills` row:
   > Directories to scan for skills, each a directory of `<name>/SKILL.md` folders or one folder holding `SKILL.md` directly. `"."` names the plugin root. Adds to the default `skills/` scan

3. `marketplace-reference.md`, section "How an entry combines with plugin.json" / "Strict mode" (https://code.claude.com/docs/en/plugins/marketplace-reference.md):
   > With `strict: true`, the default, Claude Code appends the entry's component fields to `plugin.json`, except `hooks`, whose matchers replace the manifest's per event.

   This page does not say whether the default scan runs. Its only mention of the scan is the "Relative path" and "pluginRoot" text, which does not address `skills`.

4. `marketplace-reference.md` and `manifest-reference.md` do not say what happens when the same skill is listed in two places. No passage was found.

### CLI

Commands run with `CLAUDE_CONFIG_DIR` set to a scratch directory, so the user's real plugin config was not touched.

- `claude plugin validate .` on the repo: "Validation passed", exit 0. It is static and reports no skill inventory.
- `claude plugin details <name>` after `claude plugin install`. Its "Component inventory" lists loaded skill names.

### Experiment (scratch marketplace `exp-mkt`, plugin `exp-plugin`)

Layout: `skills/alpha`, `skills/beta`, `skills/gamma`, each with a `SKILL.md`. `plugin.json` has `"skills": ["./skills/alpha"]`. Marketplace entry has `"source": "./"`.

| Entry `skills` | Loaded skills (`details`) |
| :- | :- |
| `["./skills/beta"]` | `beta` only. `alpha` (from `plugin.json`) and `gamma` (default scan) are absent. |
| `["./skills/alpha", "./skills/beta"]` | `alpha`, `beta`. Each listed once. |
| not set | `alpha`, `beta`, `gamma`. Each listed once. |

### Real repo (`ken-guru/skills`, plugin `presentation-skills` 3.0.1)

`plugin.json` lists 8 skill directories. The marketplace entry has no `skills` key. `claude plugin details presentation-skills` reported 14 skills: the 8 from `plugin.json` plus 6 from the default `skills/` scan (`setup-antigravity-devcontainer`, `setup-claude-devcontainer`, `setup-codex-devcontainer`, `setup-copilot-devcontainer`, `setup-devcontainer`, `unslop`). No name appeared twice, including `researching-sources`, which is both in `plugin.json` and under `skills/`.

## Still unknown

- **Whether a duplicate is loaded once or twice at runtime.** The inventory dedupes or shows one row per name. The experiment cannot show whether a skill is registered twice internally, for example with two discovery entries that collapse in the display. A session-level check (skill list or invocation count) would settle it.
- **Why the entry `skills` list replaces `plugin.json`'s skills rather than appending.** The docs say "appended". The observed behavior contradicts that for `skills`. Whether this is intended or a bug is not settled by any source found here.
- **Whether the entry `skills` list is the only way to limit the default scan.** Only the `./` source was tested. Other `source` types are out of scope.

## Implication for ken-guru/skills

The repo's entry has no `skills` list, so the default scan runs and loads 14 skills, not the 8 in `plugin.json`. If the intent is to ship only the 8 listed skills, the entry would need a `skills` list naming them, or `plugin.json` would need to drop them from the default scan. The docs do not describe a way to exclude default-scan directories other than setting the entry list. This is a decision for the orchestrating session, not a finding.
