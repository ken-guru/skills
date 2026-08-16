## Destination

Produce a handoff-ready verification and hardening specification for the six-member `devcontainer-setup` Skill Suite: its clean-state, focused-installation, and combined-installation guarantees are explicit, security- and performance-sensitive behavior has bounded acceptance criteria, and the route to implementing those guarantees is clear.

Labels: `wayfinder:map`

## Notes

- Domain: the `devcontainer-setup` Skill Suite and the Target Devcontainer lifecycle it modifies.
- Evidence boundary: treat the supplied verification report as observations to validate, not as an already-approved patch list.
- Scope: include security and performance concerns that can invalidate suite guarantees or materially affect agent safety, startup reliability, resource use, or host/container lifecycle behavior.
- Standing vocabulary: use `Add-on Skill`, `Target Devcontainer`, and `Retrofit Contract` as defined in `skills/devcontainer-setup/CONTEXT.md`.
- Skills every decision session should consult: `grilling` and `domain-modeling`; use `research` when an external runtime or platform fact is required.
- Planning boundary: this map produces decisions and an implementation handoff, not the implementation itself.

## Decisions so far

- [Choose the Target Devcontainer verification matrix](01-choose-target-devcontainer-verification-matrix.md) — Require clean, focused, combined, and re-attach lanes across scaffolded and separately authored non-root Debian-family targets, with deterministic and live checks separated.
- [Define the security acceptance boundary](02-define-security-acceptance-boundary.md) — Treat supported non-root, least-privilege, credential, firewall, and verified-update guarantees as hard gates with fail-closed uncertainty handling.
- [Set performance and resource budgets](03-set-performance-and-resource-budgets.md) — Gate unsafe or runaway lifecycle behavior, while treating environment-sensitive timing and resource measurements as baseline-backed diagnostics.
- [Choose the verification harness and evidence model](04-choose-verification-harness-and-evidence-model.md) — Keep per-Feature tests, suite-level container fixtures, and manual live/host checks distinct, with disposable deterministic runs and auditable evidence.
- [Assign remediation and contract ownership](05-assign-remediation-and-contract-ownership.md) — Assign each behavior to its narrowest owner and keep cross-Skill integrations capability-detected, soft-ordered, and explicitly verifiable.
- [Approve the implementation handoff and acceptance spec](06-approve-implementation-handoff-and-acceptance-spec.md) — Implement prerequisites first, gate suite claims on deterministic hard checks plus recorded live status, and rerun tests by change impact.

## Not yet specified

## Out of scope

- Generic base-image CVE remediation unrelated to a suite guarantee.
- Broad Docker or host performance optimization unrelated to the Skill Suite's lifecycle behavior.
- General host hardening beyond the host/container boundary exercised by `devcontainer-dx-niceties`.
