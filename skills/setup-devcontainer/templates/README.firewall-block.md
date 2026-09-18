
## Network egress firewall

- Outbound network from this container default-denies everything except an
  explicit allowlist — a default-DROP `iptables`+`ipset` firewall
  (`.devcontainer/init-firewall.sh`), run on every container start via
  `postStartCommand`, with a background loop
  (`.devcontainer/refresh-allowlist.sh`) that re-resolves and atomically
  swaps in the full allowlist every 5 minutes (override with the
  `FIREWALL_REFRESH_INTERVAL` env var, in seconds) so CDN-backed hosts
  (whose IPs rotate) don't go stale mid-session.
- The allowlist is built entirely from the **Network Manifest**
  (`.devcontainer/network-manifest.json`) — a base-owned JSON file where
  each installed CLI Skill declares its own required hosts, derived by
  `.devcontainer/network-manifest-domains.sh` — plus this repo's own
  `.devcontainer/allowed-domains.local.txt` for project-specific hosts (your
  own API, a private package registry, etc.). Nothing here is hardcoded:
  adding a CLI Skill later automatically widens the allowlist to match, with
  no firewall-script edit required.
- GitHub's IP ranges are fetched live from `api.github.com/meta` at every
  run (not hardcoded), so `git`/`gh` keep working even as GitHub's published
  ranges change.
- Any Network Manifest host fronted by Google's shared infrastructure
  (`*.google.com`, `*.googleapis.com`, `*.googleusercontent.com`, `*.google`)
  gets Google's full published IP ranges (`gstatic.com/ipranges/goog.json`),
  not just the one IP a single `dig` happens to resolve — Google
  round-robins a given hostname across many widely separated ranges within
  seconds, so pinning to one resolved IP intermittently breaks that host
  (this is what caused Antigravity's own "eligibility check" `no route to
  host` failures against `lh3.googleusercontent.com`; see ADR-0005's third
  addendum). Only fetched when the manifest actually declares a
  Google-fronted host, so a container with none doesn't get Google's entire
  network opened for no reason.
- The Network Manifest's baseline also includes `archive.ubuntu.com` and
  `ports.ubuntu.com` (Ubuntu's own package mirrors, for amd64/i386 and
  arm64/other architectures respectively), so an ordinary ad hoc `sudo
  apt-get install <tool>` mid-session keeps working under this layer too —
  without them, `apt-get update` silently "succeeds" while failing to
  refresh the package index, and only already-cached packages stay
  installable.
- `init-firewall.sh` self-verifies its own effect at the end of every run: a
  request to a disallowed host must fail, and `https://api.github.com/zen`
  must succeed. Either unexpected result fails the container's
  `postStartCommand` loudly rather than leaving a container that looks
  running but has silently wrong network rules.

**Need to reach a host that isn't already allowed?** Add it to
`.devcontainer/allowed-domains.local.txt` (one host per line) and restart
the container (**Dev Containers: Rebuild Container** isn't needed — a
restart alone reruns `postStartCommand`, which rebuilds the allowlist from
the current file contents) — or wait up to 5 minutes for the background
refresh loop to pick it up without restarting at all. A host that isn't on
the Network Manifest, `allowed-domains.local.txt`, or GitHub's/npm's own
ranges is unreachable by design; that's the point of opting into this
layer.

**`init-firewall.sh`/`refresh-allowlist.sh` run as root** via a `sudo` rule
scoped to exactly those two script paths, baked into the image's `firewall`
build stage at build time (`templates/Dockerfile`) — changing which stage
gets built, or the sudoers rule itself, needs **Dev Containers: Rebuild
Container**; the scripts' own logic lives in the bind-mounted workspace, so
an edit there is picked up on the next restart like any other lifecycle
script.

**`--cap-add=NET_ADMIN --cap-add=NET_RAW`** are added to `runArgs` only when
this layer is present — `iptables`/`ipset` need them, and they're withheld
entirely (along with the rest of this layer) if you declined the firewall
question at setup.

**What this firewall does and doesn't protect against:** it blocks a
process that tries to reach a host outside the allowlist — accidental
misconfiguration, a naive script hitting the wrong endpoint, a dependency
phoning home somewhere unexpected. It does **not** block a process that
deliberately runs `sudo iptables -F` (or any other root command) to
disable enforcement itself: `vscode` has passwordless root via a sudoers
grant baked into the base image, independent of and not narrowed by this
firewall layer's own scoped rule. Treat this firewall as a guardrail
against mistakes, not a sandbox against a fully compromised agent
process — narrowing that is a separate, larger effort than this layer
alone.
