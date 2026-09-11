# Connecting a Local Checkout to a real GitHub repo

For a repo generated as Local Checkout (step 1) that now has a real GitHub repository to push
to. This needs **no skill-level regeneration** — no rerunning this skill, no `devcontainer.json`
changes. The workspace at `/workspace` is already a live bind-mount of the host's own checkout,
so there's no clone step to re-trigger — and `postCreateCommand` already configures the
`gh auth setup-git` credential helper unconditionally, regardless of Local Checkout — so HTTPS
push authentication is already wired up as soon as `GH_TOKEN` is actually loaded into the
container.

Tell the user the plain-git sequence, in order:

1. Create the GitHub repository, outside this skill (github.com or `gh repo create`).
2. If `.devcontainer/.env` doesn't already have a valid `GH_TOKEN` (it wasn't required for Local
   Checkout), add one now. `GH_TOKEN` is loaded via `bash-env.sh` (set as `BASH_ENV` in
   `devcontainer.json`) plus a `~/.bashrc` line for interactive shells — see `post-create-base.sh`
   — same as `DEVCONTAINER_HOST` in the SSH flow above — adding it to `.env` for the first time
   needs **Dev Containers: Rebuild Container** before it actually takes effect, it isn't picked up
   by an already-running container.
3. Inside the container, if this workspace declined `git init` at generation time (a genuinely
   bare workspace, no `.git` at all): `git init` first. Then, whether or not that step was
   needed: `git remote add origin <url>`, then `git push -u origin <branch>`.

That's it — the devcontainer is now connected. If it also wants agent-driven `git push`
and signed commits via the SSH layer, that's the separate [Adding SSH
later](adding-ssh-later.md) flow, run **after** this — not before, since that flow
resolves `{{REPO_SLUG}}` from the now-real `origin` and registers deploy/signing keys against a
repo that has to already exist.

Done when the user has been given the steps above, in order (including the rebuild if `GH_TOKEN`
was just added, and `git init` if this workspace never had one), and — if confirmed by the user
afterward — a real `git push` from inside the container actually succeeds.
