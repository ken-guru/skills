---
name: devcontainer-dx-niceties
description: "Statusline, config-directory symlink bridging, host-sleep prevention, database healthcheck gating, and secrets-splitting patterns for a devcontainer — including one this Skill Suite didn't scaffold. Use when polishing an already-functional devcontainer's day-to-day feel, bundling a database service, or reconciling multiple tools that disagree about a shared config directory's persistence contract. Partial automation: the statusline installs automatically; host-sleep prevention and database bundling need a one-line addition to your own devcontainer.json or compose file, since neither is something a devcontainer Feature can declare."
---

# devcontainer-dx-niceties

An Add-on Skill of the devcontainer-setup Skill Suite, authored as a
local-path [devcontainer Feature](https://containers.dev/implementors/features/)
— see [feature-conventions.md](../docs/feature-conventions.md) for the
mechanics every Feature-authored Skill in this suite shares. Small
conveniences that don't change what the devcontainer does
architecturally, but change how it feels to work in day to day. None of
these are "decisions with alternatives" the way a base-image choice or a
network policy is; they're accumulated polish.

**Only partially install-and-forget, unlike this suite's other four
Add-on Skills.** A devcontainer Feature's manifest can declare
`postCreateCommand`/`postStartCommand`/`postAttachCommand` and in-container
mounts and capabilities — but not `initializeCommand` (a base
`devcontainer.json`-only property) and not a compose file's own service
definitions. Host-sleep prevention and database-healthcheck gating are
real capabilities this Skill ships the scripts and snippets for, but
genuinely can't wire up by installing the Feature alone; they need one
line added to your own project files, documented below for each.

## Install

Copy [`feature/devcontainer-dx-niceties/`](feature/devcontainer-dx-niceties/)
into your project's `.devcontainer/devcontainer-dx-niceties/`, add it to
your `devcontainer.json`'s `features` block —

```jsonc
"features": {
  "./devcontainer-dx-niceties": {}
}
```

— and rebuild. This installs `jq`, copies the statusline to
`/usr/local/bin/statusline.sh` (the Feature source cache may disappear after
build), and wires it into the non-root user's `.bashrc`, idempotently (a
marker comment guards against double-appending on rebuild). Everything else below needs the specific
manual step its own section describes.

The hook reaches interactive shells that source `.bashrc` (including the
usual `docker exec -it ... bash` path). The executable itself is kept at
`/usr/local/bin/statusline.sh`, so it remains available after Feature source
cache cleanup.

## Keeping the host awake with `initializeCommand`

A devcontainer's own processes only run once the container is up — no
help for preventing the *host* machine from sleeping while a long build,
a database connection, or an agent session is in flight inside the
container. There's no way to prevent host sleep from inside a container;
the host is a different machine (or VM) as far as the container's process
namespace is concerned. The fix runs on the host itself, launched detached
before the container starts — which is exactly why a Feature can't
declare it: `initializeCommand` fires before any container or Feature
machinery exists yet.

