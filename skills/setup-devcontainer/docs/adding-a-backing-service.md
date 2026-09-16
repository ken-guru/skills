# Adding a backing service

For a project that needs a backing service (a database, a cache) running while it develops inside
the Shared Container. Reintroducing Docker Compose (a sibling `db` service, say) throws away every
assumption the CLI companion skills and the firewall's `runArgs`-based Capability Seam model make
about there being exactly one container — so instead, install the service *inside* the Shared
Container itself, the same way a CLI Skill installs its own CLI: imperatively, from an idempotent,
project-owned lifecycle-script block, never baked into the base-owned `Dockerfile`.

This isn't a new mechanism. Every piece below — `patch-if-absent.sh`, a marker-keyed
`post-start.sh` block, a `project-mounts.local.json` volume entry — already exists for other
reasons; a backing service is just another **Project-Owned Block** (see [CONTEXT.md](../CONTEXT.md))
using them. Two worked examples follow: PostgreSQL (more involved — a third-party apt repository,
password/database bootstrap) and Redis (simpler — stock Ubuntu package, no bootstrap). Both use the
same shape:

1. Declare a named volume for the service's data directory in `project-mounts.local.json`, fold it
   into `devcontainer.json`, rebuild.
2. Append one idempotent block to `post-start.sh`, under a project-owned marker, that installs the
   service on first run and (re)starts it on every run.

## Example: PostgreSQL

1. Add a data volume in `.devcontainer/project-mounts.local.json`:

   ```json
   ["source={{REPO_NAME}}-postgres-data,target=/var/lib/postgresql/16/main,type=volume"]
   ```

   Fold it into `devcontainer.json` and rebuild:

   ```bash
   scripts/patch-json-array-if-absent.sh .devcontainer/devcontainer.json .mounts .devcontainer/project-mounts.local.json
   ```

2. Write the service block to a file, then append it to `post-start.sh` under a project-owned
   marker:

   ```bash
   cat > /tmp/postgres-block.sh <<'EOF'
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

   # Idempotent: pg_ctlcluster start on an already-running cluster is a no-op
   # exit-0, but check status first anyway so a restart never depends on that
   # being true forever.
   if ! pg_lsclusters | grep -q '16 *main.*online'; then
     sudo pg_ctlcluster 16 main start
   fi

   # One-time password/database bootstrap, guarded by a marker file on the
   # data volume itself (survives rebuilds, since the volume does) — never
   # re-run once it has succeeded.
   BOOTSTRAP_MARKER="/var/lib/postgresql/16/main/.bootstrapped"
   if [ ! -f "$BOOTSTRAP_MARKER" ]; then
     sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'devpassword';"
     sudo -u postgres createdb "{{REPO_NAME}}"
     sudo -u postgres touch "$BOOTSTRAP_MARKER"
   fi
   EOF
   scripts/patch-if-absent.sh append .devcontainer/post-start.sh "# --- Project: PostgreSQL ---" /tmp/postgres-block.sh
   ```

Done when `pg_lsclusters` reports cluster `16 main` `online` after a rebuild and a restart, and
`psql -U postgres -h localhost -d {{REPO_NAME}}` connects with the bootstrapped password.

## Example: Redis

Simpler — a stock Ubuntu package, no third-party repository, no password/database bootstrap:

1. Add a data volume in `.devcontainer/project-mounts.local.json`:

   ```json
   ["source={{REPO_NAME}}-redis-data,target=/var/lib/redis,type=volume"]
   ```

   Fold it in and rebuild, same command as above.

2. Append the service block to `post-start.sh`:

   ```bash
   cat > /tmp/redis-block.sh <<'EOF'
   # --- Project: Redis ---
   if ! command -v redis-server >/dev/null 2>&1; then
     sudo apt-get update
     sudo apt-get install -y redis-server
   fi

   sudo chown -R redis:redis /var/lib/redis

   if ! pgrep -x redis-server >/dev/null 2>&1; then
     sudo service redis-server start
   fi
   EOF
   scripts/patch-if-absent.sh append .devcontainer/post-start.sh "# --- Project: Redis ---" /tmp/redis-block.sh
   ```

Done when `redis-cli ping` returns `PONG` after a rebuild and a restart.

## Notes for any other service

The pattern generalizes: a data volume declared in `project-mounts.local.json` (skip this if the
service is genuinely stateless), one apt-installable package (or another install mechanism if the
service isn't packaged for Ubuntu — the same `curl | sh`-into-`~/.local/bin` shape `install_cli()`
uses for CLI installs works here too), and one idempotent `post-start.sh` block under its own
`# --- Project: <name> ---` marker that installs on first run, fixes data-directory ownership, and
starts or restarts the service every run. Nothing here is specific to PostgreSQL or Redis — swap
the package name, the data directory, and the start command for whatever the service needs.
