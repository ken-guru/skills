# Can Multiple Devcontainers Run Concurrently Against the Same Repo Checkout?

## Executive summary / verdict

**Yes — a "Concurrent Workspace" is achievable, but only via the Docker Compose mechanism, and only across multiple VS Code windows, not within one window.**

VS Code's Dev Containers extension is explicit that "Currently you can only connect to one container per Visual Studio Code window" ([Connect to multiple containers](https://code.visualstudio.com/remote/advancedcontainers/connect-multiple-containers)). Within a single window, opening a second config via **Dev Containers: Switch Container** or **Reopen in Container** reloads the window onto the new container — it does not add a second concurrent connection in that window.

However, VS Code's own documentation describes, as a first-class supported pattern, exactly the topology this project needs: one `docker-compose.yml` with one service per tool, one `devcontainer.json` per service living in its own `.devcontainer/<tool>/` subfolder, each `devcontainer.json` pointing at the same compose file and the same bind-mounted workspace, each opened in its own **separate VS Code window** via **File > New Window** + **Dev Containers: Reopen in Container**. Once open, "you can now interact with both containers from separate windows" concurrently, and `"shutdownAction": "none"` keeps each container running independently so closing one window's dev container does not tear down the other ([Connect to multiple containers](https://code.visualstudio.com/remote/advancedcontainers/connect-multiple-containers)). This is a native, documented, non-hacky capability — not a workaround. Native VS Code support for "N independent `.devcontainer/<name>/devcontainer.json` files with no shared compose file, attached concurrently" does **not** exist for non-compose configs; the picker there is one-at-a-time-per-window (see Area 1 below). Compose is therefore the mechanism, not multi-config-without-compose and not manual `docker compose exec` (though the latter remains available as a fallback for tools without a Dev Containers "primary" role — see Area 2).

The main real-world friction is not VS Code's UX but the shared-workspace substrate: (a) a docker-compose project-name collision if each service's own `.devcontainer/<tool>/docker-compose.yml`-style folder layout isn't accounted for (VS Code has a specific mitigation, see Area 2), (b) UID/GID drift across containers with different `remoteUser`/`updateRemoteUserUID` outcomes writing to the same bind mount, and (c) concurrent git operations (index.lock contention) if more than one Tool Container's agent runs git commands against the same `.git` directory at the same moment. None of these are fatal, but they should shape the on-disk layout and shared-base-layer design (see final section).

---

## 1. VS Code's native multiple `.devcontainer/<name>/devcontainer.json` support

The Dev Container Specification allows more than one `devcontainer.json`, and defines lookup precedence:

> "Products using it should expect to find a `devcontainer.json` file in one or more of the following locations (in order of precedence): `.devcontainer/devcontainer.json`, `.devcontainer.json`, `.devcontainer/<folder>/devcontainer.json` (where `<folder>` is a sub-folder, one level deep)... these files may exist in more than one location, so consider providing a mechanism for users to select one when appropriate."
> — [devcontainers/spec, devcontainer-reference.md](https://github.com/devcontainers/spec/blob/main/docs/specs/devcontainer-reference.md)

VS Code's Dev Containers extension implements the "select one" part as a **picker**, not a concurrent-attach mechanism:

- Command **Dev Containers: Reopen in Container** (or **Open Folder in Container...**) presents a list of discovered configs; picking one reloads the *current* window and connects it to that one container. ([Create a Dev Container](https://code.visualstudio.com/docs/devcontainers/create-dev-container); [Configure separate containers](https://code.visualstudio.com/remote/advancedcontainers/configure-separate-containers.md))
- Command **Dev Containers: Switch Container** does the same reload-to-a-different-config action within one window: "Run Dev Containers: Switch Container from the Command Palette (F1) and select Node Container... The current VS Code window will reload and connect to the selected container." ([Connect to multiple containers](https://code.visualstudio.com/remote/advancedcontainers/connect-multiple-containers))
- The explicit, unambiguous statement of the single-window limit: "Currently you can only connect to one container per Visual Studio Code window. However, you can spin up multiple VS Code windows to attach to them." ([Connect to multiple containers](https://code.visualstudio.com/remote/advancedcontainers/connect-multiple-containers))
- Also stated from the other doc page: "while you cannot use multiple containers for the same workspace in the same VS Code window, you can use multiple Docker Compose managed containers at once from separate windows." ([Developing inside a Container](https://code.visualstudio.com/docs/devcontainers/containers))

Request/issue-tracker context (GitHub issues, read directly):

- [microsoft/vscode-remote-release#8678](https://github.com/microsoft/vscode-remote-release/issues/8678) — "Easy switching with multiple devcontainer.json configurations." Requested a faster UI for switching between configs (menu shortcut instead of several nested menu hops). This is a request about switching speed, not concurrent attach; it does not ask for or describe simultaneous connections. Closed, milestone July 2023.
- [microsoft/vscode-remote-release#7548](https://github.com/microsoft/vscode-remote-release/issues/7548) — "Support for folders with multiple devcontainer.json files." Tracked bringing the spec's `.devcontainer/<folder>/devcontainer.json` sub-folder discovery (already live in GitHub Codespaces at the time) into the Dev Containers extension. Closed, milestone January 2023 — this is the feature that shipped the subfolder-picker behavior described above. Nothing in the shipped feature or its tracking issue describes concurrent/simultaneous attachment; it is presented purely as more configs to choose from in the same picker.
- Follow-on issues confirm the picker model, not a concurrency model, e.g. [#8620](https://github.com/microsoft/vscode-remote-release/issues/8620) and [#11604](https://github.com/microsoft/vscode-remote-release/issues/11604) (both about the subfolder-config picker failing to *reconnect*, i.e. bugs in the one-at-a-time reopen flow, not about running two at once).

**Conclusion for this mechanism alone:** discovering N `.devcontainer/<tool>/devcontainer.json` files (with no compose file involved) gives you a convenient *picker*, not a concurrent workspace. Each reopen/switch replaces the container the current window is attached to. To get concurrency you must open additional windows AND those configs must resolve to distinct, independently-running containers — which in practice pushes you toward Docker Compose (Area 2), because plain image/Dockerfile-based configs pointed at the same folder don't have a clean "these two containers are meant to coexist" declaration the way compose services do.

## 2. Docker-Compose-based approach — the actual mechanism

VS Code documents, with a complete worked example, precisely the "one compose file, one service per tool, N devcontainer.json files, same workspace" pattern:

> "If you'd prefer to use `devcontainer.json` instead and are using Docker Compose, you can create separate `devcontainer.json` files for each service in your source tree, each pointing to a common `docker-compose.yml`."
> — [Connect to multiple containers](https://code.visualstudio.com/remote/advancedcontainers/connect-multiple-containers) (raw source: `remote/advancedcontainers/connect-multiple-containers.md` in [microsoft/vscode-docs](https://github.com/microsoft/vscode-docs))

The doc's example tree is structurally identical to the Tool Container proposal:

```
📁 project-root
    📁 .git
    📁 .devcontainer
      📁 python-container
        📄 devcontainer.json
      📁 node-container
        📄 devcontainer.json
    📄 docker-compose.yml
```

with both services in the one `docker-compose.yml` mounting the same host path:

```yaml
services:
  python-api:
    volumes:
      - .:/workspace
    command: sleep infinity
  node-app:
    volumes:
      - .:/workspace
    command: sleep infinity
```

and each `devcontainer.json` differing only in `service` and `workspaceFolder`:

```json
{
  "name": "Python Container",
  "dockerComposeFile": ["../../docker-compose.yml"],
  "service": "python-api",
  "shutdownAction": "none",
  "workspaceFolder": "/workspace/python-src"
}
```

The doc calls out the exact hazard relevant here: **"The location of the `.git` folder is important, since we will need to ensure the containers can see this path for source control to work properly."** — i.e., every service's bind mount must include the repo root (not just a tool-specific subtree) or that container's git tooling breaks.

Workflow for genuine concurrency, quoted directly:

> "1. Open a VS Code window at the root level of the project. 2. Run Dev Containers: Reopen in Container ... and select Python Container. 3. VS Code will then start up both containers, reload the current window and connect to the selected container. 4. Next, open a new window using File > New Window. 5. Open your project at root level in the current window. 6. Run Dev Containers: Reopen in Container ... and select Node Container. 7. The current VS Code window will reload and connect to the selected container. You can now interact with both containers from separate windows."
> — [Connect to multiple containers](https://code.visualstudio.com/remote/advancedcontainers/connect-multiple-containers)

Note step 3: opening *either* config with `docker compose up` semantics starts **both** declared services (unless scoped with `runServices`), so both containers come up together the first time, then each window independently attaches to its own. `"shutdownAction": "none"` is explicitly recommended so that closing one window doesn't stop the other's container: "will leave the containers running when VS Code closes -- which prevents you from accidentally shutting down both containers by closing one window" (same source).

**Primary ("named service") vs. non-primary compose services.** The Dev Container Spec formalizes what `service` means:

> "`service`: declares the **main** container that will be used for all other operations... Tools are assumed to also use this parameter to connect to the development container, although they can provide facilities to connect to the other containers as required by the user."
> — [devcontainers/spec, devcontainer-reference.md](https://github.com/devcontainers/spec/blob/main/docs/specs/devcontainer-reference.md)

and

> "`runServices`: an optional property that indicates the set of services in the `docker-compose` configuration that should be started or stopped with the environment."
> — same source

VS Code's own reference reiterates that `service` governs *connection*, not which services get started: "The `service` property indicates which service in your Docker Compose file VS Code should connect to, not which service should be started. If you started them by hand, VS Code will attach to the service you specified." — [Create a Dev Container, "Use Docker Compose"](https://code.visualstudio.com/docs/devcontainers/create-dev-container) (raw: `docs/devcontainers/create-dev-container.md` in vscode-docs).

For a service in the compose file that is **not** any `devcontainer.json`'s declared `service` (e.g., if only one tool got a "real" devcontainer.json and the others are just plain compose services), VS Code's fallback is the generic **Attach to Running Container** command, which works "regardless of how [the container] was started" ([Attach to a running container](https://code.visualstudio.com/docs/devcontainers/attach-container)) — i.e., you `docker compose up -d` from the CLI, then `Dev Containers: Attach to Running Container...` in a new window to reach any of the other services. This is the "manual attach" fallback the research question anticipated, but in practice — per the worked example above — it is **not necessary** if every tool gets its own thin `devcontainer.json` naming it as `service`: then each is reachable natively via **Reopen in Container** in its own window, with full devcontainer features (postCreateCommand, features, extensions) rather than bare attach.

**Docker Compose project-name collision — a real, documented failure mode and its fix.** [microsoft/vscode-remote-release#5716](https://github.com/microsoft/vscode-remote-release/issues/5716) documents that VS Code discovers running containers via `docker ps --filter label=com.docker.compose.project=<name> --filter label=com.docker.compose.service=<name>`; if two unrelated compose projects/services resolve to the same default project name (Compose's default is the containing folder's basename) and same service name, VS Code cannot tell the two apart and the second container fails to start correctly. VS Code's own docs describe the mitigation:

> "Visual Studio Code will respect the value you configure for the Docker Compose project name... When no project name is configured and the `docker-compose.yml` is in the `.devcontainer` folder, the Docker Compose default of using the `docker-compose.yml` folder's basename is overridden with `${project-folder-basename}_devcontainer` to avoid name collisions with other projects."
> — [Set Docker Compose project name](https://code.visualstudio.com/remote/advancedcontainers/set-docker-compose-project-name) (raw: `remote/advancedcontainers/set-docker-compose-project-name.md`)

This means: as long as the Tool Container `docker-compose.yml` lives under `.devcontainer/` (or an explicit `name:`/`COMPOSE_PROJECT_NAME` is set) and service names are distinct per tool (`claude-code`, `codex`, `antigravity`, `copilot`), the project-name collision from #5716 should not recur — but this is worth an explicit, deliberate choice in the layout rather than an accident.

## 3. Caveats of one bind-mounted workspace shared by several simultaneously-running containers

**File lock / write contention.** Docker's bind-mount mechanism has no built-in cross-container coordination: writes go straight through the host kernel's filesystem, and "Docker doesn't manage bind mounts at all, and doesn't provide any file locking..." The Docker community/support consensus (found via search, not an official docs page with a dedicated section — see gap note below) is that the *only* docs-endorsed pattern for a shared mount is single-writer/multi-reader; the official Docker volumes page is permissive about the mechanism itself but silent on write-safety:

> "A given volume can be mounted into multiple containers simultaneously... Multiple containers can mount the same volume. You can simultaneously mount a single volume as `read-write` for some containers and as `read-only` for others."
> — [Docker Docs, Volumes](https://docs.docker.com/engine/storage/volumes/)

Docker's bind-mounts page (checked directly) does not contain an explicit "concurrent write" warning section; the only multi-container language found there concerns the SELinux `z`/`Z` mount-label options ("the `z` option indicates that the bind mount content is shared among multiple containers"), which is about labeling, not write-safety — a documentation gap I could not close from `docs.docker.com/engine/storage/bind-mounts/` itself (see Note on gaps below). Practically, for Tool Containers this means: editor swap/temp files, node_modules/build caches, and lockfiles (`package-lock.json`, `.terraform.lock.hcl`, etc.) written concurrently by two different tool agents are a real hazard class, independent of git — nothing in Docker's own mount mechanism arbitrates it.

**UID/GID drift.** VS Code auto-aligns the in-container user to the host user by default, specifically to prevent bind-mount permission problems:

> "On Linux, if you are referencing a Dockerfile, image, or Docker Compose in `devcontainer.json`, this will also automatically update the container user's UID/GID to match your local user to avoid the bind mount permissions problem... (unless you set `"updateRemoteUserUID": false"`)."
> — [Add a non-root user to a container](https://code.visualstudio.com/remote/advancedcontainers/add-nonroot-user)

and the underlying reason bind mounts are UID-sensitive at all:

> "Inside the container, any mounted files/folders will have the exact same permissions as outside the container - including the owner user ID (UID) and group ID (GID). Because of this, your container user will either need to have the same UID or be in a group with the same GID."
> — same source

Two consequences for the Concurrent Workspace design: (1) `updateRemoteUserUID` runs per-container at container-creation time only ("UID/GID updates are only applied when the container is created and requires a rebuild to change" — same source), so if Tool Containers are built from different base images with different default UIDs/usernames, and each is independently rebuilt at different times, they can drift out of sync with the host UID (e.g., after a host user's UID changes, or if one container is rebuilt and another isn't) — meaning files one tool creates may become unwritable/unreadable to another until both are rebuilt; (2) if two Tool Containers ever intentionally use *different* `remoteUser`s that don't both map to the host UID, whichever container's user doesn't match the host UID will produce files the host user (and the other container) may not be able to write, since — per the same source — "the automatic matching prevents permission conflicts—when users share the same UID/GID, filesystem operations on bind mounts work seamlessly." **Practical implication:** all Tool Containers should share one base layer with one consistent `remoteUser`/UID scheme rather than letting each tool's image pick its own default user, or UID drift becomes a source of "works in one container, permission-denied in the other" bugs on the exact same file.

**Git index.lock / concurrent git operations.** Two independent primary sources agree that Git itself is not safe for arbitrary-timing concurrent writes against one `.git` directory:

> "When you perform a Git command that edits the index, Git creates a new index.lock file, writes the changes, and then renames the file. The index.lock file indicates to other Git processes that the repository is locked for editing... if the editing process is terminated or becomes unresponsive, the index.lock file can be left behind and remain present even if no Git process is running. This orphaned index.lock file will prevent other Git processes from editing the repository."
> — [Git index.lock file, Azure Repos docs](https://learn.microsoft.com/en-us/azure/devops/repos/git/git-index-lock?view=azure-devops)

Git's own official docs (git-scm.com) make the corruption risk explicit for the specific case of one operation (`git gc`) racing another:

> "when `git gc` runs concurrently with another process, there is a risk of it deleting an object that the other process is using but hasn't created a reference to. This may just cause the other process to fail or may corrupt the repository if the other process later adds a reference to the deleted object... these features fall short of a complete solution, so users who run commands concurrently have to live with some risk of corruption (which seems to be low in practice)."
> — [git-gc(1)](https://git-scm.com/docs/git-gc)

Git does serialize index-writing commands against each other via `index.lock` (so a second `git commit` started while another is mid-flight will fail fast with a lock error rather than silently corrupt), but that protection is per-command-invocation, not a guarantee against corruption from all classes of concurrent operation (e.g. `gc`, `pack-refs`, ref updates), and a crashed process can leave a stale lock that blocks the *other* container's git operations entirely until someone manually removes `.git/index.lock`. Because both containers see the same `.git` directory through the same bind mount, this is a real, if generally low-probability, risk whenever two Tool Container agents might run `git add`/`commit`/`status`/background `gc` against the repo at the same moment — worth calling out explicitly to whoever designs the agent orchestration (e.g., "only one agent commits at a time" as a policy, or route all git writes through one container).

**Note on gaps:** I could not find an official Docker Docs page with a dedicated, explicit "concurrent writes to a shared bind mount" warning section (the bind-mounts and volumes pages were fetched directly and checked; neither has one). The characterization of write-contention risk above (no host-kernel-level arbitration) is well-established general Linux/Docker community knowledge but is not itself pinned to a docs.docker.com URL with that specific wording — flagging this honestly rather than fabricating a citation.

## Implications for Tool Container layout

Given the verdict — **compose-based concurrency across separate VS Code windows is the supported mechanism; bare multi-`devcontainer.json`-without-compose is a picker, not concurrency** — the recommended on-disk layout is:

1. **One `docker-compose.yml`** (e.g. at repo root or under `.devcontainer/docker-compose.yml` — putting it under `.devcontainer/` gets the automatic `${project-folder-basename}_devcontainer` project-name collision guard described in Area 2 for free) defining one service per tool: `claude-code`, `codex`, `antigravity`, `copilot`. Each service mounts the **same** workspace path (the repo root, so `.git` is visible to all — per the explicit VS Code caveat quoted above) via one bind mount or one named volume shared across services.
2. **One `devcontainer.json` per tool**, each in its own `.devcontainer/<tool>/devcontainer.json` subfolder (matching the spec's documented sub-folder discovery, Area 1), each with `"dockerComposeFile": ["../../docker-compose.yml"]` and its own `"service": "<tool>"`. This gives every tool a fully native, non-"attach-only" experience — features, postCreateCommand, extensions — while still being one compose stack under the hood. Set `"shutdownAction": "none"` on each so closing one tool's window never stops a sibling container.
3. **A shared base image/Dockerfile** used by all four services (the "shared-base-layer mechanism" from the map), so `remoteUser`/UID handling is identical across containers and UID drift (Area 3) can't silently break cross-container file permissions on the shared mount.
4. **No reliance on manual `docker compose exec`/`attach`** as the primary path — reserve the generic **Attach to Running Container** command only as a fallback/debugging tool for a service that intentionally has no `devcontainer.json` (e.g. an ad hoc sidecar), not as the everyday way to reach a Tool Container.
5. **Document, as an operational policy (not a technical guard VS Code provides)**, that concurrent git *write* operations (commit, `gc`, ref updates) across simultaneously-running Tool Containers carry a real if low-probability corruption/lock-contention risk (Area 3) — e.g., recommend that only one agent/container performs git writes at a time, or that agents retry/backoff on `index.lock` errors rather than treating them as fatal.

## References

- [Connect to multiple containers — code.visualstudio.com](https://code.visualstudio.com/remote/advancedcontainers/connect-multiple-containers)
- [Configure separate containers — code.visualstudio.com](https://code.visualstudio.com/remote/advancedcontainers/configure-separate-containers.md)
- [Set Docker Compose project name — code.visualstudio.com](https://code.visualstudio.com/remote/advancedcontainers/set-docker-compose-project-name)
- [Add a non-root user to a container — code.visualstudio.com](https://code.visualstudio.com/remote/advancedcontainers/add-nonroot-user)
- [Create a Dev Container — code.visualstudio.com](https://code.visualstudio.com/docs/devcontainers/create-dev-container)
- [Developing inside a Container — code.visualstudio.com](https://code.visualstudio.com/docs/devcontainers/containers)
- [Attach to a running container — code.visualstudio.com](https://code.visualstudio.com/docs/devcontainers/attach-container)
- [devcontainers/spec — devcontainer-reference.md](https://github.com/devcontainers/spec/blob/main/docs/specs/devcontainer-reference.md)
- [microsoft/vscode-docs source (raw), remote/advancedcontainers/connect-multiple-containers.md](https://github.com/microsoft/vscode-docs/blob/main/remote/advancedcontainers/connect-multiple-containers.md)
- [microsoft/vscode-docs source (raw), remote/advancedcontainers/set-docker-compose-project-name.md](https://github.com/microsoft/vscode-docs/blob/main/remote/advancedcontainers/set-docker-compose-project-name.md)
- [microsoft/vscode-docs source (raw), remote/advancedcontainers/configure-separate-containers.md](https://github.com/microsoft/vscode-docs/blob/main/remote/advancedcontainers/configure-separate-containers.md)
- [microsoft/vscode-docs source (raw), docs/devcontainers/create-dev-container.md](https://github.com/microsoft/vscode-docs/blob/main/docs/devcontainers/create-dev-container.md)
- [microsoft/vscode-remote-release#8678 — Easy switching with multiple devcontainer.json configurations](https://github.com/microsoft/vscode-remote-release/issues/8678)
- [microsoft/vscode-remote-release#7548 — Support for folders with multiple devcontainer.json files](https://github.com/microsoft/vscode-remote-release/issues/7548)
- [microsoft/vscode-remote-release#5716 — Remote development cannot abide multiple remote containers defined in compose files with the same service name running simultaneously](https://github.com/microsoft/vscode-remote-release/issues/5716)
- [microsoft/vscode-remote-release#1233 — Can not connect to two containers in same project at same time](https://github.com/microsoft/vscode-remote-release/issues/1233)
- [microsoft/vscode-remote-release#8620 — devcontainer.json not found when file is located deeper than 1 subfolder](https://github.com/microsoft/vscode-remote-release/issues/8620)
- [microsoft/vscode-remote-release#11604 — reconnecting to existing subfolder config container fails](https://github.com/microsoft/vscode-remote-release/issues/11604)
- [Docker Docs — Volumes](https://docs.docker.com/engine/storage/volumes/)
- [Docker Docs — Bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [git-gc(1) — git-scm.com](https://git-scm.com/docs/git-gc)
- [Git index.lock file — Azure Repos, Microsoft Learn](https://learn.microsoft.com/en-us/azure/devops/repos/git/git-index-lock?view=azure-devops)