[`files/keep-host-awake.sh`](feature/devcontainer-dx-niceties/files/keep-host-awake.sh)
is defensive in the ways a script running directly on a developer's host,
rather than inside the sandboxed container, needs to be: a no-op on
unsupported hosts (checks for the platform wake-lock command and the
container runtime's CLI before doing anything), scoped to this project's
containers only via the `devcontainer.local_folder` label so multiple
devcontainer projects running concurrently don't step on each other's
wake locks, guarded against duplicate watchers stacking up via a
liveness-probed lock file, and releases the wake lock a grace period
after the last matching container disappears rather than holding the host
awake forever. Add this line to your project's `devcontainer.json`
yourself (the script's own header comment has the exact line, including
why the workspace folder is passed twice):

```jsonc
"initializeCommand": "nohup bash \"${localWorkspaceFolder}/.devcontainer/devcontainer-dx-niceties/feature/devcontainer-dx-niceties/files/keep-host-awake.sh\" \"${localWorkspaceFolder}\" >/tmp/keep-awake.log 2>&1 &"
```

## Wipe-vs-persist asymmetry across skill/config directories

When more than one AI coding tool shares a devcontainer, they often
disagree about where reusable "skill" or plugin content should live, and
whether it's disposable or durable state. One tool's directory might get
rewiped and reinstalled from a pinned source every start; another's is
additive and expected to persist. Rather than forcing every tool onto one
policy, let each directory keep its own semantics and bridge between them
with symlinks where a newer or less-flexible tool's discovery path
doesn't match the shared convention yet.

[`files/ensure-symlink.sh`](feature/devcontainer-dx-niceties/files/ensure-symlink.sh)
is a library function, not something this Feature calls automatically —
this suite doesn't know in advance which directories need bridging for
your specific combination of installed tools. Source it from your own
`postCreateCommand` (or a script it calls) and call `ensure_symlink
<link_path> <target>` for each pair you need. It only creates a symlink
when the target doesn't already exist, and errors loudly rather than
silently overwriting when something unexpected already occupies that
path. The point isn't the specific tools; it's the general shape: when
multiple pieces of tooling read from conceptually the same content but
disagree on the path or the persistence contract, designate one location
as the source of truth and link the others to it, instead of duplicating
content or forcing every consumer onto identical semantics.

## A statusline that answers "where am I, and what's the state of my work"

[`files/statusline.sh`](feature/devcontainer-dx-niceties/files/statusline.sh)
answers the questions a developer re-asks dozens of times a session: which
repo, which branch, is there an open PR for this branch, how much
uncommitted work is sitting around. Works two ways — with no stdin (a
plain `.bashrc` `PS1` hook, reading `$PWD`) or with JSON on stdin
containing a `cwd` field (an agentic CLI's own statusline-hook convention,
Claude Code's `statusLine` command being the running example, which
invokes scripts this way rather than relying on the shell's own idea of
the current directory).

Deliberately uses `jq` for the JSON parsing, even in this hot-path,
frequently-invoked script — a statusline script reaching for a `sed`/`grep`
one-liner instead of the JSON tool used everywhere else in a codebase is a
real, previously-observed pattern, sometimes a deliberate tradeoff
(avoiding a subprocess dependency, preserving a working snippet from
elsewhere) and sometimes just drift. If you change this, leave a one-line
comment saying which — don't assume a future maintainer, human or agent,
will re-derive the reasoning from the code alone.

## Healthcheck-gated startup, not just `depends_on`

A compose-based devcontainer that bundles a database (or any other
service the app needs at boot) should gate startup on the service actually
being *ready*, not merely *started* — a plain `depends_on` only waits for
the dependency's container process to launch, and a database container
can report "started" well before it's accepting connections. This is a
compose-file, service-definition concern — outside what any Feature
manifest can declare, the same boundary as `initializeCommand` above.
Add this to your own `docker-compose.yml` (wherever `devcontainer-scaffold`'s
skeleton put your `devcontainer` service, alongside a new `db` service):

```yaml
services:
  devcontainer:
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:15-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
```

This removes an entire category of "works on the second `dev` command but
not the first" flakiness, especially on cold starts or after a full
volume wipe, without the app needing any retry/backoff logic of its own
for the ordinary startup case.

## Splitting `containerEnv` from a gitignored `.env`

Already implemented, not something this Skill duplicates:
`devcontainer-scaffold`'s compose skeleton ships the `env_file` stanza and
[`.env.example`](../devcontainer-scaffold/templates/.env.example) this
pattern needs, and `devcontainer-git-auth`'s `GH_TOKEN` is the worked
example already using it. The dividing line, restated here since it's
genuinely this Skill's own topic even though the mechanism lives
elsewhere: **safe-to-commit local defaults** (a local database connection
string, a placeholder secret obviously not real, feature flags scoped to
local dev) belong in `devcontainer.json`'s `containerEnv`, version-controlled
like any other project file, so a fresh clone works with zero manual
setup. **Genuine secrets and per-developer values** (API tokens, anything
granting real access, anything that legitimately differs per developer)
belong in the gitignored `.env`, with every key documented in the
committed `.env.example` (what it's for, where to get it, which
permissions it needs) but no real values filled in. If you add a secret
of your own, append your key to that shared `.env.example` rather than
creating a second one — see its own header comment for why it has no
single narrow owner the way most of this suite's artifacts do.

## Bind-mounting a host CLI's auth dotfile

Some CLIs (a cloud platform's CLI, a deployment tool) store their
authentication state in a dotfile or directory under the host user's home
directory. Without special handling, a developer re-authenticates that
CLI, often via an interactive browser flow, every time the devcontainer
rebuilds. Bind-mounting the host's auth directory straight into the
container's equivalent path carries the login across rebuilds
automatically — but this needs a host-side path
(`${localEnv:HOME}`-style substitution), which a Feature's own `mounts`
field doesn't support (only `devcontainerId` substitution is documented
there), so this is another one for your own `docker-compose.yml`:

```yaml
volumes:
  - ${HOME}/.some-cli-auth-dir:/home/appuser/.some-cli-auth-dir
```

Two things make this safe rather than sketchy: it's a two-way bind mount,
not a copy — nothing about the credential duplicates into the container
image, a named volume, or version control, and revoking it on the host
revokes it inside the container too. And the target should be a directory
the CLI already treats as its own private auth state, on a tool that
isn't part of this suite's reviewed, pinned toolchain (unlike
`devcontainer-agentic-clis`' or `devcontainer-git-auth`'s own credentials,
which those Skills own and verify directly) — there's no expectation this
pattern also controls that CLI's version or install method, only that it
inherits a login already established on the host. If the host directory
doesn't exist yet, most container runtimes create it automatically on
first mount, empty, and the CLI is simply prompted to log in once (inside
the container this time), after which the login persists across every
future rebuild.

## Verification

Build and boot; confirm the statusline appears in a fresh interactive
shell and actually updates (change branches, make the working tree dirty,
confirm the line changes on the next prompt — not just that it rendered
once at shell start, which is exactly the bug a naively-quoted `PS1`
assignment produces). For any of the three manually-wired patterns you
add, verify the actual behavior, not just that the line is present:
confirm the host actually doesn't sleep during a long-running container
task, confirm a cold `docker compose up` doesn't race the database, and
confirm a bind-mounted CLI's login genuinely survives a full rebuild.
