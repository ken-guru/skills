# ADR-0006: Unconditional capability drop; reject read-only rootfs, no-new-privileges, and a custom seccomp profile

**Status:** Accepted
**Date:** 2026-09-14

## Context

A Wayfinder map (issue #281) set out to decide `skills/setup-devcontainer`'s Blast-radius
Containment posture. With network egress already decided (issue #287, ADR-0005), this ticket
(issue #288) covers the remaining candidate techniques: read-only rootfs, capability dropping,
`--security-opt no-new-privileges`, and a custom seccomp/AppArmor profile. Research (issues
#283/#284/#285) found none of the four CLI vendors' own devcontainer-level guidance prescribes any
of these for the devcontainer itself — unlike the firewall, this would be this repo's own addition
with no primary source to anchor it, so each technique needed to be weighed on its own merits
against what this container actually does.

Checking this repo's own scripts before deciding (not assumed): grepping all four CLI Skills
(`setup-claude/codex/antigravity/copilot-devcontainer`) for `apt-get`/`sudo` found zero hits —
every CLI install (`install_cli` in `templates/install-cli-block.sh`) is a `curl | sh` into a
user-owned path, no root needed. The only two things anywhere in this Shared Container that use
`sudo` are the base skill's `chown_config_volume` (fixing a fresh named-volume mountpoint's
root:root ownership) and the firewall's `init-firewall.sh` (run via a scoped `NOPASSWD` sudoers
rule, per ADR-0005). All `apt-get install`s happen at Dockerfile build time, before `USER vscode`.
Runtime state lives in exactly two places, both already separate mounts: `$HOME` (the named config
volume) and `/workspace` (the host bind-mount).

## Decision

**Reject read-only rootfs.** This container's own automation gains nothing from it — it already
writes only to the two separate mounts a read-only rootfs wouldn't restrict. But a normal, common
devcontainer workflow — a human or agent running an ad hoc `sudo apt-get install <missing-tool>`
mid-session to debug a missing library or try a new tool — has nothing to do with this repo's own
scripts, and a read-only rootfs would break it outright, with a failure mode much harder to diagnose
than "this host isn't reachable." The trade-off isn't close: zero benefit to what's actually being
protected, against a real cost to a workflow users rely on.

**Adopt `--cap-drop ALL` plus a selective `--cap-add` allowlist, unconditionally** (not opt-in,
unlike the firewall layer): `CHOWN`, `DAC_OVERRIDE`, `FOWNER` for `chown_config_volume`'s sudo'd
`mkdir`/`chown`, plus `NET_ADMIN`/`NET_RAW` added conditionally when the firewall layer (ADR-0005)
is opted into. This costs nothing a normal workflow needs — cap-dropping bounds the *maximum*
capability set available to any process in the container, and neither this repo's own sudo'd
operations nor an ordinary `apt-get install` need anything outside Docker's already-permissive
default set for package-manager operations. It's compatible with `sudo`, unlike no-new-privileges
below, because it doesn't touch the setuid mechanism itself.

**Reject `--security-opt no-new-privileges` outright, for now.** It is directly incompatible with
this container's own architecture: no-new-privileges blocks any process from gaining privileges via
a setuid bit, which is exactly the mechanism `sudo` uses — and both `chown_config_volume` and the
firewall's `init-firewall.sh` depend on a scoped `sudo` today. Adopting it would require
rearchitecting those two mechanisms to not need root at all (e.g. file capabilities on specific
binaries instead of setuid `sudo`), which is a materially larger change than this ticket's scope
and not something this map's Destination calls for. Not spun off as a new ticket either — if this
becomes worth pursuing, it's a future effort with its own destination, not fog this map should
carry.

**Reject a custom seccomp/AppArmor profile entirely** — including a narrower syscall-blocklist
version. A general-purpose devcontainer has to support arbitrary project toolchains (whatever
language, build system, or package manager a given repo uses), and a custom seccomp profile risks
breaking some future project's tooling in a way that's extremely hard to diagnose (a mysterious
`EPERM` deep inside a compiler or interpreter, unrelated on its face to "the firewall" or "read-only
rootfs"). No vendor precedent recommends this for a devcontainer. Docker's own default seccomp
profile already blocks the genuinely dangerous syscalls (container-escape primitives like
`ptrace`-class calls) without this repo needing to maintain a custom list.

**Priority**: this ticket's one adopted item (cap-drop) ranks below the network egress firewall
(#287) within Blast-radius Containment, per that ticket's own resolution.

This decision produces no implementation itself — per the parent map's Notes, this Wayfinder effort
stops at the decision. A follow-up effort implements the `--cap-drop`/`--cap-add` flags.

## Alternatives considered

### A) Adopt read-only rootfs with a tmpfs for `/tmp` (rejected)

- Pro: this repo's own scripts would work unchanged — they already write only to `$HOME` and
  `/workspace`, both separate mounts. Closes off an entire class of container-escape/persistence
  technique that depends on writing to the rootfs.
- Con: breaks the ad hoc `sudo apt-get install` workflow described above — a real, common pattern
  with nothing to do with this repo's own automation, for a defensive benefit that only matters if
  an attacker specifically needs rootfs write access as part of an exploit chain (a narrower,
  less-common threat than "a normal debugging session needs a package installed").

### B) Adopt `--security-opt no-new-privileges` alongside cap-drop (rejected)

- Pro: closes the specific privilege-escalation path setuid binaries represent — a genuinely
  stronger containment posture than cap-drop alone, if it could be made to work.
- Con: directly breaks `sudo`, which two of this container's own mechanisms depend on today. Making
  it work would mean removing `sudo` entirely from the container's design — out of proportion to
  what this ticket set out to decide, and no vendor guidance suggested this needed doing now.

### C) Build a narrow custom seccomp profile blocking only a small number of dangerous syscalls (rejected)

- Pro: smaller, more auditable than a full custom profile; could plausibly avoid breaking most
  ordinary toolchains.
- Con: still carries the core risk — this repo can't predict every syscall a future project's build
  tooling will need, and "small" doesn't eliminate the failure mode, just narrows how often it's hit
  (in exchange for making it harder to find *why*, when it does). Docker's default profile already
  covers the specific escape-relevant syscalls a custom list would target; the marginal benefit
  doesn't clear the risk bar.

## Consequences

- `runArgs` (Capability Seam) gains `--cap-drop=ALL --cap-add=CHOWN --cap-add=DAC_OVERRIDE
  --cap-add=FOWNER` unconditionally in every generated Shared Container; `--cap-add=NET_ADMIN
  --cap-add=NET_RAW` are added only when the firewall layer (ADR-0005) is opted into, alongside that
  layer's existing capability grant.
- No `--read-only`, no `--security-opt no-new-privileges`, and no custom `--security-opt seccomp=...`
  appear anywhere in the generated `devcontainer.json` or Dockerfile.
- No change to any repo's ad hoc in-container workflows (`sudo apt-get install`, etc.) — unaffected
  by this decision.
- If a future effort wants no-new-privileges, it needs its own destination scoped around removing
  this container's dependency on `sudo` first — not an extension of this map.

## Addendum (2026-09-14, from issue #289's Capability Seam reconciliation)

The "Docker's own default profile already covers the genuinely dangerous syscalls" reasoning above
holds only for a Shared Container without `setup-codex-devcontainer` installed. Codex's own
Capability Seam entries (`templates/capability-seam-entries.json`) unconditionally include
`--security-opt=seccomp=unconfined`, required for its own bubblewrap sandbox to function — and
Docker's `--security-opt seccomp` is a container-wide setting, not scopeable to one process. So in
any Shared Container with Codex installed, the default seccomp profile this ADR leaned on is already
disabled entirely, by a pre-existing, independently-justified decision this ADR doesn't change or
revisit. Recorded here so this ADR's reasoning doesn't read as contradicted by Codex's own
requirements: the "no custom profile" decision stands regardless — a custom profile would still be
disabled the same way for Codex installs, so it wouldn't have protected them either. The gap this
surfaces (no seccomp protection at all when Codex is present) isn't new and isn't something #289's
reconciliation was chartered to solve. `--cap-drop=ALL` plus the selective `--cap-add` allowlist
composes cleanly with Codex's `--cap-add=SYS_ADMIN` regardless — Docker computes the final capability
set as a union of every `--cap-add` entry in `runArgs`, order-independent, so both sides' needs are
met with no conflict.

## Addendum (2026-09-15, from PR #290's own manual validation)

The Decision's claim above — "It's compatible with `sudo`... because it doesn't touch the setuid
mechanism itself" — is wrong in a way this ADR didn't anticipate. The setuid *bit* on `/usr/bin/sudo`
is indeed untouched by capability dropping, and does still grant the process effective UID 0 at
`exec()`. But `sudo` doesn't stop there: it calls `setresuid()`/`setresgid()` internally to fully
transition identity (drop supplementary groups, become real-and-effective root, not just
effective), and those syscalls need `CAP_SETUID`/`CAP_SETGID` in the process's capability *bounding
set* — which `--cap-drop=ALL` plus this ADR's original three-entry allowlist (`CHOWN`,
`DAC_OVERRIDE`, `FOWNER`) never granted. Verified live during PR #290's pre-merge validation: built
the Dockerfile's `firewall` stage, ran a container with exactly the `runArgs` this baseline plus the
firewall's own grant would produce, and `sudo whoami` as `vscode` failed with `sudo: unable to
change to root gid: Operation not permitted`; a control container with only `--cap-add=SETUID
--cap-add=SETGID` (no other capabilities at all) made it succeed, isolating the two missing
capabilities precisely.

This wasn't a narrow gap — every `sudo` call in every generated Shared Container was broken by the
original baseline, including the firewall's own invocation of `init-firewall.sh`/
`refresh-allowlist.sh` (so the firewall layer never actually started once opted into) and the
ordinary ad hoc `sudo apt-get install <tool>` workflow this same ADR's Decision and Consequences
sections explicitly promised would keep working unchanged. `CAP_SETUID`/`CAP_SETGID` are now part of
the unconditional baseline allowlist alongside `CHOWN`/`DAC_OVERRIDE`/`FOWNER` — `sudo` itself needs
them regardless of what it's then asked to run, so they belong in the baseline (unconditional) set,
not the firewall's conditional one. This doesn't change the Decision's cap-drop-vs-no-new-privileges
comparison (no-new-privileges is still rejected for the same reason: it blocks the setuid mechanism
itself, which is a strictly different failure mode from a missing capability in the bounding set) —
only the enumeration of which capabilities `sudo` compatibility actually requires.

Separately, also surfaced during this validation: the base image
(`mcr.microsoft.com/devcontainers/base:ubuntu`) already grants `vscode` blanket passwordless root
(`NOPASSWD: ALL`) via its own pre-existing `/etc/sudoers.d/vscode`, entirely independent of and
unnarrowed by the firewall's own scoped `/etc/sudoers.d/vscode-firewall` rule (ADR-0005). That
blanket grant predates this ADR and isn't something cap-dropping can narrow — a capability the
container's root doesn't have, `sudo` still can't grant regardless of the sudoers policy — but it
does mean a compromised (not just misbehaving) process running as `vscode` can invoke any root
command, including disabling the firewall's own iptables rules, once `sudo` itself works again per
the fix above. Tracked as a known, accepted limitation of this container's `sudo`-dependent design
rather than something this ADR's cap-drop decision was ever positioned to close.
