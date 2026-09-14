# Research: Docker Hardened Images for `setup-devcontainer`'s base image

**Ticket:** ken-guru/skills#282 (part of the #281 Wayfinder map on `setup-devcontainer` hardening priorities)
**Scope:** the base-image question only — Docker Hardened Images (DHI), what it is, cost, free/OSS usability, and whether an Ubuntu-devcontainer-compatible variant exists. Network egress and filesystem/capability containment are explicitly out of scope (covered by sibling tickets under #281).

## What Docker Hardened Images actually is

Docker Hardened Images (DHI) is Docker Inc.'s curated catalog of "near-zero CVE, secure-by-default, minimal container images designed to serve as a trusted, verifiable upstream for modern software supply chains" ([docker.com/products/hardened-images](https://www.docker.com/products/hardened-images/)). Concretely, per Docker's own product page and docs:

- **Minimal, non-distroless-by-default images** built on two foundations only: **Alpine** (musl libc) and **Debian** (glibc) — [docker.com/products/hardened-images](https://www.docker.com/products/hardened-images/), confirmed by [docs.docker.com/dhi/migration/migrate-from-doi/](https://docs.docker.com/dhi/migration/migrate-from-doi/) ("Docker Hardened Images support both Alpine and Debian, so teams can choose the distribution that matches their existing environment"). Images are tagged with the distro/version, e.g. `-alpine3.22`, `-debian12`, `-debian13`.
- **Two variants per image**: a `-dev` tag (has a shell and a package manager, meant for the build/compile stage of a multi-stage Dockerfile) and a runtime tag with the `-dev` suffix dropped (no shell, no package manager, distroless-style, meant only to run the already-built artifact). Example cited in search results: `dhi.io/node:24-debian13-sfw-dev` for build, `dhi.io/node:24-debian13-sfw` (no `-dev`) for runtime; the same pattern applies to `dhi.io/python`.
- **Continuous rebuild-from-source** so CVE fixes land automatically when upstream patches are available, yielding the "near-zero CVE" claim.
- **Supply-chain attestation bundle** on every image: SBOM (Software Bill of Materials), SLSA Build Level 3 provenance, cryptographic signatures, and OpenVEX exploitability data (which CVEs are actually reachable, not just present) — "over 17 complete supply chain attestations" per image ([docker.com/products/hardened-images](https://www.docker.com/products/hardened-images/)).
- **Non-root execution by default** in the images themselves.
- Catalog covers 1000+ images: language runtimes (Python, Node.js, Go, Rust, Java — OpenJDK/Temurin/Corretto/Azul), databases (Postgres, MySQL, MongoDB, Redis, Valkey, ClickHouse, Elasticsearch, OpenSearch), infra components, and plain OS base layers (`alpine-base`, `debian-base`, `busybox`) — [github.com/docker-hardened-images/catalog](https://github.com/docker-hardened-images/catalog).
- **No GitHub CLI (`gh`) image** in the catalog. The catalog's development-tools category lists `maven`, `gradle`, `git`, `jenkins` — `git` is present, `gh` is not ([github.com/docker-hardened-images/catalog](https://github.com/docker-hardened-images/catalog)).

## Cost and free/OSS tier

As of **December 17, 2025**, Docker made the entire DHI catalog free:

> "The full Docker Hardened Images catalog is free and open source under the Apache 2.0 license. Any developer can pull and use hardened images from Docker Hub at no cost, with no usage restrictions or paywalled catalog access."
— [docker.com/products/hardened-images](https://www.docker.com/products/hardened-images/) FAQ

Docker's own press release confirms the free tier is explicitly aimed at individuals, not just enterprises:

> Available to "developers, maintainers, hobbyists, teams, governments, and organizations" ... "No subscription required, no usage restrictions, and no vendor lock-in."
— [docker.com/press-release/docker-makes-hardened-images-free-open-and-transparent-for-everyone](https://www.docker.com/press-release/docker-makes-hardened-images-free-open-and-transparent-for-everyone/)

Pricing tiers (per [docker.com/products/hardened-images](https://www.docker.com/products/hardened-images/)):

| Tier | Cost | What it adds |
|---|---|---|
| **DHI Community** | Free, Apache 2.0 | Full catalog, near-zero CVEs, SBOM, SLSA L3 provenance, OpenVEX data, signatures |
| **DHI Select** | Starting ~$5k/repo | FIPS/STIG compliance variants, <7-day SLA on critical CVE fixes, up to 5 customizations |
| **DHI Enterprise** | Contact sales | Unlimited customizations, Hardened System Packages repo access, full catalog, ELS add-on eligibility |
| **DHI ELS** (add-on, requires Enterprise) | — | +5 years of hardened updates past upstream EOL |

For a single-maintainer OSS "skills" repo, the free Community tier is the relevant one and covers everything this project would use (image pulls, SBOM/provenance, CVE data). One practical friction point: the docs show pulling from the dedicated `dhi.io` registry via `docker login dhi.io` ([docs.docker.com/dhi/how-to/search-evaluate/](https://docs.docker.com/dhi/how-to/search-evaluate/)) — i.e., even free usage appears to require an authenticated Docker Hub/Docker ID login rather than fully anonymous pulls, which is a small extra setup/credential-management step for CI or Codespaces builds (not a cost, but not zero-friction either). This is consistent with (but not identical to) Docker Hub's existing anonymous-pull rate limits.

## Ubuntu-devcontainer-compatible variant: does it exist?

**No.** DHI's base-OS foundations are Alpine and Debian only; Ubuntu is not one of the supported distros anywhere in Docker's own product page, docs, or the DHI catalog repo. This was checked directly:

- [docker.com/products/hardened-images](https://www.docker.com/products/hardened-images/): "Multi-distro compatible: Support both Alpine and Debian foundations."
- [docs.docker.com/dhi/migration/migrate-from-doi/](https://docs.docker.com/dhi/migration/migrate-from-doi/): "Docker Hardened Images support both Alpine and Debian."
- [github.com/docker-hardened-images/catalog](https://github.com/docker-hardened-images/catalog): base images are `alpine-base`, `debian-base`, `busybox` — no `ubuntu-base`.

This project's current Dockerfile (`skills/setup-devcontainer/templates/Dockerfile`) starts `FROM mcr.microsoft.com/devcontainers/base:ubuntu` — a Microsoft-maintained image, unrelated to and not covered by Docker's DHI catalog. Adopting DHI as the base would mean **abandoning the Microsoft devcontainers Ubuntu base entirely** and rebuilding the devcontainer on Debian (DHI's closer analog to Ubuntu, since it's also apt/dpkg-based), losing whatever devcontainer-specific tooling/conventions `mcr.microsoft.com/devcontainers/base:ubuntu` bundles (locale setup, non-root `vscode` user already pre-provisioned in some devcontainer base images, VS Code Server compatibility). A third-party practitioner article (Mathieu Benoit, ITNEXT) that attempts exactly this — using DHI as a devcontainer base — reportedly required extra manual steps such as installing `gzip` (needed by the devcontainer CLI to unpack the VS Code Server) and rebuilding the `ldconfig` cache for VS Code Server compatibility (found via search; the article itself returned HTTP 403 on direct fetch, so this detail is second-hand from search-result summaries, not independently verified against the primary text — flagged as lower-confidence).

Even setting Ubuntu aside, using DHI's Debian `-dev` variant as the *build stage* is plausible for this Dockerfile's needs (it has apt + a package manager at build time), but the *runtime* variant is deliberately distroless (no shell, no package manager) — that's incompatible with this project's actual runtime requirement, which is an interactive devcontainer shell where `apt-get` (nodesource setup script), `wget`/`curl`, and ongoing package installation remain available for the container's whole lifetime, not just a build stage. DHI's whole "dev vs. runtime" split is designed for compiled-artifact multi-stage builds (compile in `-dev`, ship in slim runtime) — a persistent interactive devcontainer doesn't fit that shape at all, since the "runtime" image the developer would actually live in is the minimal one with no package manager.

## Principles applicable without adopting the DHI product

These are usable on the current `mcr.microsoft.com/devcontainers/base:ubuntu` foundation regardless of the DHI decision:

1. **Digest pinning.** Replace the floating tag `FROM mcr.microsoft.com/devcontainers/base:ubuntu` with `FROM mcr.microsoft.com/devcontainers/base:ubuntu@sha256:<digest>`. Docker's own docs endorse this generally: "pulling an image using its digest ensures you retrieve exactly the same image that was originally built," preventing silent content drift and a class of supply-chain tampering — [docs.docker.com/dhi/core-concepts/digests/](https://docs.docker.com/dhi/core-concepts/digests/). Trade-off: automatic security patches from the upstream tag stop arriving; the digest needs a deliberate, periodic bump (e.g. via Dependabot/Renovate or a scheduled workflow), otherwise the base silently goes stale.
2. **Minimal-package discipline.** The Dockerfile already does most of this: `--no-install-recommends` on both `apt-get install` calls, and `rm -rf /var/lib/apt/lists/*` after each install to avoid shipping stale package indexes in the image layer. This is the same spirit as DHI's minimalism, achieved manually.
3. **Provenance/SBOM/attestation generation for the *built* image**, independent of what the base image provides — e.g. `docker buildx build --provenance=true --sbom=true` (BuildKit-native, applies to any base image) or a separate `docker scout` / `syft` SBOM generation step in CI. This gives the project's own supply-chain transparency without requiring the base image itself to originate from Docker's hardened catalog.
4. **Non-root runtime user** — already implemented (the Dockerfile creates and switches to `USER vscode` at UID/GID 1000), matching DHI's own non-root-by-default practice.
5. **Periodic CVE scanning of the built image** (`docker scout cves`, Trivy, Grype) as a substitute for DHI's continuous-rebuild guarantee — doesn't self-heal automatically, but surfaces the same class of problem for a maintainer to act on.

## Recommendation

**Adopt the principles; do not adopt the Docker Hardened Images product itself, at least not as the FROM base for this devcontainer.**

Reasoning:

- The blocking constraint is the Ubuntu-devcontainer requirement combined with a persistent, package-installable runtime. DHI has no Ubuntu foundation (Alpine/Debian only), and its Debian variants are split into a package-manager-having `-dev` stage and a distroless no-package-manager runtime stage — neither maps cleanly onto "one long-lived interactive container where `apt-get install`-style provisioning (Node via nodesource, `gh` via apt) needs to keep working, and a human/agent gets an actual shell with `bash`/`curl`/`wget` at any time." Forcing this into DHI's multi-stage compiled-artifact model would mean either living in the `-dev` image forever (defeating DHI's whole minimal/distroless value proposition — at that point it is just "Debian with extra Docker branding and attestations," not meaningfully more hardened than the current Ubuntu base for this specific use case) or reworking the devcontainer's fundamental design away from "shell you provision things into" — out of proportion to the problem.
- Cost is not the blocker — the Community tier is genuinely free, unrestricted, and explicitly pitched at hobbyists/individual OSS maintainers, so if a compatible variant existed this recommendation might differ.
- No GitHub CLI image exists in the catalog either, so `gh` would still need to be apt-installed by hand even inside a DHI Debian `-dev` container, which is exactly what the current Dockerfile already does on Ubuntu — no meaningful ceiling is being hit by staying off DHI for that piece.
- The real, achievable security wins right now are the general principles above (digest-pin the Microsoft base, keep the existing `--no-install-recommends`/apt-list-cleanup discipline, add BuildKit `--provenance`/`--sbom` generation in CI, periodic CVE scanning of the built image) — these capture most of DHI's practical value (immutability, transparency, minimalism) without discarding the Ubuntu/devcontainers-base foundation this skill is built around.
- Revisit if Docker ever ships an Ubuntu foundation in the DHI catalog, or if `setup-devcontainer`'s design changes toward a build/runtime split where a distroless runtime image would actually fit (neither is true today).

## Sources

- [docker.com/products/hardened-images](https://www.docker.com/products/hardened-images/) — product page, FAQ, pricing tiers
- [docker.com/press-release/docker-makes-hardened-images-free-open-and-transparent-for-everyone](https://www.docker.com/press-release/docker-makes-hardened-images-free-open-and-transparent-for-everyone/) — Dec 17, 2025 free-tier announcement
- [docs.docker.com/dhi/migration/migrate-from-doi/](https://docs.docker.com/dhi/migration/migrate-from-doi/) — Alpine/Debian-only distro support confirmation
- [docs.docker.com/dhi/how-to/search-evaluate/](https://docs.docker.com/dhi/how-to/search-evaluate/) — `docker login dhi.io` access step
- [docs.docker.com/dhi/core-concepts/digests/](https://docs.docker.com/dhi/core-concepts/digests/) — Docker's own digest-pinning guidance (general principle, base-image-agnostic)
- [github.com/docker-hardened-images/catalog](https://github.com/docker-hardened-images/catalog) — catalog contents: base images (`alpine-base`, `debian-base`, `busybox`), dev-tools list (no `gh`), no Ubuntu
- Mathieu Benoit, "Security Hardening of your Dev Containers with Docker Hardened Images (dhi.io)", ITNEXT (found via search; direct fetch returned HTTP 403, so quoted details are second-hand from search-result summaries and flagged lower-confidence): https://itnext.io/security-hardening-of-your-dev-containers-with-docker-hardened-images-dhi-io-2bfb5d299b7f
