# Research: dateable release feeds for the four imperatively-installed CLIs

Ticket: issue #309 (child of map #299, "Decide setup-devcontainer's extension
points for a project with its own backing services"). Fact-finding only — this
does **not** design a minimum-release-age gate, it only establishes what
evidence such a gate could be built on.

All commands below were run live via `curl`/`WebFetch`/`WebSearch` on
**2026-09-16**. Every timestamp quoted is what that live call returned at that
moment — GitHub Releases and vendor CDNs are naturally continuing to publish
after this research was captured.

## Claude Code (`curl -fsSL https://claude.ai/install.sh | bash`)

**1. Dateable feed exists.** GitHub Releases on `anthropics/claude-code` does,
with a standard `published_at` timestamp:

```
GET https://api.github.com/repos/anthropics/claude-code/releases
→ 200, first entry: tag_name "v2.1.273", published_at "2026-09-15T20:23:03Z", prerelease: false
```
(confirmed live 2026-09-16, via `curl -si`)

**2. Correlation with what the installer actually fetches: weak/indirect —
the installer does not talk to GitHub Releases at all.** Fetched the real
installer (`curl -fsSL https://claude.ai/install.sh`, 260 lines) and read its
logic:
- `DOWNLOAD_BASE_URL="https://downloads.claude.ai/claude-code-releases"` — a
  separate, Anthropic-owned CDN (backed by Google Cloud Storage, per response
  headers), not GitHub.
- It fetches `$DOWNLOAD_BASE_URL/latest` (a bare version string), then
  `$DOWNLOAD_BASE_URL/$version/manifest.json` for a per-platform SHA-256, and
  downloads/verifies the binary straight from that CDN. GitHub is never
  referenced anywhere in the script.
- Live check: `curl -fsSL https://downloads.claude.ai/claude-code-releases/latest`
  → `2.1.273`, with response header `last-modified: Tue, 15 Sep 2026 20:22:10 GMT`.
  That is **53 seconds** before the GitHub release's `published_at`
  (`2026-09-15T20:23:03Z`) for the same version number (`v2.1.273` vs `2.1.273`,
  differing only by the `v` prefix convention) — strong evidence of a single
  automated release pipeline that publishes to both the CDN and GitHub
  Releases essentially simultaneously, but the *installer itself* only ever
  reads the CDN, not the Releases API. A gate would have to trust that this
  same-pipeline correlation holds for every future release; it is not
  something the installer enforces or the CDN documents as a guarantee.

**3. Rate limits / auth.** Unauthenticated `GET /repos/anthropics/claude-code/releases`
returned `x-ratelimit-limit: 60`, `x-ratelimit-remaining: 57`, resource
`core` — GitHub's standard 60 requests/hour/IP for unauthenticated REST calls.
The CDN itself (`downloads.claude.ai`) showed no rate-limit headers at all
(plain GCS-backed static file serving) and needs no auth.

**4. Conclusion.** A dateable feed exists and is unauthenticated and roughly
low-rate-limit-safe, but it is a *side channel* relative to what the installer
fetches — feasible only if the gate is willing to trust that Anthropic's CDN
and GitHub Releases stay in lockstep (observed true at a single point in time,
not contractually guaranteed), which is a real drift risk, not a solid
foundation.

## Codex (`curl -fsSL https://chatgpt.com/codex/install.sh | sh`)

**1. Dateable feed exists, and the installer documents two of them itself.**
GitHub Releases on `openai/codex`:

```
GET https://api.github.com/repos/openai/codex/releases
→ 200, first entry: tag_name "rust-v0.155.0-alpha.9", published_at "2026-09-16T01:34:34Z", prerelease flag present
GET https://api.github.com/repos/openai/codex/releases/tags/rust-v0.154.0
→ 200, tag_name "rust-v0.154.0", published_at "2026-09-09T22:35:38Z", prerelease: false
```
(confirmed live 2026-09-16)

