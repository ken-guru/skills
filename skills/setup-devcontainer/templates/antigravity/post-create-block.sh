
# Fix ownership on the .antigravity config volume mount (Docker creates it
# root-owned on first mount, since nothing in the base image pre-creates it).
sudo chown -R vscode:vscode "$HOME/.antigravity"

# Install Antigravity CLI. Checked by binary path, not `command -v` — this
# non-login script's PATH doesn't include ~/.local/bin, so a PATH-based check
# would miss an already-installed binary and redownload it on every rebuild.
# Antigravity is optional tooling, so a download/install failure here is a
# warning, not a postCreateCommand-aborting error.
if [ ! -x "$HOME/.local/bin/agy" ]; then
  # Chained with `&&`, not sequential statements inside the subshell: a
  # subshell that is itself the left side of `||` has bash's errexit
  # suppressed for everything inside it, so a failing `curl`/`tar`/`install`
  # would otherwise be silently ignored and the subshell would still exit 0
  # from the final `rm -rf` (which always succeeds) — meaning the warning
  # below would never fire even though the install actually failed. The
  # `&&` chain's own exit status correctly reflects the first failure.
  tmpdir=$(mktemp -d)
  (
    architecture=$(uname -m) &&
    case "$architecture" in
        x86_64|amd64) platform=linux-amd64 ;;
        arm64|aarch64) platform=linux-arm64 ;;
        *) echo "ERROR: unsupported Antigravity CLI architecture: $architecture" >&2; exit 1 ;;
    esac &&
    curl -fsSL --retry 3 --output "$tmpdir/agy.tar.gz" "https://storage.googleapis.com/antigravity-cli/releases/latest/antigravity-${platform}.tar.gz" &&
    tar -xzf "$tmpdir/agy.tar.gz" -C "$tmpdir" antigravity &&
    install -d -m 0755 "$HOME/.local/bin" &&
    install -m 0755 "$tmpdir/antigravity" "$HOME/.local/bin/agy"
  ) || echo "Warning: Antigravity CLI install failed, continuing without it" >&2
  rm -rf "$tmpdir"
fi
