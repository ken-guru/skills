---
name: devcontainer-setup
description: Set up a devcontainer for agentic coding with one or more AI CLIs: deny-by-default network firewalling, staged MCP server activation, age-gated CLI/tool auto-updates, dual-key SSH commit signing, container build ordering and capability scoping, and DX/database niceties. Use when adding a devcontainer to a project, sandboxing an agent's shell and network access, wiring up MCP servers or developer CLIs safely inside a container, or bundling a database service with the dev environment.
---

# Devcontainer Setup for Agentic Coding

A devcontainer that runs an AI coding agent gives that agent real shell,
filesystem, and (usually) network access. The container itself has to be
the security boundary, not just a convenience wrapper, because the thing
running inside it can execute arbitrary commands on its own initiative.
This skill collects the patterns that keep such a container both safe and
pleasant to work in, across six areas that compound on each other. Work
through the sections below roughly in build order: image and capabilities
first, then network policy, then the tools that live inside that policy
(MCP servers, CLI lifecycle, signing), then the smaller DX and database
niceties. Each section below is a short summary; the full lessons,
gotchas, and reasoning for each live in a linked root-level doc.

## 1. Container build ordering and capability scoping

A runtime firewall does not exist yet during `docker build`, and it does
not exist yet during whatever early setup hook runs before the firewall
script itself. That gives exactly two safe places for anything needing
broad, unpredictable network access (OS package mirrors, a browser-binary
CDN, a CLI release host): build time, or an early runtime hook that runs
before the firewall initializes. Installing the firewall's own dependencies
at runtime, after the firewall is already enforcing, is the single most
common way this gets violated by accident. Pin the exact base-image tag
(not a floating "latest"-style alias), and when a nested tool needs
privileged operations (managing its own netfilter rules, running a nested
namespace-based sandbox), grant only the specific Linux capabilities it
needs instead of `privileged: true`.

Copy [`templates/build/Dockerfile.skeleton`](templates/build/Dockerfile.skeleton)
to your project's `Dockerfile` and fill in the placeholder base image,
package manager calls, and firewall-dependency list. Copy
[`templates/build/docker-compose.skeleton.yml`](templates/build/docker-compose.skeleton.yml)
to your compose file and adapt the `cap_add`/`security_opt` block to the
capabilities your own firewall and any nested sandbox actually require,
and split persistent state into one named volume per independent concern.

Full writeup, including the floating-base-image-tag trap and the
scripting-runtime-for-the-agent gotcha: see
[BUILD-ORDERING-CAPABILITIES.md](BUILD-ORDERING-CAPABILITIES.md).

## 2. Network firewall: self-bootstrapping deny-by-default allowlist

The safe default for a container with broad shell access is deny-by-default
outbound networking with an explicit allowlist. The init script that builds
this must reset to a permissive policy as its very first action (so a prior
run interrupted mid-way never deadlocks its own next bootstrap), then
resolve allowed domains and any provider CIDR ranges into a kernel-level
set, tighten to deny, and self-verify with two live requests, one that must
fail and one that must succeed. Domains behind a rotating-IP CDN need a
background refresh loop that atomically swaps in a freshly, *fully*
rebuilt allowlist each cycle, never a partial one, and never by mutating
the live set in place.

Copy [`templates/firewall/init-firewall.sh.template`](templates/firewall/init-firewall.sh.template)
to `.devcontainer/init-firewall.sh` and fill in your own allowed domains
and any provider-specific CIDR fetch. If any of your allowed domains sit
behind a CDN with rotating IPs, also copy
[`templates/firewall/refresh-allowlist.sh.template`](templates/firewall/refresh-allowlist.sh.template)
to `.devcontainer/refresh-allowlist.sh`, keeping its domain list in exact
sync with the init script's (a shared manifest file is the safer long-term
fix once you have more than a couple of tools with their own network
needs).

Full writeup, including the read-only bind-mount gotcha and the
desktop-runtime host-bridge networking gotcha: see
[NETWORK-FIREWALL.md](NETWORK-FIREWALL.md).

## 3. MCP server wiring across multiple agentic CLIs

Don't let an agentic CLI resolve an MCP server package at launch time via
an unpinned "just fetch and run" mechanism; a supply-chain compromise or a
breaking release becomes something the agent discovers by failing
mid-task. Use a general **stage, verify, atomically swap** pattern instead:
install the candidate into a private staging directory, verify it with a
real protocol handshake (not just "the binary exists"), and only then
atomically repoint the "active" symlink at it via a same-filesystem
rename. If a bundled dependency (a vendored browser driver, for instance)
tries to resolve its own binary, don't trust its guesswork; scan your own
tooling's actual install cache and pass the exact binary path explicitly.
When you support more than one agentic CLI, expect each to read its MCP
config from a different location with different trust and non-interactive
behavior; verify each empirically rather than assuming parity.

