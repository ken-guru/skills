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
Multiple Tool Containers running at once against the same repo checkout, each
opened in its own VS Code window via Docker Compose.
_Avoid_: multi-container mode, parallel containers
