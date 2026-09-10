# Research: do the four CLIs now offer first-class auto/yolo modes that supersede the hand-rolled `yolo-alias-block.sh` aliases?

## Question

Issue [#254](https://github.com/ken-guru/skills/issues/254) asks: for each of the
four `skills/setup-devcontainer/templates/<cli>/yolo-alias-block.sh` files
(Claude Code, Codex, Antigravity, Copilot), does that CLI's **current, vendor-owned
official documentation** now expose a first-class auto/permissive/"yolo" run mode —
a single flag, persistent setting, or env var — that is simpler than, or supersedes,
the hand-rolled flag combination each alias currently wraps? If such a mode exists,
what is its exact syntax and citation, does adopting it change any of the
security/sandbox reasoning already recorded in that template's comments, and what is
the vendor's own terminology for the concept? Research was done exclusively against
vendor-owned doc sites (`code.claude.com`, `www.anthropic.com/engineering`,
`developers.openai.com`/`learn.chatgpt.com`, `antigravity.google`, `docs.github.com`)
plus the vendor's own GitHub issue tracker for one specific bug citation — never
blogs, Stack Overflow, or training-data memory.

## Findings

### Claude Code

**Current alias**: `alias claude-yolo="claude --permission-mode auto --worktree --remote-control"`

The exact flag the alias already uses, `--permission-mode auto`, is still the
current, first-class, vendor-documented mechanism, and Anthropic's own
terminology for it is **"auto mode."** As of the current
[Choose a permission mode](https://code.claude.com/docs/en/permission-modes) page,
auto mode is not just alive, it has become the *built-in default* starting
permission mode on Pro, Max, and Team plans (Claude Code v2.1.228+ on
macOS/Linux/WSL, v2.1.233+ on native Windows): "On Pro, Max, and Team plans, the
built-in starting permission mode is auto mode." Auto mode routes every action
through "a second model, the classifier," rather than eliminating review the way
`--dangerously-skip-permissions` (`bypassPermissions` mode) does.

The docs draw the same distinction the alias's comment already draws, and state it
more strongly than before: the auto-mode classifier's own default block list
includes "Launching an autonomous agent loop that runs without human approval or a
sandbox, such as one started with `--dangerously-skip-permissions` or
`--no-sandbox`." The permission-modes page's "Common setups" table also frames
`bypassPermissions`/`--dangerously-skip-permissions` as something to run only
"fully unattended inside a container," requiring "a container, VM, or the sandbox
runtime" and, "on Linux and macOS, ... a non-root user" — and a Troubleshooting
note in [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)
confirms `--dangerously-skip-permissions` is flatly **blocked when run as root or
via sudo** on Linux/macOS. None of this contradicts the alias; it reinforces
"don't swap in `--dangerously-skip-permissions`."

One nuance worth flagging: the current sandboxing doc explicitly describes
`/sandbox` (the opt-in bubblewrap/Seatbelt Bash sandbox) and
`--dangerously-skip-permissions`/`bypassPermissions` as two **independent,
orthogonal** layers — a comparison table states `/sandbox` controls "What a Bash
command can access once it runs" while `--dangerously-skip-permissions` controls
"Whether each tool call runs," with "Nothing" replacing the prompt. Current docs do
not frame `--dangerously-skip-permissions` as itself *triggering* the bwrap
sandbox the way the alias's comment phrases it. That said, the underlying failure
mode the comment warns about — a worktree failing a git-identity check — is still a
live, documented mechanism: [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees)
has a dedicated Troubleshooting section, "Claude Code refuses to use a worktree,"
describing exactly this kind of git-identity-based refusal, and the sandboxing doc
now carries a dedicated "Git worktrees" carve-out (allowing writes to the shared
`.git` directory) that didn't need to exist unless worktree/sandbox interaction was
an active problem area. This is corroborating context, not an independent
reproduction of the exact bwrap-mount-namespace claim — it should be treated as
"still plausible and still worth the warning," not as freshly vendor-confirmed
verbatim.

`--worktree` (`-w`) and `--remote-control` are both still current, documented flags
(worktrees page; permission-modes page's Remote Control tab, e.g.
`claude remote-control --permission-mode acceptEdits`). No newer single flag
unifies approval-automation, filesystem isolation, and remote visibility into one
switch — they remain three independent axes, so the alias's three-flag combination
is still the correct, current way to combine them.

**Recommendation: keep hand-rolled alias as-is.** `--permission-mode auto` is the
exact, current, vendor-recommended, and now vendor-*default* syntax; nothing
simpler supersedes it, and the "avoid `--dangerously-skip-permissions`" reasoning
is, if anything, more strongly endorsed by current docs than before.

### Codex

**Current alias**: `alias codex-yolo="codex --ask-for-approval on-request --sandbox workspace-write -c sandbox_workspace_write.network_access=true"`

Current OpenAI docs confirm this exact flag combination, `--sandbox workspace-write
--ask-for-approval on-request` (short forms `-s workspace-write -a on-request`), is
still live and is explicitly the vendor-recommended pattern for local development:
"For local development work, combine flags: `--sandbox workspace-write
--ask-for-approval on-request`" ([Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli),
reached via a 308 redirect from `developers.openai.com/codex/cli/reference`). The
`-c sandbox_workspace_write.network_access=true` config-override syntax the alias
uses is also confirmed current, exposed under `[sandbox_workspace_write]` /
`sandbox_workspace_write.network_access` in
[Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)
(redirected from `developers.openai.com/codex/agent-approvals-security`).

There is **no newer, simpler single flag** that collapses this. If anything, the
vendor has moved in the opposite direction: `--full-auto`, which used to be a
shorthand, is now explicitly **deprecated** — "Deprecated compatibility flag.
Prefer `--sandbox workspace-write`; Codex prints a warning when this flag is used"
— meaning the two-flag explicit combination the alias already uses is the more
current, more correct form, not a workaround for something better.

The `on-request` vs. full-bypass distinction the alias's comment relies on is still
live and correctly described: `--dangerously-bypass-approvals-and-sandbox` (alias:
`--yolo`) is documented as running "every command without approvals or
sandboxing. Only use inside an externally hardened environment" — matching the
alias comment's warning almost verbatim. The container-privilege reasoning in the
alias's comment (Compose `cap_add`/`security_opt` grants enabling the Bubblewrap
namespace) is also corroborated: current docs warn "the sandbox may not work if the
host or container configuration blocks the namespace, setuid `bwrap`, or `seccomp`
operations."

Vendor terminology: docs refer to the `-s workspace-write -a on-request` combination
informally as the **"Auto preset"** (per secondary vendor-adjacent context found
during search) and use "approval policy" / "sandbox policy" as the two named
underlying settings; the full-bypass mode has an official `--yolo` alias, so
OpenAI's own naming for the risky end of the spectrum is literally "yolo."

**Recommendation: keep hand-rolled alias as-is.** Exact match to the current,
vendor-recommended "local development" flag combination; the `on-request` vs.
`--dangerously-bypass-approvals-and-sandbox` distinction remains correct and live,
and the deprecation of `--full-auto` actually reinforces keeping the explicit,
two-flag form.

### Antigravity

**Current alias**: `alias agy-yolo="agy --mode accept-edits"`

Current Google docs ([Choose an execution mode](https://antigravity.google/docs/cli/modes/))
confirm exactly three execution modes — `default`, `accept-edits`, `plan` — and
confirm the alias's exact launch syntax: "You can launch directly in accept-edits
mode with `agy --mode=accept-edits`." There is **no fourth, more-permissive
"yolo"/full-auto execution mode** documented beyond `accept-edits`; the docs
explicitly separate execution modes from sandboxing: "`sandbox` is an OS
containment permission setting, not an execution mode." [Using AGY CLI](https://antigravity.google/docs/cli/using/)
confirms `--dangerously-skip-permissions` exists as a flag but documents it as
governing shell commands (`run_command`) "across all execution modes" — i.e., it
sits orthogonal to `--mode`, not as a replacement for it.

The bug the alias's comment cites,
[google-antigravity/antigravity-cli#36](https://github.com/google-antigravity/antigravity-cli/issues/36)
("Agent can bypass sandbox when combining `--sandbox` with
`--dangerously-skip-permissions`"), was checked directly against the vendor's own
issue tracker and is **confirmed still open** as of 2026-09-04 (six days before
this research), with no linked fix PR. The issue's own description matches the
alias's comment precisely: "`--dangerously-skip-permissions` does not only
auto-approve 'regular' permission requests, but also auto-approves the prompt for
whether the agent is allowed to bypass the sandbox... the sandbox becomes a no-op
because the model receives hints to pass `bypassSandbox: true`... a regression from
Gemini CLI." The proposed fix (never allow `bypassSandbox` without explicit
confirmation, and never in headless `-p` mode) is unmerged. This is the strongest,
most directly vendor-confirmed finding in this research: the exact hazard the
alias's comment warns against is still live in the vendor's own bug tracker today.

The `permissions.allow` curated-list mitigation the alias's comment recommends
(`~/.antigravity/antigravity-cli/settings.json`) is broadly consistent with current
docs, which describe permission control via `/config` or `/permissions`, though the
fetched pages did not independently re-confirm that exact settings-file path
verbatim — worth a follow-up spot-check if precision on that path matters later,
but nothing found contradicts it.

Vendor terminology: **"execution mode"** is Google's own term for the
default/accept-edits/plan axis; there is no vendor-branded "yolo mode" name in the
docs fetched — "yolo" only appears in third-party commentary, not in
`antigravity.google`'s own pages.

**Recommendation: keep hand-rolled alias as-is.** `--mode accept-edits` is still
the correct, current, and only non-buggy semi-autonomous mode; the sandbox-bypass
bug the alias warns against (antigravity-cli#36) is independently confirmed still
open against the vendor's own tracker, so the "do not combine
`--dangerously-skip-permissions` with `--sandbox`" warning is not just still valid
but freshly reverified.

### Copilot

**Current alias**: `alias copilot-yolo="echo '...manual /sandbox enable...'"` (a
placeholder — the comment states Copilot CLI has no unattended/auto-approve flag)

This is the one CLI where the premise behind the current alias has changed.
Current GitHub docs ([Allowing and denying tool use](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/allowing-tools)
and [Allowing GitHub Copilot CLI to work autonomously](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/autopilot))
show Copilot CLI **now has** real auto-approve flags:

* `--allow-tool` / `--deny-tool` — comma-separated per-tool allow/deny lists
* `--allow-all-tools`, `--allow-all-paths`, `--allow-all-urls` — permissive grants
  per resource category
* `--allow-all` (alias `--yolo`) — "Equivalent to using all of the
  `--allow-all-tools`, `--allow-all-paths`, and `--allow-all-urls` options when
  starting the CLI"
* `--autopilot` — runs Copilot CLI through steps unattended until it decides the
  task is complete, with `--max-autopilot-continues <N>` to cap runaway loops. The
  docs' own suggested unattended invocation is: `--autopilot --yolo
  --max-autopilot-continues 10`
* Mid-session equivalents: `/allow-all` and `/yolo` slash commands

This directly contradicts the "Copilot CLI has NO unattended/auto-approve flag of
its own" premise the current placeholder alias's comment states — that premise is
no longer accurate against current vendor docs (whether it changed after the
alias was written, or was missed at the time, is not established either way).

Two caveats worth flagging as real regression risk before swapping this in:

1. **The vendor explicitly warns against exactly the alias pattern this skill
   uses.** The allowing-tools doc states in a caution block: "It is strongly
   recommended that you only use these options in an isolated environment. **You
   should never use an alias to apply one of these options every time you start
   Copilot CLI.**" That is a direct, vendor-stated objection to shipping
   `--allow-all`/`--yolo` inside a persistent shell alias, which is the exact
   mechanism `yolo-alias-block.sh` uses for all four CLIs. The Tool Container
   *is* an isolated environment (the premise the other three aliases already rely
   on), which plausibly satisfies the spirit of the warning, but the letter of the
   warning specifically targets the alias mechanism itself, not just the flag's
   use — this should be weighed explicitly if #254's resolution adopts a Copilot
   alias.
2. Sandboxing is a separate, still-current layer: the vendor's own `/sandbox`
   interactive config (`General`, `Auth`, `Filesystem`, `Network` tabs, with
   `/sandbox enable` / `/sandbox disable` shortcuts, confirmed in
   [Configuring local sandbox settings](https://docs.github.com/en/copilot/how-tos/cloud-and-local-sandboxes/configuring-local-sandbox-settings))
   is exactly what the current placeholder alias already echoes as the manual
   step. Docs pair `--allow-all` with "consider using local sandboxing" the same
   way Codex pairs `--sandbox workspace-write` with `--ask-for-approval
   on-request` — i.e., the vendor-recommended pattern for unattended-but-bounded
   use is auto-approve **plus** sandbox, not auto-approve alone. Whether
   `/sandbox enable` can be made to persist non-interactively (so an alias could
   set both flags at once) was not confirmed in the fetched pages — settings are
   stored under a `sandbox` key in a `settings.json` config file, but no
   documented CLI flag or env var was found to set it at launch, so a
   fully-scripted "auto-approve + sandboxed" single-line alias may not yet be
   achievable without a one-time interactive `/sandbox enable` step first,
   mirroring the current placeholder's manual instruction.

Vendor terminology: **"autopilot mode"** for the unattended-execution concept;
"auto-approve" / "allow-all" for the permission-bypass concept; no single branded
"yolo mode" name (`--yolo` exists as a flag/slash-command alias, but the docs don't
use "yolo" as prose terminology the way "auto mode" is used for Claude Code).

**Recommendation: replace with built-in equivalent, but flag the regression
risk.** A real auto-approve flag now exists — `--allow-all` (or `--yolo`), and for
fully unattended runs the vendor's own pattern `--autopilot --yolo
--max-autopilot-continues <N>` — so "no such flag exists" is no longer accurate.
However, this is the one CLI in the batch where the vendor's own docs *explicitly
warn against aliasing the exact flag being proposed*, so any replacement should
either (a) keep the alias as an interactive reminder/manual gate rather than a
silent auto-approve wrapper, or (b) proceed with an `--allow-all`/`--autopilot`
alias only with that vendor warning surfaced in the skill's own comment, the same
way the other three templates already surface their own vendor-specific caveats.

## Conclusion

Three of the four CLIs — Claude Code, Codex, Antigravity — have vendor docs that
independently reconfirm the *exact* flag syntax and security reasoning each
`yolo-alias-block.sh` template already encodes, with no simpler or newer
vendor-first-class mode superseding them. In two of those three cases the vendor
docs have moved in a direction that *reinforces* the existing choice: Claude Code's
`--permission-mode auto` graduated from an available mode to the vendor's own
default, and Codex's explicit `--sandbox workspace-write --ask-for-approval
on-request` combination is now favored over the deprecated `--full-auto` shortcut.
For Antigravity, the cited sandbox-bypass bug (antigravity-cli#36) was
independently reverified as still open against the vendor's own tracker, so the
"don't combine `--dangerously-skip-permissions` with `--sandbox`" warning is not
stale — it is current and vendor-tracker-confirmed as of six days before this
research.

Copilot is the outlier and the one finding worth acting on: contrary to the
existing comment, Copilot CLI now ships real auto-approve and autopilot flags
(`--allow-all`/`--yolo`, `--autopilot`, `--max-autopilot-continues`). The
placeholder alias's premise ("Copilot CLI has no unattended/auto-approve flag of
its own") is out of date. But the fix isn't a simple drop-in swap: GitHub's own
docs explicitly warn against exactly the "alias a permissive flag for every
session start" pattern this skill's convention uses, which is a direct tension
worth resolving deliberately in #254 rather than silently.

## Source citations

- Claude Code — [Choose a permission mode](https://code.claude.com/docs/en/permission-modes)
  (auto mode definition, `--permission-mode auto` syntax, built-in default on
  Pro/Max/Team, `bypassPermissions`/`--dangerously-skip-permissions` container/
  non-root requirement, classifier's default block list including
  `--dangerously-skip-permissions`/`--no-sandbox` loops)
- Claude Code — [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)
  (`/sandbox` vs. `--dangerously-skip-permissions` framed as independent layers;
  root/sudo block on `--dangerously-skip-permissions`; "Git worktrees" filesystem
  carve-out)
- Claude Code — [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees)
  (`--worktree`/`-w` current syntax; "Claude Code refuses to use a worktree"
  git-identity-check troubleshooting section; `EnterWorktree` approval-prompt
  behavior under `bypassPermissions`)
- Anthropic Engineering — [How we built Claude Code auto mode: a safer way to skip permissions](https://www.anthropic.com/engineering/claude-code-auto-mode)
  (classifier architecture, "auto mode" terminology, comparison framing against
  `--dangerously-skip-permissions`)
- OpenAI/Codex — [Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)
  (redirected from `developers.openai.com/codex/agent-approvals-security`) —
  approval-policy values, sandbox-mode values, `--dangerously-bypass-approvals-and-sandbox`
  description, `sandbox_workspace_write.network_access` config key, container/bwrap
  namespace requirement note
- OpenAI/Codex — [Developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
  (redirected from `developers.openai.com/codex/cli/reference`) — exact
  `--ask-for-approval`/`-a`, `--sandbox`/`-s`, `--dangerously-bypass-approvals-and-sandbox`/
  `--yolo`, and deprecated `--full-auto` flag descriptions; "local development work"
  recommended combination quote
- Google Antigravity — [Choose an execution mode](https://antigravity.google/docs/cli/modes/)
  (three execution modes; exact `agy --mode=accept-edits` syntax; "sandbox is an OS
  containment permission setting, not an execution mode")
- Google Antigravity — [Using AGY CLI](https://antigravity.google/docs/cli/using/)
  (`--dangerously-skip-permissions` governs shell commands across all execution
  modes; permission control via `/config`/`/permissions`)
- GitHub — [google-antigravity/antigravity-cli issue #36](https://github.com/google-antigravity/antigravity-cli/issues/36)
  ("Agent can bypass sandbox when combining `--sandbox` with
  `--dangerously-skip-permissions`" — confirmed open, `state: open`, `closed_at:
  null`, `updated_at: 2026-09-04`)
- GitHub Copilot — [Allowing and denying tool use](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/allowing-tools)
  (`--allow-tool`/`--deny-tool`, `--allow-all-tools`/`--allow-all-paths`/
  `--allow-all-urls`, `--allow-all`/`--yolo` equivalence, "never use an alias"
  caution)
- GitHub Copilot — [Allowing GitHub Copilot CLI to work autonomously](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/autopilot)
  ("autopilot mode" terminology, `--autopilot --yolo --max-autopilot-continues 10`
  recommended unattended invocation, `/allow-all`/`/yolo` slash commands, local/
  cloud sandboxing recommendation)
- GitHub Copilot — [Configuring local sandbox settings](https://docs.github.com/en/copilot/how-tos/cloud-and-local-sandboxes/configuring-local-sandbox-settings)
  (`/sandbox enable`/`/sandbox disable`, settings stored under a `sandbox` key in
  `settings.json`, no confirmed launch-time flag/env var for persistent sandbox
  default)
- GitHub Copilot — [Configuring GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/configure-copilot-cli)
  (sandboxing framed as risk mitigation alongside permissive flags)
- Repo files read in full before this research: `skills/setup-devcontainer/templates/codex/yolo-alias-block.sh`,
  `skills/setup-devcontainer/templates/claude-code/yolo-alias-block.sh`,
  `skills/setup-devcontainer/templates/antigravity/yolo-alias-block.sh`,
  `skills/setup-devcontainer/templates/copilot/yolo-alias-block.sh`
- Issue [#254](https://github.com/ken-guru/skills/issues/254) — this research
  ticket
