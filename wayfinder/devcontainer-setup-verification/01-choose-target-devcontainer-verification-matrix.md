## Question

What Target Devcontainer fixture matrix is required for the suite's verification contract?

The decision must specify the minimum scenarios that prove the six Skills work from a clean state, that every Add-on Skill honors the Retrofit Contract when installed alone against an existing Target Devcontainer, and that the complete suite preserves its cross-Skill handoffs. Decide whether the matrix must vary the pre-existing user model, base image family, named-volume state, and host/runtime platform, and which variations are representative rather than combinatorial.

Labels: `wayfinder:grilling`

Claimed by: Codex

Blocked by: None

## Resolution

The verification contract requires four lanes:

1. scaffold a clean Target Devcontainer and install all six Skills;
2. install each Add-on Skill alone into a pre-existing Target Devcontainer;
3. exercise the supported combined handoffs, especially firewall + agentic CLIs + lifecycle;
4. restart and re-attach an already configured container to verify persistence and idempotency.

The representative fixture pair is a suite-scaffolded Debian-slim Target Devcontainer and a separately authored non-root Debian/Ubuntu Target Devcontainer. Both are exercised with empty and pre-populated named-volume state. Root-default targets are not added to the full matrix implicitly; their support status must be decided explicitly by the security-boundary ticket.

Deterministic tests use local fixtures or stubs for package metadata, MCP handshakes, and GitHub API responses. Real allowlisted/blocked network checks and deploy-key registration belong to a marked live acceptance lane. `caffeinate` remains a manual host-boundary check unless a supported host runner is later established.

(CLOSED)
