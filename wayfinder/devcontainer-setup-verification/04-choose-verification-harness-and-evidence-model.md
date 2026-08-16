## Question

Where should the end-to-end verification harness live, how should it build and exercise fixtures, and what evidence must it retain?

Choose between extending the existing per-Feature tests, adding a checked-in suite-level harness, or splitting deterministic container checks from a manual host/GitHub runbook. Define the ownership boundary between Skill-level tests, shared Feature conventions, and suite-level tests; the clean-state teardown policy; how live external dependencies are stubbed or isolated; and the report format that makes warnings, blocked traffic, held updates, ownership, and host-side processes auditable.

Labels: `wayfinder:grilling`

Claimed by: Codex

Blocked by: [Choose the Target Devcontainer verification matrix](01-choose-target-devcontainer-verification-matrix.md), [Define the security acceptance boundary](02-define-security-acceptance-boundary.md), [Set performance and resource budgets](03-set-performance-and-resource-budgets.md)

## Resolution

The suite-level harness lives in this Collection under `skills/devcontainer-setup/verification/`, alongside the existing per-Feature tests. Per-Feature tests prove narrow installation prerequisites and owned behavior; suite-level fixtures prove the clean, focused, combined, restart, ownership, security, and lifecycle lanes; a manual live runbook covers real GitHub registration, real allowlisted/blocked traffic, and host `caffeinate`.

Deterministic runs inject local fixtures or stubs for package and release metadata, MCP handshakes, and GitHub API responses, and use controlled local endpoints for network assertions where possible. Real external calls are opt-in, credentialed, and isolated. No test silently registers keys or mutates a real repository.

Each run emits machine-readable results and a human-readable summary containing fixture, image, base, and runtime identity; commands and logs; ownership, capability, and process snapshots; network outcomes; timing/resource samples; and failure classification. Deterministic runs use unique disposable projects, volumes, networks, and credentials and tear them down on failure or success. The live lane uses explicitly named resources and a manual cleanup checklist.

(CLOSED)