**2. Correlation with what the installer actually fetches: strong and
explicit — GitHub Releases is a first-class, named fallback path in the
script itself.** Fetched the real installer (`curl -fsSL
https://chatgpt.com/codex/install.sh`, 1209 lines) and read its logic:
- `DEFAULT_PREFER_RELEASES_OPENAI_COM="true"` — by default it prefers a
  vendor CDN, `RELEASES_BASE_URL="https://releases.openai.com/codex"`, hitting
  `$RELEASES_BASE_URL/channels/latest` for the "latest" channel.
- Live check: `curl -sS https://releases.openai.com/codex/channels/latest`
  returns a JSON manifest whose only non-asset top-level field is
  `"tag_name": "rust-v0.154.0"` — the exact same tag format GitHub uses, and
  it resolves to the GitHub release confirmed above
  (`published_at: 2026-09-09T22:35:38Z`, non-prerelease). The manifest itself
  carries no date, but its `tag_name` is a direct, queryable key into GitHub
  Releases.
- Critically, the script's own `resolve_release_from_github()` function
  falls back to `https://api.github.com/repos/openai/codex/releases/latest`
  (or `/releases/tags/rust-v$VERSION` for a pinned version) whenever
  `releases.openai.com` is unavailable, or whenever a user sets
  `CODEX_INSTALLER_USE_RELEASES_OPENAI_COM=0`. It also always falls back to
  `https://github.com/openai/codex/releases/download/rust-v$VERSION/<asset>`
  for the actual binary if the CDN copy fails digest verification. So GitHub
  Releases is not a side channel here — it is a documented, code-level part of
  Codex's own installer.

**3. Rate limits / auth.** Unauthenticated `GET /repos/openai/codex/releases`
→ `x-ratelimit-limit: 60`, `x-ratelimit-remaining: 56`, resource `core` —
same standard 60/hour/IP limit. `releases.openai.com` (Cloudflare-fronted)
showed no rate-limit headers and needs no auth either. The installer's own
`--help` text documents `CODEX_INSTALLER_USE_RELEASES_OPENAI_COM` explicitly
as an env var to force GitHub Releases mode.

**4. Conclusion.** Feasible, and the best-evidenced of the four — the
installer's own code treats GitHub Releases as an authoritative,
version-tag-addressable source it already falls back to, so a gate can query
`api.github.com/repos/openai/codex/releases/tags/rust-v<version>` for the
exact version the primary CDN is about to install and get a trustworthy
`published_at`.

## Antigravity (`curl -fsSL https://antigravity.google/cli/install.sh | bash`)

**1. Dateable feed exists — a public GitHub repo was found, contrary to the
ticket's working assumption that Antigravity might be closed with no public
feed.** A web search (`WebSearch: "Antigravity CLI Google changelog release
notes agy version history"`) surfaced `github.com/google-antigravity/antigravity-cli`,
verified live:

```
GET https://api.github.com/repos/google-antigravity/antigravity-cli
→ 200, full_name "google-antigravity/antigravity-cli", archived: false
GET https://api.github.com/repos/google-antigravity/antigravity-cli/releases
→ 200, first entry: tag_name "1.2.4", published_at "2026-09-16T03:54:29Z", prerelease: false
```
(confirmed live 2026-09-16)

`antigravity.google/releases` also exists (200 OK) and links to a
`/changelog` page, but per a live `WebFetch` its release list is loaded
client-side via JavaScript ("Loading releases...") — not fetchable as static,
parseable content the way the GitHub API is. The CLI itself is also reported
(via the same web search, not independently verified here) to expose an `agy
changelog` subcommand, which would be the "documented CLI-exposed record"
form of evidence if confirmed, but that was not verified live in this pass.

