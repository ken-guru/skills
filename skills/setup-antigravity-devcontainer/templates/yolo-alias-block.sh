# --- Antigravity yolo-alias ---
# Add YOLO alias for fast development. Opt-in: only present because this was
# accepted during setup. Do not swap in --dangerously-skip-permissions
# --sandbox: Antigravity auto-approves its own sandbox's internal prompts once
# --dangerously-skip-permissions is present, making --sandbox a no-op —
# confirmed by a filed Google bug
# (antigravity-cli#36). The real safety boundary is a curated
# permissions.allow list in ~/.gemini/antigravity-cli/settings.json,
# starting from git, gh, ls, cat and never rm, curl, raw bash -c, or a
# wildcard — see the reported next steps for setting it up as a manual,
# once-per-machine step.
if ! grep -q "devcontainer-antigravity-yolo-alias" ~/.bashrc 2>/dev/null; then
cat >> ~/.bashrc << 'EOF'
# devcontainer-antigravity-yolo-alias
alias agy-yolo="agy --mode accept-edits"
EOF
fi
