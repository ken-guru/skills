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

Install the standalone Skill directly:

```bash
npx skills@latest add ken-guru/skills --skill unslop
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