**2. Correlation with what the installer actually fetches: confirmed by
matching version string, but the installer never talks to GitHub at all.**
Fetched the real installer (`curl -fsSL https://antigravity.google/cli/install.sh`,
239 lines) and read its logic:
- `DOWNLOAD_BASE_URL="https://antigravity-cli-auto-updater-974169037036.us-central1.run.app"`
  — a Google Cloud Run service, entirely separate infrastructure from GitHub
  or even a conventional CDN domain.
- It fetches `$DOWNLOAD_BASE_URL/manifests/<platform>.json` and installs
  whatever `version`/`url`/`sha512` that returns; no version parameter, no
  "latest" endpoint distinct from "current" — there is exactly one manifest
  per platform and it always represents "the" version to install right now.
- Live check: `curl -sS https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json`
  → `{"version": "1.2.4", "url": "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.2.4-6085322963025920/darwin-arm/cli_mac_arm64.tar.gz", "sha512": "..."}`.
  The `version` field (`1.2.4`) is an exact match for the GitHub repo's latest
  release tag (`1.2.4`, `published_at 2026-09-16T03:54:29Z`) confirmed above.
  The manifest itself carries **no date field at all** — no `Last-Modified`
  response header either (`server: Google Frontend`, only `date`,
  `content-length`, `x-cloud-trace-context`). The only way to get a date for
  what this manifest is about to install is to take its bare `version` string
  and separately look up `api.github.com/repos/google-antigravity/antigravity-cli/releases/tags/<version>`.
- Also worth flagging: unlike the Claude Code installer's pre-existence
  behavior, Antigravity's installer **exits immediately with no download at
  all** if `$BINARY_PATH` already exists — "The Antigravity CLI automatically
  self-updates in the background during regular runs." Any age-gating logic
  built against this installer would be gating an initial install only; the
  CLI's own self-updater (not curl-installed, not observed in this pass) is
  the actual update mechanism to instrument if drift/update-time gating
  matters, not this script.

**3. Rate limits / auth.** The GitHub side is the same unauthenticated
60/hour/IP (`x-ratelimit-limit: 60`, confirmed on the
`google-antigravity/antigravity-cli` releases call). The Cloud Run manifest
endpoint showed no rate-limit headers and needs no auth.

**4. Conclusion.** Feasible, but only by treating the version string as an
indirect join key into a second, unrelated service (GitHub) — the installer's
own primary source (the Cloud Run manifest) carries no date at all, so the
gate's trust boundary has to span two independently-operated systems (Google
Cloud Run auto-updater and a separately-branded `google-antigravity` GitHub
org) that happen to use matching version numbers today, with no documented
contract that they always will.

## Copilot CLI (`curl -fsSL https://gh.io/copilot-install | bash`)

**1. Dateable feed exists.** First resolved the short link, since the ticket
correctly flagged it as unverified:

```
curl -sSI https://gh.io/copilot-install
→ 301, Location: https://raw.githubusercontent.com/github/copilot-cli/refs/heads/main/install.sh
```
(confirmed live 2026-09-16) — so the source repo is `github/copilot-cli`, not
`cli/cli` or `github/gh-copilot` as the ticket flagged as other possibilities.
GitHub Releases on that repo has `published_at`:

```
GET https://api.github.com/repos/github/copilot-cli/releases
→ 200, first entry: tag_name "v1.0.85", published_at "2026-09-16T02:44:45Z", prerelease: false
```
(confirmed live 2026-09-16)

