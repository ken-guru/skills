# Task: Run Snyk Agent Scan / Skill Inspector against this repo

Wayfinder task ticket: https://github.com/ken-guru/skills/issues/336
Map: https://github.com/ken-guru/skills/issues/333

## What was run

Package: `snyk-agent-scan` (formerly published as `mcp-scan`; that name now prints a
rename warning and forwards to the same code). Version `0.6.3` at time of running,
installed on demand via `uvx`.

```
uvx snyk-agent-scan@latest inspect --skills --print-full-descriptions \
  "<repo>/skills" "<repo>/skills/presentation"
```

and (attempted, see below):

```
uvx snyk-agent-scan@latest scan --skills --print-full-descriptions \
  "<repo>/skills" "<repo>/skills/presentation"
```

## Key finding #1: default discovery is machine-wide, not repo-scoped

Run with **no positional path arguments**, `snyk-agent-scan` does not scope itself to
the current directory or any single project. It probes *every* well-known AI-agent
config location across the whole machine it's run on — Claude Code (`~/.claude`,
plus every project ever opened, recorded in `~/.claude.json`), VS Code family, Kiro,
Codex, Windsurf/Codeium, OpenCode, etc. — and enumerates every skill and MCP server
it finds anywhere on the machine. On the machine this was tested on, that surfaced
158 unrelated skills under an unrelated `~/.codeium` directory and MCP server
configs from three unrelated repos, none of which have anything to do with this
`ken-guru/skills` repo. In a clean, ephemeral CI runner this wouldn't matter (nothing
else would be present) — but it means "just run the scanner" is not repo-scoped
by default, and must not be pointed at a real developer machine's default config
without narrowing it first (see finding #2).

**Confirmed this run never sent any of that unrelated content anywhere**: the
`inspect` subcommand (used for this exploratory pass) is explicitly local-only —
"without security verification" — and never contacts a remote server for
verification. The default consent flow also required an explicit `y` per stdio MCP
server before it would even attempt to launch one; all were declined by piping no
input (or with a closed stdin), so no unrelated MCP server was ever started either.

## Key finding #2: explicit paths scope the scan precisely, with zero cross-talk

Passing directories as positional arguments (`... "<repo>/skills"
"<repo>/skills/presentation"`, alongside `--skills`) bypasses the well-known-path,
whole-machine discovery entirely and scans *only* the given directories. Confirmed
by reading the installed package's source (`agent_scan/pipelines.py`,
`discover_clients_to_inspect`): if `paths` is non-empty, the machine-wide "Phase A /
Phase B" discovery loop is skipped altogether. This is the invocation shape a CI
job should use — e.g. `uvx snyk-agent-scan@latest scan --skills --ci
"$GITHUB_WORKSPACE/skills"` (plus any other skill-container directories, since a
plain skills directory is scanned one level deep — see finding #3).

## Key finding #3: skill discovery is one level deep only

`inspect_skills_dir` (and the equivalent path-based logic used for an explicit
directory argument) lists the immediate children of the given directory and treats
each one with a `SKILL.md` inside as a skill. It does **not** recurse further. This
repo's own `skills/` directory mixes flat skills (`skills/setup-devcontainer/`,
`skills/unslop/`, the four `setup-*-devcontainer` skills) with one nested group
(`skills/presentation/<name>/`, 8 skills). Scanning `skills/` alone only found the 6
flat ones; `skills/presentation` had to be passed as a second, separate path to
also catch its 8. Any real CI wiring needs to enumerate every skill-container
directory explicitly (or scan `skills/*` glob-expanded to each skill's own parent),
not just the repo's top-level `skills/` folder.

## Result of the scoped local `inspect` run

All 14 of this repo's skills were found and correctly classified across the two
paths, split into `instruction` (`.md` files), `script` (`.sh`/`.js`/`.mjs` etc.),
and `asset` (everything else — JSON, CSS, test fixtures, etc.) — full file listing
per skill available in the ticket's resolution comment. No risk/security findings
were produced by this run, because `inspect` deliberately skips verification.

## Key finding #4: the actual risk-verification step requires a Snyk account token

Running the same scoped invocation with `scan` instead of `inspect` (the subcommand
that actually sends content to Snyk's analysis backend and returns risk findings)
fails immediately, before touching the network, with:

```
To use Agent Scan, set the SNYK_TOKEN environment variable. To get a token, go
to https://app.snyk.io/account (API Token -> KEY -> click to show).
```

There is no anonymous or unauthenticated path to real findings — a Snyk account and
API token are a hard prerequisite. No `SNYK_TOKEN` was available in this session, so
the actual risk/false-positive-rate/noise-level data this task ticket set out to
capture is **not yet captured**. That's the concrete blocker a follow-up ticket
needs to clear before the tool-choice/gating decision (see the map) can be made on
real evidence rather than vendor claims.

## Follow-up (issue #338): token provisioned, but the free tier's daily quota was already exhausted

With a real `SNYK_TOKEN` in place, the same scoped, two-path invocation was re-run:

```
SNYK_TOKEN=<token> uvx snyk-agent-scan@latest scan --skills --json \
  "<repo>/skills" "<repo>/skills/presentation"
```

Authentication succeeded (no auth error) and the CLI exited `0`, but **every path came
back with an error instead of risk data**:

```
"message": "Daily usage limit reached for the public version of Agent-Scan. Unlock
higher limits and enterprise features by contacting us at
https://evo.ai.snyk.io/#contact-us.",
"exception": "429, message='Too Many Requests', url='https://api.snyk.io/hidden/
mcp-scan/cli/analysis-machine?version=2026-07-10'"
```

`server_risks` and `skill_risks` were both empty arrays — no partial results, just the
rate-limit error, on what was this token's first authenticated analysis call. This is
itself a real, decision-relevant fact for the map: **the free/"public version" of Agent
Scan's verification backend enforces a daily quota tight enough to exhaust on a single
two-path scan of a 14-skill repo**, and clearing it requires contacting Snyk's Evo team
about enterprise/higher-limit access — not just having a free-tier account token. This
materially affects both the "cost" and "gating vs. advisory" parts of the pending
decision: a hard per-day cap is very difficult to reconcile with gating *every* PR, and
even advisory/scheduled usage (mirroring the existing Trivy image-scan cadence) would
need headroom-planning against whatever the actual daily cap turns out to be — that
number itself is still unknown; only that two calls exhausted it. Not retried further
given the explicit "daily" framing and to avoid hammering a rate-limited vendor
endpoint — a fresh attempt after quota reset (timing unconfirmed) would be needed to
get first real per-skill findings.
