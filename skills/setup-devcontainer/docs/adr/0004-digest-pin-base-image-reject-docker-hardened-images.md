# ADR-0004: Digest-pin the base image; reject Docker Hardened Images

**Status:** Accepted
**Date:** 2026-09-14

## Context

A Wayfinder map (issue #281) set out to decide what `skills/setup-devcontainer` should adopt from
recent industry hardening guidance, starting with Supply-chain Hardening: base-image provenance,
pinning, and CVE surface. The prompting reference was Docker Hardened Images (DHI) — Docker's
catalog of minimal, continuously-rebuilt, attested base images, made fully free (Apache 2.0, no
usage restrictions) as of December 2025 and explicitly pitched at individual/OSS maintainers, not
just enterprises.

Research (issue #282) established that DHI's base-OS foundations are Alpine and Debian only — no
Ubuntu — and that its runtime variant is deliberately distroless (no shell, no package manager),
built for a compile-then-ship multi-stage pattern. This project's Dockerfile
(`skills/setup-devcontainer/templates/Dockerfile`) currently starts `FROM
mcr.microsoft.com/devcontainers/base:ubuntu` and needs to stay a persistent, interactive shell for
the container's whole life: `apt-get`-based provisioning (Node.js via nodesource, GitHub CLI via
apt) keeps running well after "build" time, and a human or agent expects a real shell with
`bash`/`curl`/`wget` available at any point, not just during image construction. DHI has no image
in its catalog for the GitHub CLI either, so adopting it would not even remove that one manual
apt-install step.

## Decision

Reject Docker Hardened Images as this project's base image. Keep
`mcr.microsoft.com/devcontainers/base:ubuntu`, but digest-pin it
(`FROM mcr.microsoft.com/devcontainers/base:ubuntu@sha256:<digest>`) instead of tracking the
floating `ubuntu` tag, so the base is byte-for-byte reproducible and immune to silent upstream
content drift.

Adopt DHI's underlying supply-chain principles on top of the existing Ubuntu foundation rather than
adopting the product itself:

- **Digest pinning** (this decision's headline change).
- **Minimal-package discipline** — already partly present (`--no-install-recommends`,
  `rm -rf /var/lib/apt/lists/*` after each `apt-get install`); kept as-is, no new work.
- **CVE visibility**: a new, weekly-scheduled GitHub Actions job builds
  `skills/setup-devcontainer/templates/Dockerfile` and runs a CVE scan (Trivy) against it. This
  repo's existing CI never runs `docker build` on the template at all today — it only exercises the
  generated lifecycle scripts — so this is new surface, not an extension of an existing job.
  Scheduled rather than (or in addition to) per-PR, because a per-PR build only catches CVEs
  introduced by a Dockerfile edit itself; it would miss ambient CVE disclosure against an
  already-pinned, unchanged digest over time — exactly the blind spot digest-pinning otherwise
  reintroduces.
- **Digest freshness**: a new `docker`-ecosystem entry in a new `.github/dependabot.yml`, scoped to
  `skills/setup-devcontainer/templates`, so Dependabot opens a PR when a new digest is published for
  the pinned tag. Chosen over a hand-rolled scheduled workflow: Dependabot version updates are a
  native, zero-maintenance GitHub feature, and Dependabot security updates are already confirmed
  active repository-wide, with prior Dependabot PRs already landing and being reviewed in this repo
  (precedent: past `dependabot/npm_and_yarn/...` branches).
- **Non-root runtime user** — already implemented (`USER vscode`, UID/GID 1000); no change needed.

Priority: lowest of the three Supply-chain Hardening / Blast-radius Containment decision tracks on
the parent map. Digest pinning and a weekly CVE-scan job defend against slow-burn supply-chain
drift; they don't contain a misbehaving agent process the way the still-open network-egress and
filesystem/capability decisions do.

This decision produces no implementation itself — per the parent map's Notes, this Wayfinder effort
stops at the decision. A follow-up effort implements the digest pin, the CI job, and the Dependabot
config.

## Alternatives considered

### A) Adopt Docker Hardened Images as the base (rejected)

- Pro: near-zero CVE claim, continuous rebuild-from-source, SBOM/SLSA-L3 provenance/signatures
  bundled per image, free and unrestricted for this project's use case (cost was never the
  blocker).
- Con: no Ubuntu foundation exists in the catalog (Alpine/Debian only); its runtime variant is
  distroless (no shell, no package manager), incompatible with a devcontainer that needs live
  `apt-get` provisioning for its entire lifetime, not just a build stage. Forcing this in would mean
  either living permanently in DHI's `-dev` image (defeating the product's own minimal/distroless
  value proposition — at that point it's just "Debian with extra branding," not meaningfully more
  hardened than the current base for this use case) or redesigning the devcontainer's fundamental
  shape. No GitHub CLI image exists in the catalog either, so `gh` would still need manual
  apt-installing regardless.

### B) Keep the base image exactly as-is, tag and all — no pin (rejected)

- Pro: zero effort; automatic security patches arrive with every image rebuild upstream.
- Con: a floating tag is not reproducible — the same `Dockerfile` can silently pull different bits
  on different days, which is itself a supply-chain risk (undetectable content drift, no way to
  audit exactly what was built when). This is the specific risk digest pinning exists to close.

### C) Digest-pin, but skip CI scanning and Dependabot — document only (rejected)

- Pro: smallest possible change; avoids adding new CI surface to a repo that has none today for the
  Dockerfile.
- Con: a pinned digest that nothing ever refreshes goes stale indefinitely — CVEs disclosed against
  the frozen digest would never surface to a maintainer, and pinning without a refresh mechanism
  trades one risk (untracked drift) for another (untracked staleness) rather than closing it.

## Consequences

- `skills/setup-devcontainer/templates/Dockerfile`'s `FROM` line changes from a floating tag to a
  pinned digest — a follow-up implementation effort resolves the digest to pin and adds a comment
  noting how/when to refresh it manually if Dependabot is ever paused.
- A new GitHub Actions workflow (or a new job in an existing one) builds the template Dockerfile
  weekly and runs Trivy against it — new CI surface for this repo, scoped to reading the built
  image, not to any consuming repo's own build.
- A new `.github/dependabot.yml` is created (none exists today) with at least a `docker` ecosystem
  entry for `skills/setup-devcontainer/templates`; existing Dependabot security-update behavior for
  other ecosystems is unaffected.
- No change to `skills/setup-devcontainer/templates/Dockerfile`'s installed packages, its
  `--no-install-recommends`/apt-cleanup discipline, or the non-root `vscode` user.
