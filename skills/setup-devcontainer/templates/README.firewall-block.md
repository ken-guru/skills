
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
