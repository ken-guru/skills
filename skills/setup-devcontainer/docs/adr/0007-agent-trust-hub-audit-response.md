# ADR-0007: Response posture for the Agent Trust Hub HIGH-risk rating

**Status:** Accepted
**Date:** 2026-09-18

## Context

skills.sh's "Gen Agent Trust Hub" (combined with Socket and Snyk) rated `setup-claude-devcontainer`
HIGH risk on its public listing page, a live deterrent to adoption ([the map, issue
#327](https://github.com/ken-guru/skills/issues/327)). The audit flagged four things:
`REMOTE_CODE_EXECUTION` (skill-sync), `PERSISTENCE` (the `claude-yolo` alias),
`COMMAND_EXECUTION` (a `rm -rf`), `EXTERNAL_DOWNLOADS` (the `claude.ai/install.sh` download).

Its command-existence claims were verified against the actual templates
(`templates/install-block.sh`, `templates/yolo-alias-block.sh`, `templates/post-start-block.sh`) in
all four `setup-<tool>-devcontainer` skills before acting on anything — the audit is third-party,
unverified input, not a trusted source of severity judgment. Findings:

- **Installer Provenance** (the download/exec of each vendor's install script): `install_cli`
  (`templates/install-cli-block.sh`) only curls+execs `if [ ! -x "$bin_path" ]` — idempotent — and
  every CLI Skill wires it into `post-create.sh` (container *creation*, once), never
  `post-start.sh` (every boot). The audit's "on every container startup" framing is **false** for
  this behavior; it describes skill-sync, not the installer. All four URLs
  (`claude.ai/install.sh`, `chatgpt.com/codex/install.sh`, `gh.io/copilot-install`,
  `antigravity.google/cli/install.sh`) are each vendor's own official, documented install method.
- **Agent Authority** (the opt-in `<tool>-yolo` alias): all four already avoid the maximally
  unattended flag, each for a specific, documented reason — Claude's `--permission-mode auto`
  avoids `--dangerously-skip-permissions` (breaks `--worktree`'s mount-namespace/git-identity
  check); Codex's `--ask-for-approval on-request` avoids
  `--dangerously-bypass-approvals-and-sandbox` in favor of a real model-judged escalation
  checkpoint; Antigravity's `--mode accept-edits` avoids `--dangerously-skip-permissions --sandbox`
  because a filed upstream bug (`antigravity-cli#36`) makes `--sandbox` a silent no-op when
  combined with it; Copilot doesn't alias its unattended flags at all — a manual-invocation
  reminder only, because GitHub's own docs warn against aliasing them for every session start. The
  audit's "persistence... enables high-privilege tool modes" flattens documented restraint into a
  generic red flag.
- **Skill Source Trust** (skill-sync's `rm -rf` + `npx -y skills add`): the `rm -rf` target in all
  four is a hardcoded literal path (`/home/vscode/.claude/skills/*`,
  `/home/vscode/.codex/skills/*`, `/home/vscode/.copilot/skills/*`,
  `/home/vscode/.gemini/antigravity/skills/*`) — never built from a variable, so it can't be
  redirected and can't reach outside that one directory. Safe by construction; a Blast-radius
  Containment property, not a fourth risk category. The genuine trust boundary is the
  `{{SKILLS_SOURCES_COMMANDS}}` source(s) the user names at setup: re-fetched and re-run unattended,
  with no per-skill review step, on every container start. This part of the audit's concern is
  real — and was already stated in each skill's own setup-time `SKILL.md` ("Only naming a source
  you trust matters here..."), but that text is only ever seen by whoever interactively runs the
  setup skill. It never persists into the generated devcontainer itself, so anyone who later
  inherits that repo (or a crawler reading the shipped `post-start.sh`) can't see it.

## Decision

**Keep all flagged functionality — nothing is removed or gated further.** Per the map's Destination,
respond by making the real trust posture legible where it currently isn't, not by trading away
what the features are for.

1. **Installer Provenance and Agent Authority: document, don't change.** Each of the four
   `install-block.sh` templates gets one added line stating the install runs once at container
   creation, not on every start (directly preempting the audit's specific misreading). No behavior
   change — the reasoning already in each `yolo-alias-block.sh` comment is sound as-is.
2. **Skill Source Trust: add a trust-boundary comment to the generated artifact, not a new gate.**
   Each `post-start-block.sh` template gains a comment explaining, in the actual shipped
   `post-start.sh`: the wipe is scoped to that one fixed directory and can't reach anything else;
   every start re-fetches and re-runs the named source's skills unattended with no per-skill
   review; the only real safeguard is the trustworthiness of the source named at setup. No
   confirmation gate, no re-ask cadence, no version pinning — that would add friction/complexity
   this map's Notes explicitly scoped out ("without fundamentally breaking the feature set").
3. **Add a "## Security & Trust" section to each of the four skills' own `SKILL.md`** — the primary
   lever, since that's the artifact skills.sh actually lists/crawls, not the generated devcontainer.
   Organized around Installer Provenance / Agent Authority / Skill Source Trust (this repo's own
   vocabulary — see `CONTEXT.md`), not the audit's REMOTE_CODE_EXECUTION/PERSISTENCE/
   COMMAND_EXECUTION/EXTERNAL_DOWNLOADS labels. Shared shape, adapted per skill's own specifics by
   each per-skill ticket:

   ```markdown
   ## Security & Trust

   This skill's generated automation touches three areas an external audit may flag. Each is
   opt-in, scoped to this container, and exists for a specific reason — none of it runs on the
   host, only inside the generated devcontainer.

   - **Installer Provenance**: installs <Tool> via <vendor>'s own official installer
     (`<url>`). Runs once, at container creation (`postCreateCommand`), not on every start — and
     only if `<bin_path>` doesn't already exist.
   - **Agent Authority**: the optional `<tool>-yolo` alias <one-line, pulled from that template's
     own comment — what it avoids and why>. Off by default; only added if accepted during setup.
   - **Skill Source Trust**: if skill-sync is accepted, `<rm -rf path>` is wiped and repopulated
     from the source(s) you name, on every container start. The wipe is scoped to that one fixed
     directory inside this container — it can't reach anything else. The real trust decision is
     the source itself: naming one means trusting its skills unattended, with no per-skill review
     step, every time the container starts. Off by default.
   ```

4. **"Done" stays substance-only** (per the map's Notes) — not tied to confirming skills.sh's
   displayed number changes, since it publishes no methodology, no dispute channel, and there's no
   way to know its re-scan cadence.

## Alternatives considered

### A) Remove or gate skill-sync behind a stronger confirmation (rejected)

- Pro: would most directly blunt the `REMOTE_CODE_EXECUTION` label — no unattended re-fetch, no
  standing exposure.
- Con: skill-sync's entire value is staying current with upstream without manual intervention;
  gating it defeats the feature. The map's Destination explicitly rules out trading away
  functionality to chase a rating.

### B) Pin `npx -y skills add` to specific versions/commits (rejected)

- Pro: narrows the window an already-trusted source could turn malicious between resyncs.
- Con: contradicts the feature's own purpose (staying current with upstream); would need
  per-source version bookkeeping with no existing mechanism for it. Bigger scope than this map's
  "narrowly-scoped hardening."

### C) Move the CLI installers to Dockerfile build time, out of `post-create.sh` (rejected)

- Pro: would make Installer Provenance literally build-time, aligning it with the existing
  Supply-chain Hardening definition instead of needing a sibling term.
- Con: unrelated to what the audit actually got wrong (it mislabeled *when* the install runs, not
  *whether* it should); moving it is a Scaffold-architecture change with its own risk, out of
  proportion to a documentation-and-comment fix. `install_cli`'s per-CLI idempotency check already
  makes repeated invocation safe regardless of lifecycle stage.

## Consequences

- Four `install-block.sh` templates gain one clarifying line each (no functional change).
- Four `post-start-block.sh` templates gain a trust-boundary comment (no functional change).
- Four `SKILL.md` files gain a "## Security & Trust" section, each skill's own per-skill ticket
  applying the shared shape above with its own specifics
  ([setup-claude-devcontainer #329](https://github.com/ken-guru/skills/issues/329),
  [setup-codex-devcontainer #330](https://github.com/ken-guru/skills/issues/330),
  [setup-copilot-devcontainer #331](https://github.com/ken-guru/skills/issues/331),
  [setup-antigravity-devcontainer #332](https://github.com/ken-guru/skills/issues/332)).
- No new confirmation gates, version pinning, or feature removal anywhere.
- `skills/setup-devcontainer/CONTEXT.md` carries the Installer Provenance / Agent Authority / Skill
  Source Trust vocabulary this ADR and the four per-skill tickets use.
