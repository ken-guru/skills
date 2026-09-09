# Migrating a Tool Container to Private Checkout

For a tool whose `devcontainer.json` predates Private Checkout (step 2's detection: no
`onCreateCommand`) — moving it from the old shared bind-mounted workspace to its own isolated
clone. This changes what persists where, so it's opt-in per tool, never automatic:

1. **Warn before touching anything.** The old bind-mounted workspace *is* this repo's host
   checkout — any uncommitted changes or unpushed local branches made inside that Tool Container
   are sitting on the host, not in any container-managed volume. Private Checkout clones fresh
   from `origin`, so none of that carries over automatically. Tell the user, plainly: commit and
   push everything they want to keep in this tool's Tool Container before rebuilding, or it
   won't be there afterward. Get explicit confirmation before continuing.
2. Resolve `{{REPO_SLUG}}`, `{{REPO_NAME}}` as in the main flow's step 1.
3. Run step 5 (build or reuse the shared base image) exactly as written. `base.Dockerfile` now
   carries the clone-checkout script, so this is a real content change — expect step 5's existing
   content-hash check to detect it and prompt for a version bump the first time any repo migrates
   a tool after upgrading this skill.
4. Detect whether this tool's SSH layer is currently enabled (its `devcontainer.json` has a
   `mounts` entry) — this decides which variant to regenerate with next.
5. Regenerate `.devcontainer/<tool>/devcontainer.json` from
   [../templates/<tool>/devcontainer.json](../templates/) (or
   [../templates/<tool>/devcontainer.with-ssh.json](../templates/) if step 4 found SSH enabled),
   substituted, replacing the file outright.
6. If SSH is enabled for this tool: re-derive `.devcontainer/<tool>/post-create.sh`'s SSH block —
   remove everything from the old
   [../templates/post-create-ssh-block.sh](../templates/post-create-ssh-block.sh) content through the
   end of the old [../templates/post-create-warnings-block.sh](../templates/post-create-warnings-block.sh)
   content (the old shared-title, no-`{{TOOL_NAME}}` versions), then re-append both current
   templates (substituted, including `{{TOOL_NAME}}`) in their place. This tool will register a
   *new* per-tool key pair on its first rebuild; the old shared deploy key is auto-removed by the
   new script once that happens (see #172's resolution). The old shared *signing* key has no
   deletion API, so it needs manual removal — steps 8 and 9 below cover exactly when and how to
   tell the user this.
7. Run step 6's "Always" bullets (`docker-compose.yml` rebuild in particular — it already
   regenerates wholesale from the current tool set, so this tool's service picks up its new
   checkout volume, and its SSH volume if applicable, without needing tool-specific handling
   here) and the `.claude/worktrees/` `.gitignore` cleanup bullet, which now actively applies.
8. If SSH was enabled for this tool, check whether it was the *last* SSH-enabled tool in the repo
   still on the old shared-volume model: `grep -l "{{REPO_NAME}}-ssh-config"
   .devcontainer/*/devcontainer.json` (after this tool's own file was just rewritten in step 5, so
   it no longer matches). No remaining match means every SSH-enabled tool has migrated, and the
   old `{{REPO_NAME}}-ssh-config` volume — still holding the old deploy *and* signing key material
   — is safe to remove. Offer to remove it (`docker volume rm {{REPO_NAME}}-ssh-config`) and wait
   for confirmation before running it, same as step 2's leftover-container handling: don't remove
   it without asking. Skip this whole check if `docker` isn't installed or isn't running; note
   that it couldn't be checked rather than failing the migration over it.
9. Tell the user, as a checklist, not one run-on sentence:
   - Confirm (again) everything they need was pushed before this point.
   - Rebuild this tool's Tool Container (**Dev Containers: Rebuild Container**).
   - Once attached, confirm `/workspace` is a fresh clone (`git log -1`, `git status`).
   - If SSH was enabled: register the new signing-key prompt from `post-attach.sh`.
   - **⚠ ACTION REQUIRED, only if step 8 found this was the last SSH-enabled tool to migrate**:
     remove the old shared signing key from GitHub by hand at
     <https://github.com/settings/keys> — nothing else will do this, GitHub exposes no deletion
     API for it (unlike the old deploy key and, now, the old shared volume, both already handled
     automatically). If step 8 found another tool still unmigrated, skip this bullet for now —
     it'll surface again when that tool migrates.

Done when this tool's `devcontainer.json` has `onCreateCommand`, its SSH `mounts` entry (if any)
references its own per-tool volume, `docker-compose.yml` lists its checkout (and SSH, if
applicable) volume, no `{{...}}` placeholder remains in any touched file, no other tool's files
were modified, the old shared SSH volume was offered for removal (and removed, if confirmed) when
this was genuinely the last tool to migrate, and the user has been given the pre-rebuild push
warning and the post-migration signing-key cleanup note (if applicable) — not just told to
rebuild.
