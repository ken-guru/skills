
# Fix ownership on the .copilot config volume mount (Docker creates it
# root-owned on first mount, since nothing in the base image pre-creates it).
sudo chown -R vscode:vscode "$HOME/.copilot"

# Install GitHub Copilot CLI via the official install script, as a plain
# piped one-liner rather than a download-then-run wrapper — this is exactly
# how GitHub's own install docs invoke it. Checked by binary path, not
# `command -v` — this non-login script's PATH doesn't include ~/.local/bin,
# so a PATH-based check would miss an already-installed binary and re-run
# the installer on every rebuild. A failure here is a warning, not a
# postCreateCommand-aborting error, matching the Codex/Antigravity pattern —
# Copilot is optional tooling.
#
# Auth: the installed `copilot` CLI picks up this container's GH_TOKEN
# automatically (falling back to OAuth/`gh auth token` if unset), so no
# separate login step is needed here.
if [ ! -x "$HOME/.local/bin/copilot" ]; then
  curl -fsSL https://gh.io/copilot-install | bash || echo "Warning: Copilot CLI install failed, continuing without it" >&2
fi
