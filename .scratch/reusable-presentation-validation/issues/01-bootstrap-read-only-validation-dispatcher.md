# 01 — Bootstrap the read-only validation dispatcher

**What to build:** A versioned `presentation-validation` dispatcher that accepts a Project Folder, performs environment preflight, supports human and JSON output, returns the agreed exit statuses, and guarantees that ordinary validation performs no unintended writes.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The dispatcher accepts an explicit Project Folder and does not infer the Skill installation directory as the project root.
- [ ] A `check all` entry point and composable named check groups are available.
- [ ] Human-readable output is the default and stable JSON output is available explicitly.
- [ ] Exit statuses distinguish success, blocking validation failure, invalid invocation/configuration, and unexpected runtime failure.
- [ ] Runtime version and report-schema version are exposed.
- [ ] Environment preflight aggregates missing prerequisites and never installs tools or credentials.
- [ ] A successful or failed validation run leaves the Project Folder unchanged unless an explicit report destination is requested.
