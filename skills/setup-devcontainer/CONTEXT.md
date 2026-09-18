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
etc.) — never anything owned by the base skill, another CLI Skill, or a
project's own Project-Owned Block. The Shared Container's own definition
(`devcontainer.json`, the Dockerfile, SSH key/volume wiring) is exclusively
base-skill-owned; the one documented exception is the Capability Seam.
_Avoid_: ownership rule (too generic)

**Project-Owned Block**:
A marker-keyed block a project adds to a Scaffold lifecycle script for its own needs (e.g.
installing a backing service from `post-create.sh`, starting it from `post-start.sh`) — not owned
by the base skill or any CLI Skill. A single project need can own a block in more than one lifecycle
script at once. Uses the
same `patch-if-absent.sh` idempotent-append mechanism as a CLI Skill's own block, with a
project-chosen marker instead; no skill ever reads, edits, or removes it. A third party under the
Own-Block Contract, alongside the base skill and a CLI Skill.
_Avoid_: project hook, custom block (too generic)

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

**Baseline Containment**:
The Shared Container's default-restrictive runtime posture — network
egress, filesystem, capabilities — applied once so every CLI Skill is
protected equally, with no per-CLI opt-in required. The floor a CLI Skill's
Capability Seam use can loosen from; never the other way round.
_Avoid_: sandboxing (too generic — say which concern), hardening (see
Supply-chain Hardening / Blast-radius Containment, the two things "hardening"
could mean here)

**Supply-chain Hardening**:
Build-time concerns about the Shared Container's base image itself —
provenance, digest pinning, patch/CVE surface. Scoped entirely to the
Dockerfile; orthogonal to Blast-radius Containment, which is a runtime
concern.
_Avoid_: image hardening (drop "image", ambiguous with container image vs.
container instance)

**Blast-radius Containment**:
Runtime concerns about what a running, possibly-compromised or
misbehaving agent process can reach — network, filesystem, capabilities.
Baseline Containment is the mechanism that delivers it at the Shared
Container level; the Capability Seam is where a CLI Skill trades some of it
back for a capability it specifically needs.
_Avoid_: sandboxing (too generic), isolation (already used loosely elsewhere
for the pre-ADR-0002 per-tool-container model)

**Network Manifest**:
A second, distinct extension point from the Capability Seam: a base-owned
JSON file where each CLI Skill owns exactly one keyed entry declaring its
own outbound network needs, and the firewall's init/refresh scripts derive
their allowlist from it — the single source of truth for "what does this
CLI need to reach." Opposite direction from the Capability Seam: the
Capability Seam *widens* (`runArgs`, a CLI Skill loosening beyond Baseline
Containment); the Network Manifest *narrows/declares* (a CLI Skill stating
what should be let through a restriction that exists regardless). Don't
conflate the two just because both are per-CLI-Skill extension points on a
base-owned file.
_Avoid_: allowlist (too generic — say Network Manifest for the file, plain
"allowlist" only for the resulting ipset/firewall rule set it produces)

**Installer Provenance**:
Trust in a CLI Skill's own install-script origin (e.g. `https://claude.ai/install.sh`),
evaluated at Scaffold setup-time (`post-create.sh`) when the CLI itself is installed — not
Supply-chain Hardening, which is scoped to the Dockerfile/base-image at build-time.
_Avoid_: supply chain (too broad — say which of Installer Provenance or Supply-chain
Hardening), install security (too generic)

**Agent Authority**:
How much autonomy or privilege a CLI's own permission system grants once running — e.g. an
optional fast-iteration alias like `claude-yolo` widening from a CLI's default
interactive-approval posture. A property of the CLI process's own decision-making, not the
Shared Container; orthogonal to Blast-radius Containment, which bounds what a process can
*reach*, not what it's *permitted to decide*.
_Avoid_: permissions (too generic), privilege escalation (implies a container-level exploit,
not a CLI's own opt-in mode)

**Skill Source Trust**:
The trust boundary crossed when a CLI Skill's optional skill-sync feature (`npx -y skills
add`) pulls another party's skill instructions into the agent's own operating context,
unattended and re-synced on every container start. Distinct from Installer Provenance (a
fixed, versioned CLI binary) — a skill source is user-named, can be arbitrary, and its
content can influence agent behavior directly, not just what gets installed.
_Avoid_: RCE risk (treats it as a code-execution bug rather than a standing trust
relationship the user configures), skill security (too generic)

**Project Mounts**:
A project-owned JSON file (`project-mounts.local.json`), parallel to
`allowed-domains.local.txt` — created empty, unconditionally, never touched again by any skill —
where a project declares its own `devcontainer.json` `mounts` entries, folded in via the same
`patch-json-array-if-absent.sh` primitive the Capability Seam and Network Manifest use. Unlike the
Network Manifest, it has no per-CLI-keyed structure: no CLI Skill needs its own mount entries, only
the project does.
_Avoid_: mounts manifest (implies per-CLI-keyed structure, which this doesn't have)
