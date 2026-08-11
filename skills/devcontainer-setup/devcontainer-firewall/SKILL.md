---
name: devcontainer-firewall
description: "Add a deny-by-default outbound network firewall with a self-bootstrapping, manifest-derived allowlist to a devcontainer — including one this Skill Suite didn't scaffold. Use when sandboxing an agentic coding CLI's network access, locking down a devcontainer's outbound traffic to an explicit allowlist, or adding vendor-API/package-registry domains an agent needs reachable. Retrofits: detects and adds only what it needs, without assuming it owns the Target Devcontainer's Dockerfile."
---

# devcontainer-firewall

An Add-on Skill of the devcontainer-setup Skill Suite, authored as a
local-path [devcontainer Feature](https://containers.dev/implementors/features/)
— see [feature-conventions.md](../docs/feature-conventions.md) for the
mechanics every Feature-authored Skill in this suite shares. Installs a
deny-by-default outbound firewall: only allowlisted domains, their resolved
IPs, and any configured provider CIDR ranges are reachable; everything else
is rejected.

## Install

Copy [`feature/devcontainer-firewall/`](feature/devcontainer-firewall/)
into your project's `.devcontainer/devcontainer-firewall/`, add it to your
`devcontainer.json`'s `features` block —

```jsonc
"features": {
  "./devcontainer-firewall": {}
}
```

— then copy
`files/allowed-domains.manifest.example.json` to `files/allowed-domains.manifest.json`
in the same installed location and fill in your project's own domains
(package registries, your git forge, any vendor APIs an installed agentic
CLI needs — see [devcontainer-agentic-clis](../devcontainer-agentic-clis/SKILL.md)
if you're using it). Rebuild.

`install.sh` installs this Feature's own OS-level dependencies
(`iptables`, `ipset`, `jq`, `dnsutils`, `curl`) at build time, before any
firewall exists to block that install — the one safe time to do it,
regardless of whether a nested build-time step you add later needs the
same discipline. `capAdd: [NET_ADMIN, NET_RAW]` in
[`devcontainer-feature.json`](feature/devcontainer-firewall/devcontainer-feature.json)
declares the capabilities this Feature needs; the devcontainer CLI merges
them into the final container automatically, whether or not
`devcontainer-scaffold` built the base image.

## The core mechanism

[`files/init-firewall.sh`](feature/devcontainer-firewall/files/init-firewall.sh),
invoked by [`files/start.sh`](feature/devcontainer-firewall/files/start.sh) —
this Feature's `postStartCommand` — every container start, does four things
in order:

1. Resolve each allowed domain to its current IPs and load them into a
   kernel-level `ipset`.
2. Optionally fetch and aggregate a provider's published CIDR range (a
   package registry, a git forge), so you don't hand-list every IP.
3. Install a firewall rule that accepts traffic only to addresses in that
   set, then set the default policy to deny everything else.
4. Self-verify: make a live request to something that must be blocked
   (expect failure) and something that must be allowed (expect success),
   and fail loudly if either check comes out wrong.

That last step matters more than it looks. Every individual rule-install
command can exit 0 while the net effect of the rule *ordering* is still
wrong. Closing the loop with two real network calls catches what checking
each command's own exit code cannot.

**Fail-open bootstrap ordering.** The script's very first action resets
the default policy to permissive, before any other rule work, regardless
of what a prior run left behind. Only after the allowlist is fully built
does it tighten to deny. Without this, a run interrupted after tightening
to DROP but before the allowlist finished would deadlock every later
run — its own bootstrap fetch blocked by the leftover restrictive policy,
with no way to rebuild the allowlist that would unblock it. This makes
`start.sh`'s every-container-start re-invocation of `init-firewall.sh`
safe by construction, including on a container this Skill retrofitted onto
rather than scaffolded.

**A provider's CIDR list can silently mix in IPv6 your `ipset` can't use.**
`api.github.com/meta`-style responses now mix IPv6 ranges into the same
arrays as IPv4, with no separate field distinguishing them. The `ipset`
this builds is IPv4-only by default; skip a non-IPv4 entry silently rather
than treating "not IPv4" as a fatal parse error, and reserve the hard
failure for a genuinely malformed IPv4-shaped entry — getting this
backwards means the first IPv6 entry a provider ever returns aborts
firewall init entirely, on every container start.

## The refresh loop is optional — decide up front whether you need one

If none of your allowed domains sit behind a rotating-IP CDN, skip
[`files/refresh-allowlist.sh`](feature/devcontainer-firewall/files/refresh-allowlist.sh)
entirely: it's off by default. `start.sh` only launches it in the
background if a marker file is present —

```bash
touch .devcontainer/devcontainer-firewall/feature/devcontainer-firewall/files/.enable-refresh-loop
```

— because keeping two separate scripts (a slow, thorough one-time build
and a fast, idempotent loop body) in sync is a real and easy-to-miss
failure mode once you actually need both. If you do enable it: it rebuilds
the *entire* allowlist every cycle, atomically swapping a scratch `ipset`
in rather than mutating the live one, and skips the swap entirely (keeping
the previous, still-valid set) if any fetch fails mid-cycle — a refresh
built from partial data would silently narrow the allowlist rather than
refresh it.

**A small stable CDN pool and a large rotating backend pool need different
handling.** The refresh loop's "rebuild fully, swap atomically" design is
correct for a small, stable anycast pool (Cloudflare, Fastly). It's
actively wrong for a domain backed by a large rotating pool instead — an
AWS-ELB-style vendor API, common for an agentic CLI's own inference
backend — because a single DNS query only returns a subset of the pool, so
IPs learned one cycle get discarded the next unless re-resolved: connectivity
comes and goes every refresh interval, indefinitely, never converging. Add
such domains to `init-firewall.sh`'s and `refresh-allowlist.sh`'s
`MULTI_QUERY_DOMAINS` array to query them several times and union the
results each pass — a mitigation, not a guarantee. Prefer the vendor's
published CIDR range instead, where one exists; for a domain with neither
a small stable pool nor a CIDR range, IP-based `ipset` filtering is
structurally the wrong tool, and a domain-aware forwarding proxy is a
different architecture worth naming explicitly rather than working around.

## Manifest-derived domains — the interface for other Skills to patch into

Resist hand-listing each tool's hosts directly in the firewall scripts.
[`files/allowed-domains.manifest.json`](feature/devcontainer-firewall/files/allowed-domains.manifest.example.json)
(copied from the `.example` file at install time) records, per tool: the
hosts it needs, why, and where that's documented upstream.
[`files/domains-from-manifest.sh`](feature/devcontainer-firewall/files/domains-from-manifest.sh)
flattens it into a plain domain list that both `init-firewall.sh` and
`refresh-allowlist.sh` source, so a domain only ever needs adding in one
place; it fails loudly (non-zero exit) if the manifest is missing or
parses to zero hosts, rather than silently proceeding with an empty
allowlist.

**This Skill owns the manifest's file and format** (the Collection's own
[Artifact Owner](../../../CONTEXT.md) principle: the narrowest scope whose
responsibility fully explains why an artifact exists). A sibling Skill
that needs its own domains allowlisted —
[devcontainer-agentic-clis](../devcontainer-agentic-clis/SKILL.md) patching
in each installed CLI's vendor-API domains is the running example — is
expected to edit this exact file, at this exact path relative to the
project root:

