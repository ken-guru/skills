# meta.copilot range coverage

Research note for issue #559: what the `copilot` key in `https://api.github.com/meta` publishes, and how its CIDR ranges overlap the `api`, `web` and `git` keys that `firewall_collect_github_ranges` allowlists.

## Question

What does the `copilot` key in `https://api.github.com/meta` publish, and how do its CIDR ranges overlap the `api`, `web` and `git` keys that `firewall_collect_github_ranges` already allowlists? Report the ranges per key as of the fetch date, and whether any `copilot` range is absent from the other keys.

## Fetch

- Date fetched: 2026-10-21. The response `Date` header was `Wed, 21 Oct 2026 10:34:52 GMT`; the response was `HTTP/2 200`, `cache-control: public, max-age=60`, so values can change after that time.
- Command run (from the agent's scratchpad, outside the repo):

```bash
curl -sS -D headers.txt -H 'Accept: application/vnd.github+json' https://api.github.com/meta -o meta.json
```

- Analysis: `python3 -I overlap.py meta.json`, using the standard `ipaddress` module. Containment means a `copilot` CIDR is a subnet of an `api`, `web` or `git` CIDR. Exact match means the same network appears in that key. Raw data is not committed to the repo.

Top-level keys in the response: `verifiable_password_authentication`, `ssh_key_fingerprints`, `ssh_keys`, `hooks`, `web`, `api`, `git`, `github_enterprise_importer`, `packages`, `pages`, `importer`, `actions`, `actions_macos`, `codespaces`, `copilot`, `domains`, `commit_signing_keys`.

## Where the repo reads these keys

- `firewall_collect_github_ranges()` is defined at `.devcontainer/firewall-lib.sh` lines 30-48. It fetches `https://api.github.com/meta` with `curl`, requires `.web and .api and .git` to be present via `jq -e` (line 33), and builds `FIREWALL_GITHUB_CIDRS` from `(.web + .api + .git)[]` piped through `aggregate -q` (line 42). The `copilot` key is never read.
- The same function is duplicated at `skills/setup-devcontainer/templates/firewall-lib.sh` (defined at line 30 in the template). It is sourced by `.devcontainer/init-firewall.sh` (line 83) and `.devcontainer/refresh-allowlist.sh` (line 51).
- Note: the comment at `firewall-lib.sh` lines 80-82 says the firewall allowlist is IPv4-only. The GitHub collector applies no IPv4 filter, so the two IPv6 entries per key (`2606:50c0::/32`, `2a0a:a440::/29`) pass through the `jq` pipeline unchanged. This note did not verify how `aggregate` or `ipset` handles them at runtime.

## Ranges per key

### `api` (27 ranges: 25 IPv4, 2 IPv6)

| CIDR | Family |
| --- | --- |
| `4.208.26.200/32` | IPv4 |
| `4.225.11.201/32` | IPv4 |
| `4.228.31.149/32` | IPv4 |
| `4.237.22.34/32` | IPv4 |
| `4.249.131.166/32` | IPv4 |
| `20.26.156.210/32` | IPv4 |
| `20.27.177.116/32` | IPv4 |
| `20.29.134.17/32` | IPv4 |
| `20.87.245.6/32` | IPv4 |
| `20.175.192.149/32` | IPv4 |
| `20.199.39.228/32` | IPv4 |
| `20.200.245.245/32` | IPv4 |
| `20.201.28.148/32` | IPv4 |
| `20.205.243.168/32` | IPv4 |
| `20.207.73.85/32` | IPv4 |
| `20.217.135.0/32` | IPv4 |
| `20.233.83.146/32` | IPv4 |
| `20.250.119.72/32` | IPv4 |
| `48.202.248.39/32` | IPv4 |
| `48.204.201.2/32` | IPv4 |
| `140.82.112.0/20` | IPv4 |
| `143.55.64.0/20` | IPv4 |
| `172.182.252.137/32` | IPv4 |
| `185.199.108.0/22` | IPv4 |
| `192.30.252.0/22` | IPv4 |
| `2606:50c0::/32` | IPv6 |
| `2a0a:a440::/29` | IPv6 |

### `web` (41 ranges: 39 IPv4, 2 IPv6)

| CIDR | Family |
| --- | --- |
| `4.208.26.193/32` | IPv4 |
| `4.208.26.197/32` | IPv4 |
| `4.225.11.194/32` | IPv4 |
| `4.225.11.199/32` | IPv4 |
| `4.228.31.144/32` | IPv4 |
| `4.228.31.150/32` | IPv4 |
| `4.237.22.36/32` | IPv4 |
| `4.237.22.38/32` | IPv4 |
| `4.249.131.164/32` | IPv4 |
| `20.26.156.213/32` | IPv4 |
| `20.26.156.215/32` | IPv4 |
| `20.27.177.113/32` | IPv4 |
| `20.27.177.119/32` | IPv4 |
| `20.29.134.22/32` | IPv4 |
| `20.29.134.23/32` | IPv4 |
| `20.87.245.0/32` | IPv4 |
| `20.87.245.2/32` | IPv4 |
| `20.175.192.147/32` | IPv4 |
| `20.199.39.232/32` | IPv4 |
| `20.200.245.244/32` | IPv4 |
| `20.200.245.247/32` | IPv4 |
| `20.201.28.151/32` | IPv4 |
| `20.205.243.161/32` | IPv4 |
| `20.205.243.166/32` | IPv4 |
| `20.207.73.81/32` | IPv4 |
| `20.207.73.82/32` | IPv4 |
| `20.217.135.1/32` | IPv4 |
| `20.217.135.5/32` | IPv4 |
| `20.233.83.145/32` | IPv4 |
| `20.233.83.148/32` | IPv4 |
| `20.250.119.67/32` | IPv4 |
| `48.202.248.40/32` | IPv4 |
| `48.204.201.5/32` | IPv4 |
| `140.82.112.0/20` | IPv4 |
| `143.55.64.0/20` | IPv4 |
| `172.182.252.130/32` | IPv4 |
| `172.182.252.133/32` | IPv4 |
| `185.199.108.0/22` | IPv4 |
| `192.30.252.0/22` | IPv4 |
| `2606:50c0::/32` | IPv6 |
| `2a0a:a440::/29` | IPv6 |

### `git` (62 ranges: 60 IPv4, 2 IPv6)

| CIDR | Family |
| --- | --- |
| `4.208.26.193/32` | IPv4 |
| `4.208.26.197/32` | IPv4 |
| `4.208.26.198/32` | IPv4 |
| `4.225.11.194/32` | IPv4 |
| `4.225.11.199/32` | IPv4 |
| `4.225.11.200/32` | IPv4 |
| `4.228.31.144/32` | IPv4 |
| `4.228.31.145/32` | IPv4 |
| `4.228.31.150/32` | IPv4 |
| `4.237.22.36/32` | IPv4 |
| `4.237.22.38/32` | IPv4 |
| `4.237.22.40/32` | IPv4 |
| `4.249.131.163/32` | IPv4 |
| `4.249.131.164/32` | IPv4 |
| `20.26.156.213/32` | IPv4 |
| `20.26.156.214/32` | IPv4 |
| `20.26.156.215/32` | IPv4 |
| `20.27.177.113/32` | IPv4 |
| `20.27.177.118/32` | IPv4 |
| `20.27.177.119/32` | IPv4 |
| `20.29.134.19/32` | IPv4 |
| `20.29.134.22/32` | IPv4 |
| `20.29.134.23/32` | IPv4 |
| `20.87.245.0/32` | IPv4 |
| `20.87.245.2/32` | IPv4 |
| `20.87.245.4/32` | IPv4 |
| `20.175.192.146/32` | IPv4 |
| `20.175.192.147/32` | IPv4 |
| `20.199.39.227/32` | IPv4 |
| `20.199.39.232/32` | IPv4 |
| `20.200.245.244/32` | IPv4 |
| `20.200.245.247/32` | IPv4 |
| `20.200.245.248/32` | IPv4 |
| `20.201.28.151/32` | IPv4 |
| `20.201.28.152/32` | IPv4 |
| `20.205.243.160/32` | IPv4 |
| `20.205.243.161/32` | IPv4 |
| `20.205.243.166/32` | IPv4 |
| `20.207.73.81/32` | IPv4 |
| `20.207.73.82/32` | IPv4 |
| `20.207.73.83/32` | IPv4 |
| `20.217.135.1/32` | IPv4 |
| `20.217.135.4/32` | IPv4 |
| `20.217.135.5/32` | IPv4 |
| `20.233.83.145/32` | IPv4 |
| `20.233.83.148/32` | IPv4 |
| `20.233.83.149/32` | IPv4 |
| `20.250.119.67/32` | IPv4 |
| `20.250.119.68/32` | IPv4 |
| `48.202.248.38/32` | IPv4 |
| `48.202.248.40/32` | IPv4 |
| `48.204.201.5/32` | IPv4 |
| `48.204.201.6/32` | IPv4 |
| `140.82.112.0/20` | IPv4 |
| `143.55.64.0/20` | IPv4 |
| `172.182.252.130/32` | IPv4 |
| `172.182.252.133/32` | IPv4 |
| `172.182.252.135/32` | IPv4 |
| `185.199.108.0/22` | IPv4 |
| `192.30.252.0/22` | IPv4 |
| `2606:50c0::/32` | IPv6 |
| `2a0a:a440::/29` | IPv6 |

### `copilot` (17 ranges: 15 IPv4, 2 IPv6)

| CIDR | Family |
| --- | --- |
| `4.225.11.192/32` | IPv4 |
| `4.228.31.153/32` | IPv4 |
| `4.237.22.41/32` | IPv4 |
| `4.249.131.160/32` | IPv4 |
| `13.107.5.93/32` | IPv4 |
| `20.85.130.105/32` | IPv4 |
| `20.199.39.224/32` | IPv4 |
| `20.250.119.64/32` | IPv4 |
| `52.140.63.241/32` | IPv4 |
| `52.175.140.176/32` | IPv4 |
| `138.91.182.224/32` | IPv4 |
| `140.82.112.0/20` | IPv4 |
| `143.55.64.0/20` | IPv4 |
| `185.199.108.0/22` | IPv4 |
| `192.30.252.0/22` | IPv4 |
| `2606:50c0::/32` | IPv6 |
| `2a0a:a440::/29` | IPv6 |

## Overlap summary

| Key | Ranges | Exact matches with `copilot` | Copilot ranges contained in this key | Copilot ranges with any overlap |
| --- | --- | --- | --- | --- |
| `api` | 27 | 6 | 0 | 6 |
| `web` | 41 | 6 | 0 | 6 |
| `git` | 62 | 6 | 0 | 6 |

Of the 17 `copilot` ranges, 6 are covered by an exact match or containment in at least one of `api`, `web`, `git`, and 11 are not covered by any of them.

### `copilot` ranges covered by the other keys

| Copilot CIDR | Covered by |
| --- | --- |
| `140.82.112.0/20` | `api`, `web`, `git` (exact match in all three) |
| `143.55.64.0/20` | `api`, `web`, `git` (exact match in all three) |
| `185.199.108.0/22` | `api`, `web`, `git` (exact match in all three) |
| `192.30.252.0/22` | `api`, `web`, `git` (exact match in all three) |
| `2606:50c0::/32` | `api`, `web`, `git` (exact match in all three) |
| `2a0a:a440::/29` | `api`, `web`, `git` (exact match in all three) |

### `copilot`-only ranges (absent from `api`, `web` and `git`)

Eleven `copilot` ranges are absent from all of `api`, `web` and `git`, as an exact match or as a subnet of any range in them. All are single host addresses (`/32`):

| Copilot-only CIDR |
| --- |
| `4.225.11.192/32` |
| `4.228.31.153/32` |
| `4.237.22.41/32` |
| `4.249.131.160/32` |
| `13.107.5.93/32` |
| `20.85.130.105/32` |
| `20.199.39.224/32` |
| `20.250.119.64/32` |
| `52.140.63.241/32` |
| `52.175.140.176/32` |
| `138.91.182.224/32` |

Because `firewall_collect_github_ranges` does not read `copilot`, none of these addresses is in the allowlist it builds. Whether that matters depends on whether a Copilot endpoint resolves to them; this note did not test that.

The six covered ranges are exact matches: the IPv4 `140.82.112.0/20`, `143.55.64.0/20`, `185.199.108.0/22`, `192.30.252.0/22`, and the IPv6 `2606:50c0::/32`, `2a0a:a440::/29`. Each appears identically in `api`, `web` and `git`. No `copilot` range is contained in a larger `api`, `web` or `git` range without also being an exact match.

## Sources

- The api.github.com/meta response, fetched as above: `https://api.github.com/meta`. Per-key and per-CIDR values are taken from this response.
- GitHub REST API docs, Meta page: `https://docs.github.com/en/rest/meta/meta` (fetched 2026-10-21, API version 2026-03-10). It says the endpoint returns GitHub service IP addresses, both IPv4 and IPv6, and that the values shown in the docs are examples: "You must always query the API directly to get the latest values." The docs' example response lists `copilot` as a key with a `domains.copilot` entry, but the page gives no per-key description of what `copilot` covers, so the meaning of the `copilot` key is not defined by the docs.
- Repo source: `.devcontainer/firewall-lib.sh` lines 30-48 and 80-82; `.devcontainer/init-firewall.sh` line 83; `.devcontainer/refresh-allowlist.sh` line 51; `skills/setup-devcontainer/templates/firewall-lib.sh` line 30 onward.
- The `copilot` key in the response has a sibling `domains.copilot` list (`*.githubcopilot.com` among others). That is a domain allowlist entry, not a CIDR, and the firewall collector does not read it.

## Not verified

- Whether any Copilot service actually resolves to one of the eleven copilot-only addresses.
- Runtime behaviour of `aggregate` and `ipset` on the IPv6 entries.
- The meaning of the `copilot` key beyond the response data and the docs example.
