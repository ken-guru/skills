# PROTOTYPE — Running the Live Install recipe for Claude Code

> Companion to [live-install-recipe.PROTOTYPE.md](live-install-recipe.PROTOTYPE.md). This is
> the recipe actually followed, live, on 2026-09-09, for one real CLI — Claude Code, chosen
> because [PR #225](https://github.com/ken-guru/skills/pull/225) already implemented
> version-pinning for it by hand, giving a real Baked Install to compare against. Not adopted
> skill behavior.

## Inputs used

- `{{CLI_DISPLAY_NAME}}` = "Claude Code", `{{CLI_SLUG}}` = `claude-code`.
- `{{TRUSTED_HOSTNAME_FAMILY}}` = `code.claude.com` (docs), `claude.ai` (install script),
  `downloads.claude.ai` (signed package repos, release manifest) — per [the research ticket's
  findings](https://github.com/ken-guru/skills/blob/research/live-cli-docs-verification-policy/skills/setup-devcontainer/docs/research/live-cli-docs-verification-policy.md).
- `{{WANTS_VERSION_PIN}}` = true (to exercise item 4 against PR #225's real implementation).

## Resolution, item by item

**1. Install command.** Fetched `https://code.claude.com/docs/en/setup` directly (in-family).
States exactly: `curl -fsSL https://claude.ai/install.sh | bash`. Cross-checked against the
same page's own Windows section (consistent narrative, same domain) — no disagreement found.
**Matches today's Baked Install exactly.**

**2. Binary path / idempotency check.** Same page states native installs land at
`~/.local/bin/claude`. **Matches today's Baked Install exactly**
(`$HOME/.local/bin/claude` in `templates/claude-code/post-create-block.sh`).

**3. Non-interactive flag.** The docs describe no interactive prompts during
`curl | bash` — installation is unattended by default. **Resolved: none needed**, matching
today's actual behavior (no env var passed, unlike Codex's `CODEX_NON_INTERACTIVE=1`).

**4. Version-pinning mechanism.** The install script accepts a positional version argument:
`curl -fsSL https://claude.ai/install.sh | bash -s <version>`. This resolves cleanly from
docs and **matches PR #225's actual implementation exactly**
(`bash -s "${CLAUDE_CODE_VERSION}"`).

**5. Wide-permissions / auto-approve config — the interesting case.** Fetched
`https://code.claude.com/docs/en/settings` (in-family). It documents
`permissions.defaultMode` with a `bypassPermissions` value, and states explicitly: *"values
`auto` and `bypassPermissions` don't take effect from project or local settings; set them in
user or managed settings instead"* — and separately, that **managed settings sit above every
other level and can't be overridden by anything else** (Settings Files and Precedence page,
same domain).

Docs alone would suggest either the user settings file (`~/.claude/settings.json`) or the
managed settings file (`/etc/claude-code/managed-settings.json`) works, since both outrank
project/local settings. **This is exactly where the recipe's stated limit bites**: PR #225
already discovered, by actually running a container (not by reading docs), that Claude Code's
first-run onboarding overwrites `~/.claude/settings.json` wholesale — so a value written there
survives only until the user completes onboarding, then silently vanishes. Only the *managed*
settings file survives, because onboarding is a user-level flow with no write access to
`/etc/claude-code/`. No docs page states this onboarding-overwrite behavior; PR #225's own
comment says it was "confirmed live."

**Resolved output, adopting PR #225's already-proven managed-settings.json mechanism and
extending it with one more key** (both keys share one file, one read-merge-write, one
justification):

```json
{
  "env": { "DISABLE_AUTOUPDATER": "1" },
  "permissions": { "defaultMode": "bypassPermissions" }
}
```

**6. Auth wiring.** No docs page describes anything beyond `chown_config_volume "$HOME/.claude"`
plus an interactive `claude login`/OAuth flow on first use — **matches today's Baked Install
exactly**, no change.

## Rendered output

**Dockerfile snippet:** none needed — Claude Code needs no build-time step beyond the shared
base image, same as today.

**Post-create-block snippet** (compare directly against
[templates/claude-code/post-create-block.sh](../../templates/claude-code/post-create-block.sh)
as PR #225 leaves it):

```bash
chown_config_volume "$HOME/.claude"

managed_settings_file="/etc/claude-code/managed-settings.json"
sudo mkdir -p "$(dirname "$managed_settings_file")"
[ -f "$managed_settings_file" ] || echo '{}' | sudo tee "$managed_settings_file" > /dev/null

if [ "${DISABLE_AUTOUPDATER:-false}" = "1" ]; then
  jq '.env.DISABLE_AUTOUPDATER = "1"' "$managed_settings_file" | sudo tee "$managed_settings_file.tmp" > /dev/null && sudo mv "$managed_settings_file.tmp" "$managed_settings_file"
else
  jq 'if .env then .env |= del(.DISABLE_AUTOUPDATER) else . end' "$managed_settings_file" | sudo tee "$managed_settings_file.tmp" > /dev/null && sudo mv "$managed_settings_file.tmp" "$managed_settings_file"
fi

if [ "${CLAUDE_WIDE_PERMISSIONS:-false}" = "1" ]; then
  jq '.permissions.defaultMode = "bypassPermissions"' "$managed_settings_file" | sudo tee "$managed_settings_file.tmp" > /dev/null && sudo mv "$managed_settings_file.tmp" "$managed_settings_file"
else
  jq 'if .permissions then .permissions |= del(.defaultMode) else . end' "$managed_settings_file" | sudo tee "$managed_settings_file.tmp" > /dev/null && sudo mv "$managed_settings_file.tmp" "$managed_settings_file"
fi

if [ ! -x "$HOME/.local/bin/claude" ]; then
  if [ "${CLAUDE_CODE_VERSION:-latest}" = "latest" ]; then
    curl -fsSL https://claude.ai/install.sh | bash
  else
    curl -fsSL https://claude.ai/install.sh | bash -s "${CLAUDE_CODE_VERSION}"
  fi || echo "Warning: Claude Code CLI install failed, continuing without it" >&2
fi
```

## Verdict on the four checklist items other than #5

Items 1, 2, 3, and 6 resolved cleanly from live docs and **matched today's hand-written Baked
Install exactly**, with no discrepancy and no ambiguity — for a CLI whose Baked Install is
already this thin (see [#226](https://github.com/ken-guru/skills/issues/226)'s own framing:
today's mechanism is already "pipe the vendor's installer," not a bespoke reimplementation),
Live Install reproduces the same result the maintainer would have written by hand, just
without needing a human to have read the docs first.

## Verdict on item 5 — the one that matters for the map's Final call

This is real evidence for [Final call: adopt or reject Live
Install](https://github.com/ken-guru/skills/issues/231): **the generalized recipe, followed
correctly against genuine live docs, does not on its own discover the onboarding-overwrite
behavior that makes managed-settings.json necessary instead of user settings.json.** Docs
state both locations are valid outranking choices; only live experimentation surfaced which
one actually survives. An agent following this recipe with no other input would plausibly
have written to `~/.claude/settings.json` and shipped something that looks correct, passes
review, and then silently breaks the first time a real user completes onboarding — precisely
the kind of failure Baked Install already experienced once, with Copilot's pin-then-revert
history (`Error auto updating: TypeError: Invalid Version: latest`).

This doesn't mean Live Install fails as a concept — for three of four vendors' Baked Install
blocks, live docs alone are already sufficient (per §"Verdict on the four checklist items").
But it does mean the recipe's stated limit isn't hypothetical: **for at least this one
checklist item, out of four CLIs' worth of resolved commands to date, a docs-only resolution
would have been wrong in a way only running the result reveals.** Whether that's addressed by
a required "test it once before trusting it" step, an accumulated per-CLI-quirks knowledge
base the recipe consults alongside live docs, or accepted as a residual risk no worse than
today's, is exactly the call [Final call: adopt or reject Live
Install](https://github.com/ken-guru/skills/issues/231) needs to make.
