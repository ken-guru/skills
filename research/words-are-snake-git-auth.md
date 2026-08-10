# Findings: git-auth mechanics in the-words-are-snake devcontainer

Primary-source research for
[decide-devcontainer-git-auth-scope](../decide-devcontainer-git-auth-scope.md),
resolving
[research-words-are-snake-git-auth](../research-words-are-snake-git-auth.md).

**Repo root explored:** `/Users/ken/Workspace/ken-guru/the-words-are-snake`

**Correction to the ticket's framing:** there is no separate
`devcontainer-setup/` directory in that repo. Everything lives in the
standard `.devcontainer/` directory at the repo root
(`/Users/ken/Workspace/ken-guru/the-words-are-snake/.devcontainer/`). All
paths below are relative to that directory unless stated otherwise.

Files read in full: `devcontainer.json`, `docker-compose.yml`,
`post-create.sh`, `post-start.sh`, `post-attach.sh`, `.env`, `.env.example`,
`README.md` (lines 1–180+), `devcontainer-lock.json`.

---

## 1. Script/hook ordering, deploy-key generation, GitHub registration, idempotency

**Lifecycle wiring** — `devcontainer.json`:
```
"postCreateCommand": "bash .devcontainer/post-create.sh"
"postStartCommand": "bash .devcontainer/post-start.sh"
"waitFor": "postStartCommand"
"postAttachCommand": "bash .devcontainer/post-attach.sh"
```
So: key generation + deploy-key registration happens in **postCreateCommand**
(`post-create.sh`), once per container build. `post-start.sh` (every
container start) has nothing to do with keys — it's firewall/skills/CLI
update logic. `post-attach.sh` (every VS Code attach) re-verifies the deploy
key against live GitHub state and prints the signing-key registration
reminder if not yet done.

**Deploy-key generation** — `post-create.sh` lines 65–70:
```bash
# Deploy key — used for git transport (push/pull)
if [ ! -f ~/.ssh/id_ed25519 ]; then
  ssh-keygen -t ed25519 -C "$DEPLOY_KEY_TITLE" -f ~/.ssh/id_ed25519 -N ""
fi
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
```
Guarded by a file-existence check, so re-running `post-create.sh` does not
regenerate an existing key.

**SSH client config** (lines 79–88) pins `github.com` to this key only:
```
Host github.com
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  User git
```
plus `ssh-keyscan -H github.com >> ~/.ssh/known_hosts` (non-interactive host
key trust) guarded by a grep check.

**Registration** — `post-create.sh` lines 95–121, via `gh api` (not the web
UI, not `gh ssh-key add`):
```bash
DEPLOY_PUBKEY=$(cat ~/.ssh/id_ed25519.pub)
DEPLOY_KEY_BODY=$(echo "$DEPLOY_PUBKEY" | awk '{print $1, $2}')
REPO="ken-guru/the-words-are-snake"

ALL_DEPLOY_KEYS=$(gh api "repos/${REPO}/keys")

existing_id=$(echo "$ALL_DEPLOY_KEYS" | jq -r \
  --arg body "$DEPLOY_KEY_BODY" \
  '.[] | select((.key | split(" ")[:2] | join(" ")) == $body) | .id')

if [ -n "$existing_id" ]; then
  echo "Deploy key already registered: $DEPLOY_KEY_TITLE"
else
  stale_id=$(echo "$ALL_DEPLOY_KEYS" | jq -r \
    --arg title "$DEPLOY_KEY_TITLE" \
    '.[] | select(.title == $title) | .id')
  if [ -n "$stale_id" ]; then
    gh api "repos/${REPO}/keys/${stale_id}" -X DELETE
    echo "Removed stale deploy key (volume was rotated): $DEPLOY_KEY_TITLE"
  fi
  gh api "repos/${REPO}/keys" -X POST \
    -f title="$DEPLOY_KEY_TITLE" -f key="$DEPLOY_PUBKEY" -F read_only=false
  echo "Deploy key registered: $DEPLOY_KEY_TITLE"
fi
```
Endpoint: `POST /repos/{repo}/keys` — GitHub's repo-scoped **deploy key**
API, `read_only=false` (so it can push, not just pull).

