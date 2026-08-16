---
name: devcontainer-agentic-clis
description: "Install agentic coding CLI binaries (Claude Code, Codex, Gemini CLI, Cursor CLI) and wire their MCP servers via a stage/verify/atomic-swap install pipeline, in a devcontainer — including one this Skill Suite didn't scaffold. Use when adding an agentic CLI to a devcontainer, wiring MCP servers safely and verifiably, or making sure an installed CLI can actually reach its own vendor API once a firewall is active. Retrofits: patches its own domains into a firewall Skill's allowlist if one is present, skips cleanly if not."
---

# devcontainer-agentic-clis

An Add-on Skill of the devcontainer-setup Skill Suite, authored as a
local-path [devcontainer Feature](https://containers.dev/implementors/features/)
— see [feature-conventions.md](../docs/feature-conventions.md) for the
mechanics every Feature-authored Skill in this suite shares. Installs
agentic CLI binaries and their MCP servers.

**Scope boundary with [devcontainer-cli-lifecycle](../devcontainer-cli-lifecycle/SKILL.md):**
this Skill owns getting a CLI or MCP server to a reviewed, working baseline
at build time, and the *mechanism* for updating one later (staging,
verifying with a real protocol handshake, atomically swapping in). It does
not decide *when* an update should happen — that age-gating policy, for
CLI binaries and MCP servers alike, belongs to `devcontainer-cli-lifecycle`,
which calls back into this Skill's own script to actually perform an
update it has already decided is age-eligible. Without
`devcontainer-cli-lifecycle` installed, everything here simply stays
pinned at its reviewed baseline until the next rebuild — a safe default,
not a missing feature.

## Install

Copy [`feature/devcontainer-agentic-clis/`](feature/devcontainer-agentic-clis/)
into your project's `.devcontainer/devcontainer-agentic-clis/`, add it to
your `devcontainer.json`'s `features` block —

```jsonc
"features": {
  "./devcontainer-agentic-clis": {}
}
```

— then edit [`install.sh`](feature/devcontainer-agentic-clis/install.sh)'s
`CLI_PACKAGES` array for the CLIs you want, and copy
`files/mcp-servers.manifest.example.json` to `files/mcp-servers.manifest.json`
if you're wiring up MCP servers (fill in each server's package, reviewed
version, and reviewed integrity hash — see below). If
[devcontainer-firewall](../devcontainer-firewall/SKILL.md) is also
installed, copy `files/cli-vendor-domains.example.json` to
`files/cli-vendor-domains.json` and fill in each installed CLI's own
vendor API/auth domains — see "An installed CLI needs its own vendor
domains allowlisted" below. Rebuild.

`install.sh` requires Node.js/npm already present on the base image (a
`devcontainer-scaffold` build-ordering concern, not this Skill's); it
installs `jq` itself, repoints `npm`'s global-install prefix under the
non-root user's home directory (mirrored into `/etc/profile.d` so it
survives login shells too — moved here from `devcontainer-scaffold` since
this is the only Skill that actually installs npm-based CLIs), then runs
both CLI and MCP installs as that non-root user so the persistent prefix and
staged MCP roots are not left root-owned. It installs each CLI package and
baseline-installs every MCP server in the manifest.

## The reliability technique: stage, verify, atomic-swap

The naive way to wire up an MCP server is to let the CLI resolve the
server package at launch time, often via `npx <package>` or an equivalent
"just fetch and run" mechanism. This works until it doesn't: `npx`
resolves whatever the npm cache or registry hands back at that exact
moment, so the version an agent gets is effectively unpinned and
unreviewable. A supply-chain compromise, or simply a breaking release
landing between two sessions, becomes something the agent discovers by
failing mid-task rather than something reviewed and approved in advance.

[`files/staged-install-handshake-atomic-swap.sh`](feature/devcontainer-agentic-clis/files/staged-install-handshake-atomic-swap.sh)
implements the fix, a general reliability pattern, not specific to MCP:

1. **Stage.** Install the candidate into a private, uniquely-named
   directory under `$HOME/.local/share/devcontainer-agentic-clis-mcp/`,
   never directly over the location a running process might be reading
   from, using an explicitly isolated `npm` cache so it can't be poisoned
   by or interfere with anything else.
2. **Verify.** Before a candidate is eligible to become active, prove it
   actually works — not just that install exited zero.
   [`files/mcp-handshake-verify.mjs`](feature/devcontainer-agentic-clis/files/mcp-handshake-verify.mjs)
   spawns the candidate, sends a real MCP `initialize` request over stdio,
   and confirms a well-formed response on the matching request id before
   completing the handshake with `notifications/initialized`. A binary
   that exists but crashes on first real use, or speaks an incompatible
   protocol version, fails this the same way a missing binary does.
3. **Atomic swap.** Only once verification passes, `rename` a symlink over
   the existing "current" pointer — atomic on the same filesystem, so
   there's no window where a concurrent reader sees a half-updated
   pointer. If staging or verification fails, the previous active version
   is never touched: a bad update degrades to "the same version stays
   active, a warning is logged," never to "nothing works."

