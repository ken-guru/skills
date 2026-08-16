---
name: devcontainer-git-auth
description: "Generate and register a deploy key (git transport), a separate signing key (commit signatures GitHub marks Verified), and wire gh CLI API authentication via GH_TOKEN, for a devcontainer — including one this Skill Suite didn't scaffold. Use when a devcontainer needs to push/pull, sign commits, or call the GitHub API without reusing personal host credentials. Retrofits: declares its own SSH volume and detects an existing repo remote rather than assuming devcontainer-scaffold set anything up."
---

# devcontainer-git-auth

An Add-on Skill of the devcontainer-setup Skill Suite, authored as a
local-path [devcontainer Feature](https://containers.dev/implementors/features/)
— see [feature-conventions.md](../docs/feature-conventions.md) for the
mechanics every Feature-authored Skill in this suite shares. Three
genuinely distinct credentials, not one: a **deploy key** (git transport),
a **signing key** (commit signatures), and a **`GH_TOKEN`** (the `gh` CLI's
own API operations). Each is scoped to exactly what it needs and no more —
a compromise or misconfiguration of one shouldn't cascade into the others.

## Install

Copy [`feature/devcontainer-git-auth/`](feature/devcontainer-git-auth/)
into your project's `.devcontainer/devcontainer-git-auth/`, add it to your
`devcontainer.json`'s `features` block —

```jsonc
"features": {
  "./devcontainer-git-auth": {}
}
```

— then add `GH_TOKEN=<a fine-grained PAT scoped to this repo's
Administration (R/W), Issues (R/W), Pull requests (R/W), Metadata (R) —
no account-level permissions needed>` to your project's
`.devcontainer/.env` (copy `devcontainer-scaffold`'s
[`.env.example`](../devcontainer-scaffold/templates/.env.example) if you
haven't already; this Skill's own line is already in it). Rebuild.

This Feature declares its own named volume for `~/.ssh`
(`devcontainer-git-auth-ssh`, mounted at the resolved remote user's
`$HOME/.ssh`) rather than assuming
`devcontainer-scaffold` declared one for it, and `install.sh` pre-creates
and `chown`s that path so the volume doesn't come up root-owned on first
mount — the Retrofit Contract applied to this Skill's own state, not just
what it detects elsewhere. Both keys persist in this one volume; wiping it
resets the deploy key, the signing key, and the signing-key registration
marker together, by design (see below).

## The dual-key collision gotcha

GitHub (and GitLab) refuses to register a public key as a signing key if
that exact key is already registered elsewhere on the account, such as a
deploy key on a repository. The failure is a rejected API request with no
indication that "already used elsewhere" is the cause — it looks identical
to a malformed key or a permissions problem. Generate two separate keys
from the start, one per purpose, and never let their registration surfaces
overlap:

- **Deploy key** (`id_ed25519`) — authenticates git transport (clone,
  fetch, push), registered via GitHub's repo-scoped deploy-key endpoint
  (`POST /repos/{repo}/keys`), not an account-wide key. Structurally
  incapable of authenticating to any other repo, independent of whatever
  scope `GH_TOKEN` itself carries — a stronger guarantee than PAT scoping
  alone.
- **Signing key** (`id_ed25519_signing`) — registered against the account
  as a *signing* key specifically, never used for transport.

## Detect existing registration by content, not by title

A setup script that runs on every container create needs to know whether
a key is already registered before trying to register it again. Looking up
an existing entry by its human-readable title breaks the moment the
underlying key material changes while the title stays the same — for
instance, the SSH volume gets wiped and regenerates a fresh key under the
same title. Title-only matching then finds the *old* entry, assumes
registration is done, and skips it, leaving GitHub registered with a key
the container no longer holds.
[`files/setup-keys.sh`](feature/devcontainer-git-auth/files/setup-keys.sh)
compares the key's actual content (the base64 body, not the
comment/title) against what's registered: a content match means already
registered correctly; a title match with different content means the key
was rotated — delete the stale entry by its remote-assigned id, then
register the new one; no match at all means register fresh. This exact
pattern is verified against a real, independently-built implementation
that hits this case in practice (a wiped SSH volume regenerating a new
key under the same hostname-derived title).

## The `gh api` / `jq` argument-passing gotcha

`gh api`'s own `--jq` flag takes a single jq filter *expression*. It does
not accept jq's other flags, such as `--arg`, appended after it. A command
combining them runs without erroring but silently doesn't do what it looks
like — `--arg` never reaches an actual `jq` process, so the bound variable
is never set, and the filter either errors internally in a way that's easy
to miss, or matches nothing. The visible symptom is a lookup that always
comes back empty, not an error pointing at the cause. The fix: get raw
JSON from `gh api` first, then pipe it to a real, standalone `jq`, which
does support `--arg` — every content-comparison in `setup-keys.sh` and
`verify-and-remind.sh` does exactly this, never combining the two.

## The two-tier onboarding marker pattern

Two categories of setup step need different verification cadences.
**Steps a script can fully verify** (the deploy key's registration) get no
marker at all — re-checked from scratch on every attach via
[`files/verify-and-remind.sh`](feature/devcontainer-git-auth/files/verify-and-remind.sh),
because a marker would let a revoked or deleted registration go undetected
until push/pull actually breaks. **One-time human steps** (pasting the
signing key's public half into GitHub's account settings — automating this
needs an account-wide credential scope broader than anything else this
Skill needs) get a persisted marker file instead:
`~/.ssh/.signing-key-registered`, written by the human after completing
the step. Presence means done; absence shows the reminder. A single
persisted marker, checked for presence, is the whole state machine —
resist tracking this with a second "pending" signal, which drifts out of
sync with the first the moment the two aren't wired to change together.

The always-re-verified deploy-key check runs **ahead of** the signing-key
marker's fast-path in `verify-and-remind.sh`, not after it: a script that
only reaches its automated verification after the human-driven fast-path
exit stops catching regressions in the automated part the moment the
manual part is marked done, defeating the point of having an always-on
check at all.

## `GH_TOKEN`: a different credential for a different job

`GH_TOKEN` is not involved in git transport at all — that's the deploy
key, over SSH. It's the `gh` CLI's own credential for API operations (this
Feature's deploy-key registration calls, but also anything else `gh` does:
PRs, issues, releases). Flows via `devcontainer-scaffold`'s `env_file`
wiring (`.devcontainer/.env`, gitignored) into the container environment;
`gh` picks it up through its own documented automatic env-var convention —
no explicit `gh auth login` or `--with-token` needed anywhere in this
Skill's scripts. Scope it narrowly (a fine-grained PAT, repo-scoped, no
account-level permissions) — see the Install section above for the exact
permission table. Keeping `GH_TOKEN`, the deploy key, and the signing key
as three separate credentials, each scoped to its own narrow, frequent-use
purpose, means a compromise or misconfiguration of one doesn't cascade
into the other two.

## Verification

Build, boot from a clean state (no SSH volume already populated), and
confirm the deploy key generates and registers on first `postCreateCommand`
run. Attach again and confirm `verify-and-remind.sh` re-verifies the
deploy key live against GitHub rather than trusting a cached result, and
shows the signing-key reminder until you `touch` the marker. Make a signed
commit and confirm it shows as Verified on GitHub — a signing key that
generates and even matches the manifest's expectations can still fail
silently here if `git config`'s `gpg.format`/`user.signingkey` wiring is
wrong. Confirm `gh` CLI calls (e.g. `gh api user`) succeed using `GH_TOKEN`
alone, with no interactive login step.
