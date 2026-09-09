# Findings: re-verification of vendor CLI install pinning/checksum/signature options (2026-09-09)

Primary-source re-verification feeding the downstream decision ticket
[ken-guru/skills#214](https://github.com/ken-guru/skills/issues/214), triggered by the Socket
finding on `skills/setup-devcontainer/templates/copilot/post-create-block.sh` flagged in the
2026-09-08 skills.sh audit referenced by
[ken-guru/skills#210](https://github.com/ken-guru/skills/issues/210).

Question: as of **today, 2026-09-09**, does any of the four vendors whose CLIs this repo installs
via `curl -fsSL <url> | bash`/`sh` (Claude Code, Codex, Antigravity, GitHub Copilot) now document a
checksummed, signed, or version-pinned install path that did **not** exist when
[ken-guru/skills#147](https://github.com/ken-guru/skills/issues/147) last surveyed this on
2026-09-03? All four vendor docs pages and all four install scripts were fetched live today, not
recalled from training data — see the source index at the bottom for exact URLs and commands.

**Repo files read:** `skills/setup-devcontainer/templates/claude-code/post-create-block.sh`,
`skills/setup-devcontainer/templates/codex/post-create-block.sh`,
`skills/setup-devcontainer/templates/antigravity/post-create-block.sh`,
`skills/setup-devcontainer/templates/copilot/post-create-block.sh`,
`skills/setup-devcontainer/templates/copilot/compose-fragment.yml`,
`skills/setup-devcontainer/templates/install-cli-block.sh` (all confirm the current, unpinned,
no-argument `curl | shell_bin` invocation described in the research prompt, unchanged from what's
described there), and `research/copilot-cli-install.md` (read via
`git show origin/research/copilot-cli-install:research/copilot-cli-install.md` — that branch was
never merged to `main`, so the file isn't present in this worktree; read only to match this repo's
existing research-note format/convention, not re-cited as a new source below).

---

## Verdict summary

| Vendor | Verdict | What's new since 2026-09-03 |
|---|---|---|
| **Claude Code** | **Lever exists now — materially new** | `curl -fsSL https://claude.ai/install.sh \| bash -s <version\|stable\|latest>` pins an exact version or channel (documented). Separately, GPG-signed apt/dnf/apk repos and a documented `manifest.json` + detached `manifest.json.sig` GPG-signature verification procedure are now on the docs ("Binary integrity and code signing", published for releases ≥2.1.89). The unconditioned `install.sh \| bash` invocation this repo actually uses also does its own unconditional SHA256 checksum check against a manifest as an undocumented implementation detail. |
| **Codex CLI** | **Lever exists in the script — but still undocumented by OpenAI** | The install script (fetched live) accepts `CODEX_RELEASE=<version>` env var or a `--release VERSION` flag to pin an exact release, and does SHA256 digest verification of the downloaded archive against digests sourced from GitHub release metadata, before installing. None of this appears on OpenAI's own docs page (`learn.chatgpt.com/docs/codex/cli`, redirected from `developers.openai.com/codex/cli`) — it's only visible by reading the script's own `--help` text and body. No GPG/cosign signature anywhere. |
| **Antigravity** | **Still doesn't — no change** | Confirmed no version-pin env var or flag exists in the live install script (only `-d/--dir` for install location and `-h/--help`). The already-known internal SHA512-checksum-against-a-signed... actually **unsigned** JSON manifest behavior is unchanged and still entirely undocumented on any Antigravity docs page found (`getting-started`, `install/`) or the `google-antigravity/antigravity-cli` GitHub README. No GPG/cosign. |
| **GitHub Copilot CLI** | **Unchanged — still doesn't offer anything new** | The documented `VERSION` env var (pin an exact release, e.g. `VERSION="v0.0.369"`) and SHA256 checksum verification against a `SHA256SUMS.txt` release asset are confirmed still accurate, byte-for-byte, against the live install script and live docs page. The latest GitHub release (`v1.0.83`, 2026-09-04, confirmed via the GitHub Releases API) ships only `SHA256SUMS.txt` among its 22 assets — no `.sig`/`.asc`/provenance file has been added. No GPG/cosign. |

---

## 1. Claude Code

Fetched live today: `https://code.claude.com/docs/en/quickstart`, `https://code.claude.com/docs/en/setup`,
and the actual installer at `https://claude.ai/install.sh` (260 lines, read in full).

**The install script itself (the one this repo pipes into `bash` with zero arguments) now does two
things that weren't part of the picture on 2026-09-03:**

1. **It takes an optional positional version/channel argument**, validated by the script itself:
   ```bash
   TARGET="$1"  # Optional target parameter
   if [[ -n "$TARGET" ]] && [[ ! "$TARGET" =~ ^(stable|latest|[0-9]+\.[0-9]+\.[0-9]+(-[^[:space:]]+)?)$ ]]; then
       echo "Usage: $0 [stable|latest|VERSION]" >&2
       exit 1
   fi
   ```
   That value is later passed through to the downloaded `claude` binary's own `install` subcommand
   (`"$binary_path" install ${TARGET:+"$TARGET"}`). This is documented on the "Advanced setup" page
   under "Install a specific version," with the exact invocation shape:
   ```bash
   curl -fsSL https://claude.ai/install.sh | bash -s stable
   curl -fsSL https://claude.ai/install.sh | bash -s 2.1.89
   ```
   (`bash -s <arg>` is required to pass an argument through a piped script — the plain
   `curl | bash` this repo's `install-cli-block.sh` skeleton uses cannot pass one without a change
   to that skeleton.) The doc also states: "The channel you choose at install time becomes your
   default for auto-updates," and separately documents a `minimumVersion` settings.json key that
   acts as a floor constraining background auto-updates and `claude update` (not install-time, but a
   post-install pin/anti-downgrade mechanism).

2. **The plain, argument-free invocation this repo actually uses already does its own unconditional
   SHA256 checksum verification**, independent of the `TARGET` argument: it fetches
   `manifest.json`/`manifest.zst.json` from `downloads.claude.ai`, extracts a per-platform SHA256
   checksum (via `jq` if present, else a bundled bash-regex fallback parser), downloads the binary,
   and hard-fails (`Checksum verification failed`) if the computed `sha256sum`/`shasum -a 256` of the
   downloaded binary doesn't match. This check happens on every install run of `install.sh`, pinned
   version or not — it wasn't something this repo's current invocation opted into, it's baked into
   the script unconditionally.

**Separately, and more consequential for a "signed" claim**, the "Advanced setup" page has a new
"Binary integrity and code signing" section not present in the prior research's understanding of
Claude Code:
- "Each release publishes a `manifest.json` containing SHA256 checksums for every platform binary.
  The manifest is signed with an Anthropic GPG key, so verifying the signature on the manifest
  transitively verifies every binary it lists." A full walkthrough is documented: import the key
  from `https://downloads.claude.ai/keys/claude-code.asc`, confirm the fingerprint
  `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`, download `manifest.json` +
  `manifest.json.sig` for a specific `VERSION`, and run `gpg --verify manifest.json.sig manifest.json`.
  ("Manifest signatures are available for releases from `2.1.89` onward.")
- **GPG-signed apt/dnf/apk repositories** are documented as a first-class install path: "Claude Code
  publishes signed apt, dnf, and apk repositories... All repositories are signed with the
  [Claude Code release signing key]," with per-distro commands that import
  `https://downloads.claude.ai/keys/claude-code.asc` (apt/dnf) or
  `https://downloads.claude.ai/keys/claude-code.rsa.pub` (apk, with a documented SHA256 of the key
  itself: `395759c1f7449ef4cdef305a42e820f3c766d6090d142634ebdb049f113168b6`), and the same
  `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE` fingerprint to confirm before trusting.
- Platform-native code signing is also documented: macOS binaries signed by "Anthropic PBC" and
  notarized by Apple (`codesign --verify`), Windows binaries signed by "Anthropic, PBC"
  (`Get-AuthenticodeSignature`).

None of this is used by this repo's current `claude-code/post-create-block.sh`
(`install_cli "Claude Code" "$HOME/.local/bin/claude" "https://claude.ai/install.sh" bash` — no
`-s <version>` argument, no apt/dnf/apk, no manifest-signature verification step), but the lever
now unambiguously exists and is documented, where issue #147 found none.

## 2. Codex CLI

Fetched live today: `https://developers.openai.com/codex/cli` (308-redirects to
`https://learn.chatgpt.com/docs/codex/cli`), and the actual installer at
`https://chatgpt.com/codex/install.sh` (1209 lines, read in full via grep + targeted excerpts).

**The public docs page documents no checksum, signature, or pin mechanism** — it shows only the
plain `curl -fsSL https://chatgpt.com/codex/install.sh | sh` command plus npm/Homebrew/Windows
alternatives, with no mention of verification or version selection.

**The install script itself, however, has real pin and checksum machinery**, visible only by
reading the script (confirmed via its own `--help` output, embedded in the script):
```
Usage: install.sh [--release VERSION]

Environment:
  CODEX_RELEASE          Version to install; overridden by --release.
  CODEX_NON_INTERACTIVE  Set to 1, true, or yes to skip prompts.
  CODEX_INSTALLER_USE_RELEASES_OPENAI_COM
                         Set to 0, false, or no to use GitHub Releases.
```
- `RELEASE="${CODEX_RELEASE:-latest}"`, validated against
  `^[0-9]+\.[0-9]+\.[0-9]+(-alpha(\.[0-9]+){0,2}|-beta(\.[0-9]+)?)?$` (or the literal `latest`) — a
  real, working version-pin mechanism, just not documented on `learn.chatgpt.com`.
- The script computes an `expected_digest` for the download (`release_asset_digest`, sourced from
  GitHub release metadata via the GitHub Releases API, or — for "package" layout releases — a
  `codex-package_SHA256SUMS`-style manifest fetched via `package_archive_digest`) and calls
  `verify_archive_digest` (`sha256sum`/`shasum -a 256`/`openssl dgst -sha256` fallback chain) before
  `download_file_with_fallback` will accept a downloaded archive as good; a mismatch prints
  "Downloaded Codex archive checksum did not match expected digest" and fails the install.
- No `gpg`, `cosign`, `pgp`, `signature`, or `signed` string appears anywhere in the 1209-line
  script (checked with a direct grep) — this is checksum-only, and the checksum's root of trust is
  OpenAI's own GitHub release metadata / `releases.openai.com`, not an independent signature.

So: a real lever exists in the artifact this repo actually pipes into `sh`
(`CODEX_NON_INTERACTIVE=1 CODEX_RELEASE=<version> curl -fsSL ... | sh` would pin a version today),
but OpenAI has not published or documented it anywhere a user/auditor would find without reading the
script source — it remains undocumented, in contrast to Claude Code's and Copilot's publicly
documented `VERSION`-style knobs.

## 3. Antigravity

Fetched live today: `https://antigravity.google/docs/cli/getting-started`,
`https://antigravity.google/docs/cli/install/`, `https://github.com/google-antigravity/antigravity-cli`
(README), and the actual installer at `https://antigravity.google/cli/install.sh` (239 lines, read
in full).

**No new pin/checksum/signature mechanism found; nothing has changed since the prior research.**
- The install script's only flags are `-d`/`--dir <path>` (custom install directory) and
  `-h`/`--help` — confirmed by reading the full argument-parsing block directly; there is no
  `VERSION`/`--release`-style flag or env var anywhere in the script (grepped for `skip`, `VERSION`,
  `version` — the only hits are the manifest's own `version` field, used purely for the
  "✓ Latest available version: $version" status line, not as an installer input).
- The already-known internal checksum behavior is unchanged: the script fetches a per-platform JSON
  manifest from `https://antigravity-cli-auto-updater-<project>.run.app/manifests/<platform>.json`,
  extracts `sha512` via a hand-rolled `sed`-based JSON parser (not `jq`), downloads the payload, computes
  `sha512sum`/`shasum -a 512`, and hard-fails ("Security Halt: The downloaded payload checksum does
  not match the manifest... Installation aborted") on mismatch. This is genuine checksum
  verification, but the manifest itself is fetched over plain HTTPS from Google's own endpoint with
  no separate signature over the manifest — i.e. it verifies against itself, the same
  already-known internal-only behavior, not a new independently-signed chain of trust.
- Neither `antigravity.google/docs/cli/getting-started`, `antigravity.google/docs/cli/install/`, nor
  the `google-antigravity/antigravity-cli` GitHub README documents this checksum behavior as a
  user-facing feature or offers a version-pin path — confirmed by three separate live fetches today,
  all returning "no checksum/signature/pin mechanism documented."
- No `gpg`, `cosign`, or signature-related string appears anywhere in the script.
- One caution for the record: a `WebSearch` pass surfaced third-party (non-primary) claims that the
  installer supports `--skip-aliases`/`--skip-path` flags. Those flags do **not** appear anywhere in
  the actual script fetched live today from `antigravity.google/cli/install.sh` — only `-d/--dir` and
  `-h/--help` do. Treating the directly-fetched script as authoritative over a search-engine summary,
  that claim is not corroborated and is not counted as a materially new lever here.

## 4. GitHub Copilot CLI

Fetched live today: `https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli`,
the actual installer at `https://gh.io/copilot-install` (read in full, unchanged in shape from the
2026-09-01 research), and `https://api.github.com/repos/github/copilot-cli/releases/latest` (GitHub
Releases API, live).

**Confirmed accurate and unchanged, byte-for-byte, from the 2026-09-01 research in
`research/copilot-cli-install.md`:**
- The docs page documents the `VERSION` environment variable exactly as before: "To install a
  specific version, set the `VERSION` environment variable. It defaults to the latest version," with
  the example `curl -fsSL https://gh.io/copilot-install | VERSION="v0.0.369" PREFIX="$HOME/custom" bash`.
- The install script itself (re-fetched today) contains the identical logic: `VERSION=latest`/unset
  resolves via `.../releases/latest/download/...`; `VERSION=prerelease` resolves the newest tag via
  `git ls-remote --tags`; any other value is treated as a release tag (`v`-prefixed if needed).
- The script downloads `SHA256SUMS.txt` from the same release and, when available, validates with
  `sha256sum -c --ignore-missing`/`shasum -a 256 -c --ignore-missing` before extracting — hard-failing
  ("Error: Checksum validation failed.") on mismatch, exactly as documented in the prior research.
- **No GPG or cosign/sigstore verification is mentioned anywhere** on the install docs page.
- Checked live via the GitHub Releases API today: the current latest release is `v1.0.83`
  (released 2026-09-04 — three days after the prior research, one release ahead of the
  `1.0.82`/`v1.0.82` release that research captured). Its 22 release assets are exclusively per-platform
  archives (`copilot-{darwin,linux,linuxmusl}-{x64,arm64}.tar.gz`, `copilot-{arm64,x64}.msi`,
  `copilot-win32-{x64,arm64}.zip`, and the various `github-copilot-1.0.83-*.tgz` npm-adjacent
  bundles) plus a single `SHA256SUMS.txt` — no `.sig`, `.asc`, `.pem`, or SLSA/provenance file was
  added in this newer release. All five install methods (script, npm, Homebrew, WinGet, GitHub
  Releases) are unchanged from the prior research's list.

Nothing material has changed for Copilot since 2026-09-01: the `VERSION` pin and `SHA256SUMS.txt`
checksum path are exactly as previously documented, and no GPG/cosign signing has been added.

---

## Answering the Socket sub-question directly

**Question:** Does Socket's current finding on `templates/copilot/post-create-block.sh` (flagged in
the 2026-09-08 skills.sh audit referenced by issue #210) reflect that Copilot's default install path
is still unpinned latest, or does it look like Socket isn't recognizing an opt-in pin?

**Answer: Socket is correct, and there is no opt-in pin for it to fail to recognize.** Per the
background established for this research and confirmed by directly reading
`skills/setup-devcontainer/templates/copilot/post-create-block.sh` and
`skills/setup-devcontainer/templates/copilot/compose-fragment.yml` in this worktree today: a
`COPILOT_CLI_VERSION` pinning feature (setup-wizard question, env var, `post-start.sh` staleness
check) built on 2026-09-03 in PR #158 using Copilot's own documented `VERSION` install-script env var
was **fully reverted five days later, on 2026-09-04, in commit `2e43bcd`** ("fix(setup-devcontainer):
stop Copilot's crash-on-startup and silence npm's update notice"), because pinning interacted badly
with Copilot's background self-update (`Error auto updating: TypeError: Invalid Version: latest`).
As of today, `templates/copilot/post-create-block.sh` calls
`install_cli "Copilot" "$HOME/.local/bin/copilot" "https://gh.io/copilot-install" bash` — the shared
`install_cli` skeleton in `templates/install-cli-block.sh` (`curl -fsSL "$url" | env "$@" "$shell_bin"`)
is invoked with **no `VERSION=...` argument at all**, and the block's own comment states this
explicitly: "Always installs whatever's current at build time (VERSION left unset, matching the
other three tools — no pinning knob, no staleness-check machinery)." `compose-fragment.yml` only sets
`COPILOT_AUTO_UPDATE=false` to stop the installed binary's own background self-update from crashing
on startup — it does not reintroduce any install-time version pin.

So there is currently **no live pin option anywhere in this repo's codebase** for Copilot — not in
the post-create block, not in the compose fragment, not in any setup-wizard question — for Socket (or
any other static scanner) to fail to recognize. The file genuinely, unconditionally installs
whatever `gh.io/copilot-install` resolves as `latest` at container-build time, identically in shape
to the other three tools' installers (`claude-code`, `codex`, `antigravity`), none of which have a
pin knob wired up in this repo either (per §1–§3 above, Claude Code's and Codex's *upstream
installers* now support version pins, but this repo's own blocks don't pass those pin arguments/env
vars through). Socket flagging `templates/copilot/post-create-block.sh` as an unpinned/unverified
`curl | bash` install is accurate and expected, not a false positive or a missed-opt-in — it reflects
the genuinely unpinned default-and-only install path this repo currently uses for Copilot, on par
with the other three.

---

## Source file index

**Repo files read (this worktree, `/workspace`, current `main` at HEAD `6262822` /
merge of `8f1e7fc`):**
- `skills/setup-devcontainer/templates/claude-code/post-create-block.sh`
- `skills/setup-devcontainer/templates/codex/post-create-block.sh`
- `skills/setup-devcontainer/templates/antigravity/post-create-block.sh`
- `skills/setup-devcontainer/templates/copilot/post-create-block.sh`
- `skills/setup-devcontainer/templates/copilot/compose-fragment.yml`
- `skills/setup-devcontainer/templates/install-cli-block.sh`
- `research/copilot-cli-install.md`, read via
  `git show origin/research/copilot-cli-install:research/copilot-cli-install.md` (the file lives
  only on the unmerged `origin/research/copilot-cli-install` branch, not on `main`/this worktree —
  read solely to match this repo's existing research-note format, not treated as newly re-verified
  here beyond what §4 above re-confirms live)

**Commands run directly against live services today (2026-09-09), not web-search paraphrase:**
- `curl -fsSL https://claude.ai/install.sh` — fetched and read the full 260-line native installer
- `curl -fsSL https://chatgpt.com/codex/install.sh` — fetched and read the full 1209-line installer
  (via targeted `grep`/`sed` excerpts covering the whole file)
- `curl -fsSL https://antigravity.google/cli/install.sh` — fetched and read the full 239-line
  installer
- `curl -fsSL https://gh.io/copilot-install` — re-fetched and read the full installer, confirmed
  unchanged from the 2026-09-01 research
- `curl -fsSL https://api.github.com/repos/github/copilot-cli/releases/latest` — GitHub Releases
  API, confirmed current latest tag `v1.0.83` (2026-09-04) and its 22 asset filenames

**Web sources fetched/read directly today:**
- https://code.claude.com/docs/en/quickstart — native/Homebrew/WinGet install tabs, no pin/checksum
  mentioned here
- https://code.claude.com/docs/en/setup — "Advanced setup": release channels, `minimumVersion`,
  "Install a specific version" (`bash -s stable`/`bash -s 2.1.89`), signed apt/dnf/apk repos with
  fingerprint `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE`, "Binary integrity and code
  signing" (GPG-signed `manifest.json.sig`, macOS `codesign`, Windows Authenticode)
- https://developers.openai.com/codex/cli — 308-redirects to the URL below
- https://learn.chatgpt.com/docs/codex/cli — plain curl/npm/Homebrew/Windows install commands only;
  no checksum/signature/pin documented
- https://antigravity.google/docs/cli/getting-started — plain curl/PowerShell install commands only;
  no checksum/signature/pin documented
- https://antigravity.google/docs/cli/install/ — "Installation & Auth" page; only `--skip-aliases`/
  `--skip-path` mentioned per one WebFetch summary (not corroborated in the live script — see §3
  caution note), no checksum/signature/pin documented
- https://github.com/google-antigravity/antigravity-cli — README; plain install commands only
- https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli —
  `VERSION`/`PREFIX` env vars confirmed unchanged; five install methods unchanged; no GPG/cosign
  mentioned
- https://github.com/github/copilot-cli/releases/latest — confirmed tag `v1.0.83`, asset list via
  the API call above (page itself failed to render assets in the WebFetch summary; API call is the
  authoritative source used)

**Not found / explicitly not fabricated:**
- No GPG, cosign, or sigstore/SLSA-provenance verification is documented or present in the Codex,
  Antigravity, or Copilot install scripts or docs pages, as of today.
- No version-pin flag or env var exists in the Antigravity install script, as of today.
- No evidence that this repo's own `templates/copilot/post-create-block.sh`,
  `templates/claude-code/post-create-block.sh`, `templates/codex/post-create-block.sh`, or
  `templates/antigravity/post-create-block.sh` currently pass any pin/version argument through to
  their respective installers — all four remain plain, unpinned `curl | shell_bin` invocations via
  the shared `install_cli` skeleton, regardless of what the upstream installers themselves now
  support.
