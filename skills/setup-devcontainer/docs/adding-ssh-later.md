# Adding SSH to a tool later

For a tool that already has a Tool Container (`.devcontainer/<tool>/devcontainer.json`
exists, no SSH `mounts` entry in it) and now needs agent-driven `git push` / signed commits.
`postAttachCommand` already exists on every tool by construction (Private Checkout's staleness
hint needs it regardless of SSH), so unlike before, this flow only adds the SSH mount — not the
command itself:

1. Resolve `{{REPO_SLUG}}`, `{{REPO_NAME}}` as in the main flow's step 1.
2. Replace `.devcontainer/<tool>/devcontainer.json` with
   [../templates/<tool>/devcontainer.with-ssh.json](../templates/), substituted (`{{REPO_NAME}}`) —
   this only adds the SSH `mounts` entry (this tool's own `{{REPO_NAME}}-<tool>-ssh` volume)
   relative to the existing file, so no other property changes.
3. Append [../templates/post-create-ssh-block.sh](../templates/post-create-ssh-block.sh) (substituted,
   including `{{TOOL_NAME}}`), then
   [../templates/post-create-warnings-block.sh](../templates/post-create-warnings-block.sh)
   (no placeholders), to the end of the existing `.devcontainer/<tool>/post-create.sh`.
4. Append [../templates/env.ssh-block.example](../templates/env.ssh-block.example) to
   `.devcontainer/.env.example`, idempotently (a no-op if already present from another tool's SSH
   setup), and update its `GH_TOKEN` comment as in the main flow's step 6:

   ```bash
   scripts/patch-if-absent.sh append .devcontainer/.env.example "DEVCONTAINER_HOST=your-hostname-here" templates/env.ssh-block.example
   ```
5. `.devcontainer/.env` itself already exists in this flow (it's required for the Tool Container to
   have worked at all) and is gitignored — don't touch it programmatically, since it holds a live
   `GH_TOKEN`. `initializeCommand` only seeds `.env` from `.env.example` when
   `.env` doesn't yet exist, so appending to `.env.example` alone never reaches the file that's
   actually loaded. If `DEVCONTAINER_HOST` isn't already set in `.env` (from another tool's SSH
   setup), run `hostname` on the host yourself and give the user the fully resolved line to add,
   not a command to run themselves:
   ```
   DEVCONTAINER_HOST=<actual output of hostname>
   ```
   Skipping this doesn't fail the build — `post-create-ssh-block.sh` degrades to skipping the SSH
   setup and recording why in `~/.ssh/.ssh-setup-skipped` — but it does mean the SSH layer silently
   never activates, so set it before the first rebuild rather than relying on the warning to catch it.
6. Append [../templates/README.ssh-block.md](../templates/README.ssh-block.md) to
   `.devcontainer/README.md`, idempotently, and delete that file's "SSH deploy key and signing key
   automation — Not set up here" closing section:

   ```bash
   scripts/patch-if-absent.sh append .devcontainer/README.md "## SSH deploy key and signing key" templates/README.ssh-block.md
   scripts/patch-if-absent.sh delete-section .devcontainer/README.md "## SSH deploy key and signing key automation"
   ```
7. Tell the user, in order: add the `DEVCONTAINER_HOST` line from step 5 to
   `.devcontainer/.env` now if it wasn't already there, before rebuilding — not after hitting the
   error; rebuild this tool's Tool Container (**Dev Containers: Rebuild Container**, in that
   tool's window); and once attached, follow the signing-key prompt from `post-attach.sh`.

Done when `.devcontainer/<tool>/devcontainer.json` still parses as valid JSON, has the new SSH
`mounts` entry referencing this tool's own volume (`postAttachCommand` already existed), no
`{{...}}` placeholder remains in any touched file, no other tool's files were modified, and the
user has actually been told the `DEVCONTAINER_HOST` line to add to their existing `.env` — not
just to `.env.example`.
