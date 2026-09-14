# Research: what hardening does Anthropic's devcontainer doc recommend, and what does an agent CLI need network access to?

## Question

Issue [#283](https://github.com/ken-guru/skills/issues/283), a child of the
wayfinder map issue [#281](https://github.com/ken-guru/skills/issues/281)
("Decide setup-devcontainer's hardening priorities: Baseline Containment +
Supply-chain Hardening"), asks two things:

1. What concrete hardening mechanism(s) does Anthropic's own devcontainer
   documentation ([code.claude.com/docs/en/devcontainer](https://code.claude.com/docs/en/devcontainer))
   recommend for an agent-running devcontainer — especially any network
   egress allowlist/firewall mechanism (how it's implemented: iptables,
   DNS-based, a startup script, what's on the default allowlist), filesystem
   restrictions, and non-root/capability guidance?
2. What does an agent CLI legitimately need network access to in general
   (npm registry, GitHub, model-provider APIs), concretely enough to seed a
   later egress-allowlist decision? This repo's Shared Container
   (`skills/setup-devcontainer/templates/devcontainer.json` and
   `.../templates/Dockerfile`) installs and runs **four** AI CLIs — Claude
   Code, OpenAI Codex, Google Antigravity, GitHub Copilot CLI — each with its
   own provider API to reach, so each vendor's own docs were checked
   individually.

Today the Shared Container template runs as a non-root `vscode` user, has no
network egress restriction, no seccomp/cap-drop, and no read-only rootfs
(confirmed by reading both template files in full before starting research).

Research standard: primary sources only — vendor-owned documentation, vendor
source code, and vendor GitHub repos, never blog posts, community
write-ups, or memory. Every claim below is followed back to the specific page
or file it came from. A few gaps where no primary source exists are flagged
explicitly rather than filled from secondary sources.

## Findings

### 1. Claude Code's devcontainer doc: the exact hardening mechanisms

[code.claude.com/docs/en/devcontainer](https://code.claude.com/docs/en/devcontainer)
is a "how to use a dev container with Claude Code" page, not a hardening
spec — it is short on prescription and mostly points at a *reference*
container. Its own hardening content:

**Network egress — "Restrict network egress" section.** The doc's own words:
"You can limit the container's outbound traffic to only the domains Claude
Code needs... The reference container includes an
[`init-firewall.sh`](https://github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh)
script that limits outbound traffic to the destinations the script allows.
Running a firewall inside a container requires extra permissions, so the
reference adds the `NET_ADMIN` and `NET_RAW` capabilities through `runArgs`.
**The firewall script and these capabilities are not required for Claude Code
itself: you can leave them out and rely on your own network controls
instead.**" (emphasis on the doc's own explicit statement that this is
optional, not a requirement). The doc frames the reference container as "a
working example rather than a maintained base image."

**Filesystem — no dedicated filesystem-hardening section on this page at
all.** The devcontainer doc does not mention read-only rootfs, seccomp, or
capability-dropping anywhere. Its only filesystem-adjacent guidance is in the
top warning box: "Avoid mounting host secrets such as `~/.ssh` or cloud
credential files into the container; prefer repository-scoped or short-lived
tokens," and a caution that with `--dangerously-skip-permissions`, "dev
containers do not prevent a malicious project from exfiltrating anything
accessible inside the container, including the Claude Code credentials
stored in `~/.claude`."

**Non-root — "Run without permission prompts" section.** This is the doc's
one *hard requirement*, not just a recommendation: "Because the container
runs Claude Code as a non-root user and confines command execution to the
container, you can pass `--dangerously-skip-permissions` for unattended
operation. **The CLI rejects this flag when launched as root**, so confirm
`remoteUser` is set to a non-root account." This is enforced by the CLI
itself, not merely advised.

**Capabilities — no cap-drop, no seccomp guidance on this page.** The only
capability action documented is *adding* `NET_ADMIN`/`NET_RAW` to run the
firewall script — the opposite direction from hardening. Nothing in this doc
recommends `cap-drop`, `--security-opt no-new-privileges`, or a seccomp
profile for the devcontainer itself (Claude Code's own OS-level Bash sandbox,
covered separately below, does use seccomp, but that is a distinct feature
from the devcontainer).

### 2. The reference container — exact implementation, read from source

The doc names three files in `anthropics/claude-code` as the reference
example and explicitly says none is required. I fetched all three from
`raw.githubusercontent.com/anthropics/claude-code/main/.devcontainer/` and
read them in full.

**`init-firewall.sh`** (136 lines) — mechanism: **`iptables` + `ipset`**, not
DNS-based blocking and not a proxy.

- Creates `ipset create allowed-domains hash:net` (a CIDR-capable IP set).
- Fetches GitHub's IP ranges dynamically at container-start from
  `https://api.github.com/meta` (the `web`, `api`, and `git` key ranges),
  aggregates them with the `aggregate` tool, and loads them into the ipset.
  This means the reference script does **not** hardcode `github.com`'s IPs —
  it re-resolves them (via GitHub's official meta endpoint) every time the
  firewall initializes.
- Resolves and adds these **exact** domains by one-shot `dig` lookup at
  startup: `registry.npmjs.org`, `api.anthropic.com`, `sentry.io`,
  `statsig.com`, `marketplace.visualstudio.com`,
  `vscode.blob.core.windows.net`, `update.code.visualstudio.com`.
- Also allows the host's own `/24` subnet (derived from the container's
  default route) for INPUT/OUTPUT, and DNS (UDP/53) and SSH (TCP/22) before
  any restriction is applied.
- Sets **default-deny**: `iptables -P INPUT DROP`, `-P FORWARD DROP`, `-P
  OUTPUT DROP`, then allows only ESTABLISHED/RELATED connections and traffic
  matching the `allowed-domains` ipset; everything else is explicitly
  rejected with `iptables -A OUTPUT -j REJECT --reject-with
  icmp-admin-prohibited` (an immediate, informative reject rather than a
  silent drop).
- Self-verifies at the end: confirms `https://example.com` is unreachable and
  `https://api.github.com/zen` is reachable, and `exit 1`s the whole
  container-start step if either check fails.
- This is a one-shot IP-based allowlist, resolved once at container start —
  **not** DNS-query-time filtering, so a domain whose IP changes after
  container start (other than GitHub's, which is re-fetched each start) would
  need a container restart to pick up a new address.

**`devcontainer.json`** — `runArgs: ["--cap-add=NET_ADMIN",
"--cap-add=NET_RAW"]` (the two capabilities the doc calls out);
`remoteUser: "node"`; `postStartCommand: "sudo /usr/local/bin/init-firewall.sh"`
(the firewall runs on every start, as root, via a scoped sudo rule, not at
build time); `waitFor: "postStartCommand"` (the editor waits for the firewall
to finish before attaching). No `cap-drop`, no `--read-only`, no
`--security-opt` entries.

**`Dockerfile`** — installs `iptables ipset iproute2 dnsutils aggregate jq`
as apt packages; creates the `node` user (already the base image's default
non-root user) and does `USER node` for the bulk of the build; grants exactly
one passwordless-sudo line: `echo "node ALL=(root) NOPASSWD:
/usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall` — i.e. the
non-root user can run *only* the firewall script as root, nothing else. No
`cap-drop`, seccomp profile, or read-only-rootfs directive anywhere in the
file.

Notably, the reference script's hardcoded domain list is **narrower and
staler** than Claude Code's own current, fully-documented network
requirements (see §3) — it predates hosts like `claude.ai`,
`platform.claude.com`, `mcp-proxy.anthropic.com`, `downloads.claude.ai`,
`storage.googleapis.com`, `bridge.claudeusercontent.com`,
`*.frame.claudeusercontent.com`, `raw.githubusercontent.com`, the two Datadog
telemetry-intake hosts, and `code.claude.com`. This is a maintenance gap in
the example itself, not a doc contradiction — worth treating the *reference
script's* hardcoded list as illustrative only, and the network-access-
requirements table (§3) as the authoritative current list.

### 3. Claude Code's own required and optional network hosts

[code.claude.com/docs/en/network-config#network-access-requirements](https://code.claude.com/docs/en/network-config#network-access-requirements)
is the authoritative, current table (separate from the devcontainer page).
Required/functional hosts, quoted verbatim from the table:

| Host | Required for |
|---|---|
| `api.anthropic.com` | Claude API requests, WebFetch domain safety check, feature-flag fetches, telemetry event logging |
| `claude.ai` | claude.ai account authentication |
| `claude.com` | sign-in redirect landing page; pre-approved WebFetch doc lookups |
| `platform.claude.com` | Anthropic Console auth; OAuth token exchange/refresh/revocation for both Console and claude.ai accounts |
| `mcp-proxy.anthropic.com` | MCP connectors from claude.ai (optional: `ENABLE_CLAUDEAI_MCP_SERVERS=false` or `disableClaudeAiConnectors`) |
| `downloads.claude.ai` | plugin executable downloads; native installer/auto-updater/version checks |
| `storage.googleapis.com` | plugin install counts/metadata in `/plugin`; pre-2.1.116 native installer/updater |
| `registry.npmjs.org` | plugin npm-package installs, `npx`-launched MCP servers, npm/bun installs of Claude Code itself |
| `bridge.claudeusercontent.com` | Claude in Chrome extension WebSocket bridge |
| `*.frame.claudeusercontent.com` | Artifact content reads (optional: `enableArtifact:false` / `CLAUDE_CODE_DISABLE_ARTIFACT=1`) |
| `raw.githubusercontent.com` | `/release-notes` changelog feed |
| `*-review.googlesource.com` | Gerrit change lookup on googlesource.com checkouts only |
| `http-intake.logs.us5.datadoghq.com` | operational telemetry (optional: `DISABLE_TELEMETRY` or `DO_NOT_TRACK`) |
| `browser-intake-us5-datadoghq.com` | operational error reports (optional: `DISABLE_ERROR_REPORTING` or `DISABLE_TELEMETRY`) |
| `formulae.brew.sh` | Homebrew-install version checks only |
| `code.claude.com` | documentation lookups by the claude-code-guide agent / pre-approved WebFetch |

The doc adds that `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` (set in
`containerEnv`) disables both Datadog telemetry hosts at once, and also
disables feature-flag fetching (which Remote Control depends on). This exact
snippet is what the devcontainer doc's "Enforce organization policy" section
recommends putting in `containerEnv`:

```json
"containerEnv": {
  "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
  "DISABLE_AUTOUPDATER": "1"
}
```

Corroborating source:
[code.claude.com/docs/en/data-usage#telemetry-services](https://code.claude.com/docs/en/data-usage#telemetry-services) —
confirms the two telemetry channels are "Metrics" (`DISABLE_TELEMETRY=1`) and
"Error reports" (`DISABLE_ERROR_REPORTING=1`), both over TLS, both optional
and off by default on non-Anthropic-API providers (Bedrock, Vertex, Foundry).

### 4. Claude Code's *own* OS-level sandbox — a separate, complementary mechanism

[code.claude.com/docs/en/sandboxing](https://code.claude.com/docs/en/sandboxing)
documents a mechanism Claude Code ships **independently of the devcontainer**
— it is not iptables-based and is worth distinguishing clearly from §2 because
both are candidate "hardening mechanisms" but they operate at different
layers and neither depends on the other:

- **OS-level enforcement primitives**: "macOS: uses Seatbelt for sandbox
  enforcement... Linux: uses bubblewrap (`bwrap`) for isolation... WSL2: uses
  bubblewrap, same as Linux." Linux/WSL2 additionally needs `socat` (the relay
  for routing network traffic through the sandbox proxy) and, optionally, a
  seccomp filter (installed via `npm install -g @anthropic-ai/sandbox-runtime`)
  that adds Unix-domain-socket blocking.
- **Network isolation mechanism is a local proxy, not iptables**: "Network
  access is controlled through a proxy server running outside the sandbox...
  Claude Code pre-allows no domains by default. The first time a command
  needs a new domain, Claude Code prompts for approval... The built-in proxy
  enforces the allowlist based on the requested hostname and, by default,
  does not terminate or inspect TLS traffic." An experimental
  `network.tlsTerminate` setting can make the proxy terminate TLS for
  credential-masking use cases.
- **Filesystem isolation**: default write access is the working directory,
  `--add-dir` directories, and the session temp dir; default *read* access is
  "the entire computer, except certain denied directories" (explicitly noting
  this still permits reading `~/.aws/credentials` and `~/.ssh/` unless you
  add `sandbox.credentials` deny rules). A fixed list of "protected paths"
  (settings files, `.git/hooks`, `~/.claude`, etc.) is always denied for
  writes regardless of other rules, with no override short of disabling
  filesystem isolation entirely.
- This is a **per-Bash-command** sandbox inside the Claude Code process
  itself (via bwrap/Seatbelt), distinct from — and stackable with — a
  container-level iptables firewall. The devcontainer doc's own "Next steps"
  list separately links to
  [Sandbox environments](https://code.claude.com/docs/en/sandbox-environments)
  for comparing the two approaches, confirming Anthropic treats them as
  alternative/complementary layers rather than one subsuming the other.

### 5. What an agent CLI generically needs network access to

Cutting across the sources above and the vendor-specific sections below, the
recurring categories of outbound traffic every one of these CLIs needs are:
(a) **package registry** for its own install/update and for anything it
installs on your behalf (npm registry above all); (b) **auth/identity**
(OAuth/token exchange with the vendor); (c) **model/inference API** (the
actual chat-completions/streaming endpoint); (d) **git hosting** (GitHub, for
clone/push/PR operations the agent performs); (e) **optional telemetry/error-
reporting/update-check** traffic, which every vendor examined makes possible
to disable and none makes strictly required for core function.

### 6. OpenAI Codex CLI — sandbox and network mechanism

Primary source:
[learn.chatgpt.com/docs/agent-approvals-security](https://learn.chatgpt.com/docs/agent-approvals-security)
(canonical page; `developers.openai.com/codex/agent-approvals-security`
308-redirects here).

- **Sandbox modes**: `read-only`, `workspace-write` (default), and
  `danger-full-access` ("No sandbox; no approvals _(not recommended)_").
- **Network is disabled by default even in `workspace-write`.** To enable it:
  `[sandbox_workspace_write] network_access = true` in `config.toml` (or the
  `-c sandbox_workspace_write.network_access=true` CLI override).
- **A distinct, allowlist-capable network proxy feature**, separate from the
  sandbox toggle: `[features.network_proxy] enabled = true` with a `domains`
  map, e.g. `domains = { "api.openai.com" = "allow", "example.com" = "deny"
  }`. Documented matching rules: "Exact hosts match only themselves,"
  `*.example.com` matches subdomains, `allow_local_binding = false` blocks
  loopback/link-local/private destinations by default, and "Hostnames that
  resolve to non-public addresses are blocked" (a DNS-rebinding guard). The
  proxy explicitly does **not** filter "web search, app or connector tool
  calls, MCP server connections, browser or Computer Use activity, Codex
  cloud tasks, or the client's model and authentication requests" — i.e. the
  network_proxy allowlist covers only sandboxed shell-command traffic, not
  Codex's own control-plane calls.
- **OS-level enforcement**: macOS uses Seatbelt (`sandbox-exec` with a
  profile matching the selected mode); Linux uses `bwrap` plus `seccomp` by
  default (a related search of OpenAI's docs also surfaced "Landlock/Seccomp"
  phrasing for Linux enforcement — both point at the same Linux
  namespace+seccomp sandboxing approach, not two different mechanisms);
  Windows uses restricted process tokens natively, or the Linux approach
  under WSL2.
- No single "domains Codex needs" table was found on this page equivalent to
  Claude Code's network-config table; the one concretely named host in the
  example config is `api.openai.com`.

### 7. Google Antigravity — sandbox and network mechanism

Primary sources: [antigravity.google/docs/cli/sandbox/](https://antigravity.google/docs/cli/sandbox/),
[antigravity.google/docs/permissions/](https://antigravity.google/docs/permissions/),
[antigravity.google/docs/enterprise/](https://antigravity.google/docs/enterprise/).

- **Filesystem**: "Workspace folders and paths allowed under `write_file` are
  mounted read-write... Paths allowed under `read_file` are mounted
  read-only, on top of the default system mounts... Denied paths are blocked,
  and everything else is inaccessible," with an explicit statement that
  "Sensitive files like `~/.ssh` and `.env` are blocked" by default.
- **Network**: "Sandboxed commands run without network access by default...
  In sandbox mode, any domain granted under `read_url` is compiled directly
  into the container's outbound network allowlist (`AllowedDomains`),
  permitting commands like `curl` or `npm` to connect to authorized hosts."
  The `read_url` permission defaults to **Ask**: "Before the Agent navigates
  to or actuates on any web page, it will pause and prompt for your explicit
  approval unless an allow rule is configured." No domains are pre-configured
  by default.
- **OS-level primitives**: Linux — "Kernel namespaces isolate the filesystem,
  hide host processes, and cut off networking." macOS — "Seatbelt profiles
  (SBPL) restrict filesystem access and socket connections."
- **Escape hatch**: an explicit `unsandboxed` allow rule lets matching
  commands run outside the sandbox without prompting (structurally analogous
  to Claude Code's `dangerouslyDisableSandbox` retry and Codex's
  `danger-full-access` mode).
- **Gap**: neither the CLI/sandbox page, the permissions page, nor the
  enterprise page publishes a concrete list of hostnames Antigravity itself
  needs to reach for auth, model inference, or telemetry — the enterprise
  page's only concrete network-relevant items are that the Agent Platform API
  (`aiplatform.googleapis.com`) must be enabled in the target Google Cloud
  project and that VPC Service Controls perimeters can include that API.
  Third-party reverse-engineering write-ups (not consulted as sources here,
  per the primary-sources-only standard) claim additional
  `*.googleapis.com`/`*.sandbox.googleapis.com` hosts, but these are
  unconfirmed against antigravity.google's own docs and are **not** cited as
  fact in this research — treat Antigravity's own required-hosts list as
  undocumented by the vendor at time of writing, and expect to need live
  traffic observation (or the vendor's future publication of such a table) to
  pin it down precisely.

### 8. GitHub Copilot CLI — network/firewall allowlist

Primary source:
[docs.github.com/en/copilot/reference/copilot-allowlist-reference](https://docs.github.com/en/copilot/reference/copilot-allowlist-reference),
cross-referenced with
[docs.github.com/en/copilot/concepts/network-settings](https://docs.github.com/en/copilot/concepts/network-settings).
This is the most concrete, ready-to-use domain table among the four vendors.
Core/required entries relevant to CLI usage:

- Auth: `github.com/login/*`, `github.githubassets.com`,
  `avatars.githubusercontent.com`, `api.github.com/user`,
  `api.github.com/copilot_internal/*`
- Suggestions/completions API: `copilot-proxy.githubusercontent.com`,
  `origin-tracker.githubusercontent.com`
- Telemetry (optional-ish, but on the required allowlist for full
  functionality): `collector.github.com/*`,
  `copilot-telemetry.githubusercontent.com/telemetry`
- Experimentation: `default.exp-tas.com`
- Usage reports: `copilot-reports.github.com`
- Plan-specific subscription routing (pick per your plan):
  `*.individual.githubcopilot.com`, `*.business.githubcopilot.com`,
  `*.enterprise.githubcopilot.com`
- Voice features (CLI and app): several `*.azureml.ms` /
  `*.blob.core.windows.net` Azure hosts, only needed if voice input is used.

GitHub's own "Network settings" page states the operating premise plainly:
"Users must be able to authenticate to GitHub and access the Copilot service
on GitHub.com or GHE.com... The administrator of your proxy server or
firewall also needs to configure network settings for Copilot to work as
expected," and confirms Copilot CLI "supports basic HTTP proxy setups" with
basic or Kerberos proxy authentication.

### 9. npm registry and GitHub git/API hosts

- **npm**: [docs.npmjs.com/cli/v10/using-npm/registry](https://docs.npmjs.com/cli/v10/using-npm/registry) —
  "npm is configured to use the npm public registry at
  `https://registry.npmjs.org` by default." This single host covers `npm
  install`, `npx`, and (per Claude Code's own network table) plugin/MCP
  package installs.
- **GitHub git and API operations**: [docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses)
  is GitHub's own "how to allowlist us" guidance, and it explicitly
  recommends **hostname allowlisting over IP allowlisting**: "We do not
  recommend allowing by IP address, but if you use these IP ranges we
  strongly encourage regular monitoring of our API," and separately notes the
  Meta API's IP list "is not intended to be an exhaustive list" (LFS and
  GitHub Packages addresses, for example, aren't guaranteed to be covered).
  For applications, it says to "allow TCP ports 22, 80, and 443 via our IP
  ranges for `github.com`." The page does not itemize `api.github.com`,
  `codeload.github.com`, or `objects.githubusercontent.com` separately from
  `github.com` — in practice `github.com` (web + git-over-https) and
  `api.github.com` (REST/GraphQL, used by `gh` and any tool calling GitHub's
  API) are the two hosts to allowlist for CLI git+API use; `gh`'s own manual
  ([cli.github.com/manual/gh_help_environment](https://cli.github.com/manual/gh_help_environment))
  confirms `GH_HOST` defaults to `github.com` and that `gh` honors standard
  `HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY` env vars, with no separate host
  needed beyond the one `GH_HOST` names. This directly validates — and
  simultaneously critiques — the reference container's approach in §2: it
  dynamically resolves `api.github.com/meta`'s IP ranges rather than
  hardcoding IPs, which is compatible with GitHub's "don't hardcode IPs"
  guidance in spirit, but the mechanism is still IP-set-based rather than the
  hostname-based enforcement GitHub's own guidance more directly recommends.

## What's directly reusable for skills/setup-devcontainer's Shared Container

The Shared Container (`skills/setup-devcontainer/templates/devcontainer.json`,
`.../templates/Dockerfile`) today: non-root `vscode` user (already matches
Claude Code's one *hard* devcontainer requirement), no egress restriction, no
cap-drop/seccomp, no read-only rootfs. Concrete, directly-portable
recommendations, ranked by how load-bearing each is against Anthropic's own
guidance:

1. **Adopt the iptables/ipset default-deny firewall pattern, not the
   reference script's stale hardcoded list.** The reference `init-firewall.sh`
   mechanism (ipset + default-DROP + one allowlist match rule +
   ESTABLISHED/RELATED) is directly portable to this repo's Dockerfile/
   `postStartCommand` — copy the *mechanism*, not the *domain list* (§2's gap
   analysis shows the reference list is stale). Build the starting allowlist
   from the current, per-vendor lists gathered here instead: Claude Code's
   full table (§3), `registry.npmjs.org` (§9), `github.com` +
   `api.github.com` (§9, needed for `gh` and any CLI's git/API operations),
   Codex's `api.openai.com` example (§6, likely incomplete — Codex's own docs
   don't publish a full table), Copilot's allowlist table (§8), and
   Antigravity's one confirmed host `aiplatform.googleapis.com` plus a
   documented gap to revisit (§7). This needs `NET_ADMIN`/`NET_RAW` added to
   `runArgs`, matching what Anthropic's own reference does.
2. **Keep this firewall strictly optional/toggleable**, consistent with
   Anthropic's own explicit statement that "the firewall script and these
   capabilities are not required for Claude Code itself." Given this repo
   already treats SSH/deploy-key automation as an opt-in layer added on top
   of the base container, an egress-firewall layer fits the same pattern:
   ship it as an additional opt-in piece (e.g. a `setup-devcontainer` sub-flow
   or its own installer script), not a default-on requirement, so a container
   without Codex/Antigravity/Copilot installed isn't stuck babysitting a
   4-vendor allowlist it doesn't need.
3. **No action needed on non-root enforcement** — the template already runs
   `USER vscode` with a pinned UID/GID before any CLI installs, which already
   satisfies the one non-negotiable requirement in Anthropic's doc (the CLI
   *rejects* `--dangerously-skip-permissions` under root). Worth a one-line
   comment in the Dockerfile noting *why* non-root matters here, since none of
   the template's current comments mention it.
4. **Cap-drop / read-only-rootfs / seccomp have no vendor-doc precedent to
   copy.** None of the four CLIs' docs (Claude Code's devcontainer doc
   included) prescribe `cap-drop`, `--security-opt no-new-privileges`, or
   `--read-only` for the *devcontainer* itself — those ideas would be this
   repo's own addition, not something traceable to a primary source the way
   the firewall and non-root guidance are. If pursued, they should be scoped
   as a separate research/decision item rather than folded into "what
   Anthropic recommends," since Anthropic's own reference container doesn't
   use them either.
5. **Prefer hostname-based enforcement over the reference script's dynamic
   IP-resolution approach where practical**, per GitHub's own "we do not
   recommend allowing by IP address" guidance (§9) — e.g., a proxy-based
   allowlist (mirroring how Claude Code's *own* sandbox does host-based
   enforcement via a local proxy, §4) would track vendor domain changes more
   robustly than one-shot `dig`/`ipset` resolution, at the cost of more
   moving parts than the shell-script-and-iptables approach Anthropic ships
   as its own example.

## Source citations

- Anthropic — [Development containers](https://code.claude.com/docs/en/devcontainer)
  (core devcontainer doc: "Restrict network egress" and "Run without
  permission prompts" sections, reference-container pointer, `containerEnv`
  policy example)
- Anthropic — [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)
  (Claude Code's own OS-level sandbox: bwrap/Seatbelt, proxy-based network
  isolation, filesystem default-read/default-write behavior, protected paths)
- Anthropic — [Enterprise network configuration](https://code.claude.com/docs/en/network-config)
  (`#network-access-requirements` table — the authoritative current host
  list; proxy env vars; CA/mTLS config)
- Anthropic — [Data usage](https://code.claude.com/docs/en/data-usage)
  (`#telemetry-services` — metrics/error-report hosts and opt-out variables)
- Anthropic/GitHub —
  [`anthropics/claude-code/.devcontainer/init-firewall.sh`](https://github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh),
  [`devcontainer.json`](https://github.com/anthropics/claude-code/blob/main/.devcontainer/devcontainer.json),
  [`Dockerfile`](https://github.com/anthropics/claude-code/blob/main/.devcontainer/Dockerfile)
  (fetched verbatim via `raw.githubusercontent.com`; full contents read, not
  summarized secondhand)
- OpenAI/Codex —
  [Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)
  (canonical page; `developers.openai.com/codex/agent-approvals-security`
  redirects here) — sandbox modes, `sandbox_workspace_write.network_access`,
  `features.network_proxy` domain allow/deny config, OS enforcement per
  platform
- Google Antigravity —
  [Sandbox](https://antigravity.google/docs/cli/sandbox/),
  [Permissions](https://antigravity.google/docs/permissions/),
  [Enterprise](https://antigravity.google/docs/enterprise/)
  (filesystem/network sandbox mechanism, `read_url`→`AllowedDomains`
  compilation, `aiplatform.googleapis.com` requirement, confirmed absence of
  a published required-hosts table)
- GitHub Copilot —
  [Copilot allowlist reference](https://docs.github.com/en/copilot/reference/copilot-allowlist-reference),
  [Network settings for GitHub Copilot](https://docs.github.com/en/copilot/concepts/network-settings)
  (exact firewall domain table, proxy support statement)
- npm — [`docs.npmjs.com/cli/v10/using-npm/registry`](https://docs.npmjs.com/cli/v10/using-npm/registry)
  (default registry host)
- GitHub — [About GitHub's IP addresses](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-githubs-ip-addresses)
  (hostname-over-IP allowlisting guidance, port requirements, Meta API
  non-exhaustiveness caveat)
- GitHub CLI — [`gh` environment variables manual](https://cli.github.com/manual/gh_help_environment)
  (`GH_HOST` default, proxy env var support)
- Repo files read in full before this research:
  `skills/setup-devcontainer/templates/devcontainer.json`,
  `skills/setup-devcontainer/templates/Dockerfile`
- Issue [#283](https://github.com/ken-guru/skills/issues/283) — this research
  ticket; wayfinder map issue [#281](https://github.com/ken-guru/skills/issues/281)
