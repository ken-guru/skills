# Copilot API hosts per plan, and the GitHub meta key that contains them

Ticket: ken-guru/skills#560. Checked 2026-10-21.

## Question

Which Copilot API hosts does each plan use for inference, and do they resolve inside the published `meta` ranges? Report each host's resolved IP and the `meta` key that contains it, or none.

## Sources

- **Plan endpoints:** `GET https://api.github.com/copilot_internal/user`, authenticated as the `ken-guru` account, which reports `copilot_plan: "business"`. Field `endpoints.api` = `https://api.business.githubcopilot.com`. This is the only plan type this account can query.
- **Published ranges:** `GET https://api.github.com/meta` (GitHub's published IP ranges). Keys present: `actions`, `actions_macos`, `api`, `codespaces`, `commit_signing_keys`, `copilot`, `git`, `github_enterprise_importer`, `hooks`, `importer`, `packages`, `pages`, `ssh_keys`, `web`.
- **Resolution:** system resolver (`getent ahostsv4`) on this machine, 2026-10-21. All three hosts are CNAMEs to `glb-db52c2cf8be544.github.com`.

## Results

| Host | Plan | Resolved IPv4 | Containing `meta` key(s) | Range |
|---|---|---|---|---|
| `api.business.githubcopilot.com` | Business (verified via `endpoints.api`) | 140.82.112.22, 140.82.113.21 | `copilot` (also `api`, `git`, `web`, `hooks`, `github_enterprise_importer`) | 140.82.112.0/20 |
| `api.individual.githubcopilot.com` | Individual (endpoint not verified) | 140.82.112.22, 140.82.113.21 | `copilot` (same as above) | 140.82.112.0/20 |
| `api.githubcopilot.com` | Generic/default (not a plan-specific endpoint) | 140.82.112.22, 140.82.113.21 | `copilot` (same as above) | 140.82.112.0/20 |

The `copilot` key's ranges include `140.82.112.0/20`, and that is the only range that contains either address in the `copilot` key. The same /20 also appears under several other keys, so the `copilot` key is the one that matches the Copilot hosts specifically.

## Gaps

- **Individual plan:** the `endpoints.api` value for an Individual account was not checked. No Individual account was available. The host `api.individual.githubcopilot.com` resolves to the same IPs as the Business host, but that does not confirm it is the endpoint Individual accounts actually receive.
- **Enterprise and other plan types:** not checked. Only the `business` plan was available to query.
- **DNS:** the IPs above are the answers returned at lookup time. The name is a round-robin on a CNAME, so the exact addresses may change. The /20 containment is the stable part.
