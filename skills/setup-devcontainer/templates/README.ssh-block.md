
## SSH deploy key and signing key

- Git push/pull and commit signing use two separate SSH keys, persisted
  across rebuilds in the shared `{{REPO_NAME}}-ssh` named volume, mounted at
  `~/.ssh`. There's one container now, so one shared key pair is all there
  is to manage.

Two separate ED25519 keys exist because GitHub rejects a public key as a
signing key once that same key is already registered as a deploy key.
`post-create.sh` generates `~/.ssh/id_ed25519` as the deploy key (git
transport: push/pull this repo) and `~/.ssh/id_ed25519_signing` as the
signing key (commit verification). Both are generated unconditionally —
neither needs `GH_TOKEN` at all, only `DEVCONTAINER_HOST` (used to label
them so you can identify and revoke them per machine from GitHub).

**Both keys are registered with GitHub manually by default** — `gh
api repos/.../keys` needs the repo's **Administration** permission, and
that's disproportionate to grant `GH_TOKEN` just for this, especially since
it's sourced into every AI CLI's shell in this container. `postAttachCommand`
prints a one-time combined prompt with each key's public key to paste in:
the deploy key at `https://github.com/{{REPO_SLUG}}/settings/keys/new` (as
an **Authentication Key**), the signing key at
<https://github.com/settings/ssh> (as a **Signing Key**). Dismiss each once
done:

```bash
touch ~/.ssh/.deploy-key-registered
touch ~/.ssh/.signing-key-registered
```

**Optional convenience:** if `GH_TOKEN` happens to carry this repo's
**Administration (read/write)** permission, `post-create.sh` auto-registers
(and, on rotation, replaces) the deploy key via the API, so its half of the
prompt above never appears — `.deploy-key-registered` is touched for you.
This is opportunistic only: no permission on `GH_TOKEN` is required, nothing
fails or warns if it's absent, and the manual path above always works
regardless. The signing key has no equivalent auto-registration — there's no
API-driven way to do it without granting `GH_TOKEN` account-level
`write:ssh_signing_key`, which would let it manage every signing key on the
account, not just this project's — so it's always manual.

Both keys live in the `{{REPO_NAME}}-ssh` volume, so they and both the
`.deploy-key-registered` and `.signing-key-registered` markers survive
container rebuilds. Only wiping that volume regenerates the keys and resets
the markers — if the deploy key was auto-registered before, its stale
GitHub entry is auto-replaced on the next rebuild (matched by key
**content**, not title); if it was registered manually, remove the stale
entry yourself.

`postAttachCommand` re-verifies the deploy key on every attach, so an
accidental deletion on GitHub is caught immediately instead of failing
silently on the next `git push`. This check needs no `GH_TOKEN` scope at
all — it runs `ssh -T git@github.com` using the deploy key directly and
reads GitHub's own authenticated greeting, which is a stronger signal than
an API lookup: it proves push/pull actually works right now, not just that
GitHub's key list contains a matching entry.

**`GH_TOKEN` alone doesn't authenticate git push/pull, only the `gh` API.**
The `gh` CLI reads `GH_TOKEN` automatically for API calls, but `git` itself
has no idea it exists. If this repo's remote is an SSH URL (`git@github.com:...`),
the SSH deploy key set up in `post-create.sh` is what makes `git push`/`git
pull` work against `origin` — `git config --global credential.helper
'!gh auth setup-git'` (set in the baseline) only covers an HTTPS remote, and
does nothing for SSH transport. Keeping push access on a separate,
filesystem-resident key like this — rather than folding it into `GH_TOKEN`
— is deliberate: `GH_TOKEN` is an environment variable exposed to every
process in the container, while the deploy key is a file that requires a
much more deliberate, targeted read to exfiltrate, and a leak of one never
hands over the other.

**An unset `DEVCONTAINER_HOST` never fails the container build**, but it
does skip SSH setup entirely (both keys, not just auto-registration) —
`post-create-ssh-block.sh` records why to `~/.ssh/.ssh-setup-skipped`
instead of aborting `postCreateCommand`, which would otherwise also skip
every block concatenated after the SSH layer (the warnings banner below;
CLI installs run earlier and are unaffected). The reason appears once in
the build log, and then at the top of every new terminal (via a
`~/.bashrc` snippet) until it's fixed — along with the other standing SSH
warnings (either key not yet registered; deploy key not currently working),
all read from local files so no terminal pays for a network call just to
open a shell. Fix `.devcontainer/.env`, then **Dev Containers: Rebuild
Container** — no need to re-run this skill.
