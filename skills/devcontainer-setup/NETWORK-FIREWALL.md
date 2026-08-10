# Devcontainer firewall: self-bootstrapping allowlist

When an agent CLI runs inside a devcontainer with broad filesystem and shell access, the safest default for outbound network traffic is deny-by-default with an explicit allowlist: only named domains and their resolved IPs (plus a known-good CIDR range or two, such as your git host's published IP ranges) can be reached, everything else gets rejected. This pattern covers the shape that allowlist firewall takes in practice, the failure modes it needs to guard against, and how to keep the list itself from silently going stale.

## The core mechanism

A firewall init script runs once, early in container startup (a `postCreateCommand` or `postStartCommand` hook, or equivalent), and does four things in order:

1. Resolve each allowed domain to its current IP addresses and load them into a kernel-level set (an `ipset` on Linux, or an equivalent grouped-address construct on your platform).
2. Optionally fetch and aggregate a known CIDR range for any host with well-defined published address blocks (a package registry, a git forge), so you don't have to hand-list every IP.
3. Install a firewall rule that accepts traffic only to addresses in that set, then set the default policy to deny everything else.
4. Verify the result by making a live request to something that should be blocked (expect failure) and something that should be allowed (expect success), and fail the script loudly if either check comes out wrong.

That last step matters more than it looks. Every individual rule-install command can exit 0 while the net effect of the rule *ordering* is still wrong (a broad accept rule placed before a narrower reject, for instance). A script that only checks each command's exit code will report success on a firewall that doesn't actually do what it claims. Closing the loop with two real network calls, one that must fail and one that must succeed, catches that class of bug that unit-level checks on the script's own commands cannot.

## Fail-open bootstrap ordering

The init script's own bootstrap step (resolving domains, fetching a CIDR range) needs network access before the allowlist exists. If the script is interrupted partway through a previous run, after tightening the default policy to deny but before the allowlist rules were fully installed, a naive script would inherit that deny policy on its next run and deadlock: its own bootstrap fetch would be blocked by the leftover restrictive policy, with no way to ever rebuild the allowlist that would unblock it.

The fix is to make the very first action of the script an explicit reset of the default policy to permissive, before any other rule work happens, regardless of what state the previous run left behind. Only after the allowlist is fully built does the script tighten the default policy to deny. This guarantees every run of the script can always bootstrap itself from any prior failure state. Pair it with a short connect timeout on the bootstrap fetch itself, so a network hiccup fails fast rather than hanging the container's startup indefinitely.

## Periodic re-resolution for CDN-backed domains

A domain served through a CDN (CloudFront, Cloudflare, or similar) can rotate its resolved IPs while the container keeps running. Resolving it once at startup means the container quietly degrades over the session as those IPs age out of the CDN's rotation, producing connection errors that look unrelated to the firewall.

The fix is a background loop, launched alongside the init script, that periodically re-resolves the CDN-backed domains and any dynamic CIDR ranges and refreshes the live allowlist. Build the replacement set from scratch on a scratch name each cycle (don't mutate the live set in place), then swap the scratch set in for the live one atomically, then discard the old set. An atomic swap means there is never a window where the live set is empty, partially populated, or otherwise in an inconsistent state visible to the firewall rule that references it.

Two failure-handling details matter here:

- **If a required fetch fails mid-cycle** (the CIDR-range lookup errors, a DNS resolution times out), skip the swap for that cycle entirely and keep serving the previous, still-valid set. A refresh loop that swaps in a set built from partial data will silently narrow the allowlist rather than refresh it, breaking things that were working a moment ago.
- **The refresh loop must rebuild the *entire* allowlist, not just the domains it exists to keep fresh.** If the loop only tracks a handful of CDN-backed domains and does a full rebuild-and-swap each cycle, everything the init script added that isn't in the loop's own domain list gets silently dropped on the very first cycle. This is a fully rebuild by construction: track the complete allowlist in the loop, not a subset.

## Duplicated allowlists drift, and that drift is a live-fire failure

If your init script and refresh loop are two separate files (a reasonable split, since they run at different points with different constraints), and both maintain their own copy of "the current full allowlist," those two lists will drift the moment someone adds a domain to only one of them. Because the refresh loop does a full rebuild rather than an incremental patch, drift isn't cosmetic: it's an active failure. Something that worked at container start stops working silently, somewhere between zero and one refresh interval later, with no error message pointing at the cause.

There is no fully structural fix for this if the two scripts genuinely need different logic (one does a slow, thorough one-time build; the other needs a fast, idempotent loop body). What works in practice: document the two-file requirement explicitly and prominently wherever an agent or contributor would think to add a domain, and treat "I only edited one of the two files" as a known failure mode to check for in review, not a hypothetical.

## Deriving domain lists from a manifest instead of hand-maintaining them

Once you have more than one tool with its own separate network requirements (each agent CLI you support, each dev-tool integration), resist hand-listing each tool's hosts directly inside the firewall scripts. Instead, keep a single manifest file (JSON works well) that records, per tool: the hosts it needs, why it needs each one, and where that requirement is documented upstream. Have a small helper script parse the manifest (a JSON query tool like `jq` is enough) into a plain array, and have both the init script and the refresh loop source that helper and splice its output into their own domain lists.

This collapses what would otherwise be a third and fourth place a given host has to be kept in sync, back down to one. It also gives you a place to record *why* each host is allowed, which a bare domain string in a firewall script cannot carry. Make the helper fail loudly (non-zero exit) if the manifest is missing or parses to zero hosts, rather than silently proceeding with an empty allowlist for that tool: an allowlist helper that fails open defeats the point of having one.

This isn't just advice to follow yourself: copy
[`templates/firewall/allowed-domains.manifest.example.json`](templates/firewall/allowed-domains.manifest.example.json)
for the manifest shape and
[`templates/firewall/domains-from-manifest.sh.template`](templates/firewall/domains-from-manifest.sh.template)
for the fail-loudly helper. Both `init-firewall.sh.template` and
`refresh-allowlist.sh.template` already source this helper for their
per-tool domain list, so starting from those two templates gets the
manifest-derivation pattern by construction rather than as something you
have to remember to add later, once a hand-maintained list has already
started drifting.

## The read-only bind-mount gotcha

If your firewall scripts live in the project's version-controlled source and get bind-mounted read-only into the running container (rather than copied in at image build time), be aware that a bind mount pins the underlying inode at container start. Pulling a newer version of the script into the host checkout after the container is already running does not necessarily update what the container sees: depending on your container runtime and how the edit was made, a mid-session re-run of the mounted script can execute a stale or even truncated copy.

The safe rule: treat firewall script changes as requiring a full container restart to apply, not a mid-session re-invocation of the script. If your startup hook already re-runs the init script and relaunches the refresh loop on every start, a restart is sufficient and is the only path that reliably picks up a freshly mounted file.

## Two host-networking gotchas worth checking for

- **Desktop container runtimes often route port-forwarded traffic through a separate host-bridge network**, distinct from the container's ordinary bridge network and its default route. If mapped ports are reachable from inside the container but silently unreachable from the host despite being reported as bound, check whether your runtime has a second bridge address family that needs its own explicit allow rule. Resolve the bridge's well-known hostname at firewall-init time, compare it against the address you already detected from the default route, and add a rule for it only if it differs. On platforms where no such second bridge exists, this check should be a safe no-op.
- **A domain served from the same CDN or hosting platform as your git forge's own web presence** (documentation pages, a static-site product built on the forge) may already be covered by the CIDR range you're pulling in for the forge itself. Check what's actually in your resolved allowlist before adding a dedicated entry for a new domain; you may already have it covered.

## Applying this to a new project

- Start with the four-step init script shape: reset-to-permissive, build the allowlist, tighten to deny, self-verify.
- Decide up front whether you'll need a refresh loop at all. If none of your allowed domains sit behind a rotating-IP CDN, you may not need one, and can skip the drift risk entirely by having only one file.
- If you do need a refresh loop, budget for the duplication-drift risk from day one: document the two-file rule loudly, and consider a lightweight CI check that diffs the domain lists between the two files and fails if they disagree.
- The moment you have more than one external tool with its own network needs, reach for a manifest-plus-derivation approach before you have three or four hand-maintained domain lists to keep in sync.
