---
id: research-words-are-snake-git-auth
title: Ground-truth git-auth mechanics from the-words-are-snake devcontainer-setup
status: open
type: research
assignee: null
blocked_by: []
created: 2026-08-10
---

## Question

The reference implementation at
`/Users/ken/Workspace/ken-guru/the-words-are-snake/devcontainer-setup`
already solves the exact problem `devcontainer-git-auth` needs to cover:
a deploy key (git transport), a separate commit-signing key, and `gh` CLI
API authentication via `GH_TOKEN` in a gitignored `.env`. The user
summarized it from memory (recorded in
[git-auth-scope-and-pr56-disposition](git-auth-scope-and-pr56-disposition.md)),
but the actual scope-decision ticket for `devcontainer-git-auth` needs
exact mechanics, not a paraphrase.

Read the actual files in that directory (`.devcontainer/post-create.sh` or
equivalent, `docker-compose.yml`, `.env`/`.env.example`, any
`devcontainer.json`) and report:

- Exact script/hook ordering: what generates the deploy key, when, and how
  it's registered against GitHub (which `gh` command or API call, and
  whether registration is idempotent — does re-running post-create.sh on
  an already-configured repo error, no-op, or duplicate the key?).
- Exact volume names and mount paths used for both SSH keys, and whether
  they're separate volumes or one shared volume with two files in it.
- How `GH_TOKEN` flows from `.env` into the container and how the `gh`
  CLI is made to pick it up (an explicit `--with-token`, the `GH_TOKEN`/
  `GITHUB_TOKEN` env var convention, or something else) — and whether
  anything in that flow conflicts with or duplicates PR #56's existing
  DX-AND-DATABASE-NICETIES.md guidance on gitignored `.env` + committed
  `.env.example`.
- The manual, once-per-machine registration step for the signing key
  (mentioned as "registered manually" by the user) — what exactly does a
  human do, and is there a marker file or check that detects it's already
  done, matching PR #56's existing dual-key-signing pattern (`generate-
  and-register-ssh-keys.sh.template`'s persisted-marker-file approach)?
- Anything in that implementation that contradicts or improves on PR #56's
  existing SSH-DUAL-KEY-SIGNING.md content (the `gh api --jq`
  argument-passing gotcha, the credential-scoping rationale) — flag
  discrepancies rather than silently preferring one source.

Report as findings for
[decide-devcontainer-git-auth-scope](decide-devcontainer-git-auth-scope.md)
to consume directly; this ticket does not itself decide the module's
scope, only grounds it in fact.
