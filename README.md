# Ken Sørevåge's Skills

[![skills.sh](https://skills.sh/b/ken-guru/skills)](https://skills.sh/ken-guru/skills)

A collection of agent skills.

## Skills

### Orchestrators

| Skill | Description |
|-------|-------------|
| [build-presentation](./skills/build-presentation/SKILL.md) | Full presentation pipeline — detects state and guides through all phases |

### Phase skills (use individually or via orchestrator)

| Skill | Description |
|-------|-------------|
| [discover-presentation](./skills/discover-presentation/SKILL.md) | Gather requirements: topic, audience, duration, language, occasion |
| [structure-agenda](./skills/structure-agenda/SKILL.md) | Build and iterate the agenda (AGENDA.md) |
| [generate-slides](./skills/generate-slides/SKILL.md) | Generate PRESENTASJON.md and PRESENTASJON.html from approved agenda |

### Shared modules

| Module | Description |
|--------|-------------|
| [shared/validation](./skills/shared/validation.md) | Environment checks used by all skills |
| [shared/state-schema](./skills/shared/state-schema.md) | Schema for DISCOVERY.json, PROJECT.json, and AGENDA.md |
| [shared/image-spec-diff](./skills/shared/image-spec-diff.md) | Detect and report changes to IMAGE_SPEC.md when agenda or presentation is updated |

## Installation

You can install any skill from this repository using:

```bash
npx skills@latest add ken-guru/skills/<skill-name>
```

