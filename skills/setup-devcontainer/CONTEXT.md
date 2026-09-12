# Setup Devcontainer Context

Vocabulary for `skills/setup-devcontainer`'s devcontainer generation model and
its companion per-CLI skills (`setup-claude-devcontainer`,
`setup-codex-devcontainer`, `setup-antigravity-devcontainer`,
`setup-copilot-devcontainer`): one shared devcontainer, and how
independently-invocable skills layer CLI installs onto it without touching
what they don't own.

## Language

**Shared Container**:
The single `devcontainer.json` + Dockerfile the base `setup-devcontainer`
skill generates and owns. Every selected AI CLI installs into this one
container, not one each.
_Avoid_: container, devcontainer (too generic — say Shared Container whenever
it matters that every tool shares it)

**CLI Skill**:
One of the four standalone skills (`setup-claude-devcontainer`,
`setup-codex-devcontainer`, `setup-antigravity-devcontainer`,
`setup-copilot-devcontainer`) that patches an existing Shared Container to add
exactly one AI CLI's install.
_Avoid_: tool skill, add-on skill

**Own-Block Contract**:
A CLI Skill's writes are scoped to exactly its own marker-keyed block or
line, wherever it lives (a `post-create.sh` install block, a README bullet,
etc.) — never anything owned by the base skill or another CLI Skill. The
Shared Container's own definition (`devcontainer.json`, the Dockerfile, SSH
key/volume wiring) is exclusively base-skill-owned; the one documented
exception is the Capability Seam.
_Avoid_: ownership rule (too generic)

**Capability Seam**:
The one designated, explicitly-named extension point in `devcontainer.json`
(`runArgs`) that a CLI Skill may idempotently append to when it needs
elevated container runtime settings — the sole, narrow exception to the
Own-Block Contract's "container definition is base-owned" rule. Today only
`setup-codex-devcontainer` uses it.
_Avoid_: capability grant, permission exception

**Shared Checkout**:
The repo content at `/workspace` — VS Code's default devcontainer bind-mount
of the host's own working directory, not a clone. Every CLI Skill installs
into the same Shared Container, so there's exactly one Shared Checkout to
match.
_Avoid_: private checkout, cloned workspace

**Local Checkout**:
A Shared Checkout with no GitHub `origin` at all — a local `git init` or a
genuinely bare workspace, for a project with no resolvable repo yet.
Connectable to a real GitHub repo later with no skill-level regeneration.
_Avoid_: offline mode, standalone checkout

**Scaffold**:
The generated `.devcontainer/` directory itself — the Dockerfile,
`devcontainer.json`, and lifecycle scripts — as distinct from the Shared
Checkout (the `/workspace` bind-mount of the repo's actual content). Not to
be confused with Local Checkout, which is about the workspace repo having no
`origin`, not about the Scaffold itself.
_Avoid_: devcontainer config, setup files (too generic)

**Curated Skill Set**:
The container-owned, configured collection of skills installed into a CLI's
user-level skills directory and eligible for atomic refresh.
_Avoid_: workspace skills, local skills

**Workspace Skill**:
A repository-owned skill stored in the Shared Checkout. It is part of the
repository and is never modified or deleted by the container's curated-skill
refresh.
_Avoid_: synced skill, installed skill

**Code Identity**:
The unprivileged OS user (`code-runner`) that executes workspace-derived
commands — tests, builds, package scripts, linters, formatters, and
repository hooks — inside the Shared Container, invoked through
`devcontainer-code-runner`. It shares Shared Checkout read/write access with
the Agent-Operation Identity but holds no GitHub, deploy, or signing
credentials.
_Avoid_: code-runner user, unprivileged identity (too generic)

**Agent-Operation Identity**:
The privileged OS user (`vscode`) that holds GitHub, deploy, and signing
credentials and performs GitHub API calls, signed commits, pushes, and pull
requests. Kept separate from the Code Identity so repository-controlled
commands can never reach these credentials directly.
_Avoid_: privileged identity (too generic), agent identity

**Security Boundary**:
The protection the two-identity model provides: workspace-derived commands
run as the Code Identity, never as the Agent-Operation Identity, so
repository content or its outputs cannot reach GitHub, deploy, or signing
credentials. Does not protect against a deliberately malicious
Agent-Operation process using its own authorized credentials, nor against a
compromised upstream Curated Skill Set source.
_Avoid_: generated-code boundary (used once in `cli-security-contract.md`;
reconcile to this term next time that doc is touched)
