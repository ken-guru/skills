## Developer-experience niceties

Small conveniences that don't change what the devcontainer does architecturally, but change how it feels to work in day to day. None of these are "decisions with alternatives" the way a base-image choice or a network policy is; they're accumulated polish.

### Keeping a long-running host process alive with `initializeCommand`

A devcontainer's own processes only run once the container is up. That's a problem for exactly one class of concern: something that has to survive across the container's entire lifetime, including the moment before it starts. The main example is preventing the host machine from sleeping while a long build, a database connection, or an agent session is in flight inside the container. There is no way to prevent host sleep from *inside* a container; the host is a different machine (or a different VM) as far as the container's process namespace is concerned.

The fix is to run something on the host itself, launched detached, before the container starts:

```jsonc
// devcontainer.json
"initializeCommand": "nohup bash \"${localWorkspaceFolder}/.devcontainer/keep-host-awake.sh\" >/tmp/keep-awake.log 2>&1 &"
```

The script itself should be defensive in a few specific ways, since it's the one piece of devcontainer tooling that runs directly on a developer's host rather than inside the sandboxed container:

- **No-op on unsupported hosts.** Check for the platform-specific wake-lock command (e.g. `caffeinate` on macOS) and for the container runtime's CLI before doing anything; exit cleanly if either is missing, so the same script is safe to run in CI or on Linux hosts where it has nothing to do.
- **Scope the watch to this project's containers, not all containers.** Container tooling typically labels containers it creates with the workspace folder that was opened. Filtering on that label means multiple devcontainer projects running concurrently on the same host don't step on each other's wake locks.
- **Guard against duplicate watchers.** A lock file holding the watcher's PID, checked with a liveness probe before the script does anything else, prevents a watcher from stacking up every time the container is rebuilt or reattached.
- **Poll, don't block indefinitely.** The script should release the wake lock a short grace period after the last matching container disappears, and give up entirely if no matching container ever appears within a startup timeout (a failed build, for instance) rather than holding the host awake forever.

### Wipe-vs-persist asymmetry across skill/config directories

When more than one AI coding tool shares a devcontainer, they often disagree about where reusable "skill" or plugin content should live, and about whether that content should be treated as disposable or as durable state. One tool's directory might get rewiped and reinstalled from a pinned source on every container start (favoring reproducibility and freshness over anything a developer might have hand-edited in place). Another tool's directory is additive and expected to persist and accumulate across restarts.

Rather than forcing every tool onto one policy, it's reasonable to let each directory keep its own semantics and bridge between them with symlinks where a newer or less-flexible tool's discovery path doesn't yet match the shared convention. A small helper that only creates a symlink when the target doesn't already exist, and errors loudly (rather than silently overwriting) when something unexpected already occupies that path, keeps this safe across repeated container starts:

```sh
ensure_symlink() {
  local link_path=$1 target=$2
  if [ -L "$link_path" ]; then
    [ "$(readlink -f "$link_path")" = "$(readlink -f "$target")" ] && return
    echo "ERROR: $link_path points somewhere unexpected" >&2
    exit 1
  fi
  if [ -e "$link_path" ]; then
    echo "WARN: preserving existing $link_path" >&2
    return
  fi
  ln -s "$target" "$link_path"
}
```

The point isn't the specific tools; it's the general shape: when multiple pieces of tooling read from conceptually the same content but disagree on the path or the persistence contract, resolve it by designating one location as the source of truth and linking the others to it, instead of duplicating the content or forcing every consumer onto identical semantics.

### A statusline that answers "where am I, and what's the state of my work"

A terminal statusline (or an editor/agent status bar, if the tool supports one) is cheap real estate for exactly the questions a developer re-asks dozens of times a session: which repo, which branch, is there an open pull request for this branch, and how much uncommitted work is sitting around (staged, modified, untracked). Deriving all of that from `git` and the platform's CLI takes only a handful of commands, and surfacing it ambiently removes a steady trickle of manual `git status` / `git branch` checks.

