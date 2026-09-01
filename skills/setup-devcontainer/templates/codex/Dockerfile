# Codex Tool Container — extends the shared base image. The Codex CLI itself
# installs at container-create time in post-create.sh (idempotent, checked by
# binary path), matching the existing pattern. The SYS_ADMIN/seccomp grants
# Codex's Bubblewrap sandbox needs live on this tool's own devcontainer.json
# and Compose service — never on the shared base or any other tool.
FROM {{BASE_IMAGE_TAG}}
