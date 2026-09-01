
# Fix ownership on the .copilot config volume mount (Docker creates it
# root-owned on first mount, since nothing in the base image pre-creates it).
sudo chown -R vscode:vscode "$HOME/.copilot"

# Install GitHub Copilot CLI via the official install script. Checked by
# binary path, not `command -v` — this non-login script's PATH doesn't
# include ~/.local/bin, so a PATH-based check would miss an already-installed
# binary and re-run the installer on every rebuild. A failure here is a
# warning, not a postCreateCommand-aborting error, matching the Codex/
# Antigravity pattern — Copilot is optional tooling.
#
# Auth: the installed `copilot` CLI picks up this container's GH_TOKEN
# automatically (falling back to OAuth/`gh auth token` if unset), so no
# separate login step is needed here.
if [ ! -x "$HOME/.local/bin/copilot" ]; then
  # Chained with `&&`, not sequential statements inside the subshell: a
  # subshell that is itself the left side of `||` has bash's errexit
  # suppressed for everything inside it, so a failing `curl`/`bash` would
  # otherwise be silently ignored and the subshell would still exit 0 from
  # the final `rm -f` (which always succeeds) — meaning the warning below
  # would never fire even though the install actually failed. The `&&`
  # chain's own exit status correctly reflects the first failure.
  tmpscript=$(mktemp)
  (
    curl -fsSL https://gh.io/copilot-install -o "$tmpscript" &&
    bash "$tmpscript" </dev/null
  ) || echo "Warning: Copilot CLI install failed, continuing without it" >&2
  rm -f "$tmpscript"
fi
