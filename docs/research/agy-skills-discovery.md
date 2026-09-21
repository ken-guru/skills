# Where does `agy` discover skills? (research for #342, map #341)

Researched 2026-09-21. Question: which directories the Antigravity CLI (`agy`) reads for skills, global and project-level, and whether that matches what `vercel-labs/skills` writes for `-a antigravity` and `-a antigravity-cli`.

Evidence labels used throughout:

- **DOCUMENTED**: stated by Google in official docs, the upstream repo, or files shipped inside `agy`.
- **REPORTED**: a user or maintainer claim in an upstream issue. Not verified by me.
- **STATIC**: read from source code or from strings in a binary. Not observed at runtime.
- **UNVERIFIED**: no source establishes it. Needs a real `agy` session (ticket #343 territory).

I did not run `agy` to load a skill. Nothing below is an observed runtime result of mine.

## Short answer

1. Google's docs give the CLI **two** documented locations: workspace `<workspace-root>/.agents/skills/` and global `~/.gemini/antigravity-cli/skills/` (plus plugin skills). The `~/.gemini/antigravity-cli/skills/` path is documented but is contradicted by field reports; only `~/.gemini/config/skills/` has independent confirmation of working globally.
2. `~/.gemini/config/skills/` is what Google's own shipped `agy-customizations` skill and the docs for Antigravity 2.0/IDE name as the global location. Multiple reporters say it works for the CLI too; Google has not answered whether it is officially supported for the CLI (open issue #686).
3. **Bigger finding, from vercel-labs/skills source (STATIC):** at `main` (v1.7.0), both `antigravity` and `antigravity-cli` are classified "universal" because their `skillsDir` is `.agents/skills`. Global installs for universal agents ignore `globalSkillsDir` and go to `~/.agents/skills/`. So `npx skills add ... -a antigravity -g --copy` (the line this repo runs) most likely writes to `~/.agents/skills/`, not `~/.gemini/antigravity/skills/`. The README agent table is misleading for these two agents. `agy` is reported not to read `~/.agents/skills/` (issue #103, still open).
4. Docs and `vercel-labs/skills` **disagree** for `-a antigravity` (skills table says `~/.gemini/antigravity/skills/`, Google says `~/.gemini/config/skills/` for 2.0/IDE, `~/.gemini/antigravity-cli/skills/` for the CLI). They **nominally agree** for `-a antigravity-cli` on paper (`~/.gemini/antigravity-cli/skills/`), but the universal-agent logic means that path is not what the installer writes.
5. `~/.antigravity/antigravity-cli/` appears in no primary source I found. Google's docs and the CHANGELOG place the CLI's `settings.json` at `~/.gemini/antigravity-cli/settings.json`. It does not affect skill discovery per any source.

## 1. What Google documents

### 1.1 Skills docs, CLI tab (DOCUMENTED)

Source: <https://antigravity.google/docs/skills> (CLI tab: `?tab=cli`). Fetched through a page-to-markdown tool, so the table below is a transcription; re-check the live page before quoting it.

| Location | Scope |
|---|---|
| `<workspace-root>/.agents/skills/<skill-folder>/` | Workspace |
| `~/.gemini/antigravity-cli/skills/<skill-folder>/` | Global |
| `~/.gemini/antigravity-cli/plugins/<name>/skills/` | Plugin-provided |

The page also says: "Antigravity defaults to `.agents/skills`, but still maintains backward compatibility for `.agent/skills`." It mentions `agy plugin list` and `agy plugin install ./my-skills-plugin`.

### 1.2 Skills docs, Antigravity 2.0 and IDE tabs (DOCUMENTED)

Same page:

- Antigravity 2.0: workspace `<workspace-root>/.agents/skills/`, global `~/.gemini/config/skills/`.
- IDE: workspace `.agents/skills/`, global `~/.gemini/config/skills/`, with legacy support for `~/.gemini/antigravity/skills/`.

So Google documents a **different global directory for the CLI than for 2.0/IDE**, but the 2.0/IDE one is the shared `config/` tree.

### 1.3 The `agy-customizations` skill shipped inside `agy` (DOCUMENTED)

`agy` bundles built-in skills at `~/.gemini/antigravity-cli/builtin/skills/` (present on the maintainer's machine, agy 1.1.20). `agy-customizations/SKILL.md` describes discovery:

- Workspace: `.agents/` (or `.agent/`, `_agents/`, `_agent/`) at the project root; the agent walks from the CWD up to the repository root (folder containing `.git`).
- Global: `~/.gemini/config/`.
- Priority, highest to lowest: workspace project, declared configurations (`skills.json` / `plugins.json` in the workspace), global discovery (`~/.gemini/config/`), built-ins, global declared configurations.
- `docs/json_configs.md`: `skills.json` (workspace: `.agents/skills.json`; global: `~/.gemini/config/skills.json` per issue #864) takes `entries: [{ "path": ... }]`; paths may be absolute, `~/`-relative, or repo-relative. This is a documented way to point `agy` at a non-standard skills directory.

This shipped guide names **only** `~/.gemini/config/` as the global root. It does not mention `~/.gemini/antigravity-cli/skills/`. That contradicts the web docs table in 1.1.

### 1.4 Plugins docs (DOCUMENTED, reported stale)

<https://antigravity.google/docs/plugins?tab=cli> documents CLI plugins at `~/.gemini/antigravity-cli/plugins/<name>/`, and `~/.gemini/config/plugins/` for the IDE/manual global level. Issue #1067 (open, 2026-09-21) reports the docs are stale: agy 1.2.7 installs to `~/.gemini/config/plugins/` and loads from there. A collaborator wrote in #123 (2026-09-05): "In the latest CLI versions, plugin installation paths have been unified to `~/.gemini/config/plugins/`." CHANGELOG 1.0.2 says the same for `agy plugin`. This is the same kind of drift as the skills path (docs say `antigravity-cli/`, product uses `config/`).

### 1.5 CHANGELOG evidence of the config consolidation (DOCUMENTED)

Source: <https://github.com/google-antigravity/antigravity-cli/blob/main/CHANGELOG.md> (latest entry 1.2.7).

- 1.0.2: plugins install to shared `~/.gemini/config/`, "instantly discoverable"; fallback skill discovery fixed for a missing config directory.
- 1.0.3: MCP config moved to `config/mcp_config.json`.
- 1.0.8: `/hooks` writes to shared `~/.gemini/config/hooks.json` instead of `~/.gemini/antigravity-cli/hooks.json`.
- 1.1.0: the `/agents` panel "Create New Agents" showed `~/.gemini/antigravity-cli/` when the scanned location is `~/.gemini/config/`; fixed to show the latter.
- 1.1.21: explicitly configured skill/plugin paths win name collisions over auto-discovered ones.
- 1.2.4: `/skills reload` subcommand added.

Pattern: Google moved CLI customization roots from `~/.gemini/antigravity-cli/` to `~/.gemini/config/`, fixing UI text and docs piecemeal. The CHANGELOG never states that `~/.gemini/antigravity-cli/skills/` is removed or still scanned.

## 2. What `vercel-labs/skills` writes (STATIC)

Source: `src/agents.ts` and `src/installer.ts` at main, commit `7407f3893ad4dceab546ac002c3ef806e4000c73`, package version 1.7.0, fetched 2026-09-21. `antigravity-cli` was added by commit `61827890` (2026-06-03, "feat: add Antigravity CLI support").

Agent entries:

| `-a` | `skillsDir` (project) | `globalSkillsDir` | detect |
|---|---|---|---|
| `antigravity` | `.agents/skills` | `~/.gemini/antigravity/skills` | `~/.gemini/antigravity` exists |
| `antigravity-cli` | `.agents/skills` | `~/.gemini/antigravity-cli/skills` | `~/.gemini/antigravity-cli` exists |

The README "Supported Agents" table lists the same two global paths.

Critical logic:

- `isUniversalAgent(type)` is `agents[type].skillsDir === '.agents/skills'`. Both entries above match, so both are "universal".
- `getAgentBaseDir(agent, global)` returns `getCanonicalSkillsDir(global)` for universal agents, which is `~/.agents/skills` for global installs. `globalSkillsDir` is never consulted for them.
- In `--copy` mode the installer does `copyDirectory(skill.path, agentDir)` where `agentDir = getAgentBaseDir(...)/<skill>`. For a universal agent that is `~/.agents/skills/<skill>`.
- In symlink mode, universal agents with `-g` return early after copying to canonical; no symlink is made into the agent's own `globalSkillsDir`.

Consequence, read from source and not run: `npx -y skills add <src> --skill '*' -a antigravity -y --copy -g` lands in `~/.agents/skills/`. Same for `-a antigravity-cli`. The `~/.gemini/antigravity/skills/` and `~/.gemini/antigravity-cli/skills/` values in the README table are not where a global install goes on v1.7.0. UNVERIFIED at runtime: I did not run the installer in a clean container. The `npx -y skills` version a container picks up depends on the npm `latest` tag at start time.

Upstream awareness:

- vercel-labs/skills#1470 (open, 2026-07-27): requests Antigravity 2.0 support with global `~/.gemini/config/skills/`.
- vercel-labs/skills PR #1483 (open, updated 2026-09-21): identifies the same universal-agent root cause ("installed skills to `~/.agents/skills` instead of the configured `globalSkillsDir`") and proposes three non-universal entries: `antigravity` -> `~/.gemini/config/skills/`, `antigravity-ide` -> `~/.gemini/antigravity-ide/skills/`, `antigravity-cli` -> `~/.gemini/antigravity-cli/skills/` (symlinked from canonical `~/.agents/skills/` in symlink mode). The PR body says it reported a docs discrepancy to Google about the IDE app-data directory. Not merged. Note that even if merged, `antigravity-cli` would still target the path that field reports say `agy` does not read (section 3).
- The PR body's product-split claims (three sibling products, Homebrew cask history) are third-party and not verified here.

## 3. Field reports contradicting the docs (REPORTED, open upstream issues)

All in <https://github.com/google-antigravity/antigravity-cli/issues>:

- **#864** (open, agy 1.1.19, Windows 11): controlled test with fresh `agy -p` processes and plain directories. `~/.gemini/config/skills/` loaded; `~/.gemini/antigravity-cli/skills/` did **not** load; `~/.gemini/skills/` did not load on Windows. The `/skills` TUI advertises "Workspace / Global `~/.gemini/antigravity-cli/skills/` / Shared `~/.gemini/skills/`" paths. A Google collaborator said `~/.gemini/skills` worked for them on macOS and that on Windows the skill was shown "under `~/.gemini/antigravity-cli/skills/skills.json`". So platform-dependence is possible and not settled.
- **#686** (open, agy 1.1.7 and Antigravity app 2.1.4): `~/.gemini/config/skills/` works for the CLI, IDE, and desktop app; asks whether it is officially supported. A commenter reports `skills add -a antigravity -g` output in `~/.agents/skills/` did not appear or trigger in the app until copied to `~/.gemini/config/skills/`. No Google reply in the thread as of 2026-09-21.
- **#103** (open since 2026-05-21, agy 1.0.0, macOS): skills in `~/.agents/skills/` are not picked up, despite the Agent Skills spec. Workaround reported by two users: symlink from `~/.agents/skills/` into `~/.gemini/antigravity-cli/skills/` or `~/.gemini/skills/` (May 2026, early versions). Workspace `.agents/skills/` worked for the original commenter. The docs do not list `~/.gemini/skills/` at all, yet users found it working in 1.0.x.
- **#1052** (open, agy 1.2.7, Windows): reports workspace `<repo>/.agents/` customizations (skills, hooks, rules, plugins) are never loaded, only global `~/.gemini/config/`, contradicting the shipped guide. Contradicts #103/#173 workspace reports from earlier versions; possibly a regression or Windows-specific.
- **#173** (open): workspace `.agents/skills/` skills are not in autocomplete at startup until `/skills` is run (1.0-era; CHANGELOG 1.2.4 adds `/skills reload`, and 1.0.x entries fixed some reload cases).
- **#216** (open): a skill in `~/.gemini/skills/` or `.agents/skills/` is triggered in the CLI but not in the Antigravity 2 agent runtime.
- **#1067** (open): docs stale on CLI plugin path; see section 1.4.
- **#155** / **#669** (open): requests for a `GEMINI_CLI_HOME`-style override and XDG support. Confirms the root is currently fixed at `~/.gemini`.
- **#36** (open, already known): `--sandbox` combined with `--dangerously-skip-permissions` lets the agent bypass the sandbox. Unrelated to discovery.
- **#403** (open): `agy plugin install`/import copies only some files. Relevant only if plugins become the fallback route.

## 4. The `~/.antigravity/antigravity-cli/` tree

- No primary source I found documents `~/.antigravity/antigravity-cli/`. Google's CLI docs (<https://antigravity.google/docs/cli/using/>) say settings live at `~/.gemini/antigravity-cli/settings.json` and keybindings at `~/.gemini/antigravity-cli/keybindings.json`. The CHANGELOG (1.0.12) also says "`~/.gemini/antigravity-cli/settings.json`". A string search of the `agy` 1.1.20 macOS binary found `~/.gemini/antigravity-cli/settings.json`, `.../hooks.json`, `.../cache/projects.json`, and no `.antigravity/` path (STATIC).
- The maintainer's Mac (agy 1.1.20) has `~/.gemini/antigravity-cli/` with `settings.json` (keys: `enableTelemetry`, `model`, `permissions`, `trustedWorkspaces`) and no `~/.antigravity/` directory.
- This repo references `~/.antigravity/antigravity-cli/settings.json` in `skills/setup-antigravity-devcontainer/SKILL.md` (lines 30, 121) and `templates/yolo-alias-block.sh` (line 8), and mounts a `~/.antigravity` volume in `templates/install-block.sh`. Whether a Linux agy build or a newer agy version uses `~/.antigravity/` is UNVERIFIED. If it does not, those `permissions.allow` instructions write to a file `agy` never reads. That is out of scope for #342 but worth a follow-up check inside the container (`agy` will show which settings file it reads; `find ~ -name settings.json -path '*antigravity*'`).
- For **skill discovery**, no source ties the settings tree to skills. What does matter is the `~/.gemini/` tree: `config/skills/`, `config/skills.json`, `antigravity-cli/skills/`. A persistent container volume that covers only `~/.antigravity` would not preserve any of those; `~/.gemini` would need to be persistent or repopulated on each start (post-start sync already does the latter).

## 5. Do docs and `vercel-labs/skills` agree?

| Target | Google docs (global) | `vercel-labs/skills` README/`globalSkillsDir` | Where v1.7.0 actually writes with `-g` (STATIC) | Reported to be read by `agy` |
|---|---|---|---|---|
| `-a antigravity` | 2.0/IDE: `~/.gemini/config/skills/` (legacy `~/.gemini/antigravity/skills/`) | `~/.gemini/antigravity/skills/` | `~/.agents/skills/` | Not by `agy` per #103; `~/.gemini/antigravity/skills/` has no CLI documentation at all |
| `-a antigravity-cli` | CLI: `~/.gemini/antigravity-cli/skills/` | `~/.gemini/antigravity-cli/skills/` | `~/.agents/skills/` | Docs say yes; #864 (Windows, 1.1.19) says no; `~/.gemini/config/skills/` reported yes |
| Project scope (both) | `<workspace-root>/.agents/skills/` | `.agents/skills/` | `.agents/skills/` | Docs say yes; #1052 (1.2.7, Windows) says no; older reports say yes |

Conclusion: docs and the `vercel-labs/skills` table agree only on paper for `antigravity-cli`. The `antigravity` target's global path matches nothing `agy` documents for the CLI (it is only a legacy IDE path). Independently of the paths, the installer's universal-agent rule means neither target currently writes to its listed global directory.

## 6. What is documented versus unverified

Documented:

- CLI global skills at `~/.gemini/antigravity-cli/skills/` and workspace at `.agents/skills/` (web docs).
- Global customization root `~/.gemini/config/` (bundled `agy-customizations` guide, 2.0/IDE docs, CHANGELOG).
- `skills.json` (workspace `.agents/skills.json`, global `~/.gemini/config/skills.json`) can register arbitrary skill directories, including `~/`-relative paths.
- `agy plugin install` puts plugins in `~/.gemini/config/plugins/` in current versions (maintainer statement, CHANGELOG).

Static findings:

- `vercel-labs/skills` v1.7.0 treats both Antigravity agents as universal, so `-g` goes to `~/.agents/skills/`.
- The `agy` 1.1.20 binary contains `~/.gemini/config/skills/` and `.agents/skills/` strings.

Unverified at runtime (I did not observe these):

- Whether `agy` in the Shared Container (Linux, current agy version, `/home/vscode`) reads `~/.gemini/antigravity-cli/skills/`, `~/.gemini/config/skills/`, `~/.gemini/skills/`, or `~/.agents/skills/`.
- Whether workspace `.agents/skills/` loads on Linux/macOS at agy 1.2.x (contradicted by #1052 on Windows).
- What version of `skills` the container's `npx -y` resolves and therefore where it writes.
- Whether `~/.antigravity/antigravity-cli/` exists or is read in the container.
- Whether `skills.json` in `~/.gemini/config/` reliably pointing at `~/.agents/skills` works (documented, not tried).

## 7. Inputs for the follow-up tickets

Candidates to test in a real `agy` session (#343), in order of documentation strength:

1. `~/.gemini/config/skills/`: best-corroborated by shipped docs, the CHANGELOG, and three independent reports (#686, #864, #1052).
2. `~/.gemini/antigravity-cli/skills/`: the officially documented CLI path, but contradicted by #864.
3. Global `~/.gemini/config/skills.json` with an `entries` path to wherever `skills add` writes (e.g. `~/.agents/skills`): documented mechanism that would decouple discovery from the installer's target.
4. Symlink from `~/.agents/skills/*` into a scanned directory: reported workaround in #103.
5. Project `.agents/skills/` as a fallback, as the map planned; note #1052.

Also for the decision: with the current `--copy -g -a antigravity` line, the post-start wipe `rm -rf ~/.gemini/antigravity/skills/*` probably clears a directory the sync does not populate (STATIC), while `~/.agents/skills/` is not wiped. Check both after the empirical run, because ADR-0007's trust-boundary reasoning depends on the wipe path matching the write path.

Suggested upstream issue (per the map's open question): if `~/.gemini/antigravity-cli/skills/` is confirmed not to be read, file it against `google-antigravity/antigravity-cli` (docs vs. behavior; #864 and #686 are close, so comment rather than duplicate) and comment on vercel-labs/skills#1483 that its `antigravity-cli` target should follow the confirmed path.

## Sources

- Google docs: <https://antigravity.google/docs/skills> (CLI, 2.0, IDE tabs), <https://antigravity.google/docs/plugins?tab=cli>, <https://antigravity.google/docs/cli/using/>
- antigravity-cli repo: <https://github.com/google-antigravity/antigravity-cli> (CHANGELOG.md; issues #36, #103, #123, #155, #173, #216, #403, #498, #669, #686, #864, #1052, #1067)
- Files shipped with agy 1.1.20: `~/.gemini/antigravity-cli/builtin/skills/agy-customizations/SKILL.md` and `docs/json_configs.md`
- vercel-labs/skills: <https://github.com/vercel-labs/skills> (`src/agents.ts`, `src/installer.ts`, README at commit 7407f38; issue #1470; PR #1483)
- This repo: `skills/setup-antigravity-devcontainer/SKILL.md`, `templates/post-start-block.sh`, `.devcontainer/post-start.sh`, ADR-0007
