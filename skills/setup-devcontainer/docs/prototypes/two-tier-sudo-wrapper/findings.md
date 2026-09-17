# Prototype: two-tier sudo wrapper for vscode's blanket grant

Wayfinder ticket: [Prototype a two-tier sudo wrapper for vscode's blanket grant](https://github.com/ken-guru/skills/issues/319)
Map: [Decide how to close (or accept) vscode's blanket-sudo firewall-bypass gap](https://github.com/ken-guru/skills/issues/318)

## Question

Can `vscode`'s blanket `ALL=(root) NOPASSWD: ALL` sudo grant be replaced with a two-tier
wrapper — a narrow default allowlist plus a "break-glass" escape hatch for the ad hoc
"arbitrary `sudo apt-get install <anything>`" promise — without break-glass itself
reintroducing the exact firewall-disable exploit from issue #298?

## Method

Built the real `mcr.microsoft.com/devcontainers/base:ubuntu` image (the actual base image
this repo's devcontainers use) with an added `/etc/sudoers.d/vscode-two-tier-prototype`
file (see `sudoers-two-tier` in this directory) implementing:

- **Tier 2 (break-glass) listed FIRST**: `vscode ALL=(root) PASSWD: ALL`
- **Tier 1 (default allowlist) listed LAST**: `vscode ALL=(root) NOPASSWD: /usr/bin/mkdir, /usr/bin/chown, /usr/bin/apt-get, /usr/bin/apt, /usr/bin/dpkg, /usr/bin/install, /usr/bin/curl, /usr/bin/tee, /usr/bin/test, /usr/bin/su, /usr/bin/pg_ctlcluster, /usr/bin/service`

**Gotcha discovered along the way**: sudoers is last-match-wins per matching entry, not
per-file. Listing the allowlist first and the `PASSWD: ALL` catch-all second silently
clobbers the allowlist's NOPASSWD tag for every command (since `ALL` matches everything,
including the already-allowlisted commands, and the later entry wins). The catch-all must
come *before* the specific allowlist, or the allowlist never takes effect. This is a sharp
edge worth remembering if a real fix pursues this design — it's easy to ship a config that
looks right and does nothing.

Left the base image's own pre-existing blanket `/etc/sudoers.d/vscode`
(`NOPASSWD: ALL`) in place (didn't remove it) — mirrors the real fix's need to either
strip or override it; here the two-tier file's later ordering already overrides it as shown
below, so removal at fix-time is likely unnecessary as long as ordering is enforced.

## Results

All commands run as `vscode`, non-interactively (`sudo -n`, i.e. "fail instead of prompt") —
this simulates exactly how a compromised or automated process would have to invoke sudo,
since it has no way to interactively supply a password.

**Tier 1 (allowlisted) — all succeed without a password:**
`mkdir`, `chown`, `apt-get update`, `dpkg -l`, `curl --version`, `apt --version`,
`tee`, `su vscode -c id` — all exit 0.

**Tier 2 (not allowlisted) — all correctly blocked non-interactively:**
- The exact issue #298 exploit — `sudo -n iptables -P OUTPUT ACCEPT && sudo -n iptables -F OUTPUT` — **fails**: `sudo: a password is required`.
- An arbitrary non-listed command (`sudo -n systemctl restart ssh`) — **fails** the same way.

**So mechanically, the two-tier split works exactly as designed: the firewall-disable
exploit is blocked non-interactively, without touching the allowlisted commands.**

## The crux finding: break-glass is not actually reachable

`vscode`'s account has **no password set** in the base image (`passwd -S vscode` → `L`,
locked). Tested what happens when a real interactive session tries to satisfy the PASSWD
tier:

```
$ echo "wrongpassword" | sudo -S iptables -L
[sudo] password for vscode: Sorry, try again.
[sudo] password for vscode:
sudo: no password was provided
sudo: 1 incorrect password attempt
```

There is no password that would work — PAM has nothing to check against. This means the
PASSWD break-glass tier isn't a weaker gate a human can pass and a script can't; **it's a
gate nobody can pass**, human or otherwise. In practice, this design doesn't degrade the
"arbitrary sudo" promise to "arbitrary, but with a speed bump" — it silently converts it
into "only the fixed allowlist, forever," identical in effect to a pure fixed allowlist
(the option the map's Q6 constraint already said this ticket shouldn't produce).

## Why this doesn't have a cheap fix

Making the PASSWD tier genuinely usable would mean giving `vscode` a real password or
equivalent secret — which immediately raises the question the map's constraints already
flagged as out of scope: where does that secret live such that a legitimate developer can
use it but a compromised process running as the same `vscode` user, in the same
filesystem, can't just read it too? Any secret stored inside the container is exactly as
reachable to a compromised process as to a legitimate one — they run as the same user with
the same file access. A working answer needs an out-of-band channel (host-side-only
storage, a one-time value never persisted to the container's disk, or similar) — which is
new infrastructure, not a tweak to the sudoers file, and is arguably comparable in scope to
the capability-based sudo removal option (c) that this map already scoped out of
execution.

Other break-glass shapes considered, not prototyped further because each fails the same
threat model for the same underlying reason (this repo's threat model, ADR-0005's Problem
Statement, explicitly includes "a misbehaving **or compromised** AI CLI process" — and a
compromised AI CLI process runs through the *same* interactive channel, with the *same*
TTY, that a legitimate developer's own session would use):

- **TTY-presence check** ("only allow break-glass from a real interactive terminal"): doesn't
  distinguish a human from an AI CLI agent session, since both look identical at the TTY
  layer — this repo's own threat model is specifically about an agent operating through
  that exact channel.
- **Confirmation phrase** ("type CONFIRM to proceed"): defeats a naive script, not an LLM-
  driven compromised process, which can read and satisfy a prompt as easily as a human.
- **Host-side-only toggle** (a file/flag only editable from outside the container): could
  work in principle, but is new mechanism (likely a container-restart or polling design),
  not a sudoers tweak — a materially larger change, not this ticket's scope.

## Verdict for the decision ticket (#321)

The two-tier wrapper **mechanically works** for what it can enforce (the firewall-disable
exploit is blocked non-interactively, cleanly, without breaking anything in the allowlist).
But as scoped (OS-password break-glass), it **cannot** simultaneously satisfy the map's hard
constraint (preserve genuinely arbitrary `sudo <anything>`) — the container has no live
password to gate on, so break-glass is unreachable by anyone, degrading silently into a pure
fixed allowlist. A version of this design that *does* preserve the arbitrary-command promise
needs new secret-distribution infrastructure that is out of this ticket's scope and
comparable in size to the capability-based sudo removal option this map already declined to
execute inside itself.

This doesn't kill the "narrow the grant" family of answers outright — the fixed allowlist
itself is cheap, safe, and covers everything this repo's own scaffolding and documented
patterns actually use (per the map's sudo-usage audit) — it just means the honest framing
for the decision ticket is "a fixed allowlist with the ad hoc arbitrary-tool promise
knowingly dropped for the (fairly rare) case of a non-package-manager root command," not
"a fixed allowlist plus a working escape hatch that preserves the promise."