The verify step is strict enough to fail loudly if it can't run at all,
rather than degrading silently to a warning — a session that starts with a
critical tool silently unavailable is worse than a container that refuses
to start until the tool is confirmed working.

## The version-skew trap: don't trust a bundled resolver

An MCP server package that bundles its own copy of a browser-automation or
runtime-discovery library will often try to resolve its own idea of which
binary to launch, which can silently diverge from whatever your project's
own tooling actually has installed and pinned. A `--browser <name>`-style
flag on such a tool may not even mean "the plain build of that browser" —
it can map to a differently-branded distribution channel your project
never installed. The reliable fix is to stop trusting the bundled
resolver's guesswork: scan the actual cache directory your own tooling
installs browser binaries into, find the highest revision matching the
expected path shape, and pass it explicitly via whatever "use exactly this
executable" flag the MCP server exposes.

## An installed CLI needs its own vendor domains allowlisted, not just whatever installed it

A container where every CLI is installed and MCP-wired, sitting behind a
firewall scoped only for package registries, still can't serve a single
prompt: a CLI's own vendor API (its inference backend, its auth endpoint,
often a separate telemetry or CDN subdomain too) is a categorically
different domain list from whatever registry installed the binary.

[`files/patch-firewall-domains.sh`](feature/devcontainer-agentic-clis/files/patch-firewall-domains.sh),
this Skill's `postCreateCommand`, patches
[`files/cli-vendor-domains.json`](feature/devcontainer-agentic-clis/files/cli-vendor-domains.example.json)
(one entry per CLI: domains, why, upstream docs) into
`devcontainer-firewall`'s allowed-domains manifest as `<key>-vendor-api`
entries, if that Skill is installed — detected by checking whether its
manifest file exists at all, and skipped cleanly, not as an error, if not
(the Retrofit Contract from [CONTEXT.md](../CONTEXT.md)). This runs at
`postCreateCommand` time, an earlier lifecycle phase than
`devcontainer-firewall`'s own `postStartCommand` that reads the
now-patched manifest — the devcontainer spec guarantees every Feature's
`postCreateCommand` completes, across the whole container, before any
`postStartCommand` runs, so this ordering is correct regardless of which
Skill was installed first.

Verify this for real: run a prompt through the CLI inside the built,
firewalled container, not just a version check — a wiring-complete CLI
that can't reach its own backend fails in a way no version check catches.

## Tool listing works without an approval bypass; invocation doesn't

Verifying MCP wiring inside a non-interactive, no-TTY context (a CI job, a
scripted health check, a `--print`/`exec`-style one-shot invocation):
expect a split. **Listing** which tools a connected MCP server registers
typically works without any special approval flag; **invoking** one is
commonly gated behind an interactive-approval step a non-interactive
session can't satisfy by default. For automated health checking this is
good news — confirming a server is reachable and its tools are registered
doesn't require an approval-bypass flag at all. Reserve those flags for
deliberate, one-off manual verification, not routine automation, since
they typically also bypass other safety gates (sandboxing, exec policy) at
the same time.

## Where the big agentic CLIs read MCP config from, and what surprised us

Each agentic CLI reads its MCP server configuration from a different
location, and trust/auto-detection behavior does not generalize from one
to the next. Verify each empirically for the specific versions in use —
[`files/per-cli-mcp-config-checklist.md`](feature/devcontainer-agentic-clis/files/per-cli-mcp-config-checklist.md)
is the copyable checklist for doing that, including the vendor-domains
column this Skill's own patch script consumes.

| CLI | Typical MCP config location | What surprised us |
|---|---|---|
| Claude Code | A project-root config file (e.g. `.mcp.json`), auto-detected by cwd | Works with no extra step once the file is in place and the CLI is launched from within the project; no explicit "activate this project" call needed. |
| Antigravity-style CLI | A project-specific config path (e.g. under an `.agents/` directory) | A non-interactive, single-shot invocation mode did **not** auto-detect the current directory as a project in testing; workspace config was only read once an explicit project context was established. Interactive use is expected to auto-detect the way Claude Code does — that interactive/non-interactive difference is easy to miss if you only test one mode. |
| Codex-style CLI | A project-root TOML config file (e.g. `.codex/config.toml`), merged with a global user-level config | A per-project "trust level" setting, which does gate other project-local features, turned out **not** to gate whether MCP server configuration loads at all — confirmed directly: a worktree with no trust entry still had its MCP servers listed and available. Check with that CLI's own diagnostic command rather than assuming. |

The general lesson, independent of which CLIs you're integrating: never
assume config-location or trust-scoping parity across agentic CLIs, even
ones that otherwise look similar. Confirm each one's actual behavior with
its own diagnostic commands, not another CLI's conventions.

## Verification

Build, boot from a clean state, and confirm each `CLI_PACKAGES` entry
resolves on `PATH` under both a login shell and a non-login one. For each
MCP server, run `staged-install-handshake-atomic-swap.sh health <key>` and
confirm it passes. Then the check that matters most and is easiest to
skip: actually run a prompt through each installed CLI inside the built,
firewalled container, confirming it can reach its own vendor API, not just
that its version command succeeds.
