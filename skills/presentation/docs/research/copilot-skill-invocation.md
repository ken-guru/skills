# How GitHub Copilot CLI resolves user-invoked Skills that set `disable-model-invocation`

Research for [#387](https://github.com/ken-guru/skills/issues/387) (map
[#379](https://github.com/ken-guru/skills/issues/379)). It builds on the Codex
note on branch `research/codex-skill-invocation`
([`codex-skill-invocation.md`](https://github.com/ken-guru/skills/blob/research/codex-skill-invocation/skills/presentation/docs/research/codex-skill-invocation.md))
and does not repeat its Codex work. It records facts and the option space only;
the decision belongs to [#382](https://github.com/ken-guru/skills/issues/382).

Researched 2026-09-28. Each claim is labelled:

- **Documented**: GitHub's docs, the CLI's own help text, or its bundled
  changelog say so.
- **Binary**: read from strings in the published npm package (the CLI's
  JavaScript bundle and its native `runtime.node`). Copilot CLI is not open
  source, so this replaces a source reading.
- **Measured**: reproduced here with pinned Copilot CLI versions, offline, with
  a scripted fake model (see [Reproduction](#5-reproduction-version-pinned-no-credentials)).
- **Reported**: a public issue with a reproduction, not confirmed here.
- **Inferred**: a conclusion drawn from the above, not observed directly.

Versions measured: `@github/copilot` **1.0.73, 1.0.74, 1.0.79, 1.0.88**
(latest, 2026-09-22) and **1.0.89-6** (newest prerelease, 2026-09-28), all
linux-arm64 in Docker.

## Summary

1. **Both error strings come from one code path: the model-facing `skill`
   tool.** When the tool cannot resolve a name, the **model** receives
   `Skill "<name>" not found. Available skills: <list>`, and the **terminal**
   shows `✗ skill(<name>) Skill not found: <name>` (Measured, 1.0.74–1.0.89-6;
   Binary). The field run's `Skill "proofread-presentation" not found.` is the
   text the agent saw and quoted. It is the same failure that
   github/copilot-cli [#4438](https://github.com/github/copilot-cli/issues/4438)
   reports as `Skill not found: …`.
2. **The trigger is `disable-model-invocation: true` alone.** Copilot drops
   such Skills from the model's catalog, and since **1.0.74** the `skill` tool
   resolves names only against that filtered catalog. The placeholder
   description, `user-invocable: true`, and the install location
   (`~/.agents/skills`, `~/.copilot/skills`, `.github/skills`) make no
   difference (Measured).
3. **Regression boundary: 1.0.73 → 1.0.74.** In 1.0.73 the tool still loads the
   Skill. 1.0.74's changelog says "Fully honor the skill
   disable-model-invocation flag" (Documented, Measured).
4. **Interactive `/proofread-presentation` does work.** Typed as its own
   message at the interactive prompt, it injects the full Skill into context
   with no tool call (Measured, 1.0.74–1.0.89-6). The error appears only when
   the model then **also** calls `skill("proofread-presentation")`. That second
   call fails, while the instructions are already in context. This matches the
   retrospective exactly (Measured with a forced call; Reported for real
   models in #4451, #4637 and #4438).
5. **Paths that go through the tool are dead for the flagged Skill:** `-p`
   (non-interactive) runs, where a leading `/name` is plain text, and
   "use the /name skill" inside a sentence (Measured).
6. **Not fixed.** #4438, #4451 and #4637 are open with no maintainer reply.
   No release note up to 1.0.89-6 mentions it, and 1.0.89-6 still fails
   (Measured, Documented).
7. **Copilot has no "user-only but still tool-loadable" setting.** It reads
   `disable-model-invocation` and `user-invocable`. It ignores
   `agents/openai.yaml` (Measured, Binary). No frontmatter tested makes the
   `skill` tool resolve the Skill while keeping it out of the model's catalog.

## 1. Where the two error strings come from

Binary (`prebuilds/<platform>/runtime.node` in 1.0.88, adjacent format strings
next to `src/runtime/src/tools/skill_tool.rs`):

```text
Skill "{}" loaded successfully. Follow the instructions in the skill context.
Skill "{}" is ambiguous. Use one of: …      /  Skill ambiguous: …
Available skills: …
Skill "{}" not found.                       /  Skill not found: {}
No model-invocable skills available.
```

The quoted form is the tool **result** given to the model. It is followed by
`Available skills: …` or, when the filtered list is empty,
`No model-invocable skills available.` (that variant is reported in
[#4838](https://github.com/github/copilot-cli/issues/4838)). The unquoted
`Skill not found: {}` is the short summary the terminal UI prints next to the
tool call.

Measured on 1.0.88 with the verbatim `proofread-presentation` Skill in
`~/.agents/skills`. The forced tool call printed:

```text
✗ skill(proofread-presentation) Skill not found: proofread-presentation
```

The model received:

```text
Skill "proofread-presentation" not found. Available skills: pp-dmi-false, pp-no-dmi, pp-uinv-false, pp-yaml-only, structure-agenda, customize-cloud-agent, github-pr-media
```

A second, unrelated string lives in `src/runtime/src/slash_command_handlers/skills.rs`:
`Skill not found: {}\n\nUse /skills list to see available skills.` It
presumably answers `/skills info <name>` (Binary; the command is inferred from the file name)
and does not appear in the field flow.

Version history of the strings (Reported): 1.0.39's JS SDK had only
`Skill not found: ${name}`, resolved against the **unfiltered** list; see the
[#4438 comment](https://github.com/github/copilot-cli/issues/4438). From about
1.0.65 the logic moved into the compiled runtime. This note did not diff
versions before 1.0.73.

## 2. What triggers it

Fixtures (all with the real `proofread-presentation` body):

| Fixture | Frontmatter |
|---|---|
| `proofread-presentation` | verbatim: `disable-model-invocation: true`, placeholder description |
| `pp-dmi-gooddesc` | `disable-model-invocation: true`, real trigger-style description |
| `pp-dmi-uinv` | `disable-model-invocation: true`, `user-invocable: true`, placeholder |
| `pp-dmi-false` | `disable-model-invocation: false`, placeholder |
| `pp-no-dmi` | no invocation keys, placeholder |
| `pp-yaml-only` | no invocation keys, plus `agents/openai.yaml` `policy.allow_implicit_invocation: false` |
| `pp-uinv-false` | `user-invocable: false`, placeholder |
| `structure-agenda` | verbatim control |

Results (Measured). "Catalog" means the `<available_skills>` block in the system
prompt Copilot sent to the model. "Tool" is a forced `skill(<name>)` call.

| Fixture | Catalog (all versions) | Tool 1.0.73 | Tool 1.0.74, 1.0.79, 1.0.88, 1.0.89-6 |
|---|---|---|---|
| `proofread-presentation` | omitted | loads | **not found** |
| `pp-dmi-gooddesc` | omitted | loads | **not found** |
| `pp-dmi-uinv` | omitted | loads | **not found** |
| `pp-dmi-false` | listed | loads | loads |
| `pp-no-dmi` | listed | loads | loads |
| `pp-yaml-only` | listed | loads | loads |
| `pp-uinv-false` | listed | loads | loads |
| `structure-agenda` | listed | loads | loads |

- **`disable-model-invocation: true` is the only trigger.** A good description
  does not help, and adding `user-invocable: true` does not help. `false`
  behaves like the key being absent.
- **The placeholder description is not a factor.** `pp-no-dmi` has the same
  placeholder and loads.
- **Install location is not a factor.** 1.0.88 gave the same result for the
  flagged Skill from `~/.agents/skills`, `~/.copilot/skills` and
  `<repo>/.github/skills`; the unflagged control loaded from all three. (Copilot
  CLI does **not** discover `~/.claude/skills`, where even the control was not
  found. Its help text lists only `~/.copilot/skills/` and `~/.agents/skills/`
  for personal Skills; Documented, Measured.)
- **`copilot skill list` (and `--json`) lists all fixtures as enabled**,
  flagged ones included. It gives no signal of the problem (Measured).
- **Regression boundary.** 1.0.73 already hid the flagged Skills from the
  catalog but still resolved them by name. 1.0.74 stopped resolving them. The
  bundled `changelog.json` entry for 1.0.74 (published 2026-07-23) is "Fully
  honor the skill disable-model-invocation flag", linking to a private
  `github/copilot-agent-runtime` PR (Documented, Measured).

## 3. Explicit invocation paths in Copilot CLI

Documented
([add-skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills),
[create-skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-skills)):
the docs show `/skill-name` in a prompt. Example: "Use the /frontend-design skill
to create …". They also list `/skills list|info|add|reload|remove` in a session
and `copilot skill list|add|remove|enable|disable` in the shell. Copilot
otherwise "will decide when to use your skills based on your prompt and the
skill's description". Documented frontmatter: `name`, `description`, `license`,
`allowed-tools`. The pages do not mention `disable-model-invocation`,
`user-invocable` or `agents/openai.yaml`. The changelog does document the first
two: `disable-model-invocation` since 0.0.412, "Invoke skills using slash
commands like /skill-name" since 0.0.389, and `user-invocable: false` for
custom agents.

VS Code's Copilot docs
([Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills))
define the intended semantics: `disable-model-invocation: true` means slash
command **yes**, auto-loaded **no**. `user-invocable: false` means the reverse.
They match Claude Code's
[skills docs](https://code.claude.com/docs/en/skills) (Documented).

Measured behaviour of each path with the verbatim Skill (the fake model is
scripted, so these runs show what Copilot does, not what a real model chooses):

| Path | 1.0.73 | 1.0.74 | 1.0.79 / 1.0.88 / 1.0.89-6 |
|---|---|---|---|
| Interactive: `/proofread-presentation check the deck` as its own message | Copilot rewrites it to "Use the skill tool to invoke the "proofread-presentation" skill, then follow the skill's instructions to help with: check the deck". The tool call **loads** it | Copilot injects `<skill-context name="proofread-presentation">` with the full body and `ARGUMENTS: …`. No tool call is needed | Same injection, prefixed "The user explicitly invoked the "/proofread-presentation" skill. Follow its instructions now." |
| The same, then the model calls `skill("proofread-presentation")` | loads | **`Skill "…" not found.`** after the body is already injected | **`Skill "…" not found.`** after the body is already injected |
| `-p "/proofread-presentation …"` | plain text, no injection | plain text, no injection | plain text, no injection |
| `-p "Use the /proofread-presentation skill."` (goes through the tool) | loads | **not found** | **not found** |
| Interactive `/pp-uinv-false …` | not run | not run | `✗ Unknown command: /pp-uinv-false`. No model request (1.0.79, 1.0.88, 1.0.89-6) |

Things that nudge a real model into the redundant call (these are inferences
about model behaviour, not measured):

- From 1.0.88 the `skill` tool description says "Use only listed skills unless
  the user explicitly requests an unlisted skill by name, in which case invoke
  it" and "Do not reinvoke a running skill" (Measured: absent in 1.0.73–1.0.79,
  present in 1.0.88 and 1.0.89-6). An explicit `/proofread-presentation`
  arguably is such a request, and the Skill is unlisted.
- The injected message tells the model the user "explicitly invoked" the Skill.
  A model trained on tool-based Skill loading may still call the tool.
- Real-model reports: #4451 (1.0.79, GPT-5.6 Sol, `/implement`), #4637 (1.0.80,
  `/implement`), and in #4438 comments the Copilot desktop app (`/wayfinder`),
  Agency 1.0.82 (`/manual-only-test`), and Copilot App 1.0.84-5 and 1.0.87-0.
  The 1.0.84-5 and 1.0.87-0 app reports say the slash path did **not** inject,
  so in some app builds even the slash path may fail (Reported, not measured
  here).

A picker: the in-session `/` command popup lists Skills. 1.0.81 replaced the
legacy skills picker with the `/skills` dashboard (Documented, changelog).
Whether flagged Skills show in the `/` popup was not measured here. #4637's
comment reports that they do in the app.

## 4. Does Copilot have its own "user-invocable only" mechanism?

- **`disable-model-invocation: true`** is Copilot's mechanism. It hides the
  Skill from the model catalog (as intended), keeps the interactive slash path
  (as intended), and breaks tool resolution (the bug). Binary: the runtime has a frontmatter
  key list (it also serves custom agents) containing `infer`,
  `disable-model-invocation`, `user-invocable` and `model-policy`. The Skill
  record in the JS bundle carries `disableModelInvocation` and `userInvocable`.
- **`user-invocable: false`** is honoured: it is removed from the slash
  commands and kept in the model catalog (Measured).
- **`agents/openai.yaml` is ignored.** 1.0.88's JS bundle and native runtime
  contain neither `openai.yaml` nor `allow_implicit_invocation` (Binary).
  `pp-yaml-only` stays in the catalog and loads on 1.0.79 and 1.0.88
  (Measured). This contradicts #4451's reading that the sidecar hid a Skill in
  1.0.79. That report's Skill was under a Windows `~/.agents/skills` and was
  not isolated, so the cause is unknown. The #4438 comment by an Agency user
  set both the field and the sidecar.
- No other sidecar or setting was found. `copilot skill disable` hides a Skill
  from everything (Documented).

**Inferred:** no frontmatter available today gives Copilot 1.0.74–1.0.89-6
"hidden from the model, and still resolvable by the `skill` tool". Every
fixture that left the catalog also failed resolution. Every fixture that
resolved stayed in the catalog.

## 5. Reproduction (version-pinned, no credentials)

The reproduction needs no GitHub login. Copilot CLI's documented BYOK mode
([use-byok-models](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-byok-models))
points it at an OpenAI-compatible endpoint. `COPILOT_OFFLINE=true` stops it
from contacting GitHub. The endpoint here is a ~90-line Python stub that:

- logs each request body, which holds the full system prompt and tool list;
- answers the first turn with one `skill` tool call (`{"skill": "<name>"}`) when
  `FAKE_SKILL` is set, and otherwise with `ok`;
- echoes the tool result verbatim once one exists.

Setup, all under a throwaway directory:

1. **Install** the pinned versions in a container with network access. Use
   `npm i --prefix /pkgs/<v> @github/copilot@<v>`. Give each version its own
   `COPILOT_CACHE_HOME`, and pass `--no-auto-update` with
   `COPILOT_AUTO_UPDATE=false`. Without that, an older loader silently runs a
   newer cached bundle: `--version` printed 1.0.88 for every pin until the
   caches were separated.
2. **Run** each turn in `docker run --network none` with `HOME=/home/probe`.
   Mount the fixtures read-only at `/home/probe/.agents/skills`. Unset
   `GH_TOKEN`, `GITHUB_TOKEN` and `COPILOT_GITHUB_TOKEN`. Set these variables:

   ```sh
   COPILOT_OFFLINE=true
   COPILOT_PROVIDER_BASE_URL=http://127.0.0.1:8765/v1
   COPILOT_PROVIDER_TYPE=openai
   COPILOT_PROVIDER_API_KEY=dummy
   COPILOT_MODEL=fake-model
   ```

   The container has no keychain and no host config, so no real credential can
   be picked up.
3. **Run the non-interactive turn:**

   ```sh
   copilot --no-auto-update -p "Use the /<name> skill." \
     --allow-all-tools --no-color --no-custom-instructions
   ```

   Assert on the stdout line `● skill(<name>)` versus
   `✗ skill(<name>) Skill not found: <name>`. Also check the logged request's
   `<available_skills>` block and the `tool` message.
4. **Run the interactive turn:** start `copilot -i "/<name> …"` inside `tmux`
   (a real terminal emulator is needed, because the TUI waits on terminal
   capability replies). Pre-trust `/work/proj` in `~/.copilot/config.json`
   (`trustedFolders`). Assert that the first request's user message contains
   `<skill-context name="<name>">`. 1.0.73 and 1.0.74 ignored `-i` under this
   setup, so for those versions the prompt was typed with `tmux send-keys`.
5. **Check without any model:** `copilot skill list --json` runs with no auth
   and shows that the Skill is discovered and enabled. It cannot show the bug.

A regression test built on this could assert, per pinned version:

- (a) the Skill is discovered (`skill list --json`);
- (b) whether it is in `<available_skills>`;
- (c) the forced-tool outcome;
- (d) slash injection.

Upstream's own command-line reproduction is in
[#4438](https://github.com/github/copilot-cli/issues/4438), but it needs a
logged-in real model. As its author's retraction shows, a model that reads the
file with other tools can report a false "loaded", so assert on the
`skill(...)` line, not the model's words.

## 6. Upstream status

- [#4438](https://github.com/github/copilot-cli/issues/4438) (open, `area:agents`,
  opened 2026-08-11 on 1.0.79). A comment claiming a fix in 1.0.80 was later
  retracted by its author, who retested 1.0.80 and 1.0.83. Later comments
  reproduce on 1.0.82 CLI, Copilot App 1.0.84-5 and 1.0.87-0. None of the
  comments comes from a GitHub maintainer.
- [#4637](https://github.com/github/copilot-cli/issues/4637) (open, `triage`,
  1.0.80) is the slash-then-tool shape. A commenter called it a duplicate of
  #4438, and the reporter consolidated into #4438.
- [#4451](https://github.com/github/copilot-cli/issues/4451) (open, 1.0.79) is
  the same slash-then-tool shape.
- [#4401](https://github.com/github/copilot-cli/issues/4401) (open, 1.0.78)
  claimed `~/.agents/skills` was undiscovered. Its first fixture carried the
  flag. Measured here: `~/.agents/skills` is discovered on 1.0.79+ (it is in
  the 1.0.88 help text).
- [#4838](https://github.com/github/copilot-cli/issues/4838) (open, 1.0.83–1.0.88)
  is a separate, intermittent `-p` bug: `No model-invocable skills available.`
  for unflagged Skills.
- Release notes for 1.0.74 through 1.0.89-6 contain no fix. The only related
  entry is 1.0.74's "Fully honor …", which introduced the behaviour
  (Documented). 1.0.89-6 still fails (Measured). Upstream has not announced a
  planned fix (none found).

## 7. Option space for #382 (not a decision)

Effects per harness. The Codex column comes from the Codex note: Codex ignores
`disable-model-invocation`, honours `agents/openai.yaml`, and has no `/name`
(`$name` instead).

| Option | Copilot CLI 1.0.74–1.0.89-6 | Claude Code | Codex |
|---|---|---|---|
| **A. Keep `disable-model-invocation: true`** (today) | Hidden from the model. Interactive `/proofread-presentation` injects the Skill. A redundant `skill()` call then prints the misleading error, but the instructions are present. Unreachable through `-p` or a mid-sentence mention | User-only (documented) | Field ignored, so the Skill stays model-visible |
| **A + `agents/openai.yaml` (`allow_implicit_invocation: false`)** | Same as A (sidecar ignored) | Same as A | User-only via `$proofread-presentation` |
| **B. Remove the field** (or set `false`) | Fully works: slash, tool and `-p`. The Skill becomes model-visible, guarded only by its description | Becomes model-invocable | Model-visible |
| **B + sidecar** | As B | As B | User-only |
| **C. Add a body instruction** such as "if this Skill's content is already in context, do not call the skill tool" (with A) | Might suppress the redundant call. It cannot fix `-p`. Untested with a real model (inferred) | Harmless | Harmless |
| **D. Fix the placeholder description** (with any option) | Not a cause. Visible in `skill list`, and it matters for model selection only under B | Only labels the `/` menu under A | Codex shows it to the model (Codex note) |
| **E. Document per-harness invocation** | "Type `/proofread-presentation` as its own message in an interactive session; not with `-p`" | `/proofread-presentation` | `$proofread-presentation` or `/skills` |
| **F. Wait for upstream** | #4438 is open with no maintainer response. Revisit when a release note mentions it; the probe above can confirm | — | — |

Costs to weigh:

- A keeps the documented cross-harness meaning. It accepts a cosmetic but
  alarming error in Copilot and no headless use there.
- B trades user-only behaviour in Claude Code and Copilot for Copilot
  reliability. That matters if Proofread must not auto-run, since it mutates
  Proofread state.
- The sidecar is cheap and only affects Codex.
- No option gives user-only behaviour and a clean tool path in Copilot today
  (inferred from §4).

Open questions for #382:

- Which Copilot CLI (or Copilot App) version the field run used. Any version
  from 1.0.74 onwards matches; the app builds may also fail on the slash path.
- Whether Proofread must work in Copilot `-p` runs.