Copy [`templates/mcp/staged-install-handshake-atomic-swap.sh.template`](templates/mcp/staged-install-handshake-atomic-swap.sh.template)
as the skeleton for your own stage/verify/swap installer, and
[`templates/mcp/mcp-handshake-template.mjs`](templates/mcp/mcp-handshake-template.mjs)
as the verify step it calls out to (it completes a real MCP `initialize`
handshake over stdio). Copy
[`templates/mcp/per-cli-mcp-config-checklist.md`](templates/mcp/per-cli-mcp-config-checklist.md)
and fill in one row per agentic CLI your project integrates, confirming
config location, auto-detection, and non-interactive behavior directly
against each CLI rather than from memory.

Full writeup, including the version-skew trap and a comparison table of
where three popular agentic CLIs read MCP config from: see
[MCP-MULTI-CLI-WIRING.md](MCP-MULTI-CLI-WIRING.md).

## 4. CLI lifecycle: age-gating auto-updated tooling

Auto-updated agent tooling (CLIs, MCP servers, package managers) is a live
supply-chain surface, since a compromised release can ship and get
auto-installed before anyone notices. Require every auto-updated tool to
declare a minimum release age in days, and only install a candidate once
it has cleared that bar. The load-bearing design decision: when a
release's age can't be determined at all (a registry lookup fails, a
timestamp fails to parse), treat that identically to "too young", hold,
never treat uncertainty as a pass. Tools distributed through a full
version-history registry can fall back to an older, still-eligible release
instead of freezing entirely; tools with no historical download endpoint
(only "whatever the vendor calls latest right now") can't, and that's an
honest asymmetry to document, not a bug to work around. Health checks that
gate a privileged operation should exercise the real operation, not a
proxy signal like "the binary is on PATH".

Copy [`templates/cli-lifecycle/manifest.example.json`](templates/cli-lifecycle/manifest.example.json)
as the shape for your own per-tool update manifest (pinned baseline
version, minimum release age, installer type), and
[`templates/cli-lifecycle/age-gate-check.example.sh`](templates/cli-lifecycle/age-gate-check.example.sh)
as the skeleton for the check itself, including the three distinct "held"
outcomes worth surfacing separately in your update-cycle output.

Full writeup, including the graceful-fallback asymmetry across distribution
channels and the probe-the-real-operation health-check principle: see
[CLI-LIFECYCLE-AGE-GATING.md](CLI-LIFECYCLE-AGE-GATING.md).

## 5. Dual-key SSH signing for git transport and commits

If a setup script generates a single SSH key and tries to use it for both
git transport and commit signing, most git hosting platforms will silently
reject the second registration once the key is already registered
elsewhere on the account, in a way that's easy to misdiagnose as a
key-format problem. Generate two separate keys from the start, one scoped
narrowly for transport, one registered as a signing key and never used for
transport. Detect an existing registration by comparing key *content*, not
its human-readable title. Some setup steps (registering the transport key
via an API) can be fully automated; others (registering the signing key,
which typically needs an account-wide credential scope broader than
anything else the script needs) are better left as a rare, human-driven
step behind a single persisted marker file, checked for presence, ahead of
whichever automated check runs on every session.

Copy [`templates/ssh-signing/generate-and-register-ssh-keys.sh.template`](templates/ssh-signing/generate-and-register-ssh-keys.sh.template)
and fill in your git hosting platform's key-registration API calls, your
repository identifier, and an environment label. Keep the transport-key
liveness check unconditional and ahead of the signing-key marker's
fast-path exit, exactly as the template does, so a regression in the
automated part never stops getting caught just because the manual part is
already marked done.

Full writeup, including the `gh api --jq` argument-passing gotcha and the
credential-scoping rationale: see
[SSH-DUAL-KEY-SIGNING.md](SSH-DUAL-KEY-SIGNING.md).

## 6. Developer-experience and database niceties

Smaller conveniences that don't change what the devcontainer does
architecturally but change how it feels day to day: keeping the host
machine awake for the container's lifetime via a detached
`initializeCommand` script (since nothing running inside a container can
prevent the host itself from sleeping); bridging wipe-vs-persist
disagreements between multiple tools' config directories with a
symlink helper that errors loudly rather than silently overwriting; and
surfacing repo/branch/PR/dirty-state at a glance in a terminal statusline.
On the database side: gate compose startup on `condition: service_healthy`
with a real healthcheck, not just `depends_on`, to remove an entire class
of cold-start flakiness; split environment configuration into safe-to-commit
local defaults (`containerEnv`, a working local DB connection string) versus
a gitignored `.env` for genuine secrets, with a committed `.env.example`
documenting every key; and bind-mount a host CLI's existing auth dotfile
straight into the container so a login already established on the host
carries across rebuilds without ever being copied or committed anywhere.

No dedicated templates for this section; the doc below includes complete,
ready-to-adapt snippets (a compose healthcheck block, a symlink-bridging
shell function, an `initializeCommand` wiring example) inline.

Full writeup: see [DX-AND-DATABASE-NICETIES.md](DX-AND-DATABASE-NICETIES.md).
