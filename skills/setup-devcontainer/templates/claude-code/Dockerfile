# Claude Code Tool Container — extends the shared base image (Node, gh CLI,
# fixed vscode user/UID/GID). The Claude Code CLI itself installs at
# container-create time in post-create.sh, not here, matching the idempotent
# runtime-install pattern already proven for Codex/Antigravity/Copilot rather
# than introducing a fifth, image-build-time install path.
FROM {{BASE_IMAGE_TAG}}
