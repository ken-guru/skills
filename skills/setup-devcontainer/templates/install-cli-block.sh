
# Mechanical install skeleton shared by every Tool Container flavor: fix the
# per-tool config volume's ownership (Docker creates a fresh named-volume
# mountpoint root:root regardless of the parent directory's ownership, even
# under /home/vscode), then run a curl-piped installer exactly once. Each
# tool's own post-create-block.sh calls these two functions and keeps only
# the rationale that's genuinely tool-specific (see there for it).
#
# install_cli checks by binary path, not `command -v` — this non-login
# script's PATH doesn't include ~/.local/bin, so a PATH-based check would
# miss an already-installed binary and re-run the network installer on every
# rebuild. A failed install is a warning, not a postCreateCommand-aborting
# error: every CLI installed this way is optional tooling and shouldn't
# block the rest of setup. Extra `VAR=val` arguments (Codex's
# CODEX_NON_INTERACTIVE=1) are passed to the piped shell via `env`, not a
# `</dev/null` redirect or subshell wrapper, so they don't disturb the piped
# command's own stdin — see codex/post-create-block.sh for why that
# distinction matters.
#
# Every one of these four vendor installers already verifies a checksum or
# signed digest of what it downloads before installing — unconditionally,
# not only when a version happens to be pinned: Claude Code (SHA256 vs. a
# GPG-signed manifest), Codex (SHA256 digest vs. GitHub release metadata),
# Antigravity (SHA512 vs. a signed manifest, halting the install on
# mismatch), Copilot (SHA256SUMS.txt, downloaded and checked for whichever
# release resolves, a hard failure on mismatch). None of this is visible
# from this shared `curl | shell` shape alone — see README.baseline.md's
# "CLI installer notes" section for the reader-facing version of this fact,
# kept here too since that's what a maintainer editing this file actually
# needs to know before assuming the pattern below is unverified.
chown_config_volume() {
  sudo chown -R vscode:vscode "$1"
}

install_cli() {
  local label="$1" bin_path="$2" url="$3" shell_bin="$4"
  shift 4
  if [ ! -x "$bin_path" ]; then
    curl -fsSL "$url" | env "$@" "$shell_bin" \
      || echo "Warning: $label CLI install failed, continuing without it" >&2
  fi
}
