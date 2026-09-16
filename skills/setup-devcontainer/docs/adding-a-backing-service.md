# Adding a backing service

For a project that needs a backing service (a database, a cache) running while it develops inside
the Shared Container. Reintroducing Docker Compose (a sibling `db` service, say) throws away every
assumption the CLI companion skills and the firewall's `runArgs`-based Capability Seam model make
about there being exactly one container — so instead, install the service *inside* the Shared
Container itself, the same way a CLI Skill installs its own CLI: imperatively, from an idempotent,
project-owned lifecycle-script block, never baked into the base-owned `Dockerfile`.

This isn't a new mechanism (see ADR-0002,
[docs/adr/0002-collapse-tool-container-isolation.md](adr/0002-collapse-tool-container-isolation.md),
for why this skill has exactly one container to install into in the first place). Every piece below
— `patch-if-absent.sh`, marker-keyed lifecycle-script blocks, a `project-mounts.local.json` volume
entry — already exists for other reasons; a backing service is just another **Project-Owned Block**
(see [CONTEXT.md](../CONTEXT.md)) — or rather two, split across two lifecycle scripts (see below) —
using them. Two worked examples follow: PostgreSQL (more involved — a third-party apt repository,
password/database bootstrap) and Redis (simpler — stock Ubuntu package, no bootstrap). Both use the
same shape:

`{{REPO_NAME}}` below is this repo's own `{{REPO_NAME}}` (resolved the same way as the main flow's
step 1) — substitute it with the actual value everywhere it appears before writing any file or
running any command. Unlike the base skill's own templates, `project-mounts.local.json` and
`post-create.sh`/`post-start.sh` are never substituted again after being written, so a literal
`{{REPO_NAME}}` left in place here would land as-is in `devcontainer.json`'s `mounts` array or in a
running shell command — exactly the `{{...}}`-placeholder leak `SKILL.md`'s own "Done when" step 5
checks against.

1. Declare a named volume for the service's data directory in `project-mounts.local.json`, fold it
   into `devcontainer.json`, rebuild.
2. Append one idempotent block to `post-create.sh`, under a project-owned marker, that installs the
   service, fixes up its data-directory ownership, and (for PostgreSQL) runs its one-time
   bootstrap — **not** `post-start.sh`: `setup-devcontainer` always appends the firewall's own init
   invocation to `post-start.sh` before any project block can follow it, so an install step placed
   there runs *after* the firewall is already active and needs its package host allowlisted first.
   `post-create.sh` runs once, at container creation, unconditionally *before* `post-start.sh` ever
   runs for the first time — firewall opted in or not — so it has no such ordering hazard.
3. Append a second, separate idempotent block to `post-start.sh`, under the same marker, that only
   ensures the service is running — nothing installs or bootstraps from here.

## Example: PostgreSQL

