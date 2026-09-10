# Findings: can the four vendor installer *scripts* themselves be integrity-verified before execution? (2026-09-10)

Primary-source research feeding wayfinder decision ticket
[ken-guru/skills#232](https://github.com/ken-guru/skills/issues/232), which narrows the trust
question left open by [ken-guru/skills#214](https://github.com/ken-guru/skills/issues/214):
#214 established that all four vendor installer *scripts* already checksum-verify the *CLI binary*
they go on to download, unconditionally. Socket's skills.sh audit finding — "executes an unverified
remote installer script via curl \| bash without checksum/signature or version pinning," severity
60–70%, on all four `templates/<tool>/post-create-block.sh` — is about a different, still-open trust
boundary: is the **script itself** (the bytes piped straight into `bash`/`sh`, before any of its own
internal binary-checksum logic ever runs) verified before execution? This note answers only that
narrower question, live, for each vendor, as of today.

**Repo files read:** `skills/setup-devcontainer/templates/{claude-code,codex,antigravity,copilot}/post-create-block.sh`
(confirms the exact URL/shell/env each block uses — unchanged from #214's research, reconfirmed here),
`skills/setup-devcontainer/templates/install-cli-block.sh`, `skills/setup-devcontainer/SKILL.md`
("CLI installer notes" summary, lines ~439–449), `skills/setup-devcontainer/templates/README.baseline.md`
("CLI installer notes" section, lines 77–97) — all three repo docs currently describe only binary/manifest
verification, none mention script-level verification, confirming the gap this ticket is about.

---

## Verdict summary

| Vendor | (a) Script-level verification lever | (b) Alternate signed distribution channel |
|---|---|---|
| **Claude Code** | **Doesn't exist.** `claude.ai/install.sh` is one mutable URL; the documented version argument (`bash -s 2.1.89`) pins the *target binary*, not the script's own content — same URL, same bytes, no separate hash/signature published for the script. | **Exists.** `npm install -g @anthropic-ai/claude-code` — npm-registry-signed (`dist.signatures`, keyid `SHA256:DhQ8wR5A...`, npm's registry key). Also GPG-signed apt/dnf/apk repos (binary packages, not this script). |
| **Codex CLI** | **Doesn't exist.** `chatgpt.com/codex/install.sh` → `releases.openai.com/codex/install.sh`, one mutable URL, no versioned path, no published hash/signature for the script itself. `openai/codex` GitHub repo does **not** contain `install.sh` (confirmed 404) — unlike Copilot, there's no git-pinnable source for this script. | **Exists, and strongest of the four.** `npm install -g @openai/codex` carries both npm registry signatures **and** npm/Sigstore SLSA provenance (`attestations.provenance.predicateType: https://slsa.dev/provenance/v1`, independently verifiable via `npm audit signatures` or GitHub's attestation API). |
| **Antigravity** | **Doesn't exist.** `antigravity.google/cli/install.sh` is served from a Google Cloud Run app (`antigravity-cli-auto-updater-*.run.app`), one mutable URL (`cache-control: max-age=600`), no version path, no published hash/signature for the script. | **Doesn't exist.** No official npm package (npm search for "antigravity cli" returns only unrelated third-party tools), no Homebrew formula, no apt/deb repo mentioned on `antigravity.google/docs/cli/getting-started` or `.../install/` (grepped live for `brew install`/`npm install`/`apt install`/`winget install` — zero hits on either page). Only the curl\|bash script and a PowerShell equivalent. |
| **Copilot CLI** | **Partially exists — real but incomplete.** `gh.io/copilot-install` redirects to `raw.githubusercontent.com/github/copilot-cli/refs/heads/main/install.sh` — i.e. the script **is** tracked source in the public `github/copilot-cli` repo, so it *can* be fetched by an immutable ref (a release tag or commit SHA) instead of the mutable `main` branch. Confirmed: `raw.githubusercontent.com/.../v1.0.83/install.sh` exists and its content genuinely differs from current `main` (main has since gained an OS-detection caching change and Windows/winget handling). But: the repo's commits are **unsigned** (`"verified": false, "reason": "unsigned"` on the latest commit via the GitHub API), and `install.sh` is **not** among the release's checksummed assets — `SHA256SUMS.txt` for `v1.0.83` lists only the CLI binaries, not `install.sh`. So pinning gets you immutability/reproducibility and diffability via git history, but no vendor-published hash or signature over the script. | **Exists.** `npm install -g @github/copilot` — npm-registry-signed, same signing key as the others. Also documented Homebrew, WinGet, and direct signed-checksum GitHub Release binaries (`SHA256SUMS.txt`, per #214). |

---

## 1. Claude Code

- Script fetched live: `curl -fsSL https://claude.ai/install.sh` → 302 → `https://downloads.claude.ai/claude-code-releases/bootstrap.sh` (260 lines). The script's own `TARGET="$1"` logic (`stable`/`latest`/a semver) only selects which **binary** `manifest.json`/`claude` build to download later in the same script run (`download_file "$DOWNLOAD_BASE_URL/$version/manifest.json"`) — the script content fetched from `claude.ai/install.sh` is identical regardless of that argument. There is no versioned URL for the installer script itself (e.g. no `claude.ai/install-2.1.89.sh`).
- `code.claude.com/docs/en/setup` ("Advanced setup") documents "Binary integrity and code signing" → "Verify the manifest signature" → "Platform code signatures" — confirmed by fetching the live page and extracting its table of contents and body text. Every mention is scoped to the downloaded **binary**'s manifest (GPG key fingerprint `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`, imported from `https://downloads.claude.ai/keys/claude-code.asc`) — the page never mentions a hash or signature for `install.sh` itself.
- Alternate channel: the same "Advanced setup" page's table of contents lists "Install with npm" as a first-class method alongside Native/Homebrew/WinGet/apt-dnf-apk. Confirmed live via the npm registry: `@anthropic-ai/claude-code@2.1.267`'s registry metadata carries `dist.signatures` (two ECDSA sigs, keyid `SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U` — npm's own registry signing key) and an `integrity` (sha512) field npm's client verifies automatically on install.

## 2. Codex CLI

- Script fetched live: `curl -fsSL https://chatgpt.com/codex/install.sh` → 302 → `https://releases.openai.com/codex/install.sh` (1209 lines). `CODEX_RELEASE`/`--release` only selects which release **archive** the script downloads later (`RELEASE="${CODEX_RELEASE:-latest}"`) — again, the script's own content at that URL is one mutable target, not versioned by URL.
- Checked whether the script is git-hosted and thus tag/commit-pinnable, as Copilot's is: it is not. `openai/codex` is a real public GitHub repo (confirmed via the GitHub API), but `raw.githubusercontent.com/openai/codex/main/install.sh` returns 404 — the installer isn't checked into that repo (or any repo found); it's served only from OpenAI's own `releases.openai.com` CDN with no alternate, immutable ref.
- `learn.chatgpt.com/docs/codex/cli` (the page `developers.openai.com/codex/cli` redirects to) documents no checksum/signature/pin for the script, only the plain `curl \| sh` command plus npm/Homebrew/Windows alternatives — confirmed via #214's live fetch, unchanged in scope here.
- Alternate channel: `npm install -g @openai/codex@0.154.0` — confirmed via the npm registry to carry both `dist.signatures` (same npm registry key as Claude Code/Copilot) **and** a separate `attestations.provenance` block (`predicateType: https://slsa.dev/provenance/v1`), i.e. Sigstore-backed build provenance tying the published tarball to a specific OpenAI CI build — independently verifiable (`npm audit signatures`, or GitHub's own attestation API for the `openai/codex` repo). This is the strongest verifiable alternate channel found across all four vendors.

## 3. Antigravity

- Script fetched live: `curl -fsSL https://antigravity.google/cli/install.sh` → 200 (no redirect), served directly from a Google Cloud Run app fronting `antigravity.google`, `cache-control: public, max-age=600`, `etag: "zM5DOw"` (a weak cache validator, not a content hash scheme a user could pre-fetch and verify against). No `-d/--dir`-adjacent version/pin flag exists (confirmed by reading the full 239-line script and its `show_usage` block — only `-d/--dir` and `-h/--help`).
- No GitHub repo carries this script for tag/commit pinning: `antigravity.google/cli/install.sh` is not sourced from `google-antigravity/antigravity-cli` (that repo's README only documents the same curl\|bash command).
- Live-checked today for an alternate channel: `antigravity.google/docs/cli/getting-started` and `antigravity.google/docs/cli/install/`, grepped for `brew install`, `npm install`, `apt install`/`apt-get install`, `winget install` — zero matches on either page. `npm search antigravity cli` (registry search API) returns no official Google package — the ~200 results are all unrelated third-party tools using "antigravity" or "agy" in their name. No Homebrew formula found. Antigravity remains the one vendor of the four with neither lever.

## 4. GitHub Copilot CLI

- Script fetched live: `curl -fsSL https://gh.io/copilot-install` → 301 → `https://raw.githubusercontent.com/github/copilot-cli/refs/heads/main/install.sh` (198 lines). This is the one vendor whose script is plain git-hosted source, not a CDN artifact — meaning it genuinely can be pinned to an immutable ref instead of `refs/heads/main`.
- Confirmed by direct fetch: `https://raw.githubusercontent.com/github/copilot-cli/v1.0.83/install.sh` returns 200 with content that **differs** from current `main` (`diff` shows `main` gained an `OS="$(uname -s)"` caching refactor and explicit Windows/winget error-message handling since the `v1.0.83` tag) — proof the tag genuinely freezes a distinct, older script revision, not just an alias for the same bytes.
- Checked whether that pinned content carries any vendor-published integrity artifact of its own: the `v1.0.83` release's `SHA256SUMS.txt` (fetched live from `github.com/github/copilot-cli/releases/download/v1.0.83/SHA256SUMS.txt`) lists only the 19 CLI binary/archive assets — `install.sh` is not in it. The repo's latest commit is unsigned per the GitHub API (`commit.verification.verified: false, reason: "unsigned"`) — so a tag pin buys immutability and `git diff`-ability across versions, not a vendor-issued hash/signature to check against.
- Alternate channel: `npm install -g @github/copilot@1.0.83` — confirmed via the npm registry to carry the same registry `dist.signatures` as the other two npm-distributed CLIs. Homebrew and WinGet install methods are also documented on `docs.github.com/.../install-copilot-cli` (per #214's confirmed research, unchanged).

---

## What adopting each lever would look like in this repo

**(a) is a dead end for three of four vendors.** Claude Code, Codex, and Antigravity serve `install.sh`
from one mutable, non-content-addressed URL with no vendor-published hash/signature for the script
itself — there is nothing to `sha256sum -c` against, and nothing to pin the URL to. The only
partial exception is Copilot: `templates/copilot/post-create-block.sh`'s
`install_cli "Copilot" "$HOME/.local/bin/copilot" "https://gh.io/copilot-install" bash` could change
the URL to `https://raw.githubusercontent.com/github/copilot-cli/v1.0.83/install.sh` (a specific,
already-released tag) and this repo could itself pin a `sha256sum` of that fetched content in
`install-cli-block.sh` (self-issued, not vendor-issued — the equivalent of vendoring the script) —
but that means manually bumping both the tag and the recorded hash on every Copilot CLI upgrade,
which is exactly the staleness-tracking machinery the repo's own history (`compose-fragment.yml`
comment, README's "tried and reverted" note) already describes clashing with Copilot's background
self-update. It would also only close the gap for one of the four vendors, leaving Socket's finding
present on the other three regardless.

**(b) is real for three of four vendors and is a bigger, cleaner lever than (a).** Swapping
`templates/{claude-code,codex,copilot}/post-create-block.sh` from `install_cli ... bash` to an
`npm install -g @anthropic-ai/claude-code` / `@openai/codex` / `@github/copilot` step (npm is already
a dependency of this repo's Node-based base image) would replace an unverified piped script with an
install path npm itself cryptographically verifies (registry signature check built into `npm install`,
plus Sigstore/SLSA provenance for Codex specifically) — genuinely closing Socket's stated complaint,
not just relocating it. This is a real behavior change, not a comment fix: it changes the update
model (npm's own version resolution instead of each vendor's bespoke self-updater) and would need the
same idempotency/failure-tolerance shape `install_cli` currently provides. **Antigravity has no such
channel** — nothing found here changes its posture; Socket's finding on
`templates/antigravity/post-create-block.sh` would remain accurate with no code-level fix available
from either lever.

## Answering the ticket's overall question

**A real, code-level fix for Socket's specific "unverified remote installer script" complaint exists
for three of the four vendors (Claude Code, Codex, Copilot) via lever (b) — switching to each
vendor's npm-distributed package, which npm's own client cryptographically verifies before install —
and does not exist for Antigravity via either lever.** Lever (a), verifying the install *script*
itself before piping to a shell, does not exist as a vendor-supported mechanism for any of the four:
Claude Code, Codex, and Antigravity serve it from one mutable, unversioned, unsigned URL with nothing
to check it against; Copilot's script is git-pinnable (a real, verified difference between the
`v1.0.83` tag and current `main`), but only to an immutable *ref*, not to a vendor-published hash or
signature over the script's bytes — closing the "mutable latest" half of Socket's complaint for
Copilot alone, not the "unverified" half, and not for any of the other three.

---

## Source index

**Repo files read:** `skills/setup-devcontainer/templates/claude-code/post-create-block.sh`,
`skills/setup-devcontainer/templates/codex/post-create-block.sh`,
`skills/setup-devcontainer/templates/antigravity/post-create-block.sh`,
`skills/setup-devcontainer/templates/copilot/post-create-block.sh`,
`skills/setup-devcontainer/templates/install-cli-block.sh`, `skills/setup-devcontainer/SKILL.md`,
`skills/setup-devcontainer/templates/README.baseline.md`.

**Commands run live today (2026-09-10), not paraphrased from training data or a prior research note:**
- `curl -fsSL https://claude.ai/install.sh` / `curl -fsSI https://claude.ai/install.sh` (260-line script + headers, confirms 302 → `downloads.claude.ai/claude-code-releases/bootstrap.sh`)
- `curl -fsSL https://chatgpt.com/codex/install.sh` / `curl -fsSI ...` (1209-line script + headers, confirms 302 → `releases.openai.com/codex/install.sh`)
- `curl -fsSL https://antigravity.google/cli/install.sh` / `curl -fsSI ...` (239-line script + headers, confirms 200 direct from a Cloud Run app, `etag`/`max-age=600`)
- `curl -fsSIL https://gh.io/copilot-install` (confirms 301 → `raw.githubusercontent.com/github/copilot-cli/refs/heads/main/install.sh`, 198 lines)
- `curl -fsSI https://raw.githubusercontent.com/github/copilot-cli/v1.0.83/install.sh` + `diff` against the `main` fetch (confirms the tag freezes genuinely different, older content)
- `curl -fsSL https://api.github.com/repos/openai/codex` and `curl -fsSIL https://raw.githubusercontent.com/openai/codex/main/install.sh` (confirms the repo exists but doesn't track `install.sh`, 404)
- `curl -fsSL "https://api.github.com/repos/github/copilot-cli/commits?path=install.sh&per_page=1"` (confirms latest commit touching `install.sh` is unsigned: `verification.verified: false, reason: "unsigned"`)
- `curl -fsSL "https://api.github.com/repos/github/copilot-cli/releases/tags/v1.0.83"` and `curl -fsSL ".../releases/download/v1.0.83/SHA256SUMS.txt"` (confirms `install.sh` is not among the release's 19 checksummed assets)
- `curl -fsSL "https://registry.npmjs.org/@anthropic-ai/claude-code"`, `.../@openai/codex`, `.../@github/copilot` (npm registry metadata: `dist.signatures`, `dist.integrity`; Codex additionally carries `attestations.provenance` with `predicateType: https://slsa.dev/provenance/v1`)
- `curl -fsSL "https://registry.npmjs.org/-/v1/search?text=antigravity%20cli"` (confirms no official Google/Antigravity npm package exists — all ~200 results are unrelated third-party tools)

**Web sources fetched/read directly today:**
- https://code.claude.com/docs/en/setup — "Advanced setup" page fetched and parsed directly (HTML stripped and searched): confirms the version argument to `install.sh` selects the target binary, not a different script URL; confirms "Binary integrity and code signing" section (table of contents: "Verify the manifest signature," "Platform code signatures") is scoped to the binary/manifest only, never mentions hashing/signing `install.sh` itself; confirms "Install with npm" is a documented first-class alternate method.
- https://antigravity.google/docs/cli/getting-started and https://antigravity.google/docs/cli/install/ — fetched and grepped live for `brew install`/`npm install`/`apt install`/`apt-get install`/`winget install`: zero matches on either page.

**Not found / explicitly not fabricated:**
- No vendor of the four publishes a checksum, hash file, or GPG/cosign signature for the installer
  *script itself* (as opposed to the binary it downloads), as of today.
- No Antigravity npm package, Homebrew formula, or apt/deb repo exists from Google, as of today.
- No versioned/content-addressed URL exists for Claude Code's, Codex's, or Antigravity's install
  script — all three always resolve the same mutable "latest" script regardless of any
  version-target argument passed to it.
