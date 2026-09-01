
# Add YOLO alias placeholder. Opt-in: only present because this was accepted
# during setup. Copilot CLI has no unattended/auto-approve flag of its own —
# this alias just echoes the manual step needed instead of silently doing
# nothing.
cat >> ~/.bashrc << 'EOF'
alias copilot-yolo="echo 'Copilot CLI requires manual sandboxing. Run the regular \`copilot\` command and then type \`/sandbox enable\` in the session.'"
EOF
