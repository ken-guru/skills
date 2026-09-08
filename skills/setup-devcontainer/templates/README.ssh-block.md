
## SSH deploy key and signing key

- Git push/pull and commit signing use two separate SSH keys, persisted
  across rebuilds in **this Tool Container's own** named volume
  (`{{REPO_NAME}}-<tool>-ssh`) mounted at `~/.ssh` — private to this tool,
  not shared with any other Tool Container. Each SSH-enabled Tool Container
  registers and manages its own key pair.

**Why every tool gets its own key pair.** Once each Tool Container has its
own Private Checkout (its own isolated on-disk clone — see
[CONTEXT.md](../CONTEXT.md)), a shared SSH volume would be the one surface
still connecting them: a compromised or runaway agent in one container could
still read the key material every other container's `git push` and commit
signing depend on. Per-tool keys close that surface and buy *selective
revocation* — distrust one tool's key without touching any other's — at the
cost of the signing key's manual GitHub-UI registration step happening once
per SSH-enabled tool instead of once for the whole repo. See
`docs/adr/0001-per-container-ssh-keys.md` in this skill's own repo for the
full reasoning.

Two separate ED25519 keys exist because GitHub rejects a public key as a
signing key once that same key is already registered as a deploy key. Each
SSH-enabled Tool Container's `post-create.sh` generates `~/.ssh/id_ed25519`
as the deploy key (git transport: push/pull this repo, registered
automatically against `repos/{{REPO_SLUG}}/keys` via the `gh` API) and
`~/.ssh/id_ed25519_signing` as the signing key (commit verification,
registered manually once per tool via the GitHub UI — there's no API-driven
way to do this without granting the token account-level
`write:ssh_signing_key`, which would let it manage every signing key on the
account, not just this project's).

Both keys live in that tool's own `{{REPO_NAME}}-<tool>-ssh` volume, so they
and the `~/.ssh/.signing-key-registered` marker survive that tool's
container rebuilds. Only wiping that specific volume regenerates that tool's
keys and resets its marker — it has no effect on any other tool.

Deploy-key registration is checked by key **content**, not title — if the
volume is wiped and a new key is generated, the stale GitHub entry (same
title, old content) is deleted and replaced. `postAttachCommand` re-verifies
the deploy key on every attach so an accidental deletion on GitHub is caught
immediately instead of failing silently on the next `git push`.

**Migrating from a repo-wide shared key pair.** If this repo was previously
set up before per-tool keys existed, each Tool Container's first rebuild
under the new scheme automatically removes the old repo-wide shared deploy
key once its own per-tool key is registered — no unused, unrevoked deploy
key is left standing. The old shared *signing* key has no equivalent
automatic cleanup (GitHub exposes no deletion API for it); remove it by hand
from <https://github.com/settings/keys> once every tool has registered its
own.

`GH_TOKEN` needs the repo's **Administration (read/write)** permission to
list, register, and delete deploy keys via `gh api repos/.../keys` — this is
in addition to whatever else you use `gh` for (Issues, Pull requests,
Metadata). No account-level token permissions are needed for any of this.

Register the signing key: `postAttachCommand` prints a one-time prompt with a
public key to paste into <https://github.com/settings/ssh> as a **Signing
Key**. Do that, then dismiss the prompt with
`touch ~/.ssh/.signing-key-registered`. **Do this once per SSH-enabled Tool
Container** — each tool has its own key pair and its own marker file on its
own volume now, so dismissing the prompt in one tool's window has no effect
on any other tool's.

**An under-scoped or missing `GH_TOKEN`, or an unset `DEVCONTAINER_HOST`, never fails the
container build.** `post-create-ssh-block.sh` probes `GH_TOKEN` before touching any keys; if it's
missing, invalid, or lacks Administration permission (or `DEVCONTAINER_HOST` isn't set), the rest
of the SSH setup is skipped and the reason is recorded to `~/.ssh/.ssh-setup-skipped` instead of
aborting `postCreateCommand` — which would otherwise also skip every block concatenated after the
SSH layer (the warnings banner below; tool installs run earlier and are unaffected). The reason
appears once in the build log, and then at the top of every
new terminal (via a `~/.bashrc` snippet) until it's fixed — along with the two other standing SSH
warnings (signing key not yet registered; deploy key missing on GitHub), all read from local files
so no terminal pays for a network call just to open a shell. Fix `.devcontainer/.env`, then
**Dev Containers: Rebuild Container** — no need to re-run this skill.

**`GH_TOKEN` alone doesn't authenticate git push/pull, only the `gh` API.**
The `gh` CLI reads `GH_TOKEN` automatically for API calls, but `git` itself
has no idea it exists. If this repo's remote is an SSH URL (`git@github.com:...`),
the SSH deploy key set up in `post-create.sh` is what makes `git push`/`git
pull` work against `origin` — `git config --global credential.helper
'!gh auth setup-git'` (set in the baseline) only covers an HTTPS remote, and
does nothing for SSH transport.
