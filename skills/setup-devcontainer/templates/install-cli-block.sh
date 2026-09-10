# Mechanical install skeleton shared by every Tool Container flavor:
# chown_config_volume fixes the per-tool config volume's ownership (Docker
# creates a fresh named-volume mountpoint root:root regardless of the
# parent directory's ownership, even under /home/vscode) — every tool uses
# this. install_cli runs a curl-piped installer exactly once — only
# Antigravity's post-create-block.sh still calls it; install_npm_cli runs
# an `npm install -g` instead, used by Claude Code, Codex, and Copilot (see
# each tool's own post-create-block.sh) — Claude Code was the pilot for
# #234, extended to the other two once it held up, at which point the
# repeated latest-vs-pinned shape across all three earned this helper
# (initially inlined per-file, deliberately not factored out until a third
# caller proved the shape wasn't Claude-Code-specific). Antigravity has no
# npm/Homebrew/apt package to swap to (confirmed by #232's research), so it
# stays on install_cli.
#
# install_cli checks by binary path, not `command -v` — this non-login
# script's PATH doesn't include ~/.local/bin, so a PATH-based check would
# miss an already-installed binary and re-run the network installer on every
# rebuild. A failed install is a warning, not a postCreateCommand-aborting
# error: every CLI installed this way is optional tooling and shouldn't
# block the rest of setup. The `env "$@"` forwarding exists for extra
# `VAR=val` arguments a future curl|bash installer might need (Codex's
# now-removed CODEX_NON_INTERACTIVE=1 was the original case) — passed via
# `env`, not a `</dev/null` redirect or subshell wrapper, so they don't
# disturb the piped command's own stdin.
#
# install_npm_cli takes the same failed-install-is-a-warning posture as
# install_cli, but doesn't need install_cli's binary-path existence check —
# `npm install -g` is idempotent on its own (a no-op if already at the
# requested version). `version` is the caller's already-`:-latest`-defaulted
# `_VERSION` env var (e.g. `CLAUDE_CODE_VERSION`): "latest" installs npm's
# own `latest` dist-tag; anything else pins via npm's `@<version>` syntax.
# Extra args (Claude Code's `--allow-scripts=@anthropic-ai/claude-code` —
# npm's allowScripts gate blocks that package's postinstall, which
# downloads its actual native binary, unless explicitly allowed) are
# forwarded positionally to `npm install -g`, before the package name.
#
# Antigravity's installer already verifies a checksum or signed digest of
# what it downloads before installing — unconditionally, not only when a
# version happens to be pinned: SHA512 vs. a signed manifest, halting the
# install on mismatch. None of this is visible from this shared
# `curl | shell` shape alone — see README.baseline.md's "CLI installer
# notes" section for the reader-facing version of this fact, kept here too
# since that's what a maintainer editing this file actually needs to know
# before assuming the pattern below is unverified. Claude Code, Codex, and
# Copilot no longer go through this shared curl|bash skeleton at all (see
# above) — their integrity model is npm's registry signature (plus, for
# Codex, SLSA provenance) instead, documented in each tool's own
# post-create-block.sh.
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

install_npm_cli() {
  local label="$1" package="$2" version="$3"
  shift 3
  if [ "$version" = "latest" ]; then
    sudo npm install -g "$@" "$package" \
      || echo "Warning: $label CLI install failed, continuing without it" >&2
  else
    sudo npm install -g "$@" "${package}@${version}" \
      || echo "Warning: $label CLI install failed, continuing without it" >&2
  fi
}
