# SSH dual-key signing: the collision gotcha and the marker-file onboarding pattern

Two lessons come up any time a devcontainer or CI environment needs both
git transport (push/pull over SSH) and git commit signing (SSH-format
signatures GitHub or GitLab will mark as Verified) using keys minted inside
the container itself. Both lessons were learned the expensive way, against
the real GitHub API, not from documentation that states them clearly
anywhere up front.

## The dual-key collision gotcha

GitHub (and, as of writing, GitLab) will refuse to register a public key as
a signing key if that exact key is already registered somewhere else on the
account, such as a deploy key on a repository. The failure is a rejected
API request with no indication that "already used elsewhere" is the cause:
it looks identical to a malformed key or a permissions problem. If a setup
script generates a single SSH key and tries to use it for both git
transport and commit signing, the transport registration succeeds, and the
signing registration then fails in a way that's easy to misdiagnose as a
key-format issue.

The fix is structural, not a workaround: generate two separate keys from
the start, one per purpose, and never let their registration surfaces
overlap.

- **Transport key**: authenticates git operations (clone, fetch, push).
  Scope it as narrowly as the platform allows, such as a deploy key on a
  single repository, not an account-wide key, if the platform supports
  that distinction.
- **Signing key**: registered against the account (or org) as a *signing*
  key specifically, not an authentication key. Never used for transport.

Keep the two clearly labeled wherever they're referenced in scripts, docs,
or file names (`id_ed25519` vs. `id_ed25519_signing` is one reasonable
convention). A script that reads or writes the wrong key for the wrong
purpose is a silent, hard-to-notice bug: transport still works, signing
still works, until the day the two keys need to be told apart and nothing
distinguishes them.

## Detect existing registration by content, not by title

A setup script that runs on every container rebuild needs to know whether a
key is already registered on the remote platform before trying to register
it again. The tempting shortcut is to look up an existing entry by its
human-readable title (a label like `my-project-devcontainer@hostname`) and
skip registration if a match is found. This breaks the moment the
underlying key material can change while the title stays the same. For
example, a persistent volume holding the key gets wiped and regenerates a
fresh key under the same generation logic, hence the same title, but with
different content. Title-only matching then finds the *old* entry, assumes
registration is already done, and skips it, leaving the platform
registered with a key the container no longer holds, and the container
holding a key the platform has never seen. Transport or signing then fails
in a way that looks unrelated to key rotation at all.

The fix: compare the key's actual content (the base64 body, not the
comment/title field) against what's registered remotely.

- Content matches an existing entry → already registered correctly, do
  nothing.
- No content match, but an entry with the same *title* exists → the key
  was rotated. Delete the stale entry (by its remote-assigned id, not by
  title) and register the new key.
- No match at all → register fresh.

Title stays useful as a human label for finding and revoking keys in the
platform's UI later, but it should never be the signal a script trusts to
decide whether registration is needed.

## The `gh api` / `jq` argument-passing gotcha

`gh api`'s own `--jq` flag takes a single jq filter *expression* as its
argument. It does not accept jq's other flags, such as `--arg` or
`--argjson`, appended after it. A command like:

```bash
gh api "some/endpoint" --jq \
  --arg body "$SOME_VARIABLE" \
  '.[] | select(.thing == $body)'
```

runs without erroring, but silently does not do what it looks like it
does: the `--arg` flag is not passed through to an actual jq process, so
`$body` is never bound, and the filter either errors internally to `gh api`
in a way that's easy to miss, or matches nothing. The visible symptom is a
lookup that always comes back empty, not an error message pointing at the
cause.

The fix is to stop combining the two tools into one invocation. Get raw
JSON from `gh api` first, then pipe it to a real, standalone `jq`, which
does support `--arg`:

```bash
gh api "some/endpoint" | jq -r \
  --arg body "$SOME_VARIABLE" \
  '.[] | select(.thing == $body) | .id'
```

The rule of thumb: `gh api --jq '<expr>'` is fine for simple, self-contained
filters with no external variables. The moment a filter needs a shell
variable injected safely (rather than string-interpolated into the jq
expression, which risks injection and quoting bugs), pipe to a separate
`jq` process instead of trying to make `gh api` do both jobs at once.

## The two-tier onboarding marker pattern

Some setup steps can be fully automated by a script holding the right
credentials. Others genuinely require a human to do something in a web UI,
for instance pasting a public key into an account settings page, because
automating it would require granting the automation a permission broader
than the task justifies (see below). These two categories of step need
different verification cadences, and conflating them produces either a
prompt that nags forever after the human already did the step, or a check
that goes stale and stops catching real breakage.

The pattern that works:

- **One-time human steps get a persisted marker file**, written by the
  human after completing the step (`touch ~/.some-dir/.step-done`, or
  equivalent). A setup or attach script checks for the marker's existence
  and shows the onboarding prompt only when it's absent. The marker should
  live in storage that survives whatever "start fresh" mechanism the human
  environment has (a persistent volume in a container, a dotfile outside
  the ephemeral workspace), precisely so it resets exactly when the
  underlying resource that made the step necessary also resets, and not
  before or after.
  - Resist the temptation to track this with a second signal (an
    in-memory flag, a "pending" file alongside the "done" file, checking
    for the *presence* of a pending marker instead of the *absence* of a
    done marker). Two signals for one piece of state drift out of sync:
    one file says "still pending," the human dismisses the prompt, but the
    condition that would clear "pending" was never wired to fire, so the
    prompt either never goes away or goes away and can never come back
    even after a real reset. A single persisted marker, checked for
    presence, is the whole state machine.
- **Steps a script can fully verify get no marker at all.** They're
  re-checked from scratch on every relevant event (every attach, every
  run), because a marker would let a change in the outside world (the
  credential got revoked, the registration got deleted) go undetected
  until something breaks downstream. If the automated check can run cheaply
  and the failure mode of a stale positive is worse than the cost of
  re-checking, don't cache the result at all.

Put the always-re-verified check ahead of the marker-gated fast path in
script order, not after it: a script that only reaches its automated
verification after the human-driven fast-path exit will stop catching
regressions in the automated part the moment the human part is marked
done, which defeats the purpose of having an always-on check at all.

## Scope credentials to what each step actually needs

When a step *could* be automated but only by granting a credential a wider
permission than the rest of the setup needs, that trade is usually not
worth it if the step is rare (once per machine, once per environment) and
the resource being protected already persists across the runs that would
otherwise repeat the step. Prefer: keep the automation credential scoped to
its narrow, frequent-use purpose (API calls, repo-scoped operations), and
make the rare, sensitive step (anything touching account-wide settings)
manual and human-driven instead. This also gives a natural three-way split
worth keeping distinct in any environment doing all three: the credential
that talks to a platform's API, the credential that authenticates transport
(git push/pull, deployments), and the credential that produces signatures
or attestations. They rarely need to be the same secret, and scoping them
separately means a compromise or misconfiguration of one doesn't cascade
into the other two.
