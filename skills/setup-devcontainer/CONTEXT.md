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