**Idempotency: yes, genuinely idempotent, and more careful than a simple
"skip if title exists" check.** It keys the lookup off the actual public-key
**content** (first two whitespace-delimited fields, i.e. algorithm + key
material, stripping the comment), not off the title string. Three cases:
- Same key content already registered → no-op, logs "already registered".
- Same *title* registered but with **different** key content (the
  `words-snake-ssh` volume was wiped and a new key generated under the same
  hostname-derived title) → deletes the stale GitHub entry by id, then
  registers the new one. This is explicitly commented as handling volume
  rotation.
- Neither → registers fresh.

Re-running `post-create.sh` on an already-configured repo therefore never
duplicates keys and never errors on the "key already in use" collision.

**Signing key generation** (lines 72–77) — same pattern, file-existence
guarded, but **never sent to any GitHub API**. Registration for this key is
manual only (see §4).

---

## 2. Volume names and mount paths for the two SSH keys

**One shared named volume, not two.** `docker-compose.yml` line 28:
```yaml
volumes:
  - words-snake-ssh:/home/vscode/.ssh
```
declared under `volumes:` at the bottom (line 58) with no driver options
(plain named volume). Both `id_ed25519`/`id_ed25519.pub` (deploy key) and
`id_ed25519_signing`/`id_ed25519_signing.pub` (signing key) live as separate
files inside that single mounted directory, alongside `~/.ssh/config`,
`~/.ssh/known_hosts`, and the marker file `~/.ssh/.signing-key-registered`
(see §4). `post-create.sh` line 54 comment confirms this explicitly: "two
keys per host machine, both persisted in the words-snake-ssh volume."

