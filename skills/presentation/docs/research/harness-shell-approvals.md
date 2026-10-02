# How Copilot CLI, Claude Code, and Codex match shell-command approvals

Research for [#451](https://github.com/ken-guru/skills/issues/451) (map
[#450](https://github.com/ken-guru/skills/issues/450)). It records facts and the
option space for the command-shape decision in
[#452](https://github.com/ken-guru/skills/issues/452). It makes no decision.

Researched 2026-10-01. Each claim is labelled:

- **Documented**: the vendor's docs, the CLI's own help text, or its bundled
  changelog say so.
- **Source**: read from the harness's public source code (Codex only).
- **Binary**: read from the shipped bundle (Copilot CLI is not open source, so
  this replaces a source reading).
- **Measured**: reproduced here with the CLI driven by a scripted fake model
  over the CLI's own custom-provider setting (no credentials, no real model).
- **Inferred**: a conclusion drawn from the above, not observed directly.
- **Unconfirmed**: no primary source found. Treat as open.

Versions:

- **Copilot CLI 1.0.85** (linux-arm64) measured; 1.0.90 is current. The
  1.0.86–1.0.90 changelog entries touching permissions don't change command
  matching (see [§1.7](#17-versions-after-the-measured-one)).
- **Claude Code 2.1.286** measured; docs read on the same day.
- **Codex** source at `openai/codex@a933dd7` (2026-10-01); `codex-cli 0.154.0`
  used for `codex execpolicy check`. developers.openai.com was unreachable from
  the research environment, so Codex claims rest on source, not docs.

Placeholders: `<skill-dir>` is a Skill's absolute install directory,
`<project>` the Presentation Project Folder.

## Summary

1. **Copilot CLI matches a command's *identifier*, not its text.** The
   identifier is the program token (`node`, `touch`), or for `git`/`gh` the
   program plus first subcommand (`git push`). Arguments never take part.
   "Approve for the rest of the running session" approves that identifier, so
   approving `node "<skill-dir>/scripts/render-diagrams.mjs"` once approves
   **every** later `node …` command, including `node -e '…'` (Binary,
   Measured).
2. **A shim's identifier is its path token, quotes included.** `"<skill-dir>/scripts/presentation-validation" check …`
   gets the identifier `"<skill-dir>/scripts/presentation-validation"` with
   the quotes. The unquoted form gets the bare path. A rule or approval for one
   form doesn't cover the other (Measured).
3. **Copilot has a second, separate prompt for paths.** In an interactive
   session, a script path outside the working directory, the temp directory,
   and `--add-dir` directories raises an "Allow directory access" prompt. This
   happens even when the command is already allowed. It hits
   `node "<skill-dir>/x.mjs"` and the shim alike, and also a Skill's own
   scripts after that Skill is invoked. `trustedFolders` doesn't lift it;
   `--add-dir <skill-dir>` does (Measured). The field run's "shim ran with no
   prompt" was **not** reproduced. It needs an earlier persisted approval or a
   project-local install (Inferred, [§1.6](#16-why-the-field-shim-may-not-have-prompted)).
4. **Claude Code matches the full command text** against `Bash(…)` rules,
   splitting `&&`/`||`/`;`/`|`. "Don't ask again" saves a rule to
   `.claude/settings.local.json` that lasts across sessions. Measured, the
   rule it offers is a **prefix** for a shim (`<skill-dir>/scripts/presentation-validation check *`)
   but the **exact full command** for `node <script> <args>`. Heredocs and
   `$(…)` defeat a matching allow rule. `$(…)` with dynamic content offers no
   "don't ask again" at all (Documented, Measured).
5. **Codex prompts far less, for a different reason.** With the default
   `on-request` policy and a restricted sandbox, a command that no rule
   matches runs **inside the sandbox without a prompt**. Prompts come from
   sandbox escalation, `prompt` rules, the dangerous-command heuristic, or an
   `untrusted` project. Rules are argv-prefix `prefix_rule`s in
   `~/.codex/rules/*.rules`. A `bash -lc` script is split only when it is
   plain words joined by `&&`/`||`/`;`/`|`. A quoted program path, `$(…)`,
   redirects, and heredocs keep the script whole, so no prefix rule can match
   it. "This session" approval is keyed on the exact canonical command plus
   cwd (Source).
6. **Skill frontmatter pre-approval:** Copilot honours `allowed-tools`
   (Documented). Measured, it applied in an interactive session but not under
   `-p`. Claude Code honours it for the invoking turn only (Documented),
   measured for a user-invoked Skill. Codex has no consumer for it (Source). No
   single frontmatter value works in both Copilot and Claude Code for a
   bundled script. Copilot accepts `Bash(…)` but matches identifiers, needs
   `:*` rather than ` *`, and doesn't expand `${CLAUDE_SKILL_DIR}`. Claude Code
   needs the full command text (Measured).

## Comparison table

| Question | Copilot CLI (1.0.85, reproduction) | Claude Code (2.1.286) | Codex (source `a933dd7`) |
| :- | :- | :- | :- |
| What an approval matches | Command **identifier** per segment: program token; `git`/`gh` plus first subcommand. Rule `shell(X)` = exact identifier; `shell(X:*)` = identifier prefix (Documented, Measured) | **Full command text** per segment, `*` wildcard, after stripping wrappers like `timeout`/`nohup` (Documented) | **argv token prefix** (`prefix_rule`), per segment of a plain `bash -lc` script; otherwise the whole argv (Source) |
| "Approve for session" covers | Every later command whose identifiers are all approved, e.g. all `node …` (Binary) | File edits: until session end. Bash: no session option; see next row (Documented) | Only the exact canonical command in the same cwd, sandbox and permissions (Source) |
| Persistent approval | "Yes, and don't ask again for `<identifier>` in this repo/directory" → `~/.copilot/permissions-config.json`, keyed per location (Documented, Binary) | "Yes, and don't ask again" → rule in `<repo>/.claude/settings.local.json`; prefix for shim-like commands, exact text for `node <script> <args>` (Documented, Measured) | "Yes, and don't ask again for commands that start with `…`" → `prefix_rule` appended to `~/.codex/rules/default.rules` (Source) |
| Path check besides the command | Yes, interactive: paths outside cwd, temp dir and `--add-dir` raise "Allow directory access"; `-p` skips it (Measured) | Only for read-only commands, redirect targets and `tee` targets; a non-read-only command's arguments aren't path-checked (Documented) | No prompt; the sandbox enforces write roots (Source, Inferred) |
| `node "<skill-dir>/x.mjs" …` | Identifier `node`, plus a path prompt for `<skill-dir>` (Measured) | Prompts; offered rule is the exact command; `Bash(node *)` would allow all node (Measured) | Runs sandboxed without prompt under `on-request`; `["node"]` and `["node","-e"]` are banned as suggested prefixes (Source) |
| `"<skill-dir>/…/shim" check …` | Identifier is the quoted path token; plus a path prompt (Measured) | Prompts; offered rule `<shim> check *`; `Bash(<shim> *)` matched quoted and unquoted calls (Measured) | Quoted program path makes the script unsplittable → whole-script match only. Unquoted path splits and can match `prefix_rule(["<shim>"])` (Source) |
| `a && b` chains | Each segment's identifier must be approved; a prompt lists only the missing ones (Measured) | Each subcommand must match; "don't ask again" saves up to 5 per-subcommand rules (Documented, Measured) | Split into segments when plain; every segment must be allowed (Source) |
| Heredoc stdin (`cmd <<'JSON'`) | No effect on matching; ran with `shell(node)` (Measured) | Defeats a matching allow rule (`Bash(node *)`, `Bash(<shim> *)` both prompted). `<<<` here-string and `printf … \|` pipe did match (Measured) | Script not plain → whole-script match; no "don't ask again" offered (multi-line prefix suppressed) (Source) |
| `$(…)` | Inner commands become identifiers; runs if all approved; never offers session approval. Backticks are blocked outright (Measured) | Defeats a matching allow rule; dynamic content offers no "don't ask again" (Measured) | Script not plain → whole-script match (Source) |
| `node -e '…'` | Identifier `node`; covered by any `node` approval (Measured) | Needs its own rule; offered rule is the exact text (Measured) | Not matched by a `["node", <script>]` rule; `["node","-e"]` never suggested (Source, Measured) |
| Skill `allowed-tools` | Honoured on invocation for the session (Documented); measured interactive yes, `-p` no | Honoured for the invoking turn (Documented); measured for user `/skill` yes, model `Skill` call not reproduced | Not consumed (Source) |
| User-side allowlist | `--allow-tool='shell(node)'`, `--deny-tool`, `--add-dir`, `--allow-all-paths`; config `trustedFolders`; persisted location approvals | `permissions.allow`/`ask`/`deny` and `additionalDirectories` in `settings.json`; `--allowedTools`, `--add-dir` | `~/.codex/rules/*.rules` `prefix_rule(…)`; `config.toml` `approval_policy`, `sandbox_mode`, `[sandbox_workspace_write] writable_roots`, `[projects."<path>"] trust_level` |

## 1. GitHub Copilot CLI

### 1.1 What is matched

Copilot parses each shell command with tree-sitter-bash into segments. Each
segment gets an `identifier`, and a prompt carries the identifiers that are not
yet approved. A session event from the measurement (paths redacted):

```json
{"kind":"shell",
 "fullCommandText":"node \"<skill-dir>/x.mjs\" a && touch zz.txt",
 "commands":[{"identifier":"node","readOnly":false},{"identifier":"touch","readOnly":false}],
 "possiblePaths":["<skill-dir>/x.mjs","zz.txt"],
 "canOfferSessionApproval":true}
```

The built-in help (`copilot help permissions`, Documented) states the rule
semantics:

> `shell(command:*?)` Exactly matches a specific shell command to be run. If
> the command is omitted, all shell commands are allowed. In most cases, this
> will be an exact match against the command name. To match prefixes, use the
> `:*` suffix. This is particularly useful for git and gh commands, where
> approval is performed on a first-level subcommand basis, e.g. "git push" or
> "gh pr create". … Wildcard matching is performed on the stem of the command,
> so "shell(git:*)" will match "git push" but not "gitea".

Denial rules beat allow rules, even `--allow-all-tools` (Documented, Measured:
`--allow-tool=shell(node) --deny-tool=shell(node)` was denied).

Measured with `-p` and `--allow-tool` (1.0.85):

| Command | Rule | Result |
| :- | :- | :- |
| `node "<skill-dir>/x.mjs" a` | none | denied (needs approval) |
| same | `shell(node)` or `shell(node:*)` | ran |
| same | `shell(node <skill-dir>/x.mjs:*)` | denied: arguments are not part of the identifier |
| same | `shell(node *)` | denied: ` *` isn't a wildcard here |
| `"<skill-dir>/shim" a` | `shell(node)` | denied: the shim's identifier isn't `node` |
| same | `shell(<skill-dir>/shim)` or `shell(shim)` | denied: the identifier includes the quotes |
| same | `shell("<skill-dir>/shim")` | ran |
| `<skill-dir>/shim check a` (unquoted) | `shell(<skill-dir>/shim)` or `shell(<skill-dir>/shim:*)` | ran |
| same | `Bash(<skill-dir>/shim *)` | denied (Claude-style ` *`) |
| `sh "<skill-dir>/shim" a` | `shell(sh)` | ran |
| `node -e '…'` | `shell(node)` | ran |

### 1.2 What "approve for session" and "don't ask again" cover

The interactive prompt offers (Binary, `app.js` 1.0.85):

- `Yes`
- `Yes, and approve <identifiers> for the rest of the running session`
  (`approve-for-session`, `approval: {kind: "commands", commandIdentifiers}`)
- `Yes, and don't ask again for <identifiers> in this repo (…)` /
  `in this directory (…)` (`approve-for-location`, persisted). The GitHub docs
  say location approvals go to `~/.copilot/permissions-config.json`. Changelog
  1.0.37: "Location-based permission persistence is now enabled by default, so
  approvals carry over across sessions for the same directory". Changelog
  1.0.72: "Command approvals no longer carry over to another repository after
  you switch with /cd".
- `No, and tell Copilot what to do differently`

A pending or later request is auto-approved when
`request.commandIdentifiers.every(id => approval.commandIdentifiers.includes(id))`
(Binary). So a session approval of `node` covers every `node …` segment, and
the GitHub docs warn about this. Approving `rm ./this-file.txt` for the
session lets later `rm -rf ./*` run unasked
([configure Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/configure-copilot-cli)).

A request whose command contains `$(…)` has `canOfferSessionApproval: false`
(Measured), so only the one-time `Yes` is offered.

### 1.3 Path permission is a separate prompt

`copilot help permissions` (Documented): "By default, file access is
restricted to paths within the current working directory and its
subdirectories, plus the system temporary directory." `--add-dir <directory>`
allows another directory. `--allow-all-paths` disables the check.

Measured, interactive (pty), skill scripts in a non-temp directory outside the
project, `--allow-tool=shell(node)`:

| Setup | First request |
| :- | :- |
| `node "<skill-dir>/x.mjs" a` | `{"kind":"path","accessKind":"shell","paths":["<skill-dir>/x.mjs"]}` |
| `"<skill-dir>/shim" a` with `shell("<skill-dir>/shim")` | same path prompt for `<skill-dir>/shim` |
| Skill installed in Copilot's personal skills dir, invoked first, then `node "<skill-dir>/scripts/x.mjs"` | same path prompt |
| `<skill-dir>` added to `trustedFolders` in `config.json` | same path prompt |
| `--add-dir=<skill-dir>` | ran with no prompt |
| `-p` mode (any of the above) | no path prompt (changelog 0.0.359: "Do not request path permission in prompt mode") |

The path dialog is titled "Allow directory access". Its options are `Yes`,
`Yes, and add these directories to the allowed list` (session-scoped), and `No`
(Binary). The exact directory granularity it adds (file's parent vs the path
itself) is Unconfirmed.

### 1.4 Chains, heredocs, substitution, `node -e`

Measured with `--allow-tool=shell(node)`:

- `node … a && node … b`: ran (identifiers `[node]`).
- `node … a && touch zz.txt`: denied. The prompt lists only `touch`.
- `cd "<skill-dir>" && node x.mjs a`, `node … | cat`: ran (`cd` and `cat` are
  read-only).
- `node … > out.txt`: denied (write redirection needs separate approval).
- `node "<skill-dir>/x.mjs" a <<'JSON' … JSON`: ran, stdin delivered. Heredocs
  are handled since 0.0.354 ("better heredoc handling").
- `node … "$(echo hi)"`, `"$(date +%s)"`, `P=…; node "$P/x.mjs"`: ran.
  `"$(cat /etc/hostname)"` was blocked by the path check on `/etc/hostname`,
  not by the substitution itself.
- `` node … `echo hi` ``: blocked outright: "Command blocked: contains
  dangerous shell expansion patterns …".
- `node -e '…'`: identifier `node`, so covered by any `node` approval.

### 1.5 Skill `allowed-tools`

Documented
([Adding agent skills for GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)):
"`allowed-tools` … pre-approves specific tools", example `allowed-tools: shell`,
with the warning "Only pre-approve the `shell` or `bash` tools if you have
reviewed this skill and any referenced scripts, and you fully trust their
source." Skill locations include `~/.agents/skills` and `.agents/skills`, which
are the `npx skills` targets.

Binary: on `skill.invoked`, the CLI parses `allowedTools` with
`configLoaderParseAllowedTools` and calls `addApprovedRules`, a session rule.
The parser maps Claude names: `Bash(node:*)` → `{kind:"shell",argument:"node:*"}`,
`Bash` → all shell, `Edit`/`Write` → write, `Read` → no rule.

Measured:

- Interactive, `allowed-tools: Bash(node:*)`: after the Skill loaded,
  `node "<skill-dir>/x.mjs" a` ran with no command prompt.
- Interactive, `allowed-tools: Bash("<skill-dir>/scripts/shim")` (literal
  absolute path): the quoted shim ran.
- Interactive, `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/shim:*)`: not
  applied. `${CLAUDE_SKILL_DIR}` isn't expanded.
- `-p`, same frontmatter: not applied. The hook that applies it lives in the
  interactive UI layer (Binary).
- `allowed-tools` doesn't lift the separate path prompt (§1.3).

Safety for the suite's install paths (Inferred): `npx skills` installs into
the directories Copilot reads, so a Skill's `allowed-tools` takes effect there.
A useful scoped value needs the shim's absolute path, which differs per machine.
The portable values are broad (`shell`, `Bash(node:*)`), and those pre-approve
arbitrary code: `node -e`, or any `node` script.

### 1.6 Why the field shim may not have prompted

Not reproduced: every measured shim call prompted (command, and path when
outside the project). Candidate explanations (Inferred, unverified for the
reporter's machine):

1. A persisted location approval from an earlier run. "Don't ask again for
   `"<skill-dir>/…/presentation-validation"` in this repo" lasts across
   sessions for that directory, while `node` may never have been approved that
   way. Check `~/.copilot/permissions-config.json`.
2. A project-local install (`<project>/.agents/skills/…`) would put the shim
   inside the working directory and remove the path prompt. It would still
   need a command approval.
3. A session started with `--allow-tool`, `--allow-all-tools` or `/allow-all`.

### 1.7 Versions after the measured one

The [changelog](https://github.com/github/copilot-cli/blob/main/changelog.md)
1.0.86–1.0.90 permission entries: 1.0.87 "Denying write(path) now blocks only
the specified path", 1.0.88 "remember exact session approvals for missing
paths", 1.0.89 "Exact grants are visible in /list-dirs and cleared by
/reset-allowed-tools", 1.0.90 "Choosing approve-for-location now persists tool
approval to avoid repeat prompts". None changes identifier matching (Inferred).

### 1.8 User-side configuration

- Flags: `--allow-tool='shell(node)'`, `--allow-tool='shell(git:*)'`,
  `--deny-tool='shell(git push)'`, `--allow-all-tools`, `--add-dir <dir>`,
  `--allow-all-paths`, `--allow-all`/`--yolo`, `--disallow-temp-dir`
  (Documented, `copilot --help`).
- `~/.copilot/config.json` (or `$COPILOT_HOME/config.json`): `trustedFolders`
  ("folders where permission to read or execute files has been granted"),
  `allowedUrls`/`deniedUrls`, `defaultPermissionMode` (`manual` | `assisted` |
  `allow-all`) (Documented, `copilot help config`). No config key for a
  persistent shell allowlist was found. Persistence comes from location
  approvals (Unconfirmed that none exists).
- In session: `/allow-all`, `/permissions`, `/reset-allowed-tools`, `/add-dir`
  (Documented, changelog).

## 2. Claude Code

### 2.1 What is matched

[Configure permissions](https://code.claude.com/docs/en/permissions)
(Documented): "Bash rules match the whole command text, with `*` standing in
for any text." `Bash(npm run *)` matches `npm run build`; `Bash(ls:*)` equals
`Bash(ls *)`. Rules are evaluated deny → ask → allow. The docs warn that
"Bash permission patterns that try to constrain command arguments are fragile."

Compound commands: "The recognized command separators are `&&`, `||`, `;`,
`|`, `|&`, `&`, and newlines. A rule must match each subcommand
independently." Deny and ask rules also reach into subshells and command
substitutions. Wrappers `timeout`, `time`, `nice`, `nohup`, `stdbuf`,
`command`, `builtin`, `noglob` and bare `xargs` are stripped before matching.
`npx` and similar runners are not.

Read-only commands (`ls`, `cat`, `echo`, `grep`, `cd` into a working
directory, …) run without a prompt. `node` isn't read-only.

### 2.2 What "don't ask again" covers

Documented: Bash approvals save "Permanently per repository and command" to
`.claude/settings.local.json` at the git root. "When you approve a compound
command with 'Yes, and don't ask again', Claude Code saves a separate rule for
each subcommand that requires approval … Up to 5 rules". File edits last
"Until session end". "Sometimes a permission prompt offers only a one-time
approval … Claude Code offers those options only when the prompt can show you
everything they would allow".

Measured, the rule Claude Code proposes (debug log "Permission suggestions for
Bash"):

| Command | Proposed rule |
| :- | :- |
| `<skill-dir>/shim check a` | `<skill-dir>/shim check *` |
| `"<skill-dir>/shim" check b` | `"<skill-dir>/shim" check *` |
| `node "<skill-dir>/x.mjs" a` | `node "<skill-dir>/x.mjs" a` (exact) |
| `node <skill-dir>/x.mjs <<'JSON' …` | `node <skill-dir>/x.mjs` |
| `node <skill-dir>/x.mjs "$(echo hi)"` | none ("Contains shell syntax … that cannot be statically analyzed") |
| `node … a && node … b` | two exact rules |
| `node -e 'console.log(1)'` | `node -e 'console.log(1)'` (exact) |

So one "don't ask again" covers every later `check` of a shim, but only one
exact argument list of a `node <script>` call.

### 2.3 Measured matching (`-p --permission-mode dontAsk --allowedTools …`)

| Command | Allow rule | Result |
| :- | :- | :- |
| `node "<skill-dir>/x.mjs" a` | `Bash(node *)` | ran |
| `node "<skill-dir>/x.mjs" a` | `Bash(node <skill-dir>/x.mjs *)` | denied: quoting differs from the rule text |
| `node <skill-dir>/x.mjs a` | `Bash(node <skill-dir>/x.mjs *)` | ran |
| `"<skill-dir>/shim" a` and `<skill-dir>/shim a` | `Bash(<skill-dir>/shim *)` | both ran |
| `node … a && node … b` | `Bash(node *)` | ran |
| `node … a && touch zz.txt` | `Bash(node *)` | denied |
| `node … <<'JSON' … JSON` | `Bash(node *)` | denied |
| `<shim> a <<'JSON' … JSON` | `Bash(<shim> *)` | denied |
| `<shim> a <<< '{…}'`, `printf … \| <shim> a` | `Bash(<shim> *)` | ran |
| `node … "$(echo hi)"`, `"$(date +%s)"` | `Bash(node *)` | denied |
| `node -e '…'` | `Bash(node *)` | ran |
| `cd <skill-dir> && ./shim a` | `Bash(./shim *)` | denied |

### 2.4 Skill `allowed-tools`

[Skills](https://code.claude.com/docs/en/skills) (Documented): "The
`allowed-tools` field grants permission for the listed tools during the turn
that invokes the skill … The grant clears when you send your next message".
"Claude Code substitutes `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` in
two places: the skill's markdown content, and Bash rules in the
`allowed-tools` frontmatter. In a plugin skill, Claude Code substitutes
`${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in the same two places."
Example: `allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)`. The
frontmatter table says plugin skills support every field. "Workspace trust
doesn't gate this field."

Measured: a personal Skill with
`allowed-tools: Bash(node *) Bash(${CLAUDE_SKILL_DIR}/scripts/shim *)` invoked
as `claude -p "/probe"` ran both `node <skill-dir>/scripts/x.mjs b` and
`<skill-dir>/scripts/shim a` with no prompt, in both `default` and `dontAsk`
mode. The same Skill invoked by a scripted model through the `Skill` tool did
**not** apply the grant. That contradicts the docs ("whenever you or Claude
invoke the skill"), so treat the model-invoked path as Unconfirmed: it may be
an artefact of the scripted model.

Re-measured 2026-10-02 on Claude Code 2.1.287 with the shipped
`generate-diagrams` plugin Skill
(`allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/generate-diagrams *)`,
`--plugin-dir`, `-p`, `--permission-mode default`, scripted model):

- No Skill loaded: the executable needed approval.
- `/presentation-skills:generate-diagrams`: the executable ran with no prompt.
- The model called the `Skill` tool (allowed through `--allowedTools Skill`),
  the Skill loaded, and the next call to the same executable still needed
  approval.

Same result as before. User guidance in `docs/permissions.md` treats the grant
as applying only to user invocation by name.

Install paths: Claude plugin skills honour it and get `${CLAUDE_SKILL_DIR}`
expansion (Documented). Claude Code reads personal skills from
`~/.claude/skills`, not `~/.agents/skills`
([skills](https://code.claude.com/docs/en/skills#where-skills-live)), so an
`npx skills` install reaches Claude Code only where it links into a
`.claude/skills` directory (Inferred).

### 2.5 User-side configuration

```json
{
  "permissions": {
    "allow": ["Bash(<skill-dir>/scripts/presentation-validation *)"],
    "ask": [],
    "deny": [],
    "additionalDirectories": ["<skill-dir>"]
  }
}
```

In `~/.claude/settings.json` (all projects), `.claude/settings.json`
(project, applied after workspace trust) or `.claude/settings.local.json`
(Documented). CLI flags: `--allowedTools "Bash(npm test)"`,
`--disallowedTools`, `--add-dir`. In session: `/permissions`, `/add-dir`. In
auto mode, broad interpreter rules such as `Bash(python*)` are dropped
(Documented, permission modes).

## 3. OpenAI Codex CLI

### 3.1 What is matched

Rules are Starlark `prefix_rule(pattern=[…], decision="allow"|"prompt"|"forbidden")`
loaded from `<config-folder>/rules/*.rules` for each config layer, e.g.
`~/.codex/rules/default.rules` (Source: `core/src/exec_policy.rs`,
`execpolicy/README.md`). "Tokens are matched in order"; the strictest matching
decision wins. An absolute program path matches only a rule with that
absolute first token unless host-executable resolution falls back to the
basename. Core enables that resolution (`resolve_host_executables: true`)
(Source).

Before matching, `bash -lc "<script>"` is split by
`try_parse_word_only_commands_sequence` (Source,
`shell-command/src/bash.rs`). It accepts only plain words, quoted strings and
the operators `&&`, `||`, `;`, `|`. It "returns `None`" for "parentheses,
redirections, substitutions, control flow, etc.", and the command name must be
a bare `word`. A quoted program path (`"<skill-dir>/…/shim" check`) is a
`string`, not a `word`, so the whole script stays one unsplit command and no
`prefix_rule` on the shim can match it (Source). `codex execpolicy check`
evaluates raw argv only: `node <skill-dir>/x.mjs a` matched
`prefix_rule(["node","<skill-dir>/x.mjs"])`, `node -e …` did not (Measured).

### 3.2 When Codex prompts at all

`render_decision_for_unmatched_command` (Source). For a command no rule
matches:

- `never` → allow (sandbox only).
- `untrusted` ("Internal policy for projects marked untrusted. Commands require
  approval unless an explicit exec policy rule allows them") → prompt.
- `on-request` (the `#[default]`) → allow without prompt when the filesystem
  sandbox is restricted and the model didn't request escalation. Prompt only
  when it asks to leave the sandbox.
- Any policy → prompt (or forbid under `never`) if the dangerous-command
  heuristic matches.

So under the default policy a Skill's `node "<skill-dir>/…mjs"` call runs in
the sandbox with no Permission Prompt. A prompt appears when the script needs
something the sandbox denies and the model asks to escalate (Inferred).

### 3.3 What approvals cover

- **"Yes, and don't ask again for this command in this session"**
  (`ApprovedForSession`): cache key is `canonicalize_command_for_approval(command)`
  plus cwd, tty, sandbox permissions and environment (Source,
  `core/src/tools/approvals.rs`). Canonicalization reduces `bash -lc "<one
  plain command>"` to that command's argv, and otherwise keeps the exact script
  text. Only the identical command is covered.
- **"Yes, and don't ask again for commands that start with `<prefix>`"**
  (`ApprovedExecpolicyAmendment`): appends an allow `prefix_rule` to
  `default.rules` (Source, `execpolicy/src/amend.rs`, TUI
  `approval_overlay.rs`). The model may propose the prefix. The heuristic
  fallback proposes the whole argv. Proposals equal to `["node"]`,
  `["node","-e"]`, `["python"]`, `["python","-c"]` etc. are suppressed
  (`BANNED_PREFIX_SUGGESTIONS`). The option is hidden when the prefix contains
  a newline, which covers heredoc scripts.

### 3.4 Skill frontmatter

No consumer of `allowed-tools` in the skill loader (Source: GitHub code search
finds it only in the bundled `skill-creator` validator and a memory template).
Codex reads `agents/openai.yaml` `policy.allow_implicit_invocation` /
`products` and `dependencies`, none of which approve commands (Source,
`ext/skills/src/loader/metadata.rs`). Codex can't pre-approve commands from a
Skill.

### 3.5 User-side configuration

- `~/.codex/rules/default.rules`:
  `prefix_rule(pattern = ["<skill-dir>/scripts/presentation-validation"], decision = "allow")`
  (Source; check with `codex execpolicy check --rules <file> <argv…>`).
- `~/.codex/config.toml`: `approval_policy = "on-request" | "untrusted" | "never" | { granular = {…} }`,
  `sandbox_mode = "read-only" | "workspace-write" | "danger-full-access"`,
  `[sandbox_workspace_write] writable_roots = ["…"]`,
  `[projects."<path>"] trust_level = "trusted" | "untrusted"`
  (Source, `core/config.schema.json`).
- Flags: `-a/--ask-for-approval`, `-s/--sandbox`, `--add-dir <DIR>` (writable)
  (Documented, `codex --help`).
- Default sandbox per trust level and the read scope of `workspace-write`:
  Unconfirmed (developers.openai.com unreachable).

## 4. Implications for command shape (input to #452)

- **One stable executable per Skill, called by an unquoted absolute path,
  with a subcommand.** For example, `<skill-dir>/scripts/<tool> render …`
  rather than `node "<skill-dir>/scripts/x.mjs" …`. It gives:
  - Copilot one identifier per tool (`<path>`), approvable once per session or
    per location, with no blanket `node` approval.
  - Claude Code a reusable `<tool> <subcommand> *` rule from one "don't ask
    again".
  - Codex a splittable `bash -lc` script that a `prefix_rule` can match.
  Quoting the path breaks Codex splitting and changes Copilot's identifier, so
  stable unquoted paths matter, which also means install paths without spaces
  (Inferred).
- **`node <script>` is the worst shape for repeat prompts in Claude Code**:
  every new argument list prompts again. In Copilot it is the *broadest*: one
  approval admits `node -e`. Neither is "fewer prompts, never weaker"
  (Inferred).
- **Avoid heredoc stdin and `$(…)` in commands the agent repeats.** Both
  defeat Claude Code allow rules. Both make Codex scripts unsplittable. `$(…)`
  removes Copilot's session option. Passing JSON through a file argument or a
  `<<<` here-string matched in Claude Code (Measured). Here-strings are not
  measured in Copilot or Codex.
- **Copilot's path prompt is independent of command shape.** Any script
  outside the project prompts for directory access once per session unless the
  user adds `--add-dir <skill-dir>`. Only user documentation or a
  project-local install avoids it (Inferred).
- **Skill `allowed-tools` can't be the cross-harness fix**: Codex ignores it.
  Copilot and Claude Code need different spellings. The only portable values
  (`Bash(node:*)`, `shell`) pre-approve arbitrary code. That makes the
  prompt weaker, which the map's "fewer prompts, never weaker" rule and the
  vendors' own warnings both argue against (Inferred).

## 5. Reproduction

All runs offline against a local scripted model that returns a fixed sequence
of tool calls, in throwaway config homes:

- Copilot: `COPILOT_HOME=<tmp> COPILOT_OFFLINE=true
  COPILOT_PROVIDER_BASE_URL=http://127.0.0.1:<port>/v1 COPILOT_PROVIDER_TYPE=openai
  COPILOT_PROVIDER_WIRE_API=completions copilot -p … --allow-tool=…`. For
  interactive behaviour, `copilot -i …` inside a pty. Decisions were read from
  `session-state/*/events.jsonl` (`permission.requested`/`permission.completed`)
  and the identifiers from `promptRequest.commandIdentifiers`.
- Claude Code: `CLAUDE_CONFIG_DIR=<tmp> ANTHROPIC_BASE_URL=http://127.0.0.1:<port>
  claude -p … --permission-mode dontAsk|default --allowedTools …`. Proposed
  rules came from `--debug-file` ("Permission suggestions for Bash").
- Codex: `codex execpolicy check --rules <file> -- <argv…>` (argv only; the
  `bash -lc` splitting is from source).

## Sources

- GitHub Docs: [Configure Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/configure-copilot-cli),
  [Allowing tools](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/allowing-tools),
  [Adding agent skills for GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills).
- Copilot CLI built-in help: `copilot help permissions`, `copilot help config`,
  `copilot --help` (1.0.85); bundled `changelog.json`;
  [changelog.md](https://github.com/github/copilot-cli/blob/main/changelog.md);
  `@github/copilot` bundle `app.js` and `runtime.node` (1.0.85).
- Claude Code docs: [Configure permissions](https://code.claude.com/docs/en/permissions),
  [Skills](https://code.claude.com/docs/en/skills),
  [Permission modes](https://code.claude.com/docs/en/permission-modes),
  [CLI reference](https://code.claude.com/docs/en/cli-reference).
- Codex source at [`openai/codex@a933dd7`](https://github.com/openai/codex/tree/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05):
  [`shell-command/src/bash.rs`](https://github.com/openai/codex/blob/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05/codex-rs/shell-command/src/bash.rs),
  [`core/src/exec_policy.rs`](https://github.com/openai/codex/blob/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05/codex-rs/core/src/exec_policy.rs),
  [`core/src/tools/approvals.rs`](https://github.com/openai/codex/blob/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05/codex-rs/core/src/tools/approvals.rs),
  [`core/src/command_canonicalization.rs`](https://github.com/openai/codex/blob/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05/codex-rs/core/src/command_canonicalization.rs),
  [`tui/src/bottom_pane/approval_overlay.rs`](https://github.com/openai/codex/blob/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05/codex-rs/tui/src/bottom_pane/approval_overlay.rs),
  [`protocol/src/protocol.rs`](https://github.com/openai/codex/blob/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05/codex-rs/protocol/src/protocol.rs),
  [`protocol/src/approvals.rs`](https://github.com/openai/codex/blob/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05/codex-rs/protocol/src/approvals.rs),
  [`execpolicy/README.md`](https://github.com/openai/codex/blob/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05/codex-rs/execpolicy/README.md),
  [`ext/skills/src/loader/metadata.rs`](https://github.com/openai/codex/blob/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05/codex-rs/ext/skills/src/loader/metadata.rs),
  [`core/config.schema.json`](https://github.com/openai/codex/blob/a933dd77dbe101d7bd746ea3c7d1f8174eca4a05/codex-rs/core/config.schema.json).
