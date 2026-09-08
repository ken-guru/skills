# Setup Devcontainer Context

Vocabulary for `skills/setup-devcontainer`'s devcontainer generation model: how AI
CLI tools are isolated from each other inside a repo's development environment.

## Language

**Tool Container**:
An isolated devcontainer definition dedicated to exactly one AI CLI (Claude Code,
Codex, Antigravity, or Copilot).
_Avoid_: container, devcontainer (too generic — say Tool Container whenever
per-tool isolation is the point)

**Shared Container**:
The single devcontainer.json + post-create.sh that installed multiple AI CLIs
together, superseded by one Tool Container per tool.
_Avoid_: baseline container, combined container

**Collision**:
Cross-tool interference from co-residing in one Shared Container — e.g. a
permission grant or install step from one tool affecting another.
_Avoid_: conflict, interference

**Concurrent Workspace**:
Multiple Tool Containers running at once, each opened in its own VS Code
window via Docker Compose, each with its own Private Checkout.
_Avoid_: multi-container mode, parallel containers

**Private Checkout**:
A Tool Container's own git clone of the repo — own `.git`, own persistent
volume, cloned from `origin` — invisible to every other Tool Container.
_Avoid_: isolated checkout, container clone (too generic)

**Shared Checkout**:
The single bind-mounted repo checkout every Tool Container used to share,
superseded by one Private Checkout per tool.
_Avoid_: bind mount, shared workspace

**Cross-Container Leakage**:
The risk Private Checkout closes: one Tool Container's uncommitted edits,
unpushed branches, or worktrees becoming visible to another because they
shared one on-disk checkout.
_Avoid_: contamination, cross-contamination