Consequence worth noting for scope decisions: because the marker file lives
in the *same* volume as the keys, wiping the volume resets deploy key,
signing key, and the "already registered" marker together — `post-attach.sh`
lines 8–12 documents this as intentional ("Wiping the volume resets it and
the prompt reappears").

Other named volumes in the same compose file (for context, not git-auth
related): `words-snake-claude-config`, `words-snake-codex-config`,
`words-snake-antigravity-config`, `words-snake-agent-skills`,
`words-snake-bashhistory`, `postgres-data`.

---

## 3. GH_TOKEN flow from `.env` into the container, and how `gh` picks it up

**`.env` → container:** `docker-compose.yml` lines 18–20:
```yaml
env_file:
  - path: .env
    required: false
```
on the `devcontainer` service. This is a plain Compose `env_file` stanza —
every `KEY=value` line in `.devcontainer/.env` becomes a container
environment variable, `required: false` meaning compose won't fail if the
file is absent (first-run-friendly). `.env.example` (checked into git) is
the template; `.env` itself is gitignored (`.gitignore` lines 5–7:
`.env` / `.env.*` / `!.env.example`).

**`.env.example` contents relevant to git-auth** (`.devcontainer/.env.example`):
```
DEVCONTAINER_HOST=your-hostname-here
GH_TOKEN=ghp_your_token_here
# GIT_USER_EMAIL=you@example.com
# GIT_USER_NAME=Your Name
```
The live `.devcontainer/.env` on this machine has real values filled in for
`DEVCONTAINER_HOST`, `GH_TOKEN`, and `CONTEXT7_API_KEY` — confirming the
pattern is actually in use, not just documented. (Token values are not
reproduced here since they are live secrets; the file itself is gitignored
and does not leave the host.)

**How `gh` picks up `GH_TOKEN`:** nothing explicit — no `gh auth login
--with-token`, no `--with-token` flag anywhere, no explicit env assignment
prefixing each `gh` call. Confirmed by grepping the entire `.devcontainer/`
tree for `GH_TOKEN`/`GITHUB_TOKEN`/`gh auth`/`--with-token`: the only hits
are the `.env`/`.env.example` definitions, the README's documentation, and
the bare `gh api ...` calls in `post-create.sh` / `post-attach.sh` /
`auto-update-developer-clis.sh`. This relies entirely on `gh` CLI's
documented convention of reading `GH_TOKEN` (or `GITHUB_TOKEN`) from the
process environment automatically and using it for API calls without an
interactive `gh auth login` step. README.md line 71 confirms the intended
scope explicitly: "`GH_TOKEN` is used by the `gh` CLI for API operations
(PRs, issues, etc.) but is not involved in git transport" — transport is SSH
via the deploy key (§1), API calls (deploy-key registration/lookup, release
lookups in `auto-update-developer-clis.sh`) go through the token.

**Scoping:** `.env.example` documents the required fine-grained PAT scope —
Administration (R/W, needed for the deploy-keys endpoint), Issues (R/W),
Pull requests (R/W), Metadata (R) — "No account-level permissions needed."
README.md lines 20–32 repeats this as setup instructions with a permissions
table. This is a genuinely narrow, repo-scoped token, not a classic PAT with
broad `repo` scope.

**One more `git config` wrinkle** (`post-create.sh` line 124):
```bash
git config --global credential.helper '!gh auth setup-git'
```
This configures git's HTTPS credential helper to shell out to `gh`, which
in turn would use `GH_TOKEN` for HTTPS git operations. But the SSH config
(§1) pins `github.com` to `IdentityFile ~/.ssh/id_ed25519` with
`IdentitiesOnly yes`, and the deploy key is what's actually used for
transport per the README. If the repo remote is an SSH URL
(`git@github.com:...`), this credential helper line is inert — HTTPS
credential helpers aren't consulted for SSH remotes. It reads as defensive/
belt-and-suspenders config (e.g., in case a remote or a one-off `gh repo
clone`/HTTPS operation is used) rather than the primary transport path. Not
a bug, but worth flagging as a discrepancy from a "purely SSH, no HTTPS
credential wiring" mental model.

---

## 4. Manual, once-per-machine signing-key registration step

**What a human does** — surfaced by `post-attach.sh` (runs on every VS Code
attach), lines 36–64: prints a boxed banner with the live public key
(`cat ~/.ssh/id_ed25519_signing.pub`) and numbered instructions:
1. Open <https://github.com/settings/ssh>
2. If a key with the same title already exists, delete it first (stale from
   a previous setup)
3. Click "New SSH key"
4. Title: `words-are-snake-devcontainer-signing@<hostname>`
5. Key type: **Signing Key** — explicitly called out as "NOT Authentication
   Key"
6. Paste the printed public key

**Marker file, detection, and non-reprompt:** `post-attach.sh` lines 8–12
(comment) and line 32:
```bash
REGISTERED="$HOME/.ssh/.signing-key-registered"
...
[ -f "$REGISTERED" ] && exit 0   # fast path — nothing more to do
```
The human dismisses the reminder themselves by running
`touch ~/.ssh/.signing-key-registered` — there is no automated verification
that the key was actually pasted into GitHub; the marker is purely a
human-asserted "I did it" flag. This file lives inside the `words-snake-ssh`
volume, so it survives rebuilds (per §2) but resets if that volume is wiped,
which re-surfaces the prompt — consistent by construction since the keys
themselves reset too.

**Asymmetry vs. the deploy key worth calling out explicitly:** `post-attach.sh`
lines 18–29 *does* verify the deploy key against live GitHub state on every
attach (`gh api repos/{repo}/keys`, checked by content) and warns if it's
missing. There is no equivalent live check for the signing key — GitHub's
API for a user's SSH signing keys (`GET /user/ssh_signing_keys`) is never
called anywhere in this directory (confirmed via grep for `ssh_signing_keys`
and `signing`: only the marker-file check and the local key-file existence
check exist). So "registered" for the signing key is trusted from a local
file touch, not confirmed against GitHub, whereas "registered" for the
deploy key is confirmed against GitHub every attach and never just trusted
from a marker.

---

## 5. Discrepancies / quirks / things that diverge from a "standard" or expected pattern

- **No separate reusable "generate-and-register-ssh-keys" script/template.**
  Everything (keygen, SSH config, registration, idempotency logic) is
  inlined directly in `post-create.sh` (lines 54–131), not factored into a
  standalone `.sh` / `.sh.template` file the way the ticket's framing
  ("PR #56's `generate-and-register-ssh-keys.sh.template`") implies is the
  pattern elsewhere. If `devcontainer-git-auth` wants a template-shaped
  script, that shape isn't what's demonstrated here — this repo's version is
  a monolithic block within the broader post-create hook.

- **No `gh api --jq` combined usage anywhere.** The ticket asks about "the
  `gh api --jq` argument-passing gotcha" mentioned in PR #56 material. This
  repo sidesteps that combination entirely: every `gh api` call fetches raw
  JSON, and filtering is always done in a **separate**, piped `jq -r`
  invocation (`gh api "repos/${REPO}/keys" | ...` is actually not even
  piped — it's captured to a variable first, then `echo "$VAR" | jq -r
  --arg ...`). So there's no direct evidence here of what that gotcha even
  is; this codebase simply never exercises `gh api --jq`. Worth flagging
  that this source doesn't corroborate or contradict PR #56's claim either
  way — it just uses a different technique (capture-then-jq) throughout.

- **Content-based idempotency + stale-key rotation handling is more
  sophisticated than a typical "check title, skip if exists" pattern.** The
  explicit handling of "same title, different key material → delete old,
  register new" (§1) specifically anticipates the volume-wipe scenario. If
  the skill is meant to generalize this pattern, this is the strongest
  concrete design to draw from.

- **Deploy key is repo-scoped by API design, not just by convention.** Using
  `POST /repos/{repo}/keys` (GitHub's repo deploy-key endpoint) rather than
  `POST /user/keys` (account-level SSH key) means the deploy key is
  *structurally* incapable of authenticating to any other repo, independent
  of the PAT's own scoping. This is a stronger scoping guarantee than
  PAT-only scoping and is a good example for a "principle" write-up in the
  skill.

- **The deploy key is live-reverified every attach; the signing key is
  not** (§4) — an intentional-looking but real asymmetry: one credential's
  "done" state is proven against GitHub each session, the other is
  self-reported by the human via a touch'd file with no server-side check
  ever performed. If the target skill wants a consistent trust model across
  both keys, this is a gap to either replicate deliberately or close.

- **`credential.helper '!gh auth setup-git'` alongside SSH-only transport
  config** (§3) — plausibly vestigial/defensive HTTPS wiring in an
  otherwise SSH-exclusive setup. Not necessarily wrong, but not something to
  copy without understanding why it's there, since the README explicitly
  states GH_TOKEN "is not involved in git transport."

- **The `.env`-based `GH_TOKEN` flow the user recalled is confirmed
  present and accurate** — `env_file` in `docker-compose.yml`, gitignored
  `.env` with a committed `.env.example` template, `gh` CLI's automatic
  env-var pickup with zero explicit auth wiring. Nothing here contradicts
  the user's memory on this point; it's a clean match to PR #56's general
  gitignored-`.env`-plus-committed-`.env.example` guidance style, just
  implemented independently in this repo.

- **Live secrets found in `.devcontainer/.env`:** during this investigation,
  `.env` was read directly (required to verify the mechanics) and contains
  a real fine-grained GitHub PAT and a real Context7 API key. The file is
  correctly gitignored and this is the user's own local file, so this is
  not a leak — noted here only because the file's *existence and shape*
  (not its values, which are intentionally not reproduced in this report)
  is direct evidence the `.env`/`.env.example` pattern is actually in daily
  use here, not just documented aspirationally.

---

## Source file index

All paths under `/Users/ken/Workspace/ken-guru/the-words-are-snake/.devcontainer/`:
- `devcontainer.json` — lifecycle hook wiring (postCreate/postStart/postAttach), features (`github-cli:1`)
- `docker-compose.yml` — `words-snake-ssh` volume mount, `.env` `env_file` stanza
- `post-create.sh` — key generation (lines 65–77), SSH config (79–93), deploy-key registration (95–121), git identity/signing config (123–131)
- `post-start.sh` — no git-auth content (firewall, skills, CLI updates)
- `post-attach.sh` — deploy-key live re-verification (18–29), signing-key manual-registration banner + marker check (14, 32–64)
- `.env.example` — committed template: `DEVCONTAINER_HOST`, `GH_TOKEN`, optional `GIT_USER_EMAIL`/`GIT_USER_NAME`/`CONTEXT7_API_KEY`
- `.env` — gitignored, live-filled version of the above (values not reproduced)
- `README.md` lines 1–180 — prose documentation of the whole flow, PAT scope table, key-purpose table
- `../.gitignore` lines 5–7 — `.env` gitignore rules
- `devcontainer-lock.json` — confirms `github-cli` feature pin (v1.1.0)
