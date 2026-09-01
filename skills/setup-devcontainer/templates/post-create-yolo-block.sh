
# Add YOLO alias for fast development — classifier-based auto permission mode,
# isolated worktree, and remote control. Opt-in: only present because this was
# accepted during setup. Do not swap in --dangerously-skip-permissions: it
# triggers Claude Code's own bwrap sandbox, whose mount-namespace view of the
# repo conflicts with git's worktree identity check and breaks worktree
# creation 100% of the time.
cat >> ~/.bashrc << 'EOF'
alias claude-yolo="claude --permission-mode auto --worktree --remote-control"
EOF