One honest note on implementation: a statusline script that has to parse a small JSON payload (for example, the current working directory) sometimes reaches for a `sed` or `grep` one-liner instead of a proper JSON tool, even in a codebase that uses a real JSON tool everywhere else. That kind of narrow, local inconsistency is sometimes a deliberate, documented tradeoff (avoiding a subprocess dependency in a hot path, or preserving a working snippet adapted from an external reference) and sometimes just drift. If you inherit a script like this, it's worth a one-line comment either way; don't assume future maintainers (or agents) will re-derive the reasoning from the code alone. In the case that prompted this note, the choice was clearly deliberate (flagged in a code comment) but the specific rationale behind it hadn't been preserved anywhere retrievable, which made it worth calling out explicitly rather than silently "fixing" it back to the tool used everywhere else.

---

## Database and service wiring

Patterns for bundling a dependent service (most often a database) alongside the main devcontainer, and for keeping credentials and environment configuration honest about what's safe to commit.

### Healthcheck-gated startup, not just `depends_on`

A compose-based devcontainer that bundles a database (or any other service the app needs at boot) should gate startup on the service actually being *ready*, not merely *started*. A plain `depends_on` only waits for the dependency's container process to launch; a database container can report "started" well before it's accepting connections. Pair `depends_on` with a `condition: service_healthy` and a real healthcheck on the dependency itself:

```yaml
services:
  app:
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

This removes an entire category of "works on the second `dev` command but not the first" flakiness, especially on cold starts or after a full volume wipe, without the app needing any retry/backoff logic of its own for the ordinary startup case.

### Splitting `containerEnv` from a gitignored `.env`

Two different kinds of environment configuration get conflated if you're not careful, and they have opposite commit policies:

- **Safe-to-commit local defaults.** Values that make the devcontainer usable immediately after a clone: a local database connection string pointing at the bundled service, a placeholder secret that's long enough to satisfy validation but obviously not a real credential, feature flags scoped to local development. These belong in the devcontainer config itself (e.g. `containerEnv` in `devcontainer.json`), version-controlled like any other project file, so a fresh clone works with zero manual setup.
- **Genuine secrets and per-developer values.** API tokens, personal access tokens, anything that grants real access to a real system, or anything that legitimately differs per developer (a machine hostname used to label a credential, an optional override of git identity). These belong in a gitignored `.env` file, loaded by the container at runtime but never committed. Ship a committed `.env.example` alongside it, with every key documented (what it's for, where to get it, which permissions it needs) but no real values filled in.

The dividing line is simple: if a value works for every developer and isn't sensitive, it's a committed default; if it's sensitive or personal, it's gitignored. Mixing the two in either direction is the failure mode to design against, either leaking a real secret into version control, or forcing every developer to hunt down and set values that could have shipped as safe defaults.

### Bind-mounting a host CLI's auth dotfile

Some CLIs (a cloud platform's CLI, a deployment tool) store their authentication state in a dotfile or directory under the host user's home directory. Without special handling, a developer has to re-authenticate that CLI (often via an interactive browser flow) every time the devcontainer is rebuilt, which is disruptive if rebuilds are frequent.

Bind-mounting the host's auth directory straight into the container's equivalent home-directory path carries the existing login across rebuilds automatically:

```yaml
volumes:
  - ${HOME}/.some-cli-auth-dir:/home/vscode/.some-cli-auth-dir
```

Two things make this safe rather than sketchy:

- It's a two-way bind mount, not a copy: nothing about the credential is duplicated into the container image, a named volume, or version control. Revoking the credential on the host revokes it inside the container too.
- The target directory should be one the CLI already treats as its own private auth state, on a tool that isn't part of the reviewed, pinned toolchain, so there's no expectation the container also controls that CLI's version or install method, only that it inherits a login already established on the host.

If the host directory doesn't exist yet, most container runtimes create it automatically on first mount, empty, and the CLI is simply prompted to log in once (inside the container this time), after which the login persists across every future rebuild.
