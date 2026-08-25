# Install Antigravity CLI
if ! command -v agy >/dev/null 2>&1; then
  architecture=$(uname -m)
  case "$architecture" in
      x86_64|amd64) platform=linux-amd64 ;;
      arm64|aarch64) platform=linux-arm64 ;;
      *) echo "ERROR: unsupported Antigravity CLI architecture: $architecture" >&2; exit 1 ;;
  esac
  tmpdir=$(mktemp -d)
  curl -fsSL --retry 3 --output "$tmpdir/agy.tar.gz" "https://storage.googleapis.com/antigravity-cli/releases/latest/antigravity-${platform}.tar.gz"
  tar -xzf "$tmpdir/agy.tar.gz" -C "$tmpdir" antigravity
  install -d -m 0755 "$HOME/.local/bin"
  install -m 0755 "$tmpdir/antigravity" "$HOME/.local/bin/agy"
  rm -rf "$tmpdir"
fi
