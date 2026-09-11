# ADR-0003: Manual-first deploy-key registration, SSH-based liveness check

**Status:** Accepted
**Date:** 2026-09-11

## Context

ADR-0002 collapsed per-CLI Tool Containers back into one Shared Container, reintroducing a single
`GH_TOKEN` sourced via `BASH_ENV` into every AI CLI's every shell in the container — the single
most exposed credential inside it. A security review of that change (PR #268) flagged that
`post-create-ssh-block.sh`'s automatic deploy-key registration (`gh api repos/.../keys`,
list/create/delete) requires `GH_TOKEN` to carry the repo's **Administration (read/write)**
fine-grained permission. Research against GitHub's own docs confirmed this is unavoidable for that
specific API path: deploy-key management has no permission category narrower than
`Administration`, and a leaked or exfiltrated `GH_TOKEN` with `Administration: write` could plant
an attacker's own deploy key on the repo — a persistent push-access backdoor surviving revocation
of the leaked token — or delete/tamper with the legitimate one. Given how broadly `GH_TOKEN` is
now exposed, granting it a permission whose only purpose is this one convenience was judged
disproportionate.

The same research also established two things that shape the decision: `Administration: Read-only`
is a real, selectable level that permits listing keys but not creating/deleting them, and
`ssh -T git@github.com` using the deploy key directly authenticates against GitHub with **zero**
token scope of any kind — and is actually a stronger liveness signal than the API list call, since
it tests whether git transport actually works right now rather than a proxy for it.

## Decision

Deploy-key registration becomes manual by default, mirroring how the signing key already works:
`post-create-ssh-block.sh` generates the keypair locally and unconditionally (no longer gated on
`GH_TOKEN` at all — only on `DEVCONTAINER_HOST`, needed for key titles), and `post-attach.sh`
prints paste-into-GitHub instructions for whichever of the deploy key and signing key aren't yet
registered, combined into one banner instead of two. The existing API-based auto-registration
(including stale-key rotation cleanup) is kept, but demoted to an *opportunistic* convenience:
attempted only if `GH_TOKEN` happens to already carry `Administration` access, and any failure —
missing token, invalid token, insufficient scope — silently falls through to the manual path
rather than erroring or blocking anything. The deploy key's liveness check (`postAttachCommand`,
every attach) switches from the GitHub API list call to the SSH-transport probe, so it needs no
`GH_TOKEN` scope regardless of which registration path was used.

Net effect: the documented default `GH_TOKEN` never needs `Administration` at all — only whatever
scopes a user's own day-to-day `gh` usage (PRs, issues, etc.) already requires.

## Alternatives considered

### A) Keep automatic-only registration, narrow the scope to `Administration: Read-only` (rejected)

- Pro: smaller code change; liveness check stays API-based.
- Con: `Read-only` still can't register a key at all (creation needs `write`), so this alone
  doesn't solve the actual setup problem — it only helps the liveness check, and leaves the
  create/delete path needing `write` regardless. Doesn't move the needle on the finding.

### B) Drop deploy keys entirely, push over HTTPS using `GH_TOKEN` (rejected)

- Pro: removes the SSH deploy-key machinery entirely; one credential instead of two.
- Con: pushing over HTTPS with `GH_TOKEN` needs the `Contents: Read and write` permission on the
  *same* token that's already broadly exposed via `BASH_ENV` to every shell in the container —
  trading one broad permission for another on the more exposed credential, and losing the
  privilege separation a filesystem-resident SSH key provides (a leaked `GH_TOKEN` would grant
  git push directly, instead of requiring a separate, harder-to-exfiltrate key file). Also loses
  the structural guarantee that a deploy key can never be reused against another repo, which a PAT
  only has if a human remembers to scope it that way.

### C) Manual-first with opportunistic auto-registration fallback, SSH-based liveness (chosen)

- Pro: closes the `Administration` requirement for the documented default path entirely, not just
  softens it; keeps the existing automation available for users who deliberately opt in by scoping
  their token that way; the liveness check becomes *more* accurate, not just cheaper, since it
  tests real git transport instead of a GitHub-side proxy for it.
- Con: first-time setup for a minimally-scoped token now requires one extra manual step (pasting
  the deploy key), same as the signing key already requires; a small number of users who prefer
  full automation must deliberately grant `Administration` to keep the old zero-touch experience.

## Consequences

- `.devcontainer/.env.example`'s `GH_TOKEN` comment no longer states `Administration` as a
  requirement — it's documented as an optional convenience.
- `post-create-ssh-block.sh`'s `SSH_SETUP_OK`/`SSH_SKIP_MARKER` whole-block gate is gone; the only
  remaining precondition for key generation is `DEVCONTAINER_HOST`.
- `post-attach.sh` no longer calls the GitHub API at all; `.deploy-key-registered` joins
  `.signing-key-registered` as a marker file, both read by the combined banner and by
  `post-create-warnings-block.sh`'s `~/.bashrc` snippet.
- A repo migrating from the previous automatic-only model needs no action — the auto-registration
  path still runs identically for anyone whose `GH_TOKEN` already carries `Administration`; only
  the previously-mandatory requirement becomes optional.
