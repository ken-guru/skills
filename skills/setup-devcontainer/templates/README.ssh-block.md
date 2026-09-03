
## SSH deploy key and signing key

- Git push/pull and commit signing use two separate SSH keys, persisted
  across rebuilds in one named volume (`{{REPO_NAME}}-ssh-config`) mounted at
  `~/.ssh`. This volume is shared across every Tool Container that has the
  SSH layer enabled — deploy/signing keys are a property of this repo's git
  identity, not of any one AI CLI, so every SSH-enabled Tool Container reuses
  the same registered key pair rather than each tool registering its own.

**Why sharing one key pair doesn't widen the blast radius.** If either key's
material is ever exfiltrated from a Tool Container, the attacker already has
full push/sign capability for this repo's identity from wherever they
extracted it — isolating each tool's keys wouldn't have prevented that,
since Docker boundaries between Tool Containers don't apply once the key
itself is out. Per-tool isolation would only buy *selective revocation*
(distrust one tool without touching the others' keys), which isn't worth
multiplying the signing key's manual GitHub-UI registration step by every
enabled tool: wiping the shared volume and regenerating is already a
fully-scripted, fast operation, so "revoke and redo for everyone" is an
acceptable response to distrusting any one tool.

Two separate ED25519 keys exist because GitHub rejects a public key as a
signing key once that same key is already registered as a deploy key. Each
SSH-enabled Tool Container's `post-create.sh` generates `~/.ssh/id_ed25519`
as the deploy key (git transport: push/pull this repo, registered
automatically against `repos/{{REPO_SLUG}}/keys` via the `gh` API) and
`~/.ssh/id_ed25519_signing` as the signing key (commit verification,
registered manually once per machine via the GitHub UI — there's no
API-driven way to do this without granting the token account-level
`write:ssh_signing_key`, which would let it manage every signing key on the
account, not just this project's).

Both keys live in the `{{REPO_NAME}}-ssh-config` volume, so they and the
`~/.ssh/.signing-key-registered` marker survive container rebuilds. Only
wiping that volume regenerates the keys and resets the marker.

Deploy-key registration is checked by key **content**, not title — if the
volume is wiped and a new key is generated, the stale GitHub entry (same
title, old content) is deleted and replaced. `postAttachCommand` re-verifies
the deploy key on every attach so an accidental deletion on GitHub is caught
immediately instead of failing silently on the next `git push`.

`GH_TOKEN` needs the repo's **Administration (read/write)** permission to
list, register, and delete deploy keys via `gh api repos/.../keys` — this is
in addition to whatever else you use `gh` for (Issues, Pull requests,
Metadata). No account-level token permissions are needed for any of this.

Register the signing key: `postAttachCommand` prints a one-time prompt with a
public key to paste into <https://github.com/settings/ssh> as a **Signing
Key**. Do that, then dismiss the prompt with
`touch ~/.ssh/.signing-key-registered`. **Do this once for the whole repo —
not once per Tool Container.** If more than one SSH-enabled tool is open,
whichever one you dismiss the prompt in dismisses it for all of them too,
since they all read the same marker file from the same shared volume. If you
open two SSH-enabled Tool Containers for the very first time at the same
moment, a lock in `post-create.sh` serializes key generation/registration
between them so only one actually does the work — you may still see both
print the prompt (each was waiting on the lock when it started), but there's
only ever one real key pair and one registration behind it.

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
