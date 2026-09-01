# Research: sharing a common base layer across Tool Containers

## Question

Issue [#109](https://github.com/ken-guru/skills/issues/109) is restructuring `setup-devcontainer`'s single **Shared Container** (one `devcontainer.json` + `post-create.sh` with per-tool bash blocks appended, see `skills/setup-devcontainer/templates/devcontainer.baseline.json`, `templates/post-create-baseline.sh`, `templates/post-create-codex-block.sh`, `templates/post-create-antigravity-block.sh`) into 4 isolated **Tool Containers** — one each for Claude Code, Codex, Antigravity, and Copilot CLIs — so that updating one tool's install logic doesn't require touching or rebuilding the others.

[#111](https://github.com/ken-guru/skills/issues/111) already settled how the 4 Tool Containers run *concurrently* against the same repo checkout: **Docker Compose**. One root `docker-compose.yml` defines one service per Tool Container, all bind-mounting the same repo root (so `.git` stays visible to every container); each tool then gets a thin `.devcontainer/<tool>/devcontainer.json` that names its compose service via `"service": "<tool>"` and sets `"shutdownAction": "none"`, and the four are opened via VS Code's File > New Window + Reopen in Container, one tool per window. That research write-up ([research/vscode-concurrent-devcontainers.md](https://github.com/ken-guru/skills/blob/research/vscode-concurrent-devcontainers/research/vscode-concurrent-devcontainers.md)) flags a UID/GID-drift caveat: because all 4 containers bind-mount the *same* workspace, if they're built independently from different base images or at different times, "UID drift becomes a source of 'works in one container, permission-denied in the other' bugs on the exact same file" — and it argues for "one consistent base image with identical `remoteUser`/UID configuration" across all Tool Containers as the fix.

This ticket's question: **given that constraint, which mechanism should carry the shared base layer (Node, gh CLI, base user/UID setup) across the 4 Tool Container devcontainer definitions without duplicating install logic 4 times** — devcontainer Features (A), a shared base Dockerfile/multi-stage build (B), or shared shell scripts (C)?

## Findings

### A. devcontainer Features are applied per-container-build, not deduped across sibling containers

The Features spec is unambiguous that Feature install scripts execute during each container's own image build:

> "The `install.sh` script for each Feature should be executed as `root` during a container image build." — [containers.dev/implementors/features](https://containers.dev/implementors/features/)

> "Each Feature script executes as its own layer to aid in caching and rebuilding." — same source

This is a *per-build* caching mechanism (it helps `docker build` skip re-running an unchanged Feature's script on a rebuild of the *same* image), not a *cross-image* sharing mechanism. The spec describes no way for two independently-built images — e.g. Claude Code's Tool Container and Codex's Tool Container — to share the layer produced by installing, say, `ghcr.io/devcontainers/features/node:1`, even though both declare the identical Feature at the identical version. Each of the 4 `devcontainer.json` files declaring the same Node/gh-CLI Features would independently re-run those Features' install scripts inside its own image build. Practically: 4x the apt/npm network fetches, 4x the install time on every rebuild-from-scratch, and 4 separately-produced layers that Docker's content-addressable store has no reason to consider identical (they're not byte-identical layers from a shared base — they're 4 independent RUN-script outputs, each keyed to its own build's cache lineage).

Features remain attractive for genuinely per-tool concerns (e.g. a Claude-Code-specific Feature installing only the Claude Code CLI) but do not solve the "install Node/gh-CLI/base-user setup once for all 4" problem.

### B. A shared, separately-built base image referenced by `FROM` in N sibling Dockerfiles *does* dedupe on disk and in the build/pull cache — this is a distinct, well-established mechanism, separate from single-Dockerfile multi-stage builds

Two different things needed disambiguating here, per the task's own framing:

**1. Multi-stage builds within one Dockerfile** (`FROM <earlier-stage> AS <name>`) is the mechanism Docker's official docs describe:

> "You can pick up where a previous stage left off by referring to it when using the `FROM` directive." — [docs.docker.com/build/building/multi-stage](https://docs.docker.com/build/building/multi-stage/)

This only applies to stages inside a single Dockerfile compiled by a single `docker build` invocation — it doesn't by itself say anything about sharing a base across *separate* Dockerfiles/images. Docker's multi-stage docs page is explicitly scoped to that single-Dockerfile case and doesn't address cross-Dockerfile sharing at all.

**2. A shared base image built once and referenced by `FROM <tag>` in N separate Dockerfiles** is the actually-relevant mechanism for 4 Tool Container Dockerfiles, and Docker's storage/layering docs confirm it works as hoped — this is ordinary image-layer deduplication, not a multi-stage-build feature:

> "Shared image layers are only stored once in `/var/lib/docker/` and are also shared when pushing and pulling an image to an image registry." — [docs.docker.com/storage/storagedriver](https://docs.docker.com/storage/storagedriver/)

That page's worked example is directly on point: given `acme/my-base-image:1.0` (2 layers) and `acme/my-final-image:1.0` built `FROM` it (4 layers total), "the first 2 layers in both images share identical cryptographic IDs" — i.e. Docker's content-addressable layer store recognizes the two images share a lineage and stores/transfers the common layers exactly once.

> "This is beneficial because it allows layers to be reused between images... This will make builds faster and reduce the amount of storage and bandwidth required to distribute the images." — [docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers](https://docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers/)

**Caveat / precondition** (matches the task's framing exactly): this dedup only holds if the base image is built and tagged *once*, and every derived Dockerfile references that *exact* tag (e.g. `FROM skills-tool-container-base:latest` resolving to the same image ID in every daemon/build context that has pulled or built it). If instead each of the 4 tool Dockerfiles independently re-ran the equivalent `apt-get install nodejs gh` commands without a common `FROM`, there would be no shared lineage and no dedup — identical *content* in two layers built by two different `RUN` instructions does not automatically collapse into one layer purely by coincidence of content, in ordinary (non-BuildKit-cache-mount) builds; sharing comes from a shared *ancestor image*, not from Docker noticing coincidentally-identical output. So: B works, but only through "build the base once, `FROM` it everywhere" — not through "each Dockerfile installs the same things and Docker figures it out."

This directly resolves the #111 UID/GID-drift caveat too: if the base image itself bakes in the `remoteUser`/UID/GID scheme (creating the same `vscode` user with the same UID/GID once, in the shared base), all 4 derived images inherit an *identical* user/UID definition by construction — there's no way for them to drift, because they're not 4 independent re-implementations of "create a vscode user," they're 4 images stacked on the one base layer that did it once.

### C. Shared shell scripts only dedupe post-create-time commands, not image-build-time state

Both existing per-tool blocks (`post-create-codex-block.sh`, `post-create-antigravity-block.sh`) already run at `postCreateCommand` time — i.e. after the container has been created from its already-built image. A shared script (`post-create-base.sh`) sourced or appended in each Tool Container's own post-create step would successfully dedupe *commands run after the container starts* (e.g. `git config --global user.email`, ownership fixups on a mounted volume). But it cannot dedupe anything that needs to be baked into the image itself before the container exists — package installs via `apt-get`, the Node/gh-CLI binaries in `PATH`, or (crucially for the #111 caveat) the actual creation of the `remoteUser` with a specific UID/GID, since that user needs to exist for the container's entrypoint/volume-mount permissions to resolve correctly at container-start, not after. Running `useradd`/`chown` logic identically in 4 post-create scripts is strictly weaker than baking one UID/GID definition into a shared base image: it's duplicated logic (violates the "don't duplicate 4 times" goal) that must additionally stay byte-for-byte synchronized across 4 files to avoid exactly the UID drift #111 warns about, whereas a shared base image makes drift structurally impossible.

### How B reconciles with the #111 Compose structure

The devcontainer spec confirms `dockerComposeFile`+`service` delegates image building entirely to the named Compose service's own `build` config — the devcontainer.json's own `image`/`dockerfile` properties aren't part of that path:

> "It is important to note that the `image` and `dockerfile` properties are not needed since Docker Compose supports them natively in the format." — [containers.dev/implementors/spec](https://containers.dev/implementors/spec/)

> "`service`: declares the **main** container that will be used for all other operations" — same source

And the property reference confirms `dockerComposeFile` and `service` are exactly the pairing #111 already prescribed:

> "`dockerComposeFile`: Path or an ordered list of paths to Docker Compose files relative to the `devcontainer.json` file." / "`service`: The name of the service `devcontainer.json` supporting services / tools should connect to once running." — [containers.dev/implementors/json_reference](https://containers.dev/implementors/json_reference/)

So each thin per-tool `devcontainer.json` stays exactly as #111 specified (`dockerComposeFile` + `service` + `shutdownAction: none`), and the *actual* build instructions live in Compose's `build` key on each service, which supports per-service `context`, `dockerfile`, and `target` sub-keys:

> "`dockerfile` sets an alternate Dockerfile. A relative path is resolved from the build context." / "`context` defines either a path to a directory containing a Dockerfile, or a URL to a Git repository." / "`target` defines the stage to build as defined inside a multi-stage `Dockerfile`." — [docs.docker.com/reference/compose-file/build](https://docs.docker.com/reference/compose-file/build/)

This means each Tool Container's Compose service can point `build.dockerfile` at its own small per-tool Dockerfile (e.g. `.devcontainer/codex/Dockerfile`) whose first line is `FROM skills-tool-container-base:latest` — and per the layer-sharing findings above, all 4 services' images will share that base's layers on disk once the base image has been built and tagged. Compose's own docs don't add an extra cross-service caching guarantee beyond ordinary Docker layer/cache behavior (`cache_from`/`cache_to` exist for *registry*-backed cache sharing, e.g. in CI, but aren't required for local dev — ordinary local image-layer sharing already covers the "shared base tag, used by 4 sibling Dockerfiles" case): "`cache_from` defines a list of sources the image builder should use for cache resolution" / "`cache_to` defines a list of export locations to be used to share build cache with future builds" ([docs.docker.com/reference/compose-file/build](https://docs.docker.com/reference/compose-file/build/)). Nothing about `docker compose build` changes the underlying "sibling Dockerfiles `FROM` the same tag get real layer sharing" mechanism — Compose is just orchestrating N independent `docker build` calls, each of which benefits from that mechanism on its own.

The base image itself needs to be built by something outside the 4 devcontainer.json flows — there's no tool-agnostic 5th "Tool Container" a person opens — so it should be built either by (a) a `docker build` invocation in a setup/bootstrap script that runs before any Tool Container is first opened, or (b) a Compose top-level `build` for a service that exists purely to produce the tagged image and is never itself opened as a devcontainer (no matching `devcontainer.json`). Given this repo's existing pattern of shipping the whole setup as file templates dropped into a target repo's `.devcontainer/`, option (a) — the initial repo-setup step (today's `setup-devcontainer` skill invocation) building/tagging the base image once, e.g. via a small `docker build -t skills-tool-container-base:latest -f .devcontainer/base.Dockerfile .` step, or a `postCreateCommand`/`initializeCommand` guard on the first Tool Container that builds the base if it's missing — is the simpler fit, since it doesn't require an extra never-opened Compose service kept in sync with the 4 real ones.

## Final recommendation

**Hybrid: B for the image-level base (Node, gh CLI, base user/UID scheme), C for genuinely per-tool-only shell steps that don't warrant their own image layer** (the volume-ownership `chown` one-liners already in `post-create-codex-block.sh`/`post-create-antigravity-block.sh` are fine to keep as post-create steps — they operate on a config volume whose ownership can only be fixed once the volume is mounted at container-start, so they were never image-buildable state to begin with). Features (A) are not recommended as the shared-base mechanism because the Features spec's install-time model means 4 sibling containers each independently re-run the same install script with no cross-container dedup — the opposite of #109's "targeted updates, don't touch the others" goal, and directly undermines the #111 UID/GID-consistency requirement since 4 independent Feature-driven user/UID setups have no structural guarantee of staying identical.

Concrete file layout, reconciled with the #111 Compose structure:

```
.devcontainer/
  base.Dockerfile              # FROM mcr.microsoft.com/devcontainers/base:ubuntu
                                # apt-get install Node/gh-CLI (or ARG-pinned equivalents
                                # of today's node/github-cli Features), create the
                                # `vscode` remoteUser with a fixed UID/GID, any other
                                # setup common to all 4 Tool Containers.
                                # Tagged once, e.g. skills-tool-container-base:latest.

  claude-code/
    Dockerfile                 # FROM skills-tool-container-base:latest
                                # + Claude-Code-only image-level steps, if any.
    devcontainer.json          # "dockerComposeFile": ["../../docker-compose.yml"],
                                # "service": "claude-code", "shutdownAction": "none"

  codex/
    Dockerfile                 # FROM skills-tool-container-base:latest
    devcontainer.json          # same pattern, "service": "codex"

  antigravity/
    Dockerfile                 # FROM skills-tool-container-base:latest
    devcontainer.json          # same pattern, "service": "antigravity"

  copilot/
    Dockerfile                 # FROM skills-tool-container-base:latest
    devcontainer.json          # same pattern, "service": "copilot"

  docker-compose.yml           # one service per tool, each with
                                # build: { context: ., dockerfile: <tool>/Dockerfile },
                                # each bind-mounting the same repo root.

  post-create-base.sh          # shared post-create steps common to all 4
                                # (e.g. git identity config) — sourced/appended
                                # from each tool's own postCreateCommand.
  post-create-<tool>.sh        # per-tool post-create steps that are genuinely
                                # runtime-only (e.g. the existing config-volume
                                # chown fixups) — not image-buildable state.
```

Build sequencing: the base image (`skills-tool-container-base:latest`) is built once — either as an explicit step in the `setup-devcontainer` skill's generation/first-run flow, or via an `initializeCommand`/bootstrap guard that builds it if the tag doesn't already exist — before any of the 4 per-tool Compose services are built. Each per-tool Compose service's `build.dockerfile` then points at its own thin Dockerfile, and because all 4 `FROM` the identical tagged base, Docker's layer store shares the base's layers across all 4 resulting images on disk (per the `docs.docker.com/storage/storagedriver` findings above) — satisfying both #109's "update one tool without rebuilding the others" goal (only the changed tool's thin Dockerfile/image needs rebuilding; the shared base layer is untouched and reused from cache) and #111's UID/GID-consistency requirement (the `remoteUser`/UID/GID is defined exactly once, in the base, so all 4 Tool Containers structurally cannot drift from each other). The 4 thin `devcontainer.json` files, `dockerComposeFile`+`service`+`shutdownAction: none` pairing, and separate-VS-Code-window workflow from #111 are unchanged by this recommendation — B only changes how the *image* each Compose service builds is constructed, not how the Tool Containers are opened or kept running concurrently.
