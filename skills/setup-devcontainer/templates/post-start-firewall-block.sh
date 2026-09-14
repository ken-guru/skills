
# --- Network egress firewall ---
# Opt-in network egress firewall (ADR-0005). Runs on every container start
# (not just create/rebuild), matching init-firewall.sh's own policy-reset-
# before-flush design: a script that died mid-run on a previous start can't
# permanently deadlock a later one. The refresh loop keeps CDN-backed
# allowlisted hosts from going stale mid-session (see refresh-allowlist.sh).
sudo /workspace/.devcontainer/init-firewall.sh
sudo bash -c 'bash /workspace/.devcontainer/refresh-allowlist.sh &'
