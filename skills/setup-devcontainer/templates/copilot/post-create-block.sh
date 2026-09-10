# Fix ownership on the .copilot config volume mount, then install GitHub
# Copilot CLI via npm — a vendor-signed distribution channel (npm registry
# signatures), replacing the curl|bash installer. Extended here from Claude
# Code's pilot (#234) since that one held, then Codex's since that one held
# too.
#
# A version-pinning feature (on the old curl|bash installer) was already
# built here once and reverted five days later: pinning combined with
# Copilot's own background self-update crashed on startup ("Error auto
# updating: TypeError: Invalid Version: latest") — the literal string
# "latest" (this container's un-pinned default at the time) breaking that
# installer's own version-comparison code. Confirmed live: that specific
# class of crash doesn't reproduce here — npm always resolves an install to
# a concrete semver, never a literal "latest" string, and a version pinned
# via npm's own `@<version>` syntax holds cleanly across a fresh container
# start against a filesystem snapshot taken right after install, both with
# and without COPILOT_AUTO_UPDATE=false present. That env var (set
# unconditionally in the compose fragment, not just when pinned) stays as
# defensive insurance against the same underlying self-update instability,
# even though this test didn't need it to hold the pin.
#
# COPILOT_VERSION (from .env) defaults to "latest": unset or "latest"
# installs npm's own `latest` dist-tag; any other value pins an exact
# version via npm's own `@<version>` syntax.
#
# Auth: the installed `copilot` CLI picks up this container's GH_TOKEN
# automatically (falling back to OAuth/`gh auth token` if unset), so no
# separate login step is needed here.
chown_config_volume "$HOME/.copilot"
install_npm_cli "Copilot" "@github/copilot" "${COPILOT_VERSION:-latest}"
