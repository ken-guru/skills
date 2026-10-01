# Reducing permission prompts

Each Presentation Skill runs its scripts through one bundled executable named
after the Skill. Agents call it by its absolute path, so you can approve one
command per Skill instead of approving `node` or every new argument list.

| Skill | Executable |
|---|---|
| `discover-presentation` | `<skills>/discover-presentation/scripts/discover-presentation` |
| `generate-slides` | `<skills>/generate-slides/scripts/generate-slides` |
| `generate-diagrams` | `<skills>/generate-diagrams/scripts/generate-diagrams` |
| `generate-images` | `<skills>/generate-images/scripts/generate-images` |
| `presentation-validation` | `<skills>/presentation-validation/scripts/presentation-validation` |

`<skills>` is the directory the suite is installed in, for example
`~/.agents/skills` after `npx skills add`. Proofread also runs `marp` directly to
render slide images.

Approve these executables, not `node`. Allowing `node` (or `shell(node)`,
`Bash(node *)`) also allows any inline `node -e` program.

Facts below were measured and read from each harness's documentation and source
on 2026-10-01: Copilot CLI 1.0.85, Claude Code 2.1.286, and Codex at
`openai/codex@a933dd7` ([research note](research/harness-shell-approvals.md)).
Harnesses change; check their current documentation if something here stops
working.

## GitHub Copilot CLI

Copilot asks two separate questions:

- **Allow directory access** for any script outside your working directory.
  Start Copilot with the skills directory added to lift it:

  ```bash
  copilot --add-dir ~/.agents/skills
  ```

- **Run this command** for each new program. When the prompt names a
  Presentation Skill executable, choose **Yes, and don't ask again … in this
  repo** to keep the approval for later sessions in this project. To approve them
  up front instead, pass one `--allow-tool` per executable:

  ```bash
  copilot --add-dir ~/.agents/skills --allow-tool='shell(/Users/me/.agents/skills/generate-diagrams/scripts/generate-diagrams)'
  ```

  Copilot matches the path exactly as the agent types it. The Skills call it
  unquoted, so an install path containing spaces gets more prompts.

Each Skill's `allowed-tools` frontmatter targets Claude Code and has no effect in
Copilot.

## Claude Code

Plugin installs pre-approve each Skill's own executable for the turn that
invokes the Skill, through `allowed-tools`. To approve them in every turn, add
rules to `~/.claude/settings.json` or your project's `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(/Users/me/.agents/skills/generate-slides/scripts/generate-slides *)",
      "Bash(/Users/me/.agents/skills/generate-diagrams/scripts/generate-diagrams *)",
      "Bash(/Users/me/.agents/skills/generate-images/scripts/generate-images *)",
      "Bash(/Users/me/.agents/skills/discover-presentation/scripts/discover-presentation *)",
      "Bash(/Users/me/.agents/skills/presentation-validation/scripts/presentation-validation *)"
    ]
  }
}
```

Choosing **Yes, and don't ask again** on one of these commands saves the same
kind of rule for its subcommand.

## OpenAI Codex CLI

With the default `on-request` approval policy, Codex runs these commands in its
sandbox without asking. To allow them outside the sandbox too, add one rule per
executable to `~/.codex/rules/default.rules`:

```python
prefix_rule(pattern = ["/Users/me/.agents/skills/generate-slides/scripts/generate-slides"], decision = "allow")
```
