---
id: git-auth-scope-and-pr56-disposition
title: Decide git-auth scope and PR #56 disposition
status: closed
type: grilling
assignee: claude
blocked_by: []
created: 2026-08-10
closed: 2026-08-10
---

## Question

PR #56's SSH-signing content covers two SSH keys (git transport + commit
signing) registered via `gh api`. The user's original loose idea
separately named "gh cli authentication and deployment keys" as an
add-on — is that the same content restated under a different name, or
genuinely new scope PR #56 never covered? Separately: given this effort
supersedes PR #56, when should it close?

## Resolution

**Scope**, per the user's own detailed answer (sourced from the reference
implementation at
`/Users/ken/Workspace/ken-guru/the-words-are-snake/devcontainer-setup`):
three genuinely distinct pieces, not one -

- **Deploy key** (`~/.ssh/id_ed25519`) — an SSH keypair generated inside
  the container, auto-registered as a GitHub deploy key scoped to
  push/pull one repo only. This is what actually moves git objects over
  SSH. This is the **same concept** PR #56's SSH-DUAL-KEY-SIGNING.md
  already calls the "transport key" — "deploy key" is simply GitHub's own,
  more correct term for it. Not new scope; a naming correction to carry
  into `devcontainer-git-auth`.
- **Commit-signing key** (`~/.ssh/id_ed25519_signing`) — registered
  manually once per machine, used only to sign commits (`gpg.format ssh`)
  so they show as Verified on GitHub. Already covered by PR #56's existing
  dual-key-signing content, no change.
- **`gh` CLI API authentication** (`GH_TOKEN` in a gitignored
  `.devcontainer/.env`, consumed by docker-compose at container start) —
  a fine-grained GitHub PAT for the `gh` CLI's own API operations (PRs,
  issues), unrelated to git transport or commit signing. **Genuinely new
  scope** PR #56 never addressed. Folds into `devcontainer-git-auth`
  rather than becoming a seventh module, since it's the same
  "container talking to your git host with proper credentials" concern,
  just a different credential type (API token vs. SSH key). Note: PR #56's
  DX-AND-DATABASE-NICETIES.md already documents the general
  gitignored-.env-for-secrets pattern; `GH_TOKEN` is a concrete instance
  of that pattern, not a new mechanism.

  Both SSH keys persist in a named Docker volume in the reference
  implementation — consistent with PR #56's existing named-volume-per-
  concern guidance.

  Exact mechanics (volume naming, script ordering, `gh` CLI env var
  conventions) are deferred to
  [research-words-are-snake-git-auth](research-words-are-snake-git-auth.md)
  rather than taken solely from the user's paraphrase above.

**PR #56 disposition: close now.** It's fully superseded and closing it
unblocks nothing downstream (no other ticket depends on its open/closed
state) — this is direct cleanup, not a ticket, performed once the map was
charted.
