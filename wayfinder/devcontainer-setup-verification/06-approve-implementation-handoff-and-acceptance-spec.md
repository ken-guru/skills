## Question

What final implementation handoff and acceptance specification should someone use to remediate and verify the suite?

Consolidate the preceding decisions into an ordered implementation route, explicit per-Skill acceptance checks, deferred-complexity triggers, and a reproducible verification command/runbook. Decide what must land before the suite can claim the report's guarantees, what can be staged, and how future Feature or base-image changes re-run the relevant verification without reopening the entire map.

Labels: `wayfinder:grilling`

Claimed by: Codex

Blocked by: [Assign remediation and contract ownership](05-assign-remediation-and-contract-ownership.md), [Choose the verification harness and evidence model](04-choose-verification-harness-and-evidence-model.md)

## Resolution

Implementation proceeds in this order: establish shared prerequisites and fixture scaffolding; fix scaffold/non-root ownership; fix firewall correctness; fix agentic CLI/MCP installation; fix lifecycle age-gating; fix git/auth; fix DX niceties; then run the complete deterministic matrix and live/manual lane. Cross-Skill changes land with the harness checks that prove their handoffs.

The handoff consists of a checked-in acceptance specification under `skills/devcontainer-setup/verification/` plus a concise suite README/runbook. The specification maps each check to its owner, fixture lane, expected evidence, and failure classification. The runbook documents commands, prerequisites, live credentials, cleanup, and host-only checks.

The suite may claim the report's guarantees only after all hard security and lifecycle/resource gates pass across the required deterministic lanes, with the live/manual lane explicitly passed or marked unavailable. Isolated Feature-green status is not sufficient for a suite-wide claim.

Skill script or Feature metadata changes rerun that Skill's tests plus affected suite lanes. Shared conventions, scaffold templates, base images, identity, capabilities, mounts, firewall rules, manifests, lifecycle policy, or auth-flow changes rerun the full deterministic matrix. Host integration changes rerun the host/manual lane. This impact table belongs in the acceptance specification.

(CLOSED)
