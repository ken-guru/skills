## Question

Which security properties become hard acceptance criteria for this suite, and which remain documented limitations or follow-up work?

Cover the suite's stated container security boundary: non-root execution and volume ownership, capability scoping, secret and key isolation, firewall deny-by-default behavior and Docker DNS correctness, allowlist integrity, staged/verified/atomic tool installation, age-gating fail-safe behavior, and authentication scope. Include the failure semantics that must block startup or verification, and distinguish a security regression from an unsupported Target Devcontainer shape.

Labels: `wayfinder:grilling`

Claimed by: Codex

Blocked by: None

## Resolution

All five security categories are hard gates for supported Target Devcontainers: intended non-root execution and owned paths; least-privilege capabilities and mounts; separated deploy/signing credentials with scoped `GH_TOKEN`; deny-by-default firewall behavior with working Docker DNS and manifest-derived allowlists; and staged, health-checked, atomic, age-gated tool updates.

Add-on Skills do not support a root-default runtime Target Devcontainer when their security contract requires a non-root user. They must fail clearly, while build-time installation may still run as root where the devcontainer lifecycle requires it.

Security checks fail closed for network access, tool replacement, and credential operations. Uncertain updates preserve the last known-good tool. Missing prerequisites and conflicting owned state fail verification with diagnostics. A capability may be skipped only when it is explicitly absent and documented as optional by the focused-installation contract.

Downloaded artifacts require pinned or policy-constrained sources, artifact-appropriate version/provenance checks, protocol health checks before activation, and atomic replacement. This does not establish a universal cryptographic artifact-signing program.

(CLOSED)
