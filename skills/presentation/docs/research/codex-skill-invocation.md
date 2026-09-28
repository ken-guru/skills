# How harnesses resolve user-invoked Skills that set `disable-model-invocation`

Research for [#381](https://github.com/ken-guru/skills/issues/381) (map
[#379](https://github.com/ken-guru/skills/issues/379)). It records facts and the
option space only; the decision belongs to
[#382](https://github.com/ken-guru/skills/issues/382).

Researched 2026-09-28. Each claim is labelled:

- **Documented**: the vendor's docs or spec say so.
- **Source**: read in the vendor's open-source code at the pinned commit.
- **Measured**: reproduced locally with Codex CLI 0.157.1 under a throwaway
  `HOME`/`CODEX_HOME`.
- **Reported**: a public bug report with a reproduction, not confirmed here.

Pinned sources:

- `openai/codex` at
  [`44fe510c`](https://github.com/openai/codex/tree/44fe510ce3ee61c8ef623adcbf89b901c73ddd61)
  (2026-09-28). Paths below are relative to `codex-rs/`.
- `vercel-labs/skills` 1.7.0 at
  [`7407f389`](https://github.com/vercel-labs/skills/tree/7407f3893ad4dceab546ac002c3ef806e4000c73).

## Summary

1. **Codex ignores `disable-model-invocation`.** Its frontmatter parser reads only
   `name`, `description` and `metadata.short-description`, and unknown keys are
   silently accepted (Source). Measured: the shipped `proofread-presentation`
   loads, and it is listed in the model's **implicit** skill catalog. So under
   Codex the field neither blocks the Skill nor makes it user-only.
2. **Codex's user-only mechanism is `agents/openai.yaml` →
   `policy.allow_implicit_invocation: false`.** It hides the Skill from the
   model's catalog but leaves it invocable with `$name` (Documented, Source,
   Measured for the hiding half).
3. **Codex has no `/skill-name` invocation.** The TUI only accepts built-in
   slash commands. Anything else, including `/proofread-presentation`, is
   rejected before submission with
   `Unrecognized command '/proofread-presentation'. Type "/" for a list of supported commands.`
   (Source). Explicit invocation in Codex is `$proofread-presentation`, or
   picking the Skill from `/skills` (Documented).
4. **The reported string `Skill "proofread-presentation" not found.` does not
   exist in Codex.** It is absent from the Codex source and from the 0.157.1
   binary (Measured). Codex's own skill tool reports a miss as
   `skill package is not available` (Source). The string's origin is
   **unresolved**. The closest known match is GitHub Copilot CLI, whose
   `skill()` tool returns `Skill not found: <name>` for exactly this frontmatter,
   including after a successful `/name` injection (Reported, copilot-cli
   [#4438](https://github.com/github/copilot-cli/issues/4438),
   [#4637](https://github.com/github/copilot-cli/issues/4637)).
5. **The placeholder description does not break loading anywhere checked**;
   every harness only requires it to be non-empty. It weakens the `/`-menu and
   `skill list` text, and under Codex it is the text the model sees in the
   implicit catalog.
6. **Only `proofread-presentation` carries the pattern.** No other Skill in this
   repository sets `disable-model-invocation`, has a `...` placeholder
   description, or ships `agents/openai.yaml`.

## 1. How Codex discovers and resolves Skills

### Discovery

Documented ([Codex skills docs](https://learn.chatgpt.com/docs/build-skills),
redirected from `developers.openai.com/codex/skills`): Codex loads Skills from
`.agents/skills` in the working directory, its parents and the repository
root, `$HOME/.agents/skills`, `/etc/codex/skills`, and bundled system Skills.
`SKILL.md` "must include `name` and `description`".

Source (`ext/skills/src/host_roots.rs`): the user layer adds the deprecated
`$CODEX_HOME/skills`, plus `$HOME/.agents/skills` and a system cache. The
project layer adds `.agents/skills` in every directory from the project root
down to the working directory.

`npx skills` (vercel-labs/skills 1.7.0) treats `codex` and `github-copilot`
as "universal" agents (`skillsDir: '.agents/skills'`) and writes global
installs to the canonical `~/.agents/skills` (Source: `src/agents.ts`,
`src/installer.ts`). Codex reads that directory. The installer copies the
**whole skill directory**. It excludes only `metadata.json`, `.git`,
`__pycache__` and `__pypackages__`, so an `agents/openai.yaml` sidecar would
be installed with the Skill (Source: `copyDirectory` in `src/installer.ts`).

### Frontmatter parsing

Source (`skills/src/parser.rs`): `SkillFrontmatter` deserialises only `name`,
`description` and `metadata.short-description`. It is a plain
`#[derive(Deserialize)]` without `deny_unknown_fields`, so `serde_yaml`
**ignores** `disable-model-invocation` and any other unknown key. Validation:

- the name defaults to the directory name and is limited to 64 characters;
- the description must be non-empty after whitespace collapsing, or the Skill
  fails with `missing field "description"`;
- line-oriented repair quotes prose values that contain `: `.

The loader enforces a 1,024-character description maximum (`MAX_DESCRIPTION_LEN`,
`ext/skills/src/loader/mod.rs`).

### Implicit and explicit invocation

Source:

- `agents/openai.yaml` is read from `<skill>/agents/openai.yaml`
  (`SKILLS_METADATA_DIR`, `SKILLS_METADATA_FILENAME` in
  `ext/skills/src/loader/mod.rs`). `policy.allow_implicit_invocation` is an
  `Option<bool>` that defaults to `true` (`skills/src/model.rs`).
- When it is `false`, the catalog entry is marked `hidden_from_prompt()`
  (`ext/skills/src/provider/host.rs`, `provider/executor.rs`).
  `is_model_visible()` is `enabled && prompt_visible`, and it filters the
  rendered skill list, `skills.list` and the `skills.read` alias plan
  (`catalog.rs`, `render.rs`, `tools/list.rs`, `tools/read.rs`).
- Explicit mentions go through `collect_explicit_skill_mentions`
  (`ext/skills/src/selection.rs`). They match `$name`, `[$name](path)` or a
  structured `UserInput::Skill` against entries that are `enabled`. **They do
  not check `prompt_visible`**, so a Skill hidden from implicit use is still
  injected when the user writes `$name`. When the entry is hidden, the injected
  fragment carries `resource_access` so the model can still read the Skill's
  resources (`ext/skills/src/extension.rs`).

Documented (`skills/src/assets/samples/skill-creator/references/openai_yaml.md`
in the Codex repo): "`policy.allow_implicit_invocation`: When false, the skill is
not injected into the model context by default, but can still be invoked
explicitly via `$skill`. Defaults to true." The public docs say the same.

### `/name` in the Codex TUI

Source (`tui/src/bottom_pane/chat_composer/slash_input.rs`,
`chat_composer.rs`, `chatwidget/slash_dispatch.rs`): on submit,
`validate_submission` parses a leading `/name`. If the name is not a built-in
or service-tier command, it returns `UnknownCommand`, the composer prints
`Unrecognized command '/{name}'. Type "/" for a list of supported commands.`,
and **nothing is sent to the model**. Skills are not registered as slash
commands. The documented explicit paths are `/skills` (a picker) and `$`
mentions (Documented, [Codex skills docs](https://learn.chatgpt.com/docs/build-skills)).
The public slash-command reference does not describe `/skill-name` either.

Not verified: non-TUI surfaces (the IDE extension, the desktop app, and
`codex exec "<prompt>"`, which passes text straight through). In `exec`, a
leading `/proofread-presentation` is plain prompt text. The model would still
see `proofread-presentation` in its implicit catalog, because Codex ignores the
Claude field.

### Measured reproduction (Codex CLI 0.157.1)

Setup: a throwaway `HOME` and `CODEX_HOME` containing only these Skills under
`$HOME/.agents/skills/`:

| Fixture | Frontmatter / sidecar |
|---|---|
| `proofread-presentation` | copied verbatim from this repository |
| `pp-yaml-policy` | same body, `disable-model-invocation` removed, `agents/openai.yaml` with `policy.allow_implicit_invocation: false` |
| `pp-empty-desc` | `disable-model-invocation: true`, `description: ""` |
| `structure-agenda` | copied verbatim (control) |

`codex debug prompt-input "hello"` renders the model-visible prompt. Its
`<skills_instructions>` block listed:

```text
- proofread-presentation: Run quality validation and proofreading passes... (file: r0/proofread-presentation/SKILL.md)
- structure-agenda: Drafting. Use when structuring presentation content, or after discover-presentation has completed. (file: r0/structure-agenda/SKILL.md)
```

- `proofread-presentation` loaded and is **implicitly visible**:
  `disable-model-invocation` has no effect in Codex.
- `pp-yaml-policy` loaded but is **absent** from the catalog: the policy works.
- `pp-empty-desc` was **dropped**: an empty description is a load error.
  `prompt-input` printed nothing to stderr about it.

Limit: `debug prompt-input` renders only the initial context and does not run
`$`-mention injection. Running it with `$proofread-presentation …`,
`$pp-yaml-policy …` or `/proofread-presentation …` showed only the user text.
Explicit-mention behaviour therefore rests on the source reading above, not on
a measurement. A full turn needs an authenticated `codex exec`, which was not
run so that no real credentials were copied into the sandbox.

Binary scan (Measured): the Codex 0.157.1 executable contains
`Unrecognized command '/` once. It contains **no** string matching
`Skill … not found`. The only near matches are model-prompt text ("If the skill
is not found…") and the bundled `skill-installer` and `skill-creator` scripts'
`Skill path not found` / `Skill directory not found`.

## 2. Where the reported error could come from

The retrospective (map #379, first comment) says the *skill tool* answered
`Skill "proofread-presentation" not found.` when the user started
`/proofread-presentation`. It also says the run continued only because the
Skill's content was already in the task context. Known facts:

- **Codex CLI (TUI)** rejects `/proofread-presentation` locally with
  `Unrecognized command …`. It does not produce a skill-tool error, and its
  skill tool's miss message is `skill package is not available`
  (`ext/skills/src/tools/read.rs`). Neither matches (Source, Measured).
- **GitHub Copilot CLI** 1.0.79–1.0.80, when a Skill sets
  `disable-model-invocation: true`: `copilot skill list` shows the Skill, but
  the model's `skill()` tool returns `Skill not found: <name>`. With `/name`,
  the Skill's instructions are injected **and** a separate lookup reports
  `Skill not found` (Reported:
  [copilot-cli #4438](https://github.com/github/copilot-cli/issues/4438), open;
  [copilot-cli #4637](https://github.com/github/copilot-cli/issues/4637), open).
  The shape matches the retrospective (instructions already present, then a
  tool-level "not found"). The message format differs (`Skill not found: x`
  versus `Skill "x" not found.`).
- **Claude Code** has had several bugs with the same shape. The model refused
  the Skill tool for a `disable-model-invocation` Skill
  ([#26251](https://github.com/anthropics/claude-code/issues/26251), closed).
  Such Skills were absent from every list behind a feature flag
  ([#77740](https://github.com/anthropics/claude-code/issues/77740), closed).
  Coordinator mode hides them so that `/name` reports "not installed"
  ([#82237](https://github.com/anthropics/claude-code/issues/82237), open).
- A model paraphrasing a tool result, a different harness version, or a
  wrapper cannot be excluded.

So the literal message cannot be attributed to Codex CLI from primary
evidence. Pinning it down needs the harness name and version from the field
run, or a transcript. What the evidence does support is this: the
`disable-model-invocation` field does not give user-only behaviour in Codex,
and it is actively harmful in current Copilot CLI builds.

## 3. Whether the placeholder description contributes

`description: "Run quality validation and proofreading passes..."` is 48
characters and non-empty. It passes every validator checked: Codex
(`parser.rs`), agentskills.io (1–1,024 characters, non-empty), `npx skills`
(present and a string, `src/skills.ts`), Copilot CLI (required), and Claude
Code (recommended; it falls back to the first body line). **It does not cause a
not-found in any harness examined.** Its effects:

- Codex: because Codex ignores `disable-model-invocation`, this is the text
  the model uses to decide implicit invocation (Measured). It is vague, so it
  is unlikely to trigger, but it is still offered.
- Claude Code: with `disable-model-invocation: true`, the description is not
  put in the model's context (Documented). It still labels the `/` menu entry.
- Copilot CLI: shown in `copilot skill list` (Reported, #4438).
- Antigravity: the description is its only required field and is used to
  decide invocation (Documented).

## 4. How other harnesses treat the same frontmatter

| Harness | Reads `disable-model-invocation`? | User-only mechanism | Explicit invocation | Reads `agents/openai.yaml`? |
|---|---|---|---|---|
| Codex CLI | No, silently ignored (Source, Measured) | `agents/openai.yaml` `policy.allow_implicit_invocation: false` (Documented, Source) | `$name` or `/skills` picker; `/name` is "Unrecognized command" (Documented, Source) | Yes |
| Claude Code | Yes: "prevent Claude from automatically loading this skill… trigger manually with `/name`"; description not in context (Documented, [skills docs](https://code.claude.com/docs/en/skills)) | `disable-model-invocation: true`; `user-invocable: false` is the inverse (model-only) | `/name` from `name` or the directory | No known use. The frontmatter is authoritative and an extra `agents/` file is just a bundled file |
| GitHub Copilot CLI | Not documented ([add-skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills), [create-skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-skills) list only `name`, `description`, `license`, `allowed-tools`). In 1.0.79–1.0.80 it makes the Skill unreachable through the `skill()` tool (Reported, #4438, #4637). Copilot Desktop 1.1.8 dropped such Skills from its catalog ([github/app #2802](https://github.com/github/app/issues/2802), closed) | None documented | `/name` in the prompt (Documented) | Not documented |
| Google Antigravity | Not documented ([skills docs](https://antigravity.google/docs/skills/)) | None documented | `/<skill-name>` slash command (Documented) | Not documented |
| agentskills.io spec | Not a spec field. Extensions belong under `metadata` (string→string) (Documented, [specification](https://agentskills.io/specification)) | None | Out of scope | Out of scope |
| `npx skills` 1.7.0 | Passes it through untouched (it only strips frontmatter for the `eve` agent) (Source) | `metadata.internal: true` only hides the Skill from *installation* | n/a | Copies it (whole-directory copy) |

Notes:

- The Claude Code docs set the reference semantics that
  [copilot-cli #4438](https://github.com/github/copilot-cli/issues/4438) and
  its comment cite. That comment also quotes a VS Code Copilot Chat bundled
  reference table giving `disable-model-invocation: true` → slash command yes,
  auto-loaded no. It reports that `@github/copilot` 1.0.39 resolved the tool
  against the unfiltered list, and calls the 1.0.79 behaviour a regression.
  That claim is second-hand and not verified here.
- A Codex-only sidecar (`agents/openai.yaml`) is invisible to Claude Code,
  Copilot and Antigravity as far as their docs say. Adding it is unlikely to
  change their behaviour. Removing `disable-model-invocation` changes Claude
  Code (the Skill becomes model-invocable) and, per #4438, would make current
  Copilot CLI able to load it.

## 5. Suite members sharing the pattern

Inspected every `skills/presentation/*/SKILL.md` frontmatter and searched the
whole repository:

| Skill | `disable-model-invocation` | Placeholder `...` description | `agents/openai.yaml` |
|---|---|---|---|
| `build-presentation` | — | — | — |
| `discover-presentation` | — | — | — |
| `structure-agenda` | — | — | — |
| `generate-slides` | — | — | — |
| `generate-images` | — | — | — |
| `generate-diagrams` | — | — | — |
| `presentation-validation` | — | — | — |
| **`proofread-presentation`** | **`true`** | **yes** | — |

No Skill anywhere in the repository (including `setup-*` and `unslop`) sets
`disable-model-invocation` or `user-invocable`, or ships `agents/openai.yaml`.
The placeholder description arrived in `74b8470` ("Refactor presentation
skills per writing-great-skills guidelines").

## 6. Option space for #382 (not a decision)

Frontmatter and sidecar levers, with each one's effect across harnesses
according to the facts above:

- **A. Keep `disable-model-invocation: true` and add `agents/openai.yaml` with
  `policy.allow_implicit_invocation: false`.** Claude Code: unchanged (user-only).
  Codex: becomes user-only; invocation stays `$proofread-presentation`, not
  `/…`. Copilot CLI: still hit by #4438/#4637 until fixed upstream. Antigravity:
  unknown effect of the field.
- **B. Remove `disable-model-invocation` and rely on the sidecar.** Codex:
  user-only. Claude Code, Copilot and Antigravity: model-invocable, guarded
  only by the description. Copilot CLI: loads again.
- **C. Keep the frontmatter as it is (no sidecar).** Codex stays implicitly
  invocable and `/name` stays unrecognized. This is today's behaviour.
- **D. Fix the placeholder description** in any variant. It is independent of
  the not-found question and matters most where the Skill is model-visible
  (Codex today, and all harnesses under B).
- **Documentation lever:** per-harness invocation text. Codex:
  `$proofread-presentation` or `/skills`. Claude Code, Copilot and Antigravity:
  `/proofread-presentation`.
- **Regression-check levers:** for Codex, `codex debug prompt-input` under a
  throwaway `HOME`/`CODEX_HOME` can assert the Skill is loaded and
  present or absent in `<skills_instructions>`. It needs no authentication
  (Measured). Proving that explicit `$name` injection works needs a real turn
  (`codex exec`, authenticated) or an app-server `turn/start`. Copilot CLI
  already has a command-line reproduction in #4438 (`copilot -p … skill(...)`).

Open questions for #382: which harness and version produced
`Skill "proofread-presentation" not found.` in the field run, and whether
upstream Copilot CLI fixes #4438 before the suite ships.
