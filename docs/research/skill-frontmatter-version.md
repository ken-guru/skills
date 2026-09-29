# Where a version marker can live in `SKILL.md` frontmatter

Research for [#427](https://github.com/ken-guru/skills/issues/427) (map
[#424](https://github.com/ken-guru/skills/issues/424)). It records facts only.
The decision belongs to [#430](https://github.com/ken-guru/skills/issues/430).

Researched 2026-09-29. Each claim is labelled:

- **Spec**: the Agent Skills specification or its reference validator.
- **Documented**: the harness's own docs, help text, or bundled changelog.
- **Source**: read from the harness's published source code.
- **Binary**: read from strings in a closed-source binary.
- **Measured**: reproduced here with the fixtures in [Reproduction](#reproduction).
- **Reported**: a public issue, not reproduced here.

Versions measured: Claude Code **2.1.284**, GitHub Copilot CLI **1.0.89-5**,
Codex CLI **0.157.1** (source read at `rust-v0.158.0`), Antigravity CLI
**1.2.7**. All on macOS arm64.

## Summary

| Frontmatter | Spec / `skills-ref` | Claude Code | Copilot CLI | Codex | Antigravity |
|---|---|---|---|---|---|
| top-level `version: 1.2.3` (any form) | **invalid** | loads | loads | loads | loads |
| `metadata: {version: "1.2.3"}` | valid (the spec's own example) | loads | loads | loads | loads |
| `metadata: {version: 1.2}` (unquoted number) | spec says string; `skills-ref` coerces and passes | loads | loads | loads | loads |
| `metadata: {version: {major: 1}}` (nested map) | spec says string; `skills-ref` coerces and passes | loads | loads | loads | **skill dropped** |
| `metadata: "1.2.3"` (not a map) | spec says map; `skills-ref` does not check | loads, `metadata` dropped | loads | **skill dropped** | **skill dropped** |
| unrelated unknown key (`x-custom-key`) | **invalid** | loads | loads | loads | loads |
| Harness reads or shows a skill version | n/a | no documented use | no | no | no |

1. **`metadata.version` as a quoted string is the one placement that is valid
   under the spec and loads in all four harnesses** (Spec, Measured).
2. **A top-level `version` key loads everywhere but fails the spec's
   validator and Anthropic's upload paths.** `skills-ref validate` and
   claude.ai upload, the Skills API and `package_skill.py` all reject it as an
   unexpected key (Spec, Documented).
3. **The value shape under `metadata` matters.** Antigravity drops the whole
   skill when a `metadata` value is not a scalar, and Codex and Antigravity
   both drop it when `metadata` itself is not a map. Both failures are silent
   in normal output (Measured).
4. **No harness reads a skill version for anything the user can see.** None
   documents one. Claude Code's binary copies a top-level `version` into an
   internal field, but no documented feature uses it (Binary).
5. **Copilot CLI's past strictness is fixed.** Before 0.0.403 it silently
   skipped a skill with an unknown frontmatter key. It then warned, and since
   1.0.3 it ignores the key silently (Documented, Reported).

## 1. The Agent Skills specification

The [specification](https://agentskills.io/specification) defines six
frontmatter fields: `name`, `description`, `license`, `compatibility`,
`metadata` and `allowed-tools`. There is no `version` field (Spec).

`metadata` is "a map from string keys to string values". "Clients can use this
to store additional properties not defined by the Agent Skills spec", and the
spec recommends "making your key names reasonably unique to avoid accidental
conflicts". Its only example is a version:

```yaml
metadata:
  author: example-org
  version: "1.0"
```

The reference validator,
[`skills-ref`](https://github.com/agentskills/agentskills/tree/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref)
(commit `69ef37e`), rejects any other top-level key.
[`validator.py`](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref/src/skills_ref/validator.py)
holds `ALLOWED_FIELDS` with the six names and reports
`Unexpected fields in frontmatter: …`.
[`parser.py`](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/skills-ref/src/skills_ref/parser.py)
coerces each `metadata` key and value with `str()` when `metadata` is a map,
so an unquoted `1.2` becomes the string `"1.2"`, and a nested map becomes its
Python string form. The validator never checks the type of `metadata`
(Source).

Versioning is an open proposal, not part of the spec:
[agentskills#46 "support versioning/locking"](https://github.com/agentskills/agentskills/issues/46)
(open; one comment proposes top-level `schema-version` and `version` keys),
[PR #380 "add optional skill versioning to .well-known spec"](https://github.com/agentskills/agentskills/pull/380)
(open), and a `product-version` field proposal
([#227](https://github.com/agentskills/agentskills/issues/227)/[#228](https://github.com/agentskills/agentskills/pull/228)),
closed in favour of a discussion.

## 2. Claude Code

Documented in
[Extend Claude with skills, Frontmatter reference](https://code.claude.com/docs/en/skills#frontmatter-reference):

- "Claude Code ignores a field it doesn't recognize without reporting an
  error." `version` is not in the field table.
- `metadata`: "Free-form YAML map for your own key-value data … read by your
  own tooling from `SKILL.md`. Claude Code doesn't act on its contents, and
  drops a value that isn't a map."
- If the YAML doesn't parse, "the skill still loads with no fields set".
- Outside Claude Code (claude.ai skill uploads, the Skills API, and
  `package_skill.py` from anthropics/skills) only the six spec fields are
  allowed: "If you include any field the spec doesn't allow, packaging or
  upload fails with a hard error instead of ignoring the field":
  `Unexpected key(s) in SKILL.md frontmatter: … Allowed properties are: allowed-tools, compatibility, description, license, metadata, name`.

Measured: all nine fixtures appear in Claude Code's skill listing, including
`vt-meta-scalar` and `vt-meta-nested`.

Binary: the 2.1.284 frontmatter parser contains
`version:e.version!=null?String(e.version):void 0` beside the documented
fields and `metadata:G(e.metadata)?e.metadata:void 0`. So a top-level
`version` is read into an internal field. This note found no documented
feature that shows or uses it.

Beside the skill: a Claude Code **plugin** has a documented version. The
[plugin manifest](https://code.claude.com/docs/en/plugins-reference#version)
field `version` is "a version string, not checked against semver. Setting it
pins the plugin to that version until you change it". It applies to the whole
plugin, not to one skill (Documented).

## 3. GitHub Copilot CLI

Documented:
[Creating agent skills for GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-skills)
lists `name`, `description`, `license` and `allowed-tools`. It says nothing
about `metadata`, `version` or unknown keys.

The CLI's bundled `changelog.json` (1.0.89-5) records how it treats unknown
keys:

| Version | Entry |
|---|---|
| 0.0.403 | "Skills with unknown frontmatter fields now load with warnings instead of being silently skipped" |
| 0.0.410 | "make name and description optional in skill frontmatter with sensible fallbacks" |
| 1.0.3 | "Suppress unknown field warnings in skill and command frontmatter" |
| 1.0.48 | "Skill content injected to the model no longer includes YAML frontmatter metadata" |

Reported bugs, all closed:

- [copilot-cli#951](https://github.com/github/copilot-cli/issues/951): skills
  with `metadata` as the last frontmatter field were not discovered (0.0.380).
  Closing comment: "unknown fields like `metadata:` are silently ignored rather
  than causing a discovery failure."
- [copilot-cli#894](https://github.com/github/copilot-cli/issues/894):
  validation required `license`, which the spec makes optional.
- [copilot-cli#1631](https://github.com/github/copilot-cli/issues/1631):
  "unknown field ignored" startup warnings, including for `version` in
  `claude-plugins-official` skills (v0.0.414). Closed as completed; the 1.0.3
  entry above suppresses the warnings.

Measured: `copilot skill list --json` lists all nine fixtures as
`"enabled": true`. Its output has no version field. Since 1.0.48 the model
does not receive the frontmatter at all when a skill is loaded (Documented).

## 4. Codex

Documented: [Build skills](https://learn.chatgpt.com/docs/build-skills)
(redirected from `developers.openai.com/codex/skills`) names only `name` and
`description` as frontmatter. Optional UI and policy data lives beside the
skill in `agents/openai.yaml` (`interface`, `policy`, `dependencies`), which
has no version key.

Source (`openai/codex` at `rust-v0.158.0`):

- [`codex-rs/skills/src/parser.rs`](https://github.com/openai/codex/blob/rust-v0.158.0/codex-rs/skills/src/parser.rs)
  deserializes the frontmatter into `SkillFrontmatter { name, description,
  metadata: SkillFrontmatterMetadata }` with serde. There is no
  `deny_unknown_fields`, so other top-level keys are ignored.
  `SkillFrontmatterMetadata` reads only `metadata.short-description`, so other
  keys under `metadata` are ignored too.
- Because `metadata` is deserialized into a struct, a `metadata` value that is
  not a map is a YAML error, and the skill fails to parse.
- [`model.rs`](https://github.com/openai/codex/blob/rust-v0.158.0/codex-rs/skills/src/model.rs)'s
  `SkillMetadata` has no version field.
- A failed skill is reported only as a TUI startup warning,
  "Skipped loading {n} skill(s) due to invalid SKILL.md files."
  ([`startup_prompts.rs`](https://github.com/openai/codex/blob/rust-v0.158.0/codex-rs/tui/src/app/startup_prompts.rs)).

Measured: `codex debug prompt-input` lists eight fixtures in the model-visible
skill catalog. `vt-meta-scalar` is missing. No version text appears in the
catalog, whose entries are `name: description (file: …)`. The model reads the
`SKILL.md` file itself when it uses a skill, so it would see the raw
frontmatter then (inferred from the `file:` pointer).

## 5. Antigravity

Documented: [Agent Skills](https://antigravity.google/docs/skills) lists `name`
and `description` only. The CLI's bundled changelog (`agy changelog`, 1.2.7)
adds two skill keys: `disable-slash-command: true`, and "emoji icons declared
under `metadata.icon` in `SKILL.md` frontmatter" (added in 1.1.20). So
Antigravity parses `metadata` and uses one key in it. No entry mentions a
version.

Measured: asked to list its skills, `agy -p` named seven fixtures.
`vt-meta-nested` and `vt-meta-scalar` were missing. The CLI log
(`~/.gemini/antigravity-cli/log/cli-*.log`) shows why:

```text
E skills.go:242] Failed to parse skill file …/vt-meta-nested/SKILL.md: failed to decode frontmatter: yaml: unmarshal errors:
  line 5: cannot unmarshal !!map into string
E skills.go:242] Failed to parse skill file …/vt-meta-scalar/SKILL.md: failed to decode frontmatter: yaml: unmarshal errors:
  line 3: cannot unmarshal !!str `1.2.3` into workflowparse.SkillMetadataConfig
```

So Antigravity decodes `metadata` as a map from string to string and rejects
the whole skill on a type mismatch. Unknown top-level keys, including
`version`, load. An unquoted number under `metadata` decodes into a string
and loads.

Reported:
[antigravity-cli#1056](https://github.com/google-antigravity/antigravity-cli/issues/1056)
(open, 1.2.7) says skill parse failures appear only in that log, never to the
user.

## Reproduction

Nine skills in `<project>/.agents/skills/`, symlinked from `.claude/skills`
and `.github/skills`. Each has `name`, `description` and one of these
additions:

| Fixture | Added frontmatter |
|---|---|
| `vt-control` | none |
| `vt-top-str` | `version: "1.2.3"` |
| `vt-top-bare` | `version: 1.2.3` |
| `vt-top-num` | `version: 1.2` |
| `vt-meta-str` | `metadata:` / `  version: "1.2.3"` |
| `vt-meta-num` | `metadata:` / `  version: 1.2` |
| `vt-meta-nested` | `metadata:` / `  version:` / `    major: 1` |
| `vt-meta-scalar` | `metadata: "1.2.3"` |
| `vt-unknown` | `x-custom-key: hello` |

Commands, each run from the project directory:

- Claude Code: `claude -p "…list every skill whose name starts with 'vt-'…" --model haiku --max-turns 1`
- Copilot CLI: `COPILOT_HOME=<empty dir> copilot skill list --json`
- Codex: `CODEX_HOME=<empty dir> codex debug prompt-input "hi"`
- Antigravity: `agy -p "…list the names of all skills available to you…"`, then the CLI log

Claude Code and Antigravity were checked by asking the model, which depends on
the model answering accurately. Antigravity's first run answered `NONE`. A
reworded second run listed the skills, and its log confirmed the two parse
failures. Copilot and Codex were checked without a model call.
