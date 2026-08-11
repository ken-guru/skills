---
name: devcontainer-cli-lifecycle
description: "Age-gate auto-updated CLI binaries and MCP servers in a devcontainer against a minimum release age, failing safe whenever a release's age can't be confirmed. Use when you want an agentic CLI or MCP server to auto-update at container start without adopting a just-published, unreviewed release. Retrofits: reads devcontainer-agentic-clis' own manifest directly if that Skill is installed, skips MCP-server gating cleanly if not."
---

# devcontainer-cli-lifecycle

An Add-on Skill of the devcontainer-setup Skill Suite, authored as a
local-path [devcontainer Feature](https://containers.dev/implementors/features/)
— see [feature-conventions.md](../docs/feature-conventions.md) for the
mechanics every Feature-authored Skill in this suite shares. Age-gates
auto-updated agent tooling: a registry, a release feed, or a signed
manifest can serve a just-published version that hasn't had time for the
community to notice something wrong with it, so the runtime auto-update
path needs its own, narrower mitigation than a reviewed rebuild-time
pin — it runs unattended and unreviewed on every container start.

**Scope boundary with [devcontainer-agentic-clis](../devcontainer-agentic-clis/SKILL.md):**
that Skill owns getting a CLI or MCP server to a reviewed baseline and the
*mechanism* for updating one (staged install, protocol-handshake verify,
atomic swap, for MCP servers specifically). This Skill owns the *policy* —
deciding *when* an update is age-eligible, for CLI binaries and MCP
servers alike — and, for an MCP server specifically, calls back into
`devcontainer-agentic-clis`' own script to actually perform an update this
Skill has already decided is eligible, rather than reimplementing
protocol-handshake verification here.

## Install

Copy [`feature/devcontainer-cli-lifecycle/`](feature/devcontainer-cli-lifecycle/)
into your project's `.devcontainer/devcontainer-cli-lifecycle/`, add it to
your `devcontainer.json`'s `features` block —

```jsonc
"features": {
  "./devcontainer-cli-lifecycle": {}
}
```

— then copy `files/tool-manifest.example.json` to `files/tool-manifest.json`
and fill in each CLI binary you want age-gated (see "Two tool kinds, two
manifests" below — MCP servers need no separate entry here). Rebuild.

## The pattern: minimum release age, fail-safe on uncertainty

Every auto-updated tool declares a minimum release age in days. Once a
newer version is known to exist, only a candidate that's been public at
least that long is eligible to install. This buys a review window: most
rapidly-discovered supply-chain incidents surface within a few days of
publication, so a tool that waits that long skips the highest-risk period
without giving up on staying current indefinitely.

The critical design decision is what happens when a release's age *can't
be determined at all* — not "is it too young" but "how old even is it." A
registry lookup can fail. A changelog's markup can change shape. A
timestamp can fail to parse. The correct behavior in every one of these
cases is identical to "too young": hold, do not update. Absence of proof
of age must be treated as insufficient age, never as a pass — a code path
that treats "I couldn't check" as "probably fine" turns the whole
mitigation into decoration, since an attacker (or a broken parser) doesn't
need to defeat the age check, only to make it fail to answer.
[`files/run-age-gate.sh`](feature/devcontainer-cli-lifecycle/files/run-age-gate.sh)'s
`determine_age_gated_target` returns non-zero in exactly this case, and
every caller treats that identically to the too-young branch.

This naturally produces three distinct kinds of "not updating right now,"
surfaced separately rather than collapsed into one generic message: a
known candidate that hasn't cleared the age bar yet (self-resolving, as
time passes); release history available but nothing in it clears the bar
(self-resolving, once a new release appears); and the newest known
release's age couldn't be established at all (recurs indefinitely until
the underlying lookup is fixed — worth different operational attention
than the other two).

## Falling back gracefully, where the distribution channel allows it

For a tool distributed through a registry with full version history (npm,
for instance), a release too young to install doesn't have to mean holding
at the current version: the gate walks backward through release history
and installs the newest release that both postdates what's installed and
clears the age bar, bounded above by the independently-confirmed true
latest so a stale secondary source can never win. A tool whose only
verified download is "whatever the vendor's manifest currently calls
latest" (no historical, per-version endpoint) can't fall back to an older
release even if it wanted to — for that channel shape, the gate
degenerates to a binary question: is the current latest old enough? That's
not a shortcoming; it's an honest reflection of what the channel offers.
Don't build a fallback branch that has nowhere to go.

## Two tool kinds, two manifests, two update mechanisms

**CLI binaries** — this Skill's own
[`files/tool-manifest.example.json`](feature/devcontainer-cli-lifecycle/files/tool-manifest.example.json).
An age-eligible update applies as a plain `npm install -g <package>@<target>`,
verified by `<binary> --version` afterward. No staging: a CLI binary has no
MCP handshake to verify (the same reasoning `devcontainer-agentic-clis`
uses for why its own build-time CLI installs skip staging too), and npm's
own per-package install already has reasonable internal atomicity — a
failed update is a rare, visible failure logged for the next cycle to
retry, not a routine risk this Skill engineers a second staging mechanism
around.

**MCP servers** — `devcontainer-agentic-clis`' own
`mcp-servers.manifest.json`, read directly at a fixed path
(`.devcontainer/devcontainer-agentic-clis/feature/devcontainer-agentic-clis/files/mcp-servers.manifest.json`).
Its `minimumReleaseAgeDays` field is exactly what this Skill needs — no
separate copy kept here to drift out of sync with it (narrowest-owner
principle: that Skill owns facts about installed MCP servers, this one
only owns the age-gating policy applied to them). An age-eligible update
calls that Skill's own `staged-install-handshake-atomic-swap.sh update <key> <target-version>`
directly, reusing its MCP-protocol handshake verification rather than
reimplementing it. **Retrofit Contract:** if `devcontainer-agentic-clis`
isn't installed, there's no manifest to read — MCP-server gating is
skipped entirely, detected by the manifest file's absence, not treated as
an error. CLI-binary gating still runs regardless, since this Skill owns
that manifest itself.

## A full version-history response can be too large for argv

Filling in `fetch_releases_registry_package` (a stub in
`run-age-gate.sh`, deliberately left for you to point at a real registry):
a real, actively-released package's full version/timestamp history can be
large enough to exceed the OS's `ARG_MAX` limit on `execve()` argument
size the moment you try to pass the whole response as a single
command-line argument, whether via `jq --argjson`, `jq --arg`, or an
inline script's own argument list. The failure is `Argument list too
long`, which reads like a shell bug, not a size problem — and it only
starts happening once the *target* package's own release cadence picks
up, with zero code changes on this side, which is exactly what makes it
easy to miss during initial development. Route the response through a
pipe or a temp file into whatever parses it, never through `argv` in any
form; keep only small, bounded values (a version string, an age
threshold) in actual arguments.

## The third case: a tool that updates itself, on its own schedule

Some CLIs ship a self-updater that runs independently of anything this
container does, on a schedule the container has no visibility into and
often no documented flag to disable. For a tool like this, an age-gate
check never gets a chance to hold anything back — the tool has already
updated itself before the check runs, or updates itself again moments
later regardless of what the check decided. This isn't a variant of the
pinned-release asymmetry above (there, the *devcontainer* still controls
timing for the one available version); it's a different failure mode where
the devcontainer doesn't control timing at all. Don't force a
`TARGET`/`HELD` decision onto this case — there is no decision to make.

Set `"installer": "self-updating"` in `tool-manifest.json` for a tool like
this, and the gate's job changes from deciding when to update to
**detecting and reporting drift**: `check_self_updating` in
`run-age-gate.sh` diffs the installed binary's actual reported version
against the `baselineVersion` recorded when the tool was first wired up,
and logs a `DRIFT` line on mismatch rather than silently trusting whatever
version happens to be installed. Strictly weaker than age-gating — it
can't hold anything back — and that's the honest reflection of what this
distribution shape allows.

## Probe the real operation, not a proxy signal for it

This generalizes past age-gating specifically: when a health check needs
to confirm some privileged or sandboxed operation will actually work at
runtime, checking a proxy signal (a binary's presence on `PATH`, a
security-module profile being loaded) is not the same as confirming the
operation itself succeeds — and the gap between the two shows up exactly
on the hosts you didn't test against. A binary being present says nothing
about whether it can perform the privileged operation it needs; a
security-module profile being loaded says nothing on a host where that
module isn't exposed to the container at all. Exercise the real operation
in the health check itself, and treat a profile check, where available,
as an additional layer on top of that, not a replacement — downgrade to a
warning, not a failure, on a host that doesn't expose the module.

## Verification

Build, boot, and watch `start.sh`'s output for a full cycle rather than
inferring success from a clean exit — a job silently failing every cycle
looks identical from the outside to one correctly holding at a reviewed
baseline. Confirm the three HELD outcomes are actually distinguishable in
the output, not collapsed into one generic message. If
`devcontainer-agentic-clis` is installed, confirm an MCP-server update
this Skill decides is eligible actually reaches that Skill's own
atomic-swap mechanism, not just that this Skill's own decision logged
correctly.
