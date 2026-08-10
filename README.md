# Ken Sørevåge's Skills

[![skills.sh](https://skills.sh/b/ken-guru/skills)](https://skills.sh/ken-guru/skills)

A Collection of agent Skills and cohesive Skill Suites.

## Skill Suites

| Suite | Description |
|---|---|
| [Presentation](skills/presentation/README.md) | Seven Skills for discovering, structuring, generating, rendering, and proofreading presentations |

## Standalone Skills

| Skill | Description |
|---|---|
| [devcontainer-setup](skills/devcontainer-setup/SKILL.md) | Set up a devcontainer for agentic coding: deny-by-default network firewalling, staged MCP server activation across multiple CLIs, age-gated CLI/tool auto-updates, dual-key SSH commit signing, build ordering and capability scoping, and DX/database niceties |

## Repository structure

- `skills/<name>/SKILL.md` is a Standalone Skill.
- `skills/<suite>/<name>/SKILL.md` is a Skill Suite member.
- A suite root contains `README.md` and no `SKILL.md`.
- Skill nesting stops at one suite level.

See [CONTRIBUTING.md](CONTRIBUTING.md) for ownership and contribution rules and
[CONTEXT-MAP.md](CONTEXT-MAP.md) for the Collection and Presentation glossaries.

## License

[MIT](LICENSE)
