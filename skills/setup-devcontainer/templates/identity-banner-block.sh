
# Prints which Tool Container this shell belongs to, at the top of every new
# terminal — cheap insurance against mistaking one CLI's container for
# another's. This matters even beyond user error: VS Code's own built-in
# terminal.integrated.initialHint feature shows a client-side "Type copilot
# to use Copilot CLI" suggestion based on local Copilot/Chat entitlement
# state, not on what's actually installed in the container it's attached to
# — so it can appear inside a non-Copilot Tool Container and point at the
# wrong CLI. That specific hint is suppressed via
# customizations.vscode.settings in this tool's devcontainer.json where
# applicable; this banner is the general-purpose backstop for any other,
# unrelated source of the same confusion.
if ! grep -q "devcontainer-identity-banner" ~/.bashrc 2>/dev/null; then
cat >> ~/.bashrc << 'EOF'
# devcontainer-identity-banner
if [[ $- == *i* ]]; then
  echo "── {{TOOL_DISPLAY_NAME}} Tool Container ──"
fi
EOF
fi
