#!/bin/bash
# Staged-install + handshake-verify + atomic-symlink-swap for an MCP
# server, part of the devcontainer-agentic-clis Feature. The manifest
# shape (mcp-servers.manifest.json) is fixed by this Skill; fill in its
# real values (package names, reviewed versions, reviewed integrity
# hashes) for your own project, marked TODO below.
#
# This Feature's own install.sh calls only `install` (the reviewed
# baseline, at build time). The `update` subcommand exists as a mechanism
# other Skills call into, not something this Feature schedules itself:
# devcontainer-cli-lifecycle (if installed) owns deciding WHEN an
# age-eligible update exists and calls `update <key> <target-version>`
# here to actually perform it, reusing this script's MCP-protocol-specific
# verify step rather than reimplementing it. Without devcontainer-cli-lifecycle
# installed, an MCP server simply stays pinned at its reviewed baseline
# until the next rebuild -- a safe default, not a missing feature.
#
# Usage: staged-install-handshake-atomic-swap.sh <install|update|health> <server-key> [target-version]
set -euo pipefail

# Copied from mcp-servers.manifest.example.json at install time; describes,
# per server key: the npm package name, the pinned "reviewed" version, a
# reviewed integrity hash for that version, the binary name to exec, and a
# minimum-release-age gate in days for auto-updates devcontainer-cli-lifecycle
# applies.
MANIFEST=${MCP_MANIFEST:-"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/mcp-servers.manifest.json"}

# Outside the repo checkout itself, so staged installs survive a container
# rebuild without polluting version control. $HOME here is the non-root
# user's home directory (this script only ever runs as that user, never as
# root -- unlike install.sh, which runs as root during the image build).
INSTALL_ROOT=${MCP_INSTALL_ROOT:-"$HOME/.local/share/devcontainer-agentic-clis-mcp"}

TIMEOUT_SECONDS=${MCP_TIMEOUT_SECONDS:-120}
LOG_DIR=$(mktemp -d "${TMPDIR:-/tmp}/mcp-install-logs.XXXXXX")

# Use an explicitly writable, isolated package-manager cache for staging
# installs. Never assume the ambient cache is writable or trustworthy.
NPM_CONFIG_CACHE=$(mktemp -d "${TMPDIR:-/tmp}/mcp-install-npm-cache.XXXXXX")
export NPM_CONFIG_CACHE
trap 'rm -rf "$LOG_DIR" "$NPM_CONFIG_CACHE"' EXIT

manifest_value() {
	local key=$1 field=$2
	node -e '
	  const value = process.argv[3]
	    .split(".")
	    .reduce((current, part) => current?.[part], require(process.argv[1]).servers[process.argv[2]]);
	  if (value === undefined) process.exitCode = 1;
	  else console.log(value);
	' "$MANIFEST" "$key" "$field"
}

active_root() {
	local key=$1
	readlink "$INSTALL_ROOT/$key/current" 2>/dev/null || return 1
}

# --- Verify step: a real protocol handshake, not "the file exists" -------

health_check_root() {
	local key=$1 root=$2 binary
	binary="$root/node_modules/.bin/$(manifest_value "$key" binary)"
	[ -x "$binary" ] || {
		echo "ERROR: $key executable is missing: $binary" >&2
		return 1
	}
	# Spawns the binary, sends a real MCP `initialize` request over stdio,
	# and exits 0 only once it sees a well-formed response on the matching
	# request id, then completes the handshake with
	# `notifications/initialized`. See mcp-handshake-verify.mjs.
	node "$(dirname "${BASH_SOURCE[0]}")/mcp-handshake-verify.mjs" "$binary"
}

health_check() {
	local key=$1 root
	root=$(active_root "$key") || {
		echo "ERROR: $key has no active installation" >&2
		return 1
	}
	health_check_root "$key" "$root"
}

# --- Stage step: install into a private, uniquely-named directory --------

