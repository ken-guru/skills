## Question

What bounded performance and resource budgets should the verification contract enforce?

Define measurable limits for build overhead, clean startup and restart latency, firewall initialization and refresh work, CLI/MCP lifecycle checks, statusline cost, and host-awake behavior. Decide which measurements are hard gates, which are diagnostic telemetry, how much variance different Docker/host environments permit, and what evidence is sufficient to prevent a background loop or lifecycle hook from silently becoming expensive.

Labels: `wayfinder:grilling`

Claimed by: Codex

Blocked by: None

## Resolution

The contract measures six dimensions: build duration and image size, first boot and restart latency, firewall initialization and refresh cost, CLI/MCP health-check duration, statusline prompt overhead, and host-awake process behavior.

Hard gates apply when resource behavior threatens reliability or safety: startup timeouts, unbounded refresh work, duplicated processes across restart or re-attach, skipped checks caused by timeout, materially delayed prompts, or persistent loops after a feature is disabled. Slower-but-correct behavior is recorded as diagnostic telemetry rather than failing the suite by itself.

Budgets use scenario-specific ceilings for deterministic local work, with cold and warm runs distinguished. Live network and GitHub operations do not receive hard timing gates. Reports retain environment metadata and compare results against a baseline rather than claiming identical absolute timings across hosts.

Every refresh, statusline, age-gating, and host-awake component must have bounded polling and lifecycle-safe process behavior: at most one relevant process per container or attachment, no multiplication after restart/re-attach, and clean shutdown where applicable. CPU and memory samples are retained diagnostically.

(CLOSED)
