
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
#
# Version: the installer already supports a VERSION env var to pin an exact
# release (falling back to latest when unset) — COPILOT_CLI_VERSION comes
# from .env, defaulting to "latest", which is translated to an unset VERSION
# so the installer's own default behavior applies unchanged. VERSION has to
# be set on the `bash` side of the pipe, not `curl`'s — a leading `VAR=val`
# prefix only scopes to the command it directly precedes, and it's the
# piped-into `bash` that actually reads VERSION, not `curl`.
if [ ! -x "$HOME/.local/bin/copilot" ]; then
  if [ "${COPILOT_CLI_VERSION:-latest}" = "latest" ]; then
    curl -fsSL https://gh.io/copilot-install | bash
  else
    curl -fsSL https://gh.io/copilot-install | VERSION="${COPILOT_CLI_VERSION}" bash
  fi || echo "Warning: Copilot CLI install failed, continuing without it" >&2
fi