1. Add data **and config** volumes in `.devcontainer/project-mounts.local.json` — persisting only
   the data directory works on a fresh volume, then breaks on every subsequent rebuild: a rebuilt
   container has leftover data but no `/etc/postgresql` config (never persisted), and the
   `postgresql-16` package's own postinst aborts (`Error: move_conffile: required configuration
   file .../postgresql.conf does not exist`) instead of treating it as a clean install:

   ```json
   [
     "source={{REPO_NAME}}-postgres-data,target=/var/lib/postgresql/16/main,type=volume",
     "source={{REPO_NAME}}-postgres-config,target=/etc/postgresql/16/main,type=volume"
   ]
   ```

   Fold it into `devcontainer.json` and rebuild:

   ```bash
   scripts/patch-json-array-if-absent.sh .devcontainer/devcontainer.json .mounts .devcontainer/project-mounts.local.json
   ```

2. Write the install/bootstrap block to a file, then append it to `post-create.sh` under a
   project-owned marker:

   ```bash
   cat > /tmp/postgres-install-block.sh <<'EOF'
   # --- Project: PostgreSQL ---
   if ! command -v pg_lsclusters >/dev/null 2>&1; then
     # PGDG's own apt repository — Ubuntu's own postgresql package lags several
     # major versions behind; pin the major version explicitly rather than
     # tracking whatever "postgresql" currently resolves to.
     sudo install -d /usr/share/postgresql-common/pgdg
     sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
     . /etc/os-release
     echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
       | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
     sudo apt-get update
     sudo apt-get install -y postgresql-16
   fi

   # The named volume above mounts empty on first create — chown it to the
   # postgres user before the cluster can write to it (same reason every CLI
   # Skill's install_cli() chowns its own config volume).
   sudo chown -R postgres:postgres /var/lib/postgresql/16/main

   # One-time password/database bootstrap, guarded by a marker file on the
   # data volume itself (survives rebuilds, since the volume does) — never
   # re-run once it has succeeded. Needs a running cluster to connect to;
   # post-create.sh runs once, so start it here rather than waiting for
   # post-start.sh — post-start.sh's own block (below) will find it already
   # online on every subsequent start and leave it alone.
   # sudo -u postgres <cmd> doesn't work here: this container's sudoers grant
   # is `(root) NOPASSWD: ALL`, not `(ALL)` — switching to a *different*
   # non-root user via `-u` isn't covered by that grant and prompts for a
   # password that never arrives, failing silently under a non-interactive
   # postCreateCommand. `sudo su postgres -c '<cmd>'` only needs the `(root)`
   # grant already present (sudo to root, then su to postgres, which root can
   # always do password-free).
   BOOTSTRAP_MARKER="/var/lib/postgresql/16/main/.bootstrapped"
   if [ ! -f "$BOOTSTRAP_MARKER" ]; then
     sudo pg_ctlcluster 16 main start
     sudo su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'devpassword';\""
     sudo su postgres -c "createdb '{{REPO_NAME}}'"
     sudo su postgres -c "touch '$BOOTSTRAP_MARKER'"
   fi
   EOF
   scripts/patch-if-absent.sh append .devcontainer/post-create.sh "# --- Project: PostgreSQL ---" /tmp/postgres-install-block.sh
   ```

3. Write the start/restart block to a separate file, then append it to `post-start.sh` under the
   same marker:

   ```bash
   cat > /tmp/postgres-start-block.sh <<'EOF'
   # --- Project: PostgreSQL ---
   # Idempotent: pg_ctlcluster start on an already-running cluster is a no-op
   # exit-0, but check status first anyway so a restart never depends on that
   # being true forever. Nothing here installs or bootstraps — that's
   # post-create.sh's job, which always runs first.
   if ! pg_lsclusters | grep -q '16 *main.*online'; then
     sudo pg_ctlcluster 16 main start
   fi
   EOF
   scripts/patch-if-absent.sh append .devcontainer/post-start.sh "# --- Project: PostgreSQL ---" /tmp/postgres-start-block.sh
   ```

Done when `pg_lsclusters` reports cluster `16 main` `online` after a rebuild and a restart, and
`psql -U postgres -h localhost -d {{REPO_NAME}}` connects with the bootstrapped password — check
this after a **second** rebuild too, not just the first: that's the one that actually exercises the
config-volume persistence fix above (the postinst failure this avoids only manifests once leftover
data meets a missing config on a rebuilt container, not on the first, truly-fresh one).

## Example: Redis

Simpler — a stock Ubuntu package, no third-party repository, no password/database bootstrap:

1. Add a data volume in `.devcontainer/project-mounts.local.json`:

   ```json
   ["source={{REPO_NAME}}-redis-data,target=/var/lib/redis,type=volume"]
   ```

   Fold it in and rebuild, same command as above.

2. Append the install block to `post-create.sh`:

   ```bash
   cat > /tmp/redis-install-block.sh <<'EOF'
   # --- Project: Redis ---
   if ! command -v redis-server >/dev/null 2>&1; then
     sudo apt-get update
     sudo apt-get install -y redis-server
   fi

   sudo chown -R redis:redis /var/lib/redis
   EOF
   scripts/patch-if-absent.sh append .devcontainer/post-create.sh "# --- Project: Redis ---" /tmp/redis-install-block.sh
   ```

3. Append the start/restart block to `post-start.sh`:

   ```bash
   cat > /tmp/redis-start-block.sh <<'EOF'
   # --- Project: Redis ---
   if ! pgrep -x redis-server >/dev/null 2>&1; then
     sudo service redis-server start
   fi
   EOF
   scripts/patch-if-absent.sh append .devcontainer/post-start.sh "# --- Project: Redis ---" /tmp/redis-start-block.sh
   ```

Done when `redis-cli ping` returns `PONG` after a rebuild and a restart.

## Notes for any other service

The pattern generalizes: a data volume declared in `project-mounts.local.json` (skip this if the
service is genuinely stateless), one apt-installable package (or another install mechanism if the
service isn't packaged for Ubuntu — the same `curl | sh`-into-`~/.local/bin` shape `install_cli()`
uses for CLI installs works here too), and **two** idempotent blocks under the same
`# --- Project: <name> ---` marker: a `post-create.sh` block that installs the package, fixes
data-directory ownership, and runs any one-time bootstrap (guarded by a marker file, since
`post-create.sh` re-runs on every rebuild) — and a `post-start.sh` block that only ensures the
service is running, nothing more. Keeping install/bootstrap out of `post-start.sh` entirely is what
avoids the firewall-ordering hazard described above. Nothing here is specific to PostgreSQL or
Redis — swap the package name, the data directory, and the start command for whatever the service
needs.

Two more things worth checking for a service PostgreSQL and Redis don't both exercise: if the
service keeps its config in a directory separate from its data directory (PostgreSQL does; many
don't), persist that too — a rebuilt container with leftover data but a missing config directory
can make a package's postinst script abort instead of treating it as a clean install. And if any
bootstrap step needs to run commands as a *different* non-root user, use `sudo su <user> -c
'<cmd>'`, not `sudo -u <user> <cmd>` — this container's sudoers grant is scoped to `(root)`, not
`(ALL)`, so `sudo -u` prompts for a password that never arrives under a non-interactive
`postCreateCommand`.