**2. Correlation with what the installer actually fetches: exact — this is
the only one of the four that installs directly off GitHub's own Releases
mechanism.** Fetched the real installer (the resolved raw URL above, 198
lines) and read its logic:
- No separate CDN or manifest service anywhere in the script.
- Default (no `VERSION` env var) path builds
  `DOWNLOAD_URL="https://github.com/github/copilot-cli/releases/latest/download/copilot-${PLATFORM}-${ARCH}.tar.gz"`
  and `CHECKSUMS_URL="https://github.com/github/copilot-cli/releases/latest/download/SHA256SUMS.txt"`
  — both are GitHub's own `releases/latest/download/...` redirect convention,
  which always resolves to whatever GitHub Releases currently calls "latest"
  (the same object the Releases API's `/releases/latest` endpoint returns).
- A pinned-version path builds
  `https://github.com/github/copilot-cli/releases/download/${VERSION}/...`
  directly against a release tag.
- A `VERSION=prerelease` path even uses `git ls-remote --tags --sort
  "version:refname"` against `https://github.com/github/copilot-cli` to find
  the newest tag, again entirely GitHub-native.
- There is no drift possible here in the way there is for the other three:
  the thing the installer downloads *is* a GitHub Release asset, addressed by
  GitHub's own "latest" redirect or by tag.

**3. Rate limits / auth.** Unauthenticated `GET /repos/github/copilot-cli/releases`
→ `x-ratelimit-limit: 60`, `x-ratelimit-remaining: 55`, resource `core` — same
standard limit. Note the installer script itself supports an optional
`GITHUB_TOKEN` env var (adds an `Authorization: token` header) purely to raise
GitHub's *download* rate limits for the tarball/checksum fetch, not for
Releases API metadata calls — a devcontainer gate could use the same pattern
if it ever needed to raise its own 60/hour ceiling, but plain unauthenticated
calls are sufficient at the query volumes a per-container update check would
generate.

**4. Conclusion.** Most straightforwardly feasible of the four — the
installer's download target *is* GitHub Releases, so the Releases API's
`published_at` for whatever tag the "latest" redirect currently points to is
authoritative, not inferred or joined across systems.

## Cross-CLI summary

| CLI | Dateable feed? | Correlates with installer? | Unauth rate limit issue? | Gate feasible? |
|---|---|---|---|---|
| Claude Code | Yes — GitHub Releases (`anthropics/claude-code`), `published_at` present | Indirect — installer only reads a separate Anthropic CDN (`downloads.claude.ai`); GitHub timestamp matched CDN's `Last-Modified` within 53s at time of check, but not a documented guarantee | No — standard 60/hr/IP, confirmed via response headers; CDN itself uncapped | Yes, but only by trusting an unenforced same-pipeline assumption |
| Codex | Yes — GitHub Releases (`openai/codex`), `published_at` present | Strong — installer's own code (`resolve_release_from_github`) falls back to GitHub Releases API/assets by name, and the primary CDN's manifest returns a GitHub-format `tag_name` directly | No — standard 60/hr/IP, confirmed | Yes — best-evidenced of the four |
| Antigravity | Yes — GitHub Releases (`google-antigravity/antigravity-cli`), `published_at` present (found via web search, not previously known; contradicts ticket's "may be closed" assumption) | Indirect — installer only reads a Google Cloud Run manifest with no date field at all; version string matched the GitHub tag at time of check, no documented contract | No — standard 60/hr/IP on the GitHub side, confirmed; Cloud Run manifest uncapped | Yes, but requires joining two independently-run systems on a bare version string |
| Copilot CLI | Yes — GitHub Releases (`github/copilot-cli`, resolved from the `gh.io/copilot-install` short link), `published_at` present | Exact — installer downloads directly from `github.com/.../releases/latest/download/...`, GitHub's own release-asset mechanism | No — standard 60/hr/IP, confirmed; installer's own optional `GITHUB_TOKEN` support could raise it further if ever needed | Yes — most direct of the four |

A fail-safe "hold at current version when a release's age can't be confirmed"
gate is technically feasible for all four CLIs using unauthenticated GitHub
Releases API calls (`published_at`, 60/hour/IP is ample for a per-container
check), but the strength of the guarantee differs sharply: Copilot CLI and
Codex tie the gate directly or near-directly to what the installer fetches;
Claude Code and Antigravity require trusting that a separate,
undocumented-contract CDN/manifest stays in lockstep with the GitHub tag the
gate would actually query.
