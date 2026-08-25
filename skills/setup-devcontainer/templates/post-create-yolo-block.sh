
# Add YOLO alias for fast development — skips permission prompts, runs in an
# isolated worktree, and enables remote control. Opt-in: only present because
# this was accepted during setup.
cat >> ~/.bashrc << 'EOF'
alias claude-yolo="claude --dangerously-skip-permissions --worktree --remote-control"
EOF
