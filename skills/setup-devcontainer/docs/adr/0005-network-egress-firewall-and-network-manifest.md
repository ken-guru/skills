# ADR-0005: Opt-in network egress firewall, ported from a proven sibling implementation, with a new Network Manifest extension point

**Status:** Accepted
**Date:** 2026-09-14

## Context

A Wayfinder map (issue #281) set out to decide `skills/setup-devcontainer`'s Blast-radius
Containment posture, starting with network egress. Research (issue #283) read Anthropic's
devcontainer doc and its reference `init-firewall.sh` implementation in full: an iptables+ipset
default-deny firewall, explicitly documented by Anthropic as *optional*, not required for Claude
Code itself. The reference script resolves most hosts once via `dig` at container start — a
one-shot resolution that goes stale if a CDN-backed host's IP changes mid-session, requiring a full
container restart to recover. The research also gathered per-vendor network requirements for all
four CLIs this Shared Container installs (Claude Code, Codex, Antigravity, Copilot CLI), finding
Claude Code and Copilot CLI have complete, current, vendor-published host tables, Codex has one
documented example host, and Antigravity has no vendor-published host table at all beyond one
Google-Cloud-specific entry.

While working this ticket, a sibling project in the same workspace —
`the-words-are-snake`, which already runs an agent devcontainer with this exact kind of firewall in
production — turned out to have already solved the two hardest parts of this problem, documented in
its own ADR-0028 with two cited production incidents:

1. **CDN/IP churn**: a background loop (`refresh-allowlist.sh`) re-resolves the full domain list
   every 5 minutes into a scratch ipset and atomically `ipset swap`s it into place, keeping
   CDN-backed hosts (their example: `api.anthropic.com`, served via CloudFront) working across a
   long-running session without requiring a restart. A naive first attempt at this (tracking only a
   partial domain list in the refresher) silently dropped GitHub/npm/Railway access on the first
   refresh cycle in production — the incident that produced the current design.
2. **Per-CLI extension without duplication**: rather than hand-listing each CLI's hosts inside the
   firewall scripts themselves, a small JSON manifest (`developer-clis.json`) holds each CLI's
   `networkAllowlist` as structured data (host, purpose, source), and a `jq`-based helper script
   (`firewall-developer-cli-domains.sh`) derives the array both firewall scripts source. This is the
   one part of their allowlist architecture without the general-list's duplication problem, because
   both scripts pull from the same derivation step instead of each maintaining an independent copy.

`the-words-are-snake`'s manifest also already contains real host lists for Codex and Antigravity —
including Antigravity hosts absent from Google's own published docs, evidently arrived at through
observing the CLI's own live traffic rather than reading a vendor spec.

## Decision

**Adopt the firewall as an opt-in layer**, asked during `setup-devcontainer`'s interactive setup
alongside the existing SSH-layer question (step 3 of its `SKILL.md`), not applied unconditionally.
This respects Anthropic's own explicit "not required" framing and matches this repo's existing
pattern for optional security layers (SSH deploy-key/signing-key automation).

**Port the mechanism from `the-words-are-snake`'s proven implementation, not Anthropic's reference
script as-is:**

- iptables + ipset, default-DROP, one ipset match rule, ESTABLISHED/RELATED always allowed, explicit
  `REJECT --reject-with icmp-admin-prohibited` for everything else — same core mechanism Anthropic's
  reference uses.
- Reset `INPUT`/`OUTPUT`/`FORWARD` policies to `ACCEPT` as the first action, before any flush —
  closes the self-deadlock bug `the-words-are-snake` hit in production (a script that died after
  setting `DROP` but before finishing the allowlist would permanently block its own next run's
  bootstrap `curl`).
- A background refresh loop, re-resolving the full domain list on an interval and swapping it into
  the live ipset atomically (`ipset swap`), rather than a one-shot resolve at container start.
- Self-verification at the end of every run (a disallowed host must fail, an allowed host must
  succeed) — present in both the reference and the sibling implementation independently, strong
  enough convergent evidence to keep.
- The Docker-Desktop host-bridge handling (`host.docker.internal` detection, since mapped dev-server
  ports route through a separate bridge network on macOS) — a real, previously-hit failure mode
  worth inheriting rather than rediscovering.

**Introduce a Network Manifest** (new term, `CONTEXT.md`): a base-owned JSON file where each CLI
Skill owns exactly one keyed entry declaring its own `networkAllowlist`, derived into the firewall's
domain list by a small `jq`-based helper both the init and refresh scripts source. This is a second,
distinct extension point from the Capability Seam — opposite direction (declaring what a restriction
lets through, not loosening the restriction itself) — chosen over extending
`scripts/patch-if-absent.sh`'s text-block-append pattern because structured per-host metadata (host,
purpose, source) is worth more than an opaque domain string, and because
`scripts/patch-json-array-if-absent.sh` (already built for the Capability Seam) is plausibly
reusable once addressed into `.{cliName}.networkAllowlist`, rather than inventing a third
patching mechanism.

**Seed data, labeled by provenance**: adopt `the-words-are-snake`'s manifest entries as a starting
point rather than only the research's vendor-doc-sourced subset — Claude Code, Codex, and Copilot
CLI entries there are consistent with (a superset of, in Claude's case) the primary-sourced findings
in issue #283; Antigravity's entries are the only concrete Antigravity host list available anywhere,
vendor docs included, but are field-observed, not vendor-doc-sourced. Each manifest entry should
carry its `source` (a vendor doc URL, or "observed" for the field-derived ones) so a future reader
can tell the difference — this repo's Network Manifest should preserve that distinction rather than
flattening it into an undifferentiated list.

**Project-specific network needs** (a repo's own APIs) go in a new gitignored
`.devcontainer/allowed-domains.local.txt`, parallel to how `.devcontainer/.env` already holds
user-specific config outside the Scaffold's base-owned files — created empty by the base skill,
read by the firewall scripts, never touched again by any skill.

**Priority**: ranks above the still-open filesystem/capability restriction decision (issue #288).
Cap-drop/read-only-rootfs/seccomp have zero vendor-doc precedent across any of the four CLIs
(per the #283 research) — riskier to get right without a reference to adapt. Network egress now has
two independently-converging, working implementations to draw from.

This decision produces no implementation itself — per the parent map's Notes, this Wayfinder effort
stops at the decision. A follow-up effort implements the firewall scripts, the Network Manifest file
and its derivation helper, and the setup-flow question.

## Alternatives considered

### A) Copy Anthropic's reference script verbatim, one-shot resolve, hardcoded domain list (rejected)

- Pro: simplest possible port; doc's own worked example.
- Con: the reference's own hardcoded list is already stale against Claude Code's current documented
  host table (missing `claude.ai`, `platform.claude.com`, several others — found during research);
  inherits the CDN-churn weakness `the-words-are-snake` already hit and fixed in production. Copying
  a known-worse version of a mechanism a sibling project has already improved on is not a real
  savings.

### B) Allowlisting proxy instead of iptables+ipset (rejected for v1)

- Pro: host-based enforcement tracks vendor IP/CDN changes without any re-resolution loop at all —
  the approach Codex's own `network_proxy` feature and Claude Code's own OS-level sandbox both use.
- Con: needs a running proxy process, `HTTPS_PROXY` plumbing through every tool and shell in the
  container, and unresolved TLS-interception questions this map hasn't scoped. The refresh-loop
  fix closes most of the practical gap between "iptables+ipset" and "proxy" at a fraction of the
  complexity, and it's already proven working in production rather than theoretical.

### C) Text-append CLI domains into the firewall scripts directly, extending `patch-if-absent.sh` (rejected)

- Pro: reuses an existing, already-idempotent tool with no new file format.
- Con: `the-words-are-snake`'s own ADR-0028 documents this exact shape (independent domain lists
  duplicated across `init-firewall.sh` and `refresh-allowlist.sh`) silently drifting twice in
  production, because a full-rebuild refresh loop needs its own array, and nothing forces two
  independently-maintained text blocks to stay in sync. Their fix — a single manifest both scripts
  derive from — structurally prevents the drift instead of relying on a procedural reminder to edit
  both files.

## Consequences

- `setup-devcontainer`'s `SKILL.md` step 3 gains a second opt-in question (network firewall),
  parallel to the existing SSH-layer question.
- New base-owned files: the firewall init script, the refresh-loop script, the Network Manifest
  (seeded with a base baseline: `registry.npmjs.org`, `github.com`, `api.github.com`), the
  manifest-derivation helper, and a gitignored `.devcontainer/allowed-domains.local.txt` for
  project-specific hosts.
- Each of the four CLI Skills gains a new own-block responsibility: adding its `networkAllowlist`
  entry to the Network Manifest when it installs, sourced from the vendor-doc-verified lists in
  issue #283 where available (Claude, Codex, Copilot) and the field-observed list from
  `the-words-are-snake` where not (Antigravity), each entry labeled by provenance.
- `runArgs` (Capability Seam) gains `--cap-add=NET_ADMIN --cap-add=NET_RAW` when the firewall layer
  is opted into, matching what the reference mechanism requires.
- No change to any repo that declines the opt-in question — the Shared Container's unrestricted
  network behavior is unchanged for anyone who says no.
