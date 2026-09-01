
# Fix ownership on the .codex config volume mount (Docker creates it
# root-owned on first mount, since nothing in the base image pre-creates it).
sudo chown -R vscode:vscode "$HOME/.codex"

# Install Codex CLI. Checked by binary path, not `command -v` — this
# non-login script's PATH doesn't include ~/.local/bin (the installer only
# adds that to .bashrc, which applies to interactive shells only), so a
# PATH-based check would miss an already-installed binary and re-run the
# network installer on every rebuild. The upstream installer can also prompt
# interactively and hit a flaky self-check network call, so stdin is closed
# and a failure here is a warning, not a postCreateCommand-aborting error —
# Codex is optional tooling and shouldn't block the rest of setup.
if [ ! -x "$HOME/.local/bin/codex" ]; then
  # Chained with `&&`, not sequential statements inside the subshell: a
  # subshell that is itself the left side of `||` has bash's errexit
  # suppressed for everything inside it, so a failing `curl`/`sh` would
  # otherwise be silently ignored and the subshell would still exit 0 from
  # the final `rm -f` (which always succeeds) — meaning the warning below
  # would never fire even though the install actually failed. The `&&`
  # chain's own exit status correctly reflects the first failure.
  tmpscript=$(mktemp)
  (
    curl -fsSL https://chatgpt.com/codex/install.sh -o "$tmpscript" &&
    sh "$tmpscript" </dev/null
  ) || echo "Warning: Codex CLI install failed, continuing without it" >&2
  rm -f "$tmpscript"
fi
