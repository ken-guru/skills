# Connecting a Local Checkout to a real GitHub repo

For a repo generated as Local Checkout (step 1) that now has a real GitHub repository to push
to. This needs **no skill-level regeneration** — no rerunning this skill, no `devcontainer.json`
changes, no `onCreateCommand` re-trigger. `onCreateCommand`'s clone-checkout script is already a
permanent no-op once `/workspace/.git` exists (whether that came from `git init` or a real
clone), and every Tool Container's `postCreateCommand` already configures the
`gh auth setup-git` credential helper unconditionally, regardless of Local Checkout — so HTTPS
push authentication is already wired up as soon as `GH_TOKEN` is actually loaded into the
container.

Tell the user the plain-git sequence, in order:

1. Create the GitHub repository, outside this skill (github.com or `gh repo create`).
2. If `.devcontainer/.env` doesn't already have a valid `GH_TOKEN` (it wasn't required for Local
   Checkout), add one now. `GH_TOKEN` is loaded via `env_file` at container start, same as
   `DEVCONTAINER_HOST` in the SSH flows above — adding it to `.env` for the first time needs
   **Dev Containers: Rebuild Container** before it actually takes effect, it isn't picked up by
   an already-running container.
3. Inside the Tool Container, if this tool declined `git init` at generation time (a genuinely
   bare workspace, no `.git` at all): `git init` first. Then, whether or not that step was
   needed: `git remote add origin <url>`, then `git push -u origin <branch>`.

That's it — the Tool Container is now connected. If this tool also wants agent-driven `git push`
and signed commits via the SSH layer, that's the separate [Adding SSH to a tool
later](adding-ssh-later.md) flow, run **after** this — not before, since that flow
resolves `{{REPO_SLUG}}` from the now-real `origin` and registers deploy/signing keys against a
repo that has to already exist.

Done when the user has been given the steps above, in order (including the rebuild if `GH_TOKEN`
was just added, and `git init` if this tool never had one), and — if confirmed by the user
afterward — a real `git push` from inside the Tool Container actually succeeds.
