# ADR-0001: Per-Tool-Container SSH Deploy and Signing Keys

**Status:** Accepted
**Date:** 2026-09-08

## Context

Every SSH-enabled Tool Container previously shared one deploy key and one signing key pair,
registered once for the whole repo. The documented rationale was that sharing didn't widen the
blast radius: if either key's material was ever exfiltrated from a Tool Container, the attacker
already had full push/sign capability regardless of which container it came from, since Docker
boundaries between Tool Containers didn't apply once the key itself was out — every Tool
Container already shared one on-disk checkout (Shared Checkout) and therefore already trusted
each other by construction.

Private Checkout gives each Tool Container its own isolated on-disk clone, closing that shared
filesystem. A shared SSH volume would then be the one surface left connecting Tool Containers: a
compromised or runaway agent in one container could still read the key material every other
container's `git push` and commit signing depend on.

## Decision

Each Tool Container registers and owns its own SSH deploy key and signing key, on its own named
volume (`{{REPO_NAME}}-<tool>-ssh`), titled distinctly per tool. A repo migrating from the old
shared-pair model has its old shared deploy key auto-removed once each tool's own key is
registered (the `gh api` deploy-keys endpoint supports deletion); the old shared signing key has
no equivalent removal API, so it's left for the person migrating the repo to remove by hand.

## Alternatives considered

### A) Keep one shared key pair per repo (previous state)

- Pro: One manual signing-key GitHub-UI registration for the whole repo, not one per tool.
- Con: Once Private Checkout exists, the shared SSH volume becomes the last surface connecting
  otherwise-isolated Tool Containers, undercutting the isolation Private Checkout is built for.

### B) Per-tool keys (chosen)

- Pro: Closes the last shared surface; buys selective revocation — distrust one tool's key
  without touching any other's.
- Con: The signing key's manual GitHub-UI registration step now happens once per SSH-enabled
  tool instead of once for the whole repo.

## Consequences

- `post-create-ssh-block.sh`'s cross-container `flock` is removed — it only ever arbitrated two
  containers racing to write the *same* shared volume, which can't happen once each tool has its
  own.
- A repo with N SSH-enabled Tool Containers requires N manual signing-key registrations instead
  of one, each time the underlying key material is rotated (e.g. a wiped volume).
- Migrating an already-set-up repo needs an explicit step — see SKILL.md's "Migrating a Tool
  Container to Private Checkout" — since old and new key titles don't collide, so nothing detects
  the migration automatically without a fresh clone.
- N private keys now exist at rest instead of one, each on its own Docker volume. This doesn't
  raise the *ceiling* a host-level attacker (direct access to Docker's volume storage, bypassing
  container isolation entirely) could reach either way: every deploy key is equally repo-scoped,
  so finding any single one — old shared or new per-tool — already grants full push access to
  this repo. The isolation this decision buys is specifically *container-level*: compromising one
  Tool Container no longer exposes every other tool's key, which a host-level compromise was
  never going to respect regardless of how many keys existed.
