# --- Copilot yolo-alias ---
# Add YOLO alias placeholder. Opt-in: only present because this was accepted
# during setup. Copilot CLI now has real unattended/auto-approve flags
# (--allow-all/--yolo, --autopilot --max-autopilot-continues <N>), but
# GitHub's own docs explicitly warn against ever aliasing these for every
# session start — so this stays a manual-invocation reminder, not a
# persistent auto-approve alias.
cat >> ~/.bashrc << 'EOF'
alias copilot-yolo="echo 'Copilot CLI now supports --allow-all (--yolo) and --autopilot --max-autopilot-continues <N> for unattended runs. GitHub'\''s own docs warn against aliasing these for every session start, so run them directly when you want them: copilot --allow-all --autopilot --max-autopilot-continues 10. Consider /sandbox enable first.'"
EOF
