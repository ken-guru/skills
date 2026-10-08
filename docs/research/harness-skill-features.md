# What Claude Code, Copilot CLI, and Codex offer skills beyond the open format

Research for [#485](https://github.com/ken-guru/skills/issues/485) (map
[#481](https://github.com/ken-guru/skills/issues/481)). It lists what each
harness adds on top of the open [Agent Skills](https://agentskills.io)
format, and what the other two harnesses do when a skill uses that addition.
It makes no decision. Shell-command approval matching is covered in
[#451](https://github.com/ken-guru/skills/issues/451)
([`harness-shell-approvals.md`](https://github.com/ken-guru/skills/blob/research/harness-shell-approvals/skills/presentation/docs/research/harness-shell-approvals.md))
and is only summarised here.

Researched 2026-10-08. Each claim is labelled:

- **Documented**: the vendor's docs or the spec say so.
- **Source**: read from public source code (the spec's `skills-ref`, Codex).
- **Binary**: read from the shipped Copilot CLI bundle (`app.js`, `runtime.node`).
- **Measured**: reproduced here with the installed CLI, offline.
- **Inferred**: a conclusion drawn from the above, not observed directly.
- **Unconfirmed**: no primary source found. Treat as open.

Versions and sources:

- **Open spec**: `agentskills/agentskills@69ef37e` (`docs/specification.mdx`,
  `docs/client-implementation/adding-skills-support.mdx`, `skills-ref`).
  agentskills.io itself refused connections from the research environment, so
  the spec was read from its GitHub source.
- **Claude Code**: docs at code.claude.com read on 2026-10-08 (skills, hooks,
  artifacts); installed CLI 2.1.294.
- **Copilot CLI**: GitHub Docs source (`github/docs` main, 2026-10-08) for the
  current release; bundle and measurements from the installed 1.0.85.
- **Codex**: source at `openai/codex@9b73858` (2026-10-08);
  `codex-cli 0.154.0` for measurements. developers.openai.com was unreachable,
  so Codex claims rest on source, not docs.

## Summary

1. **The open format is six frontmatter fields and a folder.** `name`,
   `description`, `license`, `compatibility`, `metadata` (string→string map),
   and `allowed-tools` (Experimental). Relative paths resolve from the skill
   root. The spec defines no variables, no invocation syntax, no subagents,
   no hooks (Documented).
2. **All three harnesses ignore frontmatter keys they don't know.** Measured:
   a skill carrying every Claude Code-only key (`hooks`, `context: fork`,
   `arguments`, `paths`, …) loaded in Copilot 1.0.85 and Codex 0.154.0, and
   Claude Code documents silent ignoring. The strict validators are the
   exception: the spec's `skills-ref validate`, claude.ai upload and the Skills
   API, `package_skill.py`, and Codex's bundled `skill-creator` validator
   reject unknown keys with an error (Documented, Source).
3. **Claude Code is by far the richest.** Frontmatter adds invocation control,
   arguments, per-skill model and effort, forked subagents, session hooks,
   path scoping, and pre-render shell injection (`` !`cmd` ``). The body gets
   `${CLAUDE_SKILL_DIR}` and other substitutions. Published artifacts give
   rich output, including a Claude Slides template behind `/slides`
   (Documented).
4. **Copilot CLI reads a Claude-shaped subset.** It honours `allowed-tools`,
   `argument-hint`, `user-invocable`, and `disable-model-invocation`. It
   substitutes nothing: it prepends `Base directory for this skill: <dir>`
   and appends `ARGUMENTS: <args>` (Documented, Binary). Hooks and custom
   agents exist, but only outside skills.
5. **Codex reads only `name`, `description`, and
   `metadata.short-description` from SKILL.md.** Its extras live in a sidecar,
   `agents/openai.yaml`: UI interface, MCP dependencies, and
   `policy.allow_implicit_invocation`. Skills are invoked as `$skill-name`,
   and Codex does no substitution or injection (Source).
6. **No one location reaches all three.** Claude Code reads `.claude/skills`.
   Copilot reads `.claude/skills`, `.agents/skills` and `.github/skills`.
   Codex reads `.agents/skills` (and `.codex/skills`), not `.claude/skills`
   (Documented, Source).
7. **Safe enrichments are additive metadata**, such as `disable-model-invocation`
   paired with Codex's `allow_implicit_invocation: false`, plus `argument-hint`,
   `model`, `effort`, and `agents/openai.yaml`. **Risky ones change what the
   model reads or runs.** These are `${CLAUDE_SKILL_DIR}` and `$ARGUMENTS`/`$0`
   in the body, `` !`cmd` `` injection, frontmatter `hooks` that enforce
   something, `allowed-tools`, `when_to_use`, and a non-map `metadata`
   (Inferred; see the [table](#safe-and-risky-enrichments)).

## 1. The open format (baseline)

From [`docs/specification.mdx`](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/specification.mdx)
(Documented):

| Field | Required | Constraint |
| :- | :- | :- |
| `name` | Yes | 1–64 chars, lowercase `a-z0-9-`, no leading, trailing or double hyphen, must match the directory |
| `description` | Yes | 1–1024 chars |
| `license` | No | Short licence name or bundled file |
| `compatibility` | No | 1–500 chars, environment requirements |
| `metadata` | No | "A map from string keys to string values". "Clients can use this to store additional properties not defined by the Agent Skills spec" |
| `allowed-tools` | No | Space-separated. "Experimental. Support for this field may vary between agent implementations" |

- Optional `scripts/`, `references/`, `assets/`. "When referencing other files
  in your skill, use relative paths from the skill root" (Documented).
- `skills-ref validate` fails on any other key: "Unexpected fields in
  frontmatter: … Only [...] are allowed." (Source,
  `skills-ref/src/skills_ref/validator.py`).
- The client-implementation guide asks clients to be lenient: warn on
  cosmetic issues and load anyway, and skip only a missing description or
  unparseable YAML. It names `/skill-name` or `$skill-name` as common explicit
  invocation syntax, "subagent delegation" as an optional advanced pattern,
  and `disable-model-invocation` as a reason to hide a skill from the catalog.
  It recommends scanning `.agents/skills/` at project and user level for
  interoperability (Documented, `adding-skills-support.mdx`).

## 2. Claude Code

All from [Extend Claude with skills](https://code.claude.com/docs/en/skills)
unless noted (Documented).

### 2.1 Frontmatter beyond the spec

"Claude Code ignores a field it doesn't recognize without reporting an
error." Unparseable YAML still loads the skill, with no fields set.

| Field | Effect |
| :- | :- |
| `when_to_use` | Appended to `description` in the listing. The combined text is cut at 1,536 chars |
| `argument-hint` | Autocomplete hint |
| `arguments` | Named positional args for `$name` substitution |
| `disable-model-invocation` | Claude can't auto-invoke. The description leaves context. Also blocks subagent preload and scheduled-task firing |
| `user-invocable: false` | Hidden from `/` menu. Only Claude invokes |
| `allowed-tools` | Pre-approves tools **for the invoking turn only**. `${CLAUDE_SKILL_DIR}` expands inside `Bash(...)` rules |
| `disallowed-tools` | Removes tools while the skill is active |
| `model`, `effort` | Per-turn override (`low`…`max`) |
| `context: fork`, `agent`, `background` | Run the skill as a subagent task (Explore, Plan, general-purpose, or a custom agent). It runs in the background by default |
| `hooks` | Hooks registered on invocation that **last for the rest of the session**. `once: true` removes one after its first run |
| `paths` | Globs. Auto-load only when working on matching files |
| `shell` | `bash` or `powershell` for injected commands |
| `metadata` | Ignored. "drops a value that isn't a map" |
| `license`, `compatibility` | Accepted, not acted on |

Uploading the same skill to claude.ai or the Skills API, or packaging it with
`package_skill.py`, allows only the six spec fields. Any other key is a hard
error: "Unexpected key(s) in SKILL.md frontmatter: argument-hint. Allowed
properties are: …". "Claude Code-only body features, such as dynamic context
injection, don't function in claude.ai chat or through the API."

### 2.2 Directory and body variables

Substituted in the skill body (and the first two in `allowed-tools`):
`${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_SESSION_ID}`,
`${CLAUDE_EFFORT}`. In plugin skills also `${CLAUDE_PLUGIN_ROOT}` and
`${CLAUDE_PLUGIN_DATA}`. Arguments: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, and
`$name`. "When no placeholder receives an argument, Claude Code appends them as
`ARGUMENTS: <value>`." Separately, "the skill directory path is prepended to
SKILL.md, so Claude can read bundled files by name"
([.claude directory](https://code.claude.com/docs/en/claude-directory)).

### 2.3 Dynamic context injection

`` !`command` `` (inline) or a ` ```! ` block runs **before** the content
reaches the model, and the output replaces the placeholder. A failing command
aborts the whole invocation. Injected commands never prompt. They are checked
against permission rules, and outside auto mode anything short of "allow"
aborts the invocation, so `allowed-tools` must pre-approve them. Synced
claude.ai skills under `disableSkillShellExecution` get
`[shell command execution disabled by policy]`.

### 2.4 Subagents

`context: fork` hands SKILL.md to a new subagent as its task. The subagent
doesn't see the conversation history. Built-in Explore and Plan skip
CLAUDE.md. A backgrounded fork gets a narrower tool set, and its edits bypass
checkpoints. The reverse direction is a custom subagent's `skills` field,
which preloads full skill content
([sub-agents](https://code.claude.com/docs/en/sub-agents)). Without
`context: fork`, a skill can still tell Claude to use the `Agent` tool.

### 2.5 Hooks

Skill `hooks` use the settings format (`PreToolUse` with a `matcher` and
`type: command`). They register on invocation and "keep running for the rest
of the session". In a project skill they follow the workspace-trust rule for
settings hooks, and they are "registered … including in a `-p` run in a
folder you haven't trusted"
([hooks](https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents)).

### 2.6 Rich output

[Artifacts](https://code.claude.com/docs/en/artifacts): Claude publishes an
HTML or Markdown page to a private claude.ai URL that updates in place. It can
be shared, can carry live MCP-connector data, and can start from Claude Slides,
Design, or Docs templates. `/slides <brief>` makes a Claude Slides deck that
exports to PowerPoint or PDF. Requirements: Pro, Max, Team, or Enterprise; a
`/login` claude.ai session (not an API key, gateway, Bedrock, Vertex, or
Foundry); not ZDR, HIPAA, or CMEK; CLI or desktop. Off by default in the Agent
SDK and GitHub Action. "When one is not met, Claude writes a local HTML file
or says it cannot publish instead." Templates are beta. On Enterprise an Owner
must turn each one on. Output styles and the status line exist too, but they
are user settings, not skill features.

### 2.7 Scripts and approvals (from #451)

`Bash(...)` rules match the full command text per segment. "Don't ask again"
saves a rule to `.claude/settings.local.json`. `allowed-tools` lasts for one
turn and expands `${CLAUDE_SKILL_DIR}`. Heredoc stdin and `$(…)` defeat allow
rules.

### 2.8 Invocation

`/name args` at the start of a message runs it. `/name` later in the message
is permission for Claude to run it. Up to six skills can be stacked. The model
invokes skills through the `Skill` tool. Plugin skills are `/plugin:name`.
Locations: managed, `~/.claude/skills`, `.claude/skills` (nested, and under
`--add-dir`), and plugins. **Not** `.agents/skills`.

## 3. GitHub Copilot CLI

From the [CLI command reference](https://github.com/github/docs/blob/main/content/copilot/reference/copilot-cli-reference/cli-command-reference.md)
("Skills reference") and
[Adding agent skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)
unless noted.

### 3.1 Frontmatter beyond the spec

Documented fields: `name` (letters, numbers, `-`, `_`, `.`, `:` and spaces,
max 64), `description` (max 1024), `argument-hint`, `allowed-tools` (string
or list, `"*"` for all), `user-invocable`, and `disable-model-invocation`. The
loaded skill record holds only `name, description, source, filePath, baseDir,
allowedTools, content, userInvocable, disableModelInvocation, isCommand,
argumentHint, pluginName, …` (Binary, 1.0.85). No `hooks`, `context`,
`model`, `paths`, or `arguments`.

Measured (1.0.85, `copilot skill list --json`, project `.agents/skills`): a
skill with every Claude Code-only key loaded and was enabled. So did a skill
with `metadata` as a list and one with non-string metadata values.

### 3.2 Directory variables and arguments

No substitution. The bundle has no `CLAUDE_SKILL_DIR` or `$ARGUMENTS`
handling (Binary). On invocation the content goes into
`<skill-context name="…">`, with `Base directory for this skill: <dir>`
before it and `ARGUMENTS: <args>` after it (Binary, `runtime.node` strings).
#451 measured that `${CLAUDE_SKILL_DIR}` in `allowed-tools` is **not**
expanded. Docs tell authors to say "run the script from this skill's base
directory". When the model reads a literal `${CLAUDE_SKILL_DIR}/scripts/x` and
runs it, bash expands the unset variable to an empty string (Inferred).

### 3.3 Dynamic context injection

None. `` !`cmd` `` reaches the model as literal text (Binary: no such
handling; Inferred).

### 3.4 Subagents

Built-in `explore`, `task`, `general-purpose`, `code-review`,
`security-review`, `research`, and `rubber-duck`. Custom agents are
`*.agent.md` files in `~/.copilot/agents`, `.github/agents`, `.claude/agents`,
or a plugin's `agents/`, with frontmatter `description`, `tools`, `model`,
`infer`, `mcp-servers`, and `include-custom-instructions`. The model dispatches
them with the `task` tool. `/fleet` runs parallel subagents. There is no
skill-level fork: a skill can only *ask* the model to use `task` (Documented).

### 3.5 Hooks

Hooks come from `.github/hooks/*.json`, user config, and plugin `hooks.json`
([hooks reference](https://github.com/github/docs/blob/main/content/copilot/reference/hooks-reference.md)).
PascalCase `PreToolUse` gets Claude matcher semantics and Claude tool names
(`Bash`, `Read`, `Write`) "as used in Claude Code plugins". Skills cannot
declare hooks. Frontmatter `hooks` are ignored (Documented, Binary).

### 3.6 Rich output

None documented for skills: terminal output and image attachments only. The
bundle ships a webview module, but no skill-facing rendering surface is
documented (Unconfirmed).

### 3.7 Scripts and approvals (from #451)

Approvals match a command identifier (the program token). `allowed-tools`
applies for the session, in interactive mode only, and maps `Bash(x:*)` to
`shell(x:*)`. Scripts outside cwd raise a separate "Allow directory access"
prompt, which only `--add-dir` lifts.

### 3.8 Invocation

`/skill-name args`, or name it in the prompt ("Use the /frontend-design
skill…"). The model invokes skills through the `skill` tool. Manage them with
`/skills list|info|add|remove|reload` and `copilot skill …`. Skills run from
`/every` and `/after` schedules. Plugin skills clash-resolve to
`/plugin/name`. Locations: `.github/skills`, `.agents/skills`,
`.claude/skills` (project); `~/.copilot/skills`, `~/.agents/skills`
(personal); plugins; `COPILOT_SKILLS_DIRS`; `--add-dir`. `.claude/commands/*.md`
also load as commands. Plugin manifests are read from `plugin.json`,
`.plugin/plugin.json`, or `.claude-plugin/plugin.json`
([plugin reference](https://github.com/github/docs/blob/main/content/copilot/reference/copilot-cli-reference/cli-plugin-reference.md)).

## 4. OpenAI Codex CLI

All Source at `openai/codex@9b73858` unless noted.

### 4.1 Frontmatter and the `agents/openai.yaml` sidecar

[`skills/src/parser.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/skills/src/parser.rs)
deserialises only `name` (falls back to the directory name, max 64),
`description` (required), and `metadata.short-description`. serde ignores
every other key. It repairs unquoted `description: foo: bar` lines before
giving up on bad YAML.

Measured (0.154.0, `codex debug prompt-input`, project `.agents/skills`):

- The skill with all Claude Code-only keys appeared in the model's skill list,
  **including `disable-model-invocation: true`**. Codex doesn't honour it, so
  the model may auto-trigger the skill.
- A skill with `metadata: [a, b]` (a list) **was silently dropped** from the
  list. `metadata` must deserialise as a map. Non-string values inside a map
  loaded fine.

Codex's extras live in `<skill>/agents/openai.yaml`
([`loader/metadata.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/ext/skills/src/loader/metadata.rs),
[`openai_yaml.md`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/skills/src/assets/samples/skill-creator/references/openai_yaml.md)).
A bad file is ignored and the skill still loads:

- `interface`: `display_name`, `short_description`, `icon_small`,
  `icon_large`, `brand_color`, `default_prompt` (UI only).
- `dependencies.tools[]`: MCP servers the skill needs (`type: mcp`, `value`,
  `transport`, `url`).
- `policy.allow_implicit_invocation`: "When false, the skill is not injected
  into the model context by default, but can still be invoked explicitly via
  `$skill`." `policy.products` limits which products load it.

The bundled `skill-creator/scripts/quick_validate.py` allows only `name`,
`description`, `license`, `allowed-tools`, and `metadata`. It rejects even the
spec's `compatibility`.

### 4.2 Directory variables and arguments

None. The catalog gives each skill a path (`file: r2/<name>/SKILL.md` with a
`### Skill roots` alias table), and the model reads SKILL.md with its file
tools. An explicitly mentioned skill is injected as
`<skill><name>…</name><path>…</path>…contents…</skill>`
([`fragments.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/ext/skills/src/fragments.rs)).
The built-in usage text says: "When `SKILL.md` references relative paths
(e.g., `scripts/foo.py`), resolve them relative to the directory containing
that expanded `SKILL.md` first"
([`catalog_prompt.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/ext/skills/src/catalog_prompt.rs)).
Arguments are just the rest of the user message. `$ARGUMENTS`, `$0`, and
`${CLAUDE_SKILL_DIR}` stay literal.

### 4.3 Dynamic context injection

None. `` !`cmd` `` is literal text.

### 4.4 Subagents

Multi-agent tools (`spawn_agent`, `followup_task`, `send_message`) with
built-in roles (`default`, `explorer`, `worker`) and user roles from config
(`[agents.<role>]` with `description`, `config_file`, and
`nickname_candidates`; the role's config layer can set
`developer_instructions`)
([`agent/role.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/core/src/agent/role.rs),
`core/config.schema.json`).
Skills have no fork field. Codex's skill instructions say: "Do not delegate
reading, summarizing, or interpreting skill instructions to a subagent.
Subagents may still perform task work when the selected skill allows it." They
also say "Do not carry skills across turns unless re-mentioned."

### 4.5 Hooks

`hooks.json` in config folders (user `~/.codex`, project `.codex`) and plugin
hook sources. Plugin hooks get `PLUGIN_ROOT`, plus `CLAUDE_PLUGIN_ROOT` "for
OOTB compat with existing plugins"
([`hooks/src/engine/discovery.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/hooks/src/engine/discovery.rs)).
Skills cannot declare hooks.

### 4.6 Rich output

None for skills. The system `imagegen` skill generates bitmap images. Codex
plugins use `.codex-plugin/plugin.json`.

### 4.7 Scripts and approvals (from #451)

Under the default `on-request` policy, unmatched commands run sandboxed with no
prompt. `prefix_rule`s live in `~/.codex/rules`. Nothing reads `allowed-tools`.
The usage text tells the model: "If `scripts/` exist, prefer running or
patching them instead of retyping large code blocks."

### 4.8 Invocation

`$skill-name` in the message (`TOOL_MENTION_SIGIL = '$'`,
[`mentions.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/skills/src/mentions.rs)),
the plain name, or a description match. `/skills` in the TUI. Locations
([`host_roots.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/ext/skills/src/host_roots.rs)):
`.agents/skills` in every directory from the project root to cwd, and the
project `.codex/skills`; `~/.agents/skills` and deprecated
`$CODEX_HOME/skills`; system and admin roots; plugins. **Not** `.claude/skills`.

## 5. Cross-harness behaviour per feature

"Ignored" means the skill loads and the key has no effect.

| Feature (origin) | Claude Code | Copilot CLI | Codex |
| :- | :- | :- | :- |
| Unknown frontmatter key | Ignored (Documented) | Ignored; loads (Measured) | Ignored; loads (Measured) |
| `metadata` not a map | Value dropped, skill loads (Documented) | Loads (Measured) | **Skill silently dropped** (Measured) |
| `description` > 1024 chars | Allowed up to 1,536 combined with `when_to_use` | Max 1024 (Documented); over-limit behaviour Unconfirmed | No length check on SKILL.md found (Source) |
| `allowed-tools` (spec, experimental) | One-turn grant; `${CLAUDE_SKILL_DIR}` expands | Session grant, interactive only; no expansion; `Bash(x:*)`→`shell(x:*)` | Ignored |
| `disable-model-invocation` (Claude) | Honoured | Honoured (Documented) | **Ignored**; use `agents/openai.yaml` `policy.allow_implicit_invocation: false` |
| `user-invocable` (Claude) | Honoured | Honoured (Documented) | Ignored |
| `argument-hint` (Claude) | Autocomplete | Skill picker (Documented) | Ignored |
| `when_to_use` (Claude) | Appended to description | Ignored: trigger text lost | Ignored: trigger text lost |
| `arguments` + `$name`, `$0`, `$ARGUMENTS` (Claude) | Substituted | Literal; args appended as `ARGUMENTS: …` | Literal; args are the user message |
| `${CLAUDE_SKILL_DIR}` in body (Claude) | Substituted | Literal; `Base directory…` header given | Literal; path given in catalog and `<path>` |
| `` !`cmd` `` injection (Claude) | Runs pre-render; failure or unapproved command aborts invocation | Literal text | Literal text |
| `model`, `effort` (Claude) | Per-turn override | Ignored | Ignored |
| `context: fork` / `agent` (Claude) | Runs as subagent with no history | Ignored: runs inline | Ignored: runs inline |
| `hooks` (Claude) | Session-long hooks from invocation | Ignored | Ignored |
| `paths` (Claude) | Auto-load gated by globs | Ignored: always eligible | Ignored: always eligible |
| `shell` / `disallowed-tools` (Claude) | Honoured | Ignored | Ignored |
| `agents/openai.yaml` (Codex) | Not read (an inert file) (Inferred) | Not read (Inferred) | UI, MCP deps, implicit-invocation policy |
| Invocation | `/name` | `/name` | `$name` |
| Project location | `.claude/skills` | `.github/`, `.agents/`, `.claude/skills` | `.agents/skills`, `.codex/skills` |
| Rich output | Artifacts, Slides/Docs/Design templates (plan- and login-gated) | None | None |

## Safe and risky enrichments

**Safe** helps one harness and is harmless in the others. **Risky** gives
another harness an error, a lost guarantee, or different behaviour the user
would notice.

| Enrichment | Helps | Elsewhere | Verdict |
| :- | :- | :- | :- |
| `disable-model-invocation: true` + `agents/openai.yaml` `policy.allow_implicit_invocation: false` | Claude, Copilot / Codex | Each harness reads its own key | **Safe as a pair**. Alone, Codex still auto-triggers |
| `user-invocable: false` | Claude, Copilot | Codex ignores (still model-invocable, the intent) | Safe |
| `argument-hint` | Claude, Copilot | Codex ignores | Safe |
| `model`, `effort` | Claude | Ignored | Safe (a tuning hint only) |
| `paths` | Claude | Ignored; skill always eligible | Safe if the description is also scoped |
| `agents/openai.yaml` `interface`, `dependencies` | Codex | Not read by the others | Safe |
| `metadata` as string→string map | Tooling | Read or ignored | Safe |
| `compatibility`, `license` | Spec | Accepted | Safe for loading, but Codex's `quick_validate.py` rejects `compatibility` |
| `context: fork` + `agent` | Claude: isolation | Runs inline in the main context | Safe **only** if the body is a self-contained task and still reads well inline |
| `hooks` (advisory, such as a reminder) | Claude | Silently absent | Safe-ish. **Risky** when the hook enforces a guarantee the skill relies on |
| `when_to_use` | Claude | Trigger text lost, so the skill may not fire | **Risky**. Put trigger text in `description` |
| `${CLAUDE_SKILL_DIR}` in body or commands | Claude | Literal. The shell expands an unset variable to empty, so the path is wrong | **Risky**. Use spec-style relative paths ("`scripts/x` in this skill's directory") |
| `$ARGUMENTS`, `$0`, `$name` | Claude | Literal placeholders reach the model | **Risky**. Both Claude and Copilot append `ARGUMENTS: …` when no placeholder is used, and Codex sees the raw message |
| `` !`cmd` `` / ` ```! ` injection | Claude: pre-computed context | Literal text. The model may run it, skip it, or be confused. In Claude a failure or unapproved command aborts the skill | **Risky** |
| `allowed-tools` | Claude (one turn), Copilot (session) | Different syntax and semantics; Codex ignores; portable values pre-approve arbitrary code (#451) | **Risky** |
| `metadata` not a map | — | Codex drops the skill silently | **Risky** (an error in effect) |
| Non-spec keys at all | Claude, Copilot | Claude.ai upload, Skills API, `skills-ref validate`, and Codex `quick_validate.py` hard-fail | **Risky for distribution** beyond the three CLIs |
| Artifacts / `/slides` as the output path | Claude (eligible plans, signed in) | Not available | **Risky** as the only path. Safe as an optional extra with a file-based default |
| Skill only in `.claude/skills` | Claude, Copilot | Codex never sees it | **Risky**. Also install to `.agents/skills` |

## Implications (input to #490 and the presentation rebuild)

- Keep SKILL.md frontmatter to the spec's six fields plus, where useful,
  `disable-model-invocation`, `user-invocable`, and `argument-hint`. Pair
  `disable-model-invocation` with a Codex `agents/openai.yaml` policy
  (Inferred).
- Write bodies in the spec's dialect: relative paths from the skill root, no
  `$ARGUMENTS`, no `${CLAUDE_SKILL_DIR}`, no `` !`cmd` ``. Every harness
  already tells the model where the skill directory is (Inferred).
- Treat Claude-only behaviour (`context: fork`, `hooks`, artifacts) as an
  optional layer. The skill must still be correct when the layer is missing
  (Inferred).
- For a presentation skill, Claude Code's `/slides` and Claude Slides
  artifacts are a native rich-output path, but they are plan-, login-, and
  provider-gated. A file-based deck must stay the default (Inferred).

## Open questions

- Does an `allowed-tools` value that Copilot can't parse fail the skill, or
  only log a warning? The bundle shows a warning path ("has unknown tools in
  allowed-tools") (Binary). Not measured end to end.
- Does Copilot enforce the 1024-character `description` limit by truncating
  or by rejecting the skill? (Unconfirmed)
- Does Copilot honour `disable-model-invocation` by hiding the skill from the
  catalog, or by blocking it at call time? (Documented as honoured; mechanism
  Unconfirmed.)
- A Claude Code plugin with a `.claude-plugin/plugin.json` is partly readable
  by Copilot (manifest location, Claude-format hooks) and by Codex
  (`CLAUDE_PLUGIN_ROOT` env for hooks; a migration path for Claude plugins).
  How far one plugin package can serve all three is unresearched.

## Reproduction

- Copilot: probe skills in a project's `.agents/skills`, then
  `COPILOT_OFFLINE=true copilot skill list --json` from that directory.
- Codex: the same directory (git-initialised), then
  `CODEX_HOME=<tmp> codex debug prompt-input '$probe-rich hello'`. Read the
  `<skills_instructions>` developer message.
- Probe set: `probe-rich` (every Claude Code-only key plus `${CLAUDE_SKILL_DIR}`,
  `$ARGUMENTS`, and `` !`echo` `` in the body), `probe-plain`, `probe-meta`
  (non-string metadata values), and `probe-list-meta` (`metadata: [a, b]`).

## Sources

- Agent Skills spec source:
  [`specification.mdx`](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/specification.mdx),
  [`adding-skills-support.mdx`](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/client-implementation/adding-skills-support.mdx),
  [`skills-ref/validator.py`](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref/src/skills_ref/validator.py).
- Anthropic:
  [Claude Code skills](https://code.claude.com/docs/en/skills),
  [hooks](https://code.claude.com/docs/en/hooks),
  [sub-agents](https://code.claude.com/docs/en/sub-agents),
  [artifacts](https://code.claude.com/docs/en/artifacts),
  [.claude directory](https://code.claude.com/docs/en/claude-directory),
  [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview),
  [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).
- GitHub:
  [Adding agent skills for Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills),
  [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills),
  [CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference),
  [hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference),
  [CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference);
  Copilot CLI 1.0.85 bundle (`app.js`, `prebuilds/linux-arm64/runtime.node`).
- OpenAI Codex source at
  [`openai/codex@9b73858`](https://github.com/openai/codex/tree/9b738582b13c2cdbeff54af0afd04c50c3e7ba09):
  files linked inline above.
- Prior research:
  [#451 `harness-shell-approvals.md`](https://github.com/ken-guru/skills/blob/research/harness-shell-approvals/skills/presentation/docs/research/harness-shell-approvals.md).
