---
name: devcontainer-scaffold
description: "Scaffold a barebones devcontainer for agentic coding from scratch: Dockerfile, docker-compose.yml, and devcontainer.json skeletons with build-ordering discipline, a non-root user, and narrow capability scoping. Use when creating a new devcontainer for a project that doesn't have one yet, or starting the devcontainer-setup Skill Suite's from-scratch path. Not for adding a firewall, agentic CLIs, or other capabilities to an EXISTING devcontainer this suite didn't create — see the sibling devcontainer-<aspect> Add-on Skills for that."
---

# devcontainer-scaffold

The Scaffolding Skill of the devcontainer-setup Skill Suite. It owns the
Target Devcontainer's build definition from scratch — the one member that
doesn't retrofit, because there's nothing to detect yet. Every sibling
Add-on Skill (devcontainer-firewall, devcontainer-agentic-clis,
devcontainer-cli-lifecycle, devcontainer-git-auth, devcontainer-dx-niceties)
installs as a [devcontainer Feature](https://containers.dev/implementors/features/)
layered on top of what this Skill produces, or onto any other pre-existing
devcontainer — this Skill's own job stops at producing a correct, minimal
foundation, not at anticipating which Features will land on it.

Copy the four templates in [`templates/`](templates/) into your project's
`.devcontainer/` directory (`Dockerfile`, `docker-compose.yml`,
`devcontainer.json`, `.env.example`) and fill in every placeholder before
building. Add `.devcontainer/.env` to your project's `.gitignore` — the
compose skeleton's `env_file` stanza reads it for secrets (a Skill that
needs one, like `devcontainer-git-auth`'s `GH_TOKEN`, documents its own
line in `.env.example`; this Skill doesn't need any itself).

## 1. Pin the base image, don't float it

`FROM your-registry/your-base-image:SPECIFIC-VERSION-TAG` in
[`Dockerfile.skeleton`](templates/Dockerfile.skeleton) must name an exact
release codename, never a floating "latest"-style alias. A floating tag
can drift past a boundary where a Feature you install later — a
browser-automation vendor's binary distribution is the classic case — has
no build published for the new codename yet on every architecture. An
install step that worked yesterday then fails today with no code change on
your side. Pin to the codename you've verified against your dependencies'
own release matrices, and re-verify deliberately when you choose to move
the pin; don't let it move on its own between rebuilds.

## 2. Build-time is the only place with no firewall yet

If a firewall Feature (devcontainer-firewall) ever gets installed, it does
not exist yet during `docker build`, and it does not exist yet during
whatever lifecycle hook runs before the firewall's own init script. That
gives every setup step exactly two safe places to reach the open internet:
build time, before a firewall is even a concept, or runtime, after a
firewall exists, with the destination host already on its allowlist. There
is no safe third option where a step "temporarily" bypasses a firewall that
might get installed after this Skill runs.

Install your OS packages in the `RUN your-package-manager update && ...`
block of [`Dockerfile.skeleton`](templates/Dockerfile.skeleton). Keep a
general-purpose scripting runtime installed even if nothing in your own
repository's scripts calls it, if an AI coding agent is a real consumer of
ad hoc inline scripting mid-session — a dependency audit that only greps
your own scripts will miss that consumer entirely, since its usage is by
design never committed anywhere. Document the reasoning inline where the
package is installed, so a later cleanup pass doesn't remove it for looking
unused.

## 3. Create the non-root user, and pre-own every path a volume will mount

A named volume's first mount copies ownership from whatever already exists
at that exact path in the image. If nothing exists there, Docker creates it
as root on first mount, regardless of which user the container otherwise
runs as — the symptom is usually indirect, a CLI crashing with `EACCES`
writing its own config on first run, which reads like a tool bug until you
check who owns the mount point.

[`Dockerfile.skeleton`](templates/Dockerfile.skeleton) creates the
non-root user and `mkdir`+`chown`s every path a home-directory named volume
in `docker-compose.skeleton.yml` mounts into. Keep the two files' username
and paths in sync — every home-directory mount target in the compose file
needs a matching path in the Dockerfile's `mkdir` line, and vice versa.

**This does not cover a named volume nested *inside* the `/workspace` bind
mount** (a build-output or dependency-cache directory some later Feature
might want cached across rebuilds) — that's a fundamentally different case.
Because `/workspace` is itself a bind mount from the host, Docker resolves
a nested volume's first-mount ownership against the live host directory at
container *start*, not against anything baked into the image at build
time. No Dockerfile change fixes this; the chown has to happen at runtime,
in a postCreate/postStart hook, after both mounts are live. Prefer pointing
whatever tool wants the cache at a directory *outside* `/workspace`
instead, if it supports overriding its output location — that sidesteps
the ownership question entirely rather than working around it. If nesting
is unavoidable, [`docker-compose.skeleton.yml`](templates/docker-compose.skeleton.yml)
carries the pattern commented out, with the runtime-chown requirement
called out explicitly.

## 4. Compose: name the project, and leave capabilities to whoever needs them

[`docker-compose.skeleton.yml`](templates/docker-compose.skeleton.yml)
sets an explicit `name:` at the top. Compose otherwise defaults the
project name to the basename of the directory holding this file —
`.devcontainer` for every project that follows this suite's own
recommended layout — so two unrelated projects on the same machine
collide in the same default namespace, and a `docker compose down -v`
queued for one can hit the other's containers and volumes.

This skeleton ships with **no capability grants** (`cap_add`/`security_opt`)
of its own. A capability like `NET_ADMIN`/`NET_RAW` (devcontainer-firewall's
netfilter management) or `SYS_ADMIN` (a nested process-sandboxing tool) is
needed by whichever Feature actually requires it, not by this Skill, which
has no way to know in advance which Features will ever be installed —
devcontainer Features declare their own `capAdd`/`securityOpt`, and the
devcontainer CLI merges them into the final container automatically. Never
reach for `privileged: true` as a substitute in your own edits, here or
anywhere in this suite: it grants every capability and device the kernel
has, not just the two or three a specific tool actually touches, and
widens the blast radius of anything that gets compromised.

Named volumes for credentials and other persistent state (tool config, SSH
keys, shell history) each get their own volume — one per independent
concern, so rotating one thing never has to touch another. Resist folding
multiple concerns into one shared volume.

The `env_file` stanza at the top of the `devcontainer` service reads
`.devcontainer/.env` (gitignored) for secrets, the same "no capabilities
of its own" logic applied to environment variables: this skeleton doesn't
know in advance which Skill will need one. Copy
[`templates/.env.example`](templates/.env.example) to
`.devcontainer/.env.example` — a Skill that needs a secret documents its
own key there.

## 5. devcontainer.json ties it together — and needs no special wiring for later Features

[`devcontainer.json.skeleton`](templates/devcontainer.json.skeleton)
references the Dockerfile and compose file, sets `remoteUser` to the
non-root user created in step 3, and ships an empty `"features": {}`
block as a visible placeholder — not because anything needs to be
pre-wired there, but so a later `npx skills@latest add --skill
devcontainer-firewall` (or a manual edit) has an obvious, already-present
place to add its entry.

Nothing else needs preparing. The devcontainer Features spec guarantees
that any Feature's own lifecycle commands run *before* whatever this
skeleton's own `postCreateCommand`/`postStartCommand` declares, and every
Feature's `capAdd`/`securityOpt`/`mounts` get concatenated automatically
across every Feature in play — composition is the spec's job, not
something this Skill has to engineer by hand.

## Verification

Build the image and bring the container up from a clean state (no volumes
already populated by a prior run, so first-mount ownership behavior
actually gets tested). Exec in and confirm the non-root user owns every
path listed in step 3, under both a login shell (`bash -l`) and a
non-login one — the two can disagree on `PATH` and other environment
setup in ways plain `docker exec` testing alone won't catch. This Skill's
own scope ends here; once an Add-on Skill installs as a Feature, that
Skill's own SKILL.md owns verifying its specific addition.
