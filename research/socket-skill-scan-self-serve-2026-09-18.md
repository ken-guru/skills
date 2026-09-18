# Findings: is Socket's newer AI-agent-skill scanning product self-serve reachable outside skills.sh's own pipeline? (2026-09-18)

Primary-source research feeding wayfinder decision ticket
[ken-guru/skills#333](https://github.com/ken-guru/skills/issues/333) via its research sub-ticket
[ken-guru/skills#335](https://github.com/ken-guru/skills/issues/335). A prior research pass already
confirmed the *standard* Socket-for-GitHub integration
(`docs.socket.dev/docs/socket-for-github`, `docs.socket.dev/docs/faq`) is manifest-based only
(npm/PyPI/Go/etc. package files) and is out of scope. This note is scoped narrowly to the *newer*
product announced 2026-02 at `socket.dev/blog/socket-brings-supply-chain-security-to-skills`, which
examines Markdown + Python/JS/TS/shell together without needing a package manifest, and which powers
skills.sh's own Socket risk-rating component.

## Verdict

**Not self-serve, confirmed (not merely unconfirmed).** Every primary source checked — the
announcement blog post itself, Socket's current CLI reference, its GitHub Action docs, its public
API reference, and GitHub Marketplace — either explicitly describes this capability as an internal
pipeline call, or contains no trace of it as a product a third party can invoke directly. There is no
self-serve CLI subcommand, no GitHub Action, and no documented public API endpoint for this specific
capability as of 2026-09-18.

## What the announcement itself says

Fetched `https://socket.dev/blog/socket-brings-supply-chain-security-to-skills` directly. The post
describes the integration mechanism explicitly:

> "When a skill is installed through the CLI, Vercel uploads the skill source code to Socket's APIs
> for security analysis."

This is the only integration path the post describes anywhere — Vercel's (skills.sh's) own
publishing/install pipeline calling a Socket API on skills.sh's behalf. The post:

- Does not mention any CLI command, GitHub Action, or public API endpoint a third-party repo could
  call directly.
- Does not mention pricing, tiers, or self-serve availability for this capability.
- Does not state a future self-serve release is planned.

The post frames the capability entirely as infrastructure behind skills.sh's own directory listing,
not as a standalone product.

## What Socket's current docs/CLI/API surface says

Checked each of the following live on 2026-09-18, specifically for any mention of skill/SKILL.md/
manifest-less scanning:

- **`docs.socket.dev/docs/socket-cli`** (CLI reference): every subcommand listed
  (`socket scan create`, `socket package score`, `socket ci`, `socket firewall`, `socket analytics`,
  `socket threat-feed`, `socket fix`, `socket optimize`, `socket login`/`logout`) is scoped to
  package/dependency manifests or npm/pip/cargo package names. No subcommand references skills,
  SKILL.md, or arbitrary markdown+code scanning.
- **`docs.socket.dev/docs/socket-scan`**: `socket scan create` "Uploads the specified dependency
  manifest files for Go, Gradle, JavaScript, Kotlin, Python, and Scala. Files like 'package.json' and
  'requirements.txt'." The `--markdown` flag is output-formatting only (renders scan *results* as
  markdown for sharing), unrelated to scanning Markdown *input*. No mention of skills.
- **`docs.socket.dev/docs/socket-for-github-actions`**: the published GitHub Action scans manifest
  files only (npm, pip via `socketsecurity`, Maven/Gradle/sbt), emitting a `.socket.facts.json`
  SBOM per build. No mention of skills or non-manifest scanning.
- **`docs.socket.dev/reference`** (API reference): endpoint categories are Issues, Packages, Scans,
  Files (supported-file checking for manifests), API Definition, Quota, Organizations, Settings,
  Repositories, Dependencies. No endpoint category for skills, agent capabilities, or arbitrary
  code/markdown bundle upload outside a package/dependency context.
- **No changelog entry found.** `docs.socket.dev/changelog` 404s; no changelog page turned up in
  either web search or site navigation as of this check.
- **GitHub Marketplace**: searching `github.com/marketplace?query=socket+skill` returns zero results.
  No Socket-published Action for skill scanning exists in the Marketplace.

## A related but distinct self-serve product (not what this ticket asked about)

`github.com/SocketDev/socket-basics` is a genuinely self-serve, open-source Socket tool (CLI, Docker,
GitHub Action, pre-commit hook) doing multi-engine SAST (15+ languages), secrets detection
(TruffleHog-backed), and container/Dockerfile scanning (Trivy-backed). It works without a package
manifest and an API token is optional for local/CLI use (only required for Dashboard-reported
results). However, per its own README framing, it is language-focused and does not treat Markdown as
code — it would scan a skill's Python/JS/shell scripts as ordinary source files, but not analyze the
SKILL.md instructions themselves or the Markdown+code relationship the Feb 2026 blog post's example
(a skill's Markdown directing execution of a malicious downloaded script) depends on. It predates and
is architecturally distinct from the capability described in the blog post, and its README makes no
connection between the two. Noting this for completeness, but it does not change the verdict above:
it is not the product this ticket is about, so it doesn't establish that product is self-serve.

## Answer to the decision ticket's narrowing question

Per #333's framing, this closes out the Socket branch of the tool-choice question: Socket's
skill-scanning product is **not adoptable** for this repo's own PR CI as of 2026-09-18 — there is
nothing self-serve to wire in. This narrows #333's tool choice to Snyk Agent Scan / Skill Inspector
alone, pending #337's real-run findings, exactly as #333's "Notes" section anticipated.