```text
.devcontainer/devcontainer-firewall/feature/devcontainer-firewall/files/allowed-domains.manifest.json
```

via its own `postCreateCommand` (an earlier lifecycle phase that's
guaranteed, by the devcontainer spec, to complete — across every installed
Feature — before this Skill's `postStartCommand` ever runs `init-firewall.sh`).
This Skill's own `install.sh` and `start.sh` never need to know whether
such a sibling Skill is even installed; the manifest is just an ordinary
project-source JSON file, edited by whatever wants to edit it, read fresh
at every container start.

## Other gotchas

**The read-only bind-mount gotcha.** These scripts live in your project's
version-controlled source, reached through the workspace bind mount at
runtime, not copied in at build time. A bind mount pins the underlying
inode at container start — pulling a newer version of a script into your
host checkout after the container is already running does not reliably
update what the container sees mid-session. Treat a firewall script change
as requiring a full container restart to apply, not a live re-invocation;
`start.sh` already re-runs `init-firewall.sh` on every start, so a restart
is sufficient.

**Desktop container runtimes** often route port-forwarded traffic through
a separate host bridge, distinct from the container's ordinary bridge
network. `init-firewall.sh` resolves the bridge's well-known hostname and
adds a rule only if it differs from the default-route network already
detected; on runtimes with no such bridge this is a safe no-op.

**A domain served from the same CDN or hosting platform as your git
forge's own web presence** may already be covered by the CIDR range
you're pulling in for the forge itself — check what's actually in your
resolved allowlist before adding a dedicated entry.

## Verification

Build, boot the container from a clean state, and watch
`init-firewall.sh`'s own log output for warnings and errors rather than
inferring success from a clean exit code. Make several live connection
attempts — not one — against every allowlisted domain that isn't a single
stable IP; a large-rotating-pool domain can pass a single spot-check and
still fail intermittently over a real session. If you enabled the refresh
loop, watch a full cycle of its output too, since a loop that's silently
failing every cycle looks identical from the outside to one correctly
serving a stable set.
