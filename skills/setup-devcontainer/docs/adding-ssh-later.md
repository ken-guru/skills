# Adding SSH later

For a repo that already has a devcontainer (`.devcontainer/devcontainer.json` exists, no SSH
`mounts` entry in it) and now needs agent-driven `git push` / signed commits. `postAttachCommand`
already exists by construction, so this flow only adds the SSH mount and the SSH block in
`post-create.sh` — not the commands themselves:

1. Resolve `{{REPO_SLUG}}`, `{{REPO_NAME}}` as in the main flow's step 1.
2. Replace `.devcontainer/devcontainer.json` with
   [../templates/devcontainer.with-ssh.json](../templates/), substituted (`{{REPO_NAME}}`) — this
   only adds the SSH `mounts` entry (the shared `{{REPO_NAME}}-ssh` volume) relative to the
   existing file, so no other property changes.
3. Append [../templates/post-create-ssh-block.sh](../templates/post-create-ssh-block.sh)
   (substituted, `{{REPO_SLUG}}`/`{{REPO_NAME}}`), then
   [../templates/post-create-warnings-block.sh](../templates/post-create-warnings-block.sh)
   (no placeholders), to the end of the existing `.devcontainer/post-create.sh`.
4. Append [../templates/env.ssh-block.example](../templates/env.ssh-block.example) to
   `.devcontainer/.env.example`, idempotently, and update its `GH_TOKEN` comment as in the main
   flow's step 5 (deploy-key registration is manual by default and needs no extra permission;
   `Administration` is only an optional convenience for auto-registration):

   ```bash
   scripts/patch-if-absent.sh append .devcontainer/.env.example "DEVCONTAINER_HOST=your-hostname-here" templates/env.ssh-block.example
   ```
5. `.devcontainer/.env` itself already exists in this flow (it's required for the devcontainer to
   have worked at all) and is gitignored — don't touch it programmatically, since it holds a live
   `GH_TOKEN`. `initializeCommand` only seeds `.env` from `.env.example` when `.env` doesn't yet
   exist, so appending to `.env.example` alone never reaches the file that's actually loaded. If
   `DEVCONTAINER_HOST` isn't already set in `.env`, run `hostname` on the host yourself and give
   the user the fully resolved line to add, not a command to run themselves:
   ```
   DEVCONTAINER_HOST=<actual output of hostname>
   ```
   Skipping this doesn't fail the build — `post-create-ssh-block.sh` degrades to skipping the SSH
   setup and recording why in `~/.ssh/.ssh-setup-skipped` — but it does mean the SSH layer silently
   never activates (this is the *only* thing that gates it; `GH_TOKEN` is never required), so set
   it before the first rebuild rather than relying on the warning to catch it.
6. Insert [../templates/README.ssh-block.md](../templates/README.ssh-block.md) into
   `.devcontainer/README.md`, positioned before `## Installed CLI Tools` (which stays the file's
   last section regardless of when SSH is added), and delete that file's "SSH deploy key and
   signing key automation — Not set up here" closing section:

   ```bash
   scripts/patch-if-absent.sh insert-before .devcontainer/README.md "## SSH deploy key and signing key" "## Installed CLI Tools" templates/README.ssh-block.md
   scripts/patch-if-absent.sh delete-section .devcontainer/README.md "## SSH deploy key and signing key automation"
   ```
7. Tell the user, in order: add the `DEVCONTAINER_HOST` line from step 5 to `.devcontainer/.env`
   now if it wasn't already there, before rebuilding — not after hitting the error; rebuild the
   container (**Dev Containers: Rebuild Container**); and once attached, follow the combined
   deploy-key/signing-key registration prompt from `post-attach.sh` (the deploy key's half may
   already be handled if `GH_TOKEN` carries this repo's `Administration` permission).

Done when `.devcontainer/devcontainer.json` still parses as valid JSON, has the new SSH `mounts`
entry referencing the shared `{{REPO_NAME}}-ssh` volume (`postAttachCommand` already existed), no
`{{...}}` placeholder remains in any touched file, `## Installed CLI Tools` is still the file's
last section, and the user has actually been told the `DEVCONTAINER_HOST` line to add to their
existing `.env` — not just to `.env.example`.
