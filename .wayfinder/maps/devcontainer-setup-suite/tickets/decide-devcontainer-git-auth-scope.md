---
id: decide-devcontainer-git-auth-scope
title: Decide devcontainer-git-auth's exact scope and content, and write it
status: open
type: grilling
assignee: null
blocked_by: [scaffold-suite-root, decide-retrofit-mechanism, research-words-are-snake-git-auth]
created: 2026-08-10
---

## Question

Source content: PR #56's `SSH-DUAL-KEY-SIGNING.md` plus
`templates/ssh-signing/generate-and-register-ssh-keys.sh.template`, PLUS
the new scope settled in
[git-auth-scope-and-pr56-disposition](git-auth-scope-and-pr56-disposition.md):
deploy-key terminology correction (transport key → deploy key), and
`gh` CLI API authentication via `GH_TOKEN`/`.env` (new, not in PR #56 at
all).

Consume [research-words-are-snake-git-auth](research-words-are-snake-git-auth.md)'s
findings directly — this ticket should not re-derive the reference
implementation's mechanics from the user's paraphrase when the research
ticket's actual file reads are available.

Covers (pending research findings, expected shape): dual-key generation
(deploy key for transport, signing key for commits) via `gh api`,
credential-scoping rationale, `gh api --jq` argument-passing gotcha,
persisted-marker-file pattern for the manual signing-key registration
step, `GH_TOKEN`/`.env` wiring for `gh` CLI API auth (cross-check against
whatever `devcontainer-dx-niceties` says generically about gitignored
`.env` + committed `.env.example`, since this may be another
narrowest-owner boundary question like the firewall/agentic-clis one).

Write `skills/devcontainer-setup/devcontainer-git-auth/SKILL.md` plus its
templates, to `/writing-for-agents` standards.

## Resolution

(pending)
