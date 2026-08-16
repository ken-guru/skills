## Question

Given the accepted matrix, security gates, performance budgets, and harness shape, where should each required behavior be owned and what cross-Skill contract changes are needed?

Map each report finding to the narrowest owner: `devcontainer-scaffold`, an Add-on Skill, a shared Feature convention, a template, the suite-level harness, or documentation. Decide how cross-Skill handoffs such as firewall domains, non-root paths, MCP health checks, lifecycle age-gating, SSH volumes, `GH_TOKEN`, and host-awake processes are specified without turning focused installation into a hard dependency. Identify any report finding that is out of scope or needs a preparatory task before implementation.

Labels: `wayfinder:grilling`

Claimed by: Codex

Blocked by: [Choose the verification harness and evidence model](04-choose-verification-harness-and-evidence-model.md)

## Resolution

Findings are assigned to the narrowest Artifact Owner: a Skill owns its runtime behavior and files; shared Feature conventions own rules required by multiple Skills; scaffold templates own new Target Devcontainer defaults; the suite harness owns orchestration and evidence; and documentation owns promises and limitations.

Cross-Skill integrations remain capability-detected and soft-ordered. Each handoff must name its producer, consumer, detection signal, absent-capability behavior, and verification check. No consumer becomes the owner of another Skill's state.

The report maps to `devcontainer-scaffold` for non-root and volume ownership; `devcontainer-firewall` for NAT/DNS and runtime prerequisites; `devcontainer-agentic-clis` for MCP installation paths; `devcontainer-cli-lifecycle` for HELD outcomes; `devcontainer-git-auth` for deploy/signing keys and `gh`; `devcontainer-dx-niceties` for statusline and host-awake behavior; and the suite harness/runbook for cross-cutting proof.

A shared convention is added only when at least two Skills need the same lifecycle, identity, prerequisite, or evidence rule. Otherwise the rule stays with its owning Skill. Preparatory fixtures or stubs become implementation tasks in the final handoff, not decisions in this ticket.

(CLOSED)
