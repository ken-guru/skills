
# Add YOLO alias for fast development. Opt-in: only present because this was
# accepted during setup. Do not swap in
# --dangerously-bypass-approvals-and-sandbox: that's Codex's full-bypass
# equivalent of --dangerously-skip-permissions — no sandbox and no approval
# checkpoint at all. --ask-for-approval on-request gives Codex a real internal
# checkpoint instead: the model itself judges when to escalate to a human,
# rather than never escalating. The cap_add/security_opt grants on this Tool
# Container's Compose service are what let the workspace-write sandbox
# actually create its Bubblewrap namespace.
cat >> ~/.bashrc << 'EOF'
alias codex-yolo="codex --ask-for-approval on-request --sandbox workspace-write -c sandbox_workspace_write.network_access=true"
EOF
