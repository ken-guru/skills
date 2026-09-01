# Fix ownership on the .codex config volume mount (Docker creates it
# root-owned on first mount, since nothing in the base image pre-creates it).
sudo chown -R vscode:vscode "$HOME/.codex"

# Install Codex CLI. Checked by binary path, not `command -v` — this
# non-login script's PATH doesn't include ~/.local/bin (the installer only
# adds that to .bashrc, which applies to interactive shells only), so a
# PATH-based check would miss an already-installed binary and re-run the
# network installer on every rebuild. CODEX_NON_INTERACTIVE=1 is the
# installer's documented switch for skipping its prompts — do not swap this
# for `sh </dev/null` on the pipeline: closing the sh process's own stdin
# breaks the curl|sh pipe itself (curl gets EPIPE and the install silently
# no-ops), it doesn't just suppress the prompt. A failure here is a warning,
# not a postCreateCommand-aborting error — Codex is optional tooling and
# shouldn't block the rest of setup.
if [ ! -x "$HOME/.local/bin/codex" ]; then
  curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh || echo "Warning: Codex CLI install failed, continuing without it" >&2
fi
