# Per-CLI MCP config checklist (stub)

Fill this in for whichever agentic CLIs your project wires up. Don't trust
a CLI's documentation alone for the trust-scoping column; confirm each row
empirically against the actual installed version before relying on it,
non-interactive/scripted behavior in particular has surprised us more than
once.

| CLI | Config file location | Auto-detected by cwd? | Non-interactive mode quirks | Verified against version | Verification command used | Vendor API/auth domains needed |
|---|---|---|---|---|---|---|
| Claude Code | | | | | | |
| Codex | | | | | | |
| Gemini CLI | | | | | | |
| Cursor CLI | | | | | | |
| (add more as needed) | | | | | | |

The last column is easy to skip entirely, and skipping it produces a
container that looks complete (every CLI installed, pinned, and MCP-wired)
but can't actually serve a single prompt once the firewall from
[NETWORK-FIREWALL.md](../../NETWORK-FIREWALL.md) is in place, because
nothing else in this checklist asks the question. A CLI needs outbound
access to its own vendor's inference/auth API to function at all, and
that's a different, usually larger, domain list (often several hosts:
separate auth, telemetry, and API subdomains are common) than whatever
package registry was needed to install the CLI in the first place. Fill
this column in for every CLI in this table, and add those domains to your
firewall's allowlist manifest (see
[`templates/firewall/allowed-domains.manifest.example.json`](../firewall/allowed-domains.manifest.example.json))
as their own entry, distinct from the entry for the package registry the
CLI was installed from.

## Checklist per CLI

For each agentic CLI your project integrates with MCP servers:

- [ ] Confirm the exact config file path and format (JSON, TOML, other) from that CLI's own current documentation, not from memory or from another CLI's convention.
- [ ] Confirm whether the config is auto-detected by current working directory, or requires an explicit "use this project" step.
- [ ] Test **interactive** invocation: does the CLI pick up the project's MCP config without extra flags?
- [ ] Test **non-interactive** invocation (a `--print`, `exec`, headless, or scripted mode, if the CLI has one) separately. Do not assume it behaves the same as interactive mode; in our own testing across three different CLIs, at least one diverged here.
- [ ] Confirm whether project trust level, sandboxing, or approval settings gate **config loading** (whether the server even gets registered) versus gating **tool invocation** (whether a registered tool can actually be called). These are frequently two separate gates with two separate flags, and conflating them leads to either believing wiring is broken when it isn't, or believing an unapproved invocation path is safe when it isn't.
- [ ] Confirm tool **listing** works in non-interactive mode without any approval-bypass flag. If it doesn't, that's a wiring problem worth fixing before moving on.
- [ ] Confirm tool **invocation** in non-interactive mode, and note exactly which flag or trust configuration was required to get past the approval gate. Reserve that flag for deliberate one-off verification, don't bake it into routine automation, since it commonly bypasses other safety gates (sandboxing, exec policy) at the same time.
- [ ] Record the CLI version tested against. Trust-scoping behavior is exactly the kind of thing that changes across releases without a prominent changelog entry.
- [ ] Re-verify this row after any major version bump of that CLI, not just at initial setup.
- [ ] Identify this CLI's own vendor API/auth domains (distinct from whatever package registry installed it) and confirm they're in the firewall's allowlist. Test this for real: run a prompt through the CLI inside the built, firewalled container, not just a version check, since a wiring-complete CLI that can't reach its own backend fails in a way none of the checks above would catch.

## Notes template (copy per CLI)

```
### <CLI name>

- Config file: <path>
- Format: <JSON / TOML / other>
- Auto-detected by cwd: <yes / no / only in interactive mode>
- Non-interactive invocation tested: <command used>
- Config loading gated by trust/sandbox setting: <yes / no / partially, explain>
- Tool listing works without approval bypass: <yes / no>
- Tool invocation requires: <flag or trust configuration, if any>
- Verified against version: <version string>
- Surprises: <anything that diverged from the documented/expected behavior>
```
