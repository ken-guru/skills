# Capability-based sudo removal for the Shared Container's own mechanisms — research input

Serves [issue #320](https://github.com/ken-guru/skills/issues/320), which asks what ADR-0006
([`0006-capability-drop-reject-readonly-rootfs-and-seccomp.md`](../adr/0006-capability-drop-reject-readonly-rootfs-and-seccomp.md))
named but didn't pursue: replacing this container's own two `sudo`-dependent mechanisms with
Linux file capabilities (`setcap`), and whether doing so actually unblocks
`--security-opt no-new-privileges`. It is a sibling to the parent Wayfinder map
[#318](https://github.com/ken-guru/skills/issues/318), which is separately deciding how to
close the blanket `NOPASSWD: ALL` ad hoc-sudo gap — that gap is explicitly **out of scope**
here (see §3). **This document is research legwork, not a decision.** It gathers primary-source
facts and states a candidate feasibility verdict for a future session/maintainer to act on,
amend, or reject. Nothing here changes `setup-devcontainer`'s behavior on its own.

Research date: 2026-09-17. All URLs below were fetched or searched live on that date; man
pages and kernel docs are versioned/living pages that can be revised — see "Open questions."

---

## Bottom line

**(a) Feasibility of capability-based sudo removal for the two mechanisms:** Partially
feasible, with one mechanism (`chown_config_volume`) requiring a small wrapper binary rather
than `setcap` on coreutils directly, and the other (the firewall scripts) only achievable by
accepting a **materially weaker security boundary** than today's path-scoped sudoers rule —
file capabilities on `iptables`/`ip`/`ipset` grant that capability to *any* invocation of those
binaries by the `vscode` user, not just from within `init-firewall.sh`/`refresh-allowlist.sh`.
Both are mechanically implementable at Dockerfile build time. See §1.

**(b) Does it make `no-new-privileges` adoptable?** **No, not by itself.** Per
`capabilities(7)` and the kernel's `no_new_privs` documentation (§4 below), the `no_new_privs`
bit disables file-capability-based `execve()` privilege escalation using the *same* mechanism
and the *same* justification it uses to disable setuid/setgid escalation — quoting the kernel
doc directly: *"the setuid and setgid bits will no longer change the uid or gid; file
capabilities will not add to the permitted set."* Swapping `sudo` for `setcap`-on-binaries
trades one `no_new_privs`-blocked escalation primitive for another that is *explicitly,
symmetrically* blocked by the same bit, for the same reason. **Ambient capabilities are the
one primitive in this family that is compatible with `no_new_privs` in principle** (they are
carried across `execve()` of a non-privileged program without invoking the file-capability or
setuid escalation path at all — see §4.3), but making the container's two mechanisms actually
use ambient capabilities is a *further, unstarted* piece of work (PAM/session-init plumbing to
grant ambient capabilities to the `vscode` session before `no_new_privs` is set) that this
research did not find precedent for inside a Docker container's normal `postCreateCommand`/
`postStartCommand` lifecycle, and which needs its own live validation before anyone trusts it
— in the same spirit as ADR-0006's own addendum, which found a confident assumption
(`--cap-drop` doesn't touch `sudo`) wrong only once someone actually ran it. **A follow-up
effort adopting `no-new-privileges` needs to solve the ambient-capability plumbing (or some
other non-execve-based privilege-carrying mechanism) as its own piece of work — it is not a
side effect of removing `sudo` and adding `setcap`.**

---

## 1. Replacing `chown_config_volume`'s sudo'd `mkdir`/`chown`

Current code (`skills/setup-devcontainer/templates/install-cli-block.sh`, lines 19-22):

```sh
chown_config_volume() {
  sudo mkdir -p "$1"
  sudo chown -R vscode:vscode "$1"
}
```

- **`chown(2)`'s capability requirement.** `capabilities(7)` defines `CAP_CHOWN` as: *"Make
  arbitrary changes to file UIDs and GIDs"* — this is exactly what `chown -R vscode:vscode`
  needs when the volume mountpoint is `root:root`-owned (a normal user can chown files they
  own to their own group, but not arbitrary ownership changes on a root-owned tree).
  (Source: <https://man7.org/linux/man-pages/man7/capabilities.7.html>)
- **`mkdir -p` into a root-owned parent directory's capability requirement.** Two capabilities
  are relevant per `capabilities(7)`: `CAP_DAC_OVERRIDE` (*"Bypass file read, write, and
  execute permission checks"* — DAC = discretionary access control) is what actually lets a
  non-owning, non-privileged-group process write into a directory it doesn't have write
  permission on, which is the operative one here (the volume mountpoint typically has `0755`
  root:root permissions after Docker creates it, so `vscode` lacks write permission on the
  parent). `CAP_FOWNER` (*"Bypass permission checks on operations that normally require the
  filesystem UID of the process to match the UID of the file... excluding those operations
  covered by CAP_DAC_OVERRIDE"*) is the complementary one ADR-0006 already included in its
  baseline allowlist. Both are already unconditionally in this container's `--cap-add`
  baseline today (alongside `CHOWN`), so nothing about the *container's own bounding set*
  would need to change to support a `setcap`-based replacement of these two calls — only the
  mechanism that reaches for them (`setcap` on a binary vs. `sudo`) would change.
  (Source: <https://man7.org/linux/man-pages/man7/capabilities.7.html>)
- **Is `setcap` on `/bin/mkdir` / `/bin/chown` even meaningful on Ubuntu?** This needed
  checking rather than assuming. Ubuntu's `coreutils` package (the one shipped in
  `mcr.microsoft.com/devcontainers/base:ubuntu`) installs `mkdir`, `chown`, `ls`, `cat`, `rm`,
  etc. as **separate individual binaries** in `/usr/bin` (each its own ELF file), not as a
  single BusyBox-style multicall binary — the multicall-binary form (`coreutils` as one
  executable dispatching on `argv[0]`) is a real thing (GNU coreutils supports building it that
  way, and it's the norm for minimal/embedded images or the newer Rust `uutils-coreutils`
  provider), but it is **not how Ubuntu's default `coreutils` package ships**, per the
  Ubuntu/Debian packaging: `coreutils` there is a `providers`-model package producing distinct
  binary files per utility. That means `setcap cap_chown+ep /usr/bin/chown` would, on stock
  Ubuntu, only affect `chown`'s own binary — not `ls`/`cat`/`rm`/etc. **The concern the issue
  raised (a shared multicall binary would over-grant to every applet) does not apply on
  Ubuntu's stock coreutils today**, but this is a packaging fact that could drift (Ubuntu is
  actively evaluating a Rust `uutils-coreutils` provider as an alternative, per public Ubuntu
  release discussion found in this research) and should be re-checked against whatever base
  image tag is actually pinned at implementation time, not assumed permanent.
  (Sources: Ubuntu/Debian coreutils packaging discussion, `dpkg -L coreutils` behavior —
  secondary sources, not a single canonical spec page; flagged for re-verification in Open
  Questions.)
- **Even though per-binary `setcap` is meaningful on Ubuntu, a wrapper is still the safer
  design**, for a reason independent of the multicall question: `setcap cap_chown+ep
  /usr/bin/chown` would grant `CAP_CHOWN` to **every invocation of `/usr/bin/chown` by any
  process running as `vscode`**, not just the one call inside `chown_config_volume`, and
  `CAP_DAC_OVERRIDE`/`CAP_FOWNER` on `mkdir` is a similarly broad grant (any `mkdir` call
  anywhere, in any directory, by any process, would now bypass permission checks). A small
  purpose-built wrapper binary (a few lines of C, or a statically-linked helper) that does
  exactly "`mkdir -p` then `chown -R vscode:vscode`" on an argument it validates, with the
  capability set on *that one wrapper's* binary and nothing else, keeps the grant scoped to
  the one operation this container actually needs — closer to today's sudoers-path-scoping
  posture than blanket-`setcap`-on-coreutils would be.
- **Shell-script shebang caveat (why the wrapper must be a compiled binary, not a `.sh`
  file).** `setcap` sets the `security.capability` extended attribute on a file
  (`setcap(8)`: *"setcap sets the capabilities of each specified filename to the capabilities
  specified"*). When the kernel executes a file with a `#!` shebang line, it is the
  **interpreter binary** (`/bin/sh`, `/bin/bash`, `/usr/bin/python3`, etc.) that the kernel's
  `execve()` actually loads and checks capabilities against — the script path is passed to the
  interpreter as an argument, not executed directly with its own file-capability xattr in
  effect. Setting a capability on a shell script is therefore a well-documented no-op: the
  capability would need to live on `/bin/bash` itself to have any effect, which would grant it
  to *every* bash invocation by `vscode`, defeating the purpose entirely. This is exactly why a
  compiled wrapper binary (not a `.sh` wrapper) is required if the goal is a narrowly-scoped
  grant. (Source: multiple technical write-ups on Linux file capabilities converge on this
  point, e.g. Baeldung's "Linux Capabilities" and the Red Team infiltr8 capabilities page,
  consistent with `execve()`'s documented interpreter-resolution behavior in `execve(2)`;
  treated here as settled community knowledge rather than a single canonical primary-source
  sentence — flagged in Open Questions as worth pinning to `execve(2)`'s own text on
  interpreter scripts if this is implemented.)
- **Does `setcap` survive a container rebuild?** Yes, mechanically — `security.capability` is
  a filesystem extended attribute (`setcap(8)`), which means it is baked into whichever
  Docker image layer the `setcap` command runs in, exactly like today's `/etc/sudoers.d`
  files are baked into the `firewall` build stage. It would need to run in the Dockerfile
  (as `RUN setcap ... /path/to/wrapper`), after the wrapper binary is compiled/copied into
  that stage, in the same layer or a later one — no different from any other build-time file
  modification. **One real caveat found in this research (see §2) is overlayfs and
  multi-stage `COPY --from=`:** there is a documented kernel history of `security.capability`
  xattrs being lost or requiring special handling on copy-up in overlay filesystems (which is
  what Docker's default storage driver uses) — this needs to be verified against the specific
  Docker/overlay2 version in use rather than assumed safe, especially if the wrapper binary is
  built in one stage and `COPY --from=` into the final stage (a copy-up-like operation).

---

## 2. Replacing the firewall scripts' sudo'd `iptables`/`ipset`/`ip`/`dig`/`curl` calls

Current code: `init-firewall.sh` and `refresh-allowlist.sh` run as root via a `NOPASSWD`
sudoers rule scoped to those two script paths (`/etc/sudoers.d/vscode-firewall`, per
ADR-0005), invoked from `post-start.sh`.

- **Capabilities `iptables`/`ip` actually need.** `capabilities(7)` defines `CAP_NET_ADMIN` as
  covering: *"interface configuration; administration of IP firewall, masquerading, and
  accounting; modify routing tables..."* — this single capability covers everything
  `init-firewall.sh`/`refresh-allowlist.sh` do to `iptables` (flush, set policies, add rules)
  and to `ip route` (not directly called in the reviewed scripts, but within scope of the
  same capability if it ever were). `CAP_NET_RAW` is defined as: *"Use RAW and PACKET
  sockets; bind to any address for transparent proxying"* — this is what raw/packet-socket
  tools (e.g. `ping`, or certain low-level packet crafting) need, and is **not obviously
  needed** by anything `init-firewall.sh`/`refresh-allowlist.sh` do: `dig` performs ordinary
  UDP/TCP DNS queries (not raw sockets), `curl`'s bootstrap fetch of GitHub's IP ranges is
  ordinary HTTPS, `iptables`/`ipset` rule manipulation is netlink/setsockopt-based
  administration, not raw-socket use. ADR-0006's existing conditional `--cap-add=NET_RAW`
  grant may be broader than these two scripts strictly need — this research did not find a
  concrete call in either script that requires `CAP_NET_RAW` specifically, so this is worth a
  future double-check (possibly `ipset` needs it for something not surfaced here) rather than
  a confirmed finding either way. (Source: `capabilities(7)`,
  <https://man7.org/linux/man-pages/man7/capabilities.7.html>.)
- **Modern Ubuntu iptables (nft backend) and unprivileged/file-capability operation.**
  Ubuntu's default `iptables` today is `iptables-nft` (a compatibility shim over the kernel's
  `nftables` subsystem) or the legacy `iptables-legacy` backend, selectable via
  `update-alternatives`. Both still ultimately require `CAP_NET_ADMIN` for the
  privileged operations this container performs (rule/policy manipulation) — file
  capabilities work identically for either backend from the kernel's perspective, since the
  kernel evaluates file capabilities against the calling process's capability sets regardless
  of which userspace tool triggered the syscalls. Nothing found in this research suggests
  either backend has special support for, or special obstacles to, `setcap`-based unprivileged
  operation beyond the ordinary `CAP_NET_ADMIN` requirement.
- **The shebang caveat applies here too, and is the load-bearing finding for this
  mechanism.** `init-firewall.sh` and `refresh-allowlist.sh` are themselves `#!/bin/bash`
  scripts. Exactly as in §1, a capability cannot be set on a shell script — it can only be set
  on the binaries the script invokes (`/usr/sbin/iptables`, `/usr/sbin/ipset`,
  `/usr/sbin/ip`, potentially `/usr/bin/dig` and `/usr/bin/curl` if those specific calls
  somehow needed elevated capabilities, though DNS/HTTPS client calls ordinarily don't).
  **This means the capability grant cannot be scoped to "only when invoked from within these
  two scripts" the way today's sudoers rule is scoped by path** (`NOPASSWD` rules in sudoers
  are keyed to the exact command path being sudo'd, which is what makes today's design
  "`vscode` can run `sudo /path/to/init-firewall.sh` passwordlessly, and nothing else via that
  rule"). A `setcap`-based replacement would instead grant `CAP_NET_ADMIN` (and, if actually
  needed, `CAP_NET_RAW`) to **the `iptables`/`ipset`/`ip` binaries themselves, for any
  invocation by the `vscode` user from anywhere** — an ad hoc interactive `iptables -F` typed
  directly at a shell prompt would work exactly as well as the scripts' own calls. **This is a
  materially weaker security boundary than today's design and should be stated plainly to
  whoever picks this up**: it does not just move the same restriction to a different
  mechanism, it removes the path-scoping restriction entirely. (This is, concretely, the same
  class of gap ADR-0006's own addendum already flagged for the *pre-existing* blanket
  `NOPASSWD: ALL` sudo grant — a compromised `vscode` process could already run
  `sudo iptables -F` today regardless of the firewall's own scoped rule. A `setcap`-based
  replacement wouldn't make that specific gap worse in the compromised-process threat model,
  since blanket sudo already covers it — but it would remove even the narrower, currently-true
  fact that *un-compromised, ordinary* ad hoc shell use can't accidentally invoke
  `iptables`/`ipset` with elevated rights outside sudo. That's a real, if narrower, regression
  worth naming.)
- **Build-time/layer-caching considerations** are the same as §1: `setcap` on
  `/usr/sbin/iptables` etc. would need to run in the Dockerfile's `firewall` build stage
  (`RUN setcap cap_net_admin+ep /usr/sbin/iptables ...`), after those packages are installed
  in that same stage, exactly parallel to how the sudoers file is baked in today. No new
  caching concern beyond §2's overlay/copy-up caveat (below), since these are single-stage
  `apt-get install` + `setcap` operations, not cross-stage copies.

---

## 3. File capabilities and user namespaces / overlayfs — container-context gotchas

- **User namespaces and the "namespaced" (version 3) file capability format.** `capabilities(7)`
  documents that traditional (version 2) file capabilities *"confer capabilities to the
  executing process regardless of which user namespace it resides in"* only when set by a
  privileged process, whereas the newer version-3 format records *"not just the capability
  masks in the extended attribute, but also the namespace root user ID,"* so that *"capabilities
  are conferred only if the binary is executed by a process that resides in a user namespace
  whose UID 0 maps to the root user ID that is saved in the extended attribute, or when
  executed by a process that resides in a descendant of such a namespace."* This matters
  concretely for **rootless Docker** or `--userns-remap` setups: whether a `setcap`'d binary's
  capability is actually honored depends on which UID namespace the file capability was
  recorded against at `setcap` time versus which namespace the container process runs in.
  For a normal, rootful (non-remapped) Docker setup — which is what this repo's generated
  devcontainers currently assume, per ADR-0006/ADR-0005 having no `--userns-remap` mentioned
  anywhere in the reviewed templates — the file capability is set during the Dockerfile build
  (running as the image-build root, itself in the host's initial/root-mapped namespace) and
  the container later runs as `vscode` inside the same non-remapped namespace, so this
  concern does not appear to apply to today's design as-is. It would need re-checking if this
  repo ever adopted `--userns-remap` or targeted rootless Docker/Podman as a supported host.
  (Source: `capabilities(7)`, <https://man7.org/linux/man-pages/man7/capabilities.7.html>.)
- **Overlayfs and `security.capability` xattr preservation.** There is a real, documented
  kernel history here, not a hypothetical. **CVE-2021-3847** describes a privilege-escalation
  bug where an overlay mount could *copy-up* a file with an existing `security.capability`
  xattr from a `nosuid` lower layer into a non-`nosuid` upper layer, causing the capability to
  become live in a context where it shouldn't be — the opposite failure mode (capability
  *surviving* somewhere it shouldn't) from the one this research was asked to check (capability
  being *lost*), but demonstrating that overlayfs's copy-up handling of this specific xattr has
  had real, security-relevant bugs. Separately, there is a documented kernel fix
  (*"ovl: Do not lose security.capability xattr over metadata file copy-up,"* backported to at
  least the 4.19 stable series) confirming the **other** direction did also happen in practice:
  a metadata-only copy-up followed by a later data write could cause the upper layer to lose
  its `security.capability` xattr, because the underlying filesystem clears the xattr on write
  by default (a general Linux VFS behavior — writing to a file normally invalidates any
  `security.capability` xattr as a safety measure against accidentally preserving elevated
  capabilities across a content change) and overlayfs's copy-up path could hit this
  unintentionally for files that were only supposed to have their metadata copied. Net
  implication for this container: **`setcap` inside a single `RUN` layer in a Dockerfile
  should be safe** (no copy-up involved — it's a normal write within one layer's own
  filesystem view), but a design that sets capabilities in one build stage and then
  `COPY --from=`s the resulting binary into a different final stage is exactly the kind of
  cross-layer copy operation this kernel history warns about, and should be verified live
  (build the image, `getcap` the binary in the final stage, confirm the xattr survived) rather
  than assumed. (Sources: CVE-2021-3847 discussion,
  <https://seclists.org/oss-sec/2021/q4/33> and <https://seclists.org/oss-sec/2021/q4/42>;
  kernel patch *"ovl: Do not lose security.capability xattr over metadata file copy-up,"*
  <https://lkml.iu.edu/hypermail/linux/kernel/1903.2/06489.html>.)
- **`--cap-drop=ALL` + selective `--cap-add` bounds what file capabilities can grant — file
  capabilities cannot bypass it.** `capabilities(7)` states this precisely, in the "Capability
  bounding set" description: *"During an execve(2), the capability bounding set is ANDed with
  the file permitted capability set, and the result of this operation is assigned to the
  thread's permitted capability set. The capability bounding set thus places a limit on the
  permitted capabilities that may be granted by an executable file."* Concretely: `setcap
  cap_net_admin+ep /sbin/iptables` is inert unless `NET_ADMIN` is already in the *container's*
  bounding set (i.e., present in the `--cap-add` list Docker was given for that container).
  This is good news for the two mechanisms in scope: ADR-0006's existing allowlist already
  includes everything both would need (`CHOWN`/`DAC_OVERRIDE`/`FOWNER` unconditionally,
  `NET_ADMIN`/`NET_RAW` conditionally on the firewall being opted into) — no bounding-set
  change is needed to support a `setcap`-based replacement of these two specific mechanisms.
  It also confirms file capabilities are not a way to route around `--cap-drop=ALL` more
  broadly — they only redistribute *within* what Docker already allows. (Source:
  `capabilities(7)`, <https://man7.org/linux/man-pages/man7/capabilities.7.html>.)
- **Ambient vs. permitted/effective/inheritable, and whether `+ep` is sufficient for a plain
  `exec()` from a shell script.** `setcap`'s conventional `+ep` flags (Effective, Permitted)
  set the file's *permitted* and *effective* capability bits — this is precisely the
  mechanism that applies when a shell script's `exec()` of the capability-bearing binary
  happens directly (as in both mechanisms here: the wrapper binary or `iptables`/`ipset`/`ip`
  are invoked directly by the calling script, not via an intermediate ambient-capability
  carrier process). No ambient-set or `PR_SET_KEEPCAPS` involvement is needed for this to
  work — `+ep` file capabilities are the *ordinary*, expected mechanism for "grant this
  specific binary a capability, effective immediately on exec," and this is exactly the same
  mechanism `no_new_privs` is designed to block (see §4). Ambient capabilities become relevant
  only as a candidate answer to the `no_new_privs` question, not as part of the baseline
  `setcap` replacement design. (Source: `capabilities(7)`,
  <https://man7.org/linux/man-pages/man7/capabilities.7.html>; `setcap(8)`,
  <https://man7.org/linux/man-pages/man8/setcap.8.html>.)

---

## 4. `no_new_privs` and file capabilities — the crux finding

This is the fact the whole feasibility question turns on, so it's quoted directly rather than
paraphrased.

### 4.1 The kernel's own statement

The kernel's `no_new_privs` documentation
(`Documentation/userspace-api/no_new_privs.rst`) states:

> "The execve system call can grant a newly-started program privileges that its parent did
> not have. The most obvious examples are setuid/setgid programs and file capabilities."

and, on what setting the bit does:

> "With no_new_privs set, execve() promises not to grant the privilege to do anything that
> could not have been done without the execve call."

and, stated as the concrete mechanism:

> "For example, the setuid and setgid bits will no longer change the uid or gid; **file
> capabilities will not add to the permitted set**, and LSMs will not relax constraints after
> execve."

and, on the resulting guarantee:

> "If everything running with a given uid has no_new_privs set, then that uid will be unable
> to escalate its privileges by directly attacking setuid, setgid, and fcap-using binaries."

(Source: kernel documentation, fetched from
<https://raw.githubusercontent.com/torvalds/linux/master/Documentation/userspace-api/no_new_privs.rst>;
also mirrored at <https://www.kernel.org/doc/html/latest/userspace-api/no_new_privs.html>.)

### 4.2 What this means for the setcap replacement as designed in §1-§2

**File capabilities and setuid are named side by side, explicitly, as the two mechanisms
`no_new_privs` disables, for the identical reason** (execve granting privilege the caller
didn't already have). The `setcap`-on-binaries design in §1 and §2 relies precisely on file
capabilities *"adding to the permitted set"* at `execve()` time — that is the entire
mechanism (`+ep` capability bits on the wrapper binary / `iptables`/`ipset`/`ip`, applied when
the calling shell script execs them). Under `no_new_privs`, that addition is exactly what gets
suppressed. **Concretely: if the container ran with `--security-opt no-new-privileges`, a
`setcap`'d `iptables` binary invoked from `init-firewall.sh` would execute as the calling
`vscode`-owned process's already-current capability set (nothing added), fail its
`CAP_NET_ADMIN`-requiring operations with `EPERM`, and the firewall would silently never
initialize** — the same class of failure ADR-0006's own PR #290 addendum found live for
`sudo` (a `setresuid()`/`setresgid()` failure), just via a different syscall path
(`iptables`'s own netlink/setsockopt calls instead of `sudo`'s `setresuid`). **This directly
confirms the premise this research was asked to test: removing `sudo` and replacing it with
file capabilities does not, by itself, make `no-new-privileges` adoptable — both mechanisms
are blocked by the identical `no_new_privs` guarantee, because both work by having `execve()`
grant a privilege the calling process didn't already hold.**

### 4.3 Ambient capabilities — the one candidate primitive that is actually different

`capabilities(7)`'s "Ambient capabilities" section (quoted from a direct fetch of that man
page) defines the ambient set as:

> "This is a set of capabilities that are preserved across an execve(2) of a program that is
> not privileged."

with the invariant:

> "The ambient capability set obeys the invariant that no capability can ever be ambient if it
> is not both permitted and inheritable."

and, on what happens across `execve()`:

> "Executing a program that changes UID or GID due to the set-user-ID or set-group-ID bits or
> executing a program that has any file capabilities set will clear the ambient set. Ambient
> capabilities are added to the permitted set and assigned to the effective set when
> execve(2) is called."

The mechanism this describes is qualitatively different from both `sudo` (setuid) and
`setcap` (file capabilities): an ambient capability is one the calling process **already
holds before the `execve()` call** (it must already be in that process's permitted and
inheritable sets), and it is simply *carried forward* into the child process's permitted and
effective sets at `execve()`-time, **provided the executed program is itself unprivileged**
(no setuid/setgid bit, no file capabilities of its own). No new privilege is created at the
`execve()` boundary — the child ends up with exactly what the parent already had. This is
precisely the case `no_new_privs`'s own stated guarantee ("won't grant the privilege to do
anything that could not have been done without the execve call") does not need to block,
because nothing new is being granted. Neither `capabilities(7)` nor the kernel's
`no_new_privs` document, in the text this research fetched, states this compatibility as an
explicit, named guarantee in so many words — **this is this research's own inference from the
two primitives' documented definitions, not a directly-quoted "ambient capabilities are safe
under no_new_privs" sentence from a primary source**, and should be flagged as such rather
than overstated. Corroborating context found during this research: the original kernel RFC
discussion for ambient capabilities (mailing-list archive) explicitly considered and
**rejected** requiring `PR_SET_NO_NEW_PRIVS` as a *prerequisite* for using ambient
capabilities at all ("An alternative would be to... require PR_SET_NO_NEW_PRIVS before
setting ambient capabilities. I think that this would be annoying...") — meaning the two are
at minimum not designed to be mutually exclusive, though this discussion doesn't itself
constitute a definitive "compatible" statement either. (Sources: `capabilities(7)`,
<https://man7.org/linux/man-pages/man7/capabilities.7.html>; kernel ambient-capabilities RFC
discussion, found via search of LKML archives, not independently re-fetched from the primary
mailing-list post in this pass — treat as secondary corroboration, not a citation-grade
primary quote.)

### 4.4 What using ambient capabilities here would concretely require

Neither mechanism in scope (§1, §2) currently uses, or is anywhere near ready to use, ambient
capabilities — this would be new plumbing, not a drop-in swap:

- A capability must first be **raised into the target process's inheritable and permitted
  sets** before it can become ambient (`capabilities(7)`'s invariant, above). Raising a
  capability into another user's inheritable set ordinarily requires the raising process to
  hold `CAP_SETPCAP` itself — meaning *something* running with elevated privilege (root,
  during container start, before `USER vscode` takes effect, or a root-run session-opening
  step) would need to perform this setup, conceptually parallel to how `pam_cap(8)` grants
  ambient capabilities to a user's session today: `pam_cap`'s own man page describes a
  `/etc/security/capability.conf` file mapping users to inherited capability sets, applied via
  a PAM module invoked by the session-opening process (`login`, `sshd`, `su`) while that
  process still runs as root, using the `defer` argument specifically to apply the ambient
  set *after* the target `setuid()` call completes. (Source: `pam_cap(8)`, referenced via
  Ubuntu manpages: <https://manpages.ubuntu.com/manpages/stonking/man8/pam_cap.8.html>.)
  A devcontainer's `vscode` shell is not started via a traditional login/PAM session stack by
  default (it's typically an exec'd shell from the container's entrypoint or VS Code's own
  remote-server process) — whether/how `pam_cap` or an equivalent (`libcap-ng`'s `capsh
  --keep=1 --user=vscode --addamb=cap_net_admin,cap_net_raw -- -c <cmd>`, or a small root-run
  setup step in `post-create`/`post-start` that uses `capsh`/`prctl` directly) can be wired
  into that specific process-start path is a genuinely open implementation question this
  research did not resolve — it would need its own investigation into exactly what process
  tree VS Code's devcontainer CLI/remote server actually spawns for interactive/script shells.
- **Container-level `--cap-add` interaction**: the container's own bounding set would still
  need to include whatever is raised as ambient (per §2's bounding-set-constrains-everything
  finding, which applies to ambient capabilities exactly as it does to file capabilities:
  OCI runtime-spec and Docker both treat ambient as one of the sets they can configure, but
  the kernel's bounding-set-limits-everything rule is unconditional). No change needed beyond
  what ADR-0006 already allowlists, on the same reasoning as §2's last bullet.
- **Whether `CAP_SETUID`/`CAP_SETGID` are still needed**: if `sudo` is removed entirely (no
  process anywhere calls `setresuid()`/`setresgid()` any more, because nothing needs to
  transition to root — `chown_config_volume`'s wrapper runs the whole operation under file
  capabilities or ambient capabilities without ever becoming root, and the firewall scripts
  likewise operate under `CAP_NET_ADMIN` without becoming root), then `CAP_SETUID`/
  `CAP_SETGID` — added to ADR-0006's baseline allowlist specifically because `sudo` itself
  needs them (per that ADR's 2026-09-15 addendum) — would no longer be needed at all and could
  be dropped from the unconditional baseline. This is a real simplification a future
  `no_new_privs`-adopting effort should capture, but it is contingent on `sudo` being fully
  and completely removed from the container (both mechanisms replaced, no remaining ad hoc
  `sudo` call anywhere in this repo's own scripts) — it does nothing for the separately-scoped
  blanket ad hoc-sudo promise (§5).

---

## 5. Scope boundary: this only covers the skill's own automation, not the ad hoc sudo promise

Confirmed, and worth stating precisely rather than just asserting: **capabilities are an
enumerable, finite, statically-declared set** (`capabilities(7)` lists a fixed, closed set of
`CAP_*` names — currently on the order of 40 distinct capabilities, unioned into an ELF
binary's extended attributes or a process's ambient set at a specific point in time, for a
specific, known operation). The ad hoc arbitrary-`sudo`-command promise
(issue #291 story 19 — "a human or agent can run `sudo apt-get install <anything>` mid-session
and it just works") has no such fixed shape: `apt-get install <package>` can, depending on
that specific package's own `postinst`/`preinst`/`postrm` maintainer scripts, do **literally
anything root can do** — create system users (`CAP_SETUID`/`CAP_SETGID`/writing
`/etc/passwd`), install setuid binaries, write to arbitrary system paths outside `$HOME`/
`/workspace` (`CAP_DAC_OVERRIDE`/`CAP_FOWNER` beyond just the config volume),
modprobe/load kernel modules (`CAP_SYS_MODULE`), adjust system time
(`CAP_SYS_TIME`), or anything else — and *which* of these a given `apt-get install` invocation
needs is not knowable until the package (and its maintainer scripts) is chosen, which the
container's Dockerfile author cannot predict in advance for "any future package a user might
want." **A fixed `--cap-add` allowlist, or a fixed set of `setcap`'d binaries, is
definitionally unable to satisfy "arbitrary future root command" the way blanket root access
can** — enumerating the capabilities needed for `apt-get install <one specific package>` is
possible after the fact (as ADR-0006's own addendum did retroactively for `sudo` itself,
finding `CAP_SETUID`/`CAP_SETGID` was missing only via live testing), but there is no fixed
enumeration that covers *every* package's maintainer scripts in advance. This confirms the
boundary claim implicit in #318/#320's framing is technically sound: **the ad hoc promise
necessarily still needs blanket root access through some mechanism** (most plausibly: blanket
sudo stays, scoped down some other way #318 is separately deciding — e.g. audit logging,
a narrower NOPASSWD command allowlist that's still open-ended enough for arbitrary packages, or
accepting the risk with compensating controls) — this research does not attempt to solve that,
only to confirm that capability-based replacement of the *skill's own two mechanisms* is an
orthogonal, independently completable piece of work that does nothing to and does not need to
touch the ad hoc promise.

---

## Open questions / things a future session should still decide or verify live

- **The `execve()`-interpreter-resolution point in §1 (shebang scripts can't carry file
  capabilities) was sourced from converging secondary/community write-ups, not a single
  quoted primary-source sentence.** A future session implementing this should pin it to
  `execve(2)`'s own documented behavior for `#!`-prefixed files before relying on it as a
  hard architectural constraint (it is almost certainly correct — it's foundational,
  well-known Linux behavior — but this pass didn't extract the exact canonical wording).
- **Ubuntu's coreutils-is-not-multicall packaging fact (§1) should be re-verified against the
  exact base image tag/digest this repo pins**, not assumed to hold forever — Ubuntu is
  reportedly evaluating a Rust `uutils-coreutils` provider as an alternative package, and if
  that or any other multicall-style provider ever became the default, the "setcap on
  `/usr/bin/chown` only affects `chown`" reasoning in §1 would need re-checking.
- **§4.3's ambient-capabilities-are-`no_new_privs`-compatible conclusion is this research's
  own inference from `capabilities(7)`'s and the kernel doc's separate definitions, not a
  directly-quoted "these two are compatible" primary-source sentence.** Given how consequential
  this specific claim is to the entire "is `no-new-privileges` ever adoptable" question, a
  future session should either find a primary source stating this explicitly, or — more in
  keeping with how ADR-0006's own addendum resolved its wrong assumption — **live-validate it**:
  build a minimal test container, grant an ambient capability to a non-root process before
  setting `no_new_privs`, set `no_new_privs`, exec a non-privileged program, and confirm the
  capability really does survive and remain effective. Do not implement the real
  `no-new-privileges` migration on the strength of this document's inference alone.
- **§4.4's PAM/session-init plumbing for ambient capabilities was not investigated against
  this repo's actual devcontainer process-start mechanics** (what VS Code's Dev Containers
  CLI or remote server actually spawns as the interactive/script shell, and whether a
  `pam_cap`-style or `capsh`-based setup step can intercept that path before `no_new_privs` is
  set). This is a substantial unknown a follow-up effort would need to resolve from scratch —
  this research only established that the underlying kernel primitive (ambient capabilities)
  is theoretically the right tool, not that wiring it into this specific container's boot path
  is straightforward.
- **The overlayfs copy-up caveat (§3) was not tested against this repo's actual Dockerfile
  structure.** If implementation puts `setcap` and the resulting binary in the same build
  stage (no `COPY --from=`), this is very likely a non-issue; if a future implementation
  splits it across stages, a live `getcap`-after-build check is warranted before trusting it.
- **Whether `CAP_NET_RAW` is actually needed anywhere in `init-firewall.sh`/
  `refresh-allowlist.sh` (§2) was not conclusively resolved** — this research found no
  concrete call requiring it in the reviewed scripts, but did not rule out some `ipset`
  behavior or an unreviewed corner of the scripts needing it. Worth a targeted live test
  (run the firewall init with only `NET_ADMIN`, see if anything fails) independent of the
  broader sudo-removal question, since it's a scoping question about today's ADR-0006
  allowlist, not about this document's core subject.
- **Docker's own docs page fetched for this research (`docs.docker.com/engine/containers/run/`)
  did not itself cover `--security-opt=no-new-privileges`** — its content on `no-new-privileges`
  in this document is sourced from the kernel documentation directly plus secondary
  write-ups (OWASP Docker Security Cheat Sheet, community blog posts) rather than a Docker-
  authored page stating it explicitly. Docker's actual runtime behavior here is a thin,
  direct pass-through of the kernel's `PR_SET_NO_NEW_PRIVS` prctl via `--security-opt`, so
  this is unlikely to matter, but a future session should locate Docker's canonical doc page
  for this flag specifically (this pass didn't find one distinct from the general security
  options reference) if a citation to Docker's own docs (rather than the kernel's) is wanted.

---

## Sources consulted

- `capabilities(7)` — <https://man7.org/linux/man-pages/man7/capabilities.7.html> (fetched
  directly, multiple passes: file capabilities/bounding set, ambient capabilities, individual
  `CAP_*` definitions, user-namespace/version-3 file capability format).
- `setcap(8)` — <https://man7.org/linux/man-pages/man8/setcap.8.html> (fetched directly).
- `prctl(2)` — <https://man7.org/linux/man-pages/man2/prctl.2.html> (fetched directly; did not
  contain the detailed `PR_CAP_AMBIENT` sub-page content).
- Kernel `no_new_privs` documentation —
  <https://raw.githubusercontent.com/torvalds/linux/master/Documentation/userspace-api/no_new_privs.rst>
  and mirror <https://www.kernel.org/doc/html/latest/userspace-api/no_new_privs.html> (fetched
  directly).
- `pam_cap(8)` — <https://manpages.ubuntu.com/manpages/stonking/man8/pam_cap.8.html> (found via
  search, referenced for ambient-capability session setup).
- OCI runtime-spec `config.md` —
  <https://github.com/opencontainers/runtime-spec/blob/main/config.md> (fetched directly;
  confirms the five capability-set fields, does not itself re-derive kernel semantics).
- Docker docs (`--cap-add`/`--cap-drop` reference) —
  <https://docs.docker.com/engine/containers/run/#runtime-privilege-and-linux-capabilities>
  (fetched directly; did not cover `--security-opt=no-new-privileges` specifically).
- CVE-2021-3847 (overlayfs copy-up capability-xattr issue) —
  <https://seclists.org/oss-sec/2021/q4/33>, <https://seclists.org/oss-sec/2021/q4/42> (found
  via search).
- Kernel patch, *"ovl: Do not lose security.capability xattr over metadata file copy-up"* —
  <https://lkml.iu.edu/hypermail/linux/kernel/1903.2/06489.html> (found via search).
- Ambient-capabilities kernel RFC/mailing-list discussion — found via search of LKML archives
  (not independently re-fetched as a primary quote in this pass; treated as secondary
  corroboration only).
- This repo: `skills/setup-devcontainer/docs/adr/0006-capability-drop-reject-readonly-rootfs-and-seccomp.md`,
  `skills/setup-devcontainer/templates/install-cli-block.sh`,
  `skills/setup-devcontainer/templates/init-firewall.sh`,
  `skills/setup-devcontainer/templates/refresh-allowlist.sh`,
  `skills/setup-devcontainer/docs/research/live-cli-docs-verification-policy.md` (format/style
  template for this document).