stage_install() {
	local key=$1 version=$2 package key_root staging installed
	package=$(manifest_value "$key" package)
	key_root="$INSTALL_ROOT/$key"
	mkdir -p "$key_root/releases"
	staging=$(mktemp -d "$key_root/.staging.XXXXXX")

	if ! timeout "$TIMEOUT_SECONDS" npm install --prefix "$staging" "$package@$version" \
		>"$LOG_DIR/$key.install-$version.log" 2>&1; then
		rm -rf "$staging"
		return 1
	fi

	installed=$(node -e "console.log(require(process.argv[1]).version)" \
		"$staging/node_modules/$package/package.json" 2>/dev/null || true)
	if [ "$installed" != "$version" ] ||
		! health_check_root "$key" "$staging" >>"$LOG_DIR/$key.install-$version.log" 2>&1; then
		rm -rf "$staging"
		return 1
	fi

	local release_root
	release_root="$key_root/releases/$version-$(basename "$staging")"
	mv "$staging" "$release_root"
	printf '%s\n' "$release_root"
}

# --- Atomic-swap step: rename, never overwrite in place -------------------

activate_root() {
	local key=$1 root=$2 key_root temporary_link
	key_root="$INSTALL_ROOT/$key"
	temporary_link="$key_root/.current.$$"
	ln -s "$root" "$temporary_link"
	# `rename` on the same filesystem is atomic: any concurrent reader of
	# `current` sees either the old target or the new one, never a
	# half-written link.
	node -e 'require("node:fs").renameSync(process.argv[1], process.argv[2])' \
		"$temporary_link" "$key_root/current"
}

# --- Reviewed-baseline install (rebuild time) ------------------------------

install_baseline() {
	local key=$1 version root expected actual package
	version=$(manifest_value "$key" version)
	package=$(manifest_value "$key" package)
	expected=$(manifest_value "$key" reviewedIntegrity)
	# TODO: verify the candidate's published integrity hash against your
	# reviewed value BEFORE installing. This is the actual supply-chain
	# guard; skipping it turns "pin a reviewed version" into "pin a
	# version number", which a compromised republish can still spoof.
	actual=$(timeout "$TIMEOUT_SECONDS" npm view "$package@$version" dist.integrity 2>/dev/null) || {
		echo "ERROR: could not fetch integrity for $package@$version" >&2
		return 1
	}
	[ "$actual" = "$expected" ] || {
		echo "ERROR: reviewed integrity did not match $package $version" >&2
		return 1
	}

	root=$(stage_install "$key" "$version") || {
		echo "ERROR: failed to stage $key $version" >&2
		return 1
	}
	activate_root "$key" "$root"
	health_check "$key"
	echo "Installed $key $version"
}

# --- Update to a caller-supplied target (startup time) ---------------------
#
# Deliberately does NOT decide what `target` should be -- that decision
# (is a newer version available, has it aged past the minimum-release-age
# gate, should uncertainty about its age hold the update) belongs to
# whatever calls this, typically devcontainer-cli-lifecycle's own age-gate
# check. This script's job stops at "given a specific target version,
# install it safely and verify it before making it active."

update_server() {
	local key=$1 target=$2 before

	before=$(node -e "console.log(require(process.argv[1]).version)" \
		"$(active_root "$key")/node_modules/$(manifest_value "$key" package)/package.json" 2>/dev/null || true)

	if [ -z "$before" ] || ! health_check "$key" >"$LOG_DIR/$key.before-health.log" 2>&1; then
		echo "WARN $key is missing or unhealthy; rebuild to restore the reviewed baseline"
		return 0
	fi

	local candidate_root
	if candidate_root=$(stage_install "$key" "$target"); then
		activate_root "$key" "$candidate_root"
		echo "Updated $key $before -> $target"
	else
		echo "WARN $key retained $before after $target failed install or health; active install unchanged"
	fi
}

case "${1:-}" in
	install) install_baseline "${2:?server key required}" ;;
	update) update_server "${2:?server key required}" "${3:?target version required}" ;;
	health) health_check "${2:?server key required}" ;;
	*)
		echo "Usage: $0 <install|update|health> <server-key> [target-version]" >&2
		exit 2
		;;
esac
