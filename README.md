# Ken Sørevåge's Skills

[![skills.sh](https://skills.sh/b/ken-guru/skills)](https://skills.sh/ken-guru/skills)

A Collection of agent Skills and cohesive Skill Suites.

## Skill Suites

| Suite | Description |
|---|---|
| [Presentation](skills/presentation/README.md) | Eight Skills for discovering, structuring, generating, validating, rendering, and proofreading presentations, with a required editorial pass |

## Standalone Skills

| Skill | Description |
|---|---|
| [unslop](skills/unslop/SKILL.md) | Edit prose to remove AI tells while preserving meaning, tone, technical precision, structured output, and explicit user style preferences |
| [setup-devcontainer](skills/setup-devcontainer/SKILL.md) | Generate a shared devcontainer baseline, optionally with SSH deploy-key/signing-key automation |
| [setup-claude-devcontainer](skills/setup-claude-devcontainer/SKILL.md) | Install Claude Code into an existing shared devcontainer |
| [setup-codex-devcontainer](skills/setup-codex-devcontainer/SKILL.md) | Install Codex into an existing shared devcontainer |
| [setup-antigravity-devcontainer](skills/setup-antigravity-devcontainer/SKILL.md) | Install Antigravity into an existing shared devcontainer |
| [setup-copilot-devcontainer](skills/setup-copilot-devcontainer/SKILL.md) | Install GitHub Copilot CLI into an existing shared devcontainer |

Install a standalone Skill directly:

```bash
npx skills@latest add ken-guru/skills --skill unslop
npx skills@latest add ken-guru/skills --skill setup-devcontainer
npx skills@latest add ken-guru/skills --skill setup-claude-devcontainer
```

## Repository structure

- `skills/<name>/SKILL.md` is a Standalone Skill.
- `skills/<suite>/<name>/SKILL.md` is a Skill Suite member.
- A suite root contains `README.md` and no `SKILL.md`.
- Skill nesting stops at one suite level.

See [CONTRIBUTING.md](CONTRIBUTING.md) for ownership and contribution rules and
[CONTEXT-MAP.md](CONTEXT-MAP.md) for the Collection and Presentation glossaries.

## License

[MIT](LICENSE)
