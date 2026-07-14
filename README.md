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
| [generate-images](./skills/generate-images/SKILL.md) | Generate PNG images from IMAGE_SPEC.md using an AI image generation API (Gemini) |
| [generate-diagrams](./skills/generate-diagrams/SKILL.md) | Generate SVG diagrams from DIAGRAM_SPEC.md using the local D2 compiler with ELK layout |

### Shared modules

| Module | Description |
|--------|-------------|
| [shared/validation](./skills/shared/validation.md) | Environment checks used by all skills |
| [shared/state-schema](./skills/shared/state-schema.md) | Schema for DISCOVERY.json, PROJECT.json, and AGENDA.md |
| [shared/image-spec-diff](./skills/shared/image-spec-diff.md) | Detect and report changes to IMAGE_SPEC.md when agenda or presentation is updated |

## Security

### Source fetching and prompt injection

The `generate-slides` skill fetches external URLs listed as sources in `AGENDA.md` and summarises their content to inform slide generation. Because `AGENDA.md` may be authored collaboratively, fetched content is treated as untrusted external data throughout the pipeline:

- The model is explicitly instructed to extract facts and quotes only — never to follow directives found in page content.
- If a fetched page contains patterns associated with prompt injection (e.g. "ignore previous instructions", "act as", `SYSTEM:`), that source is **skipped entirely** — no summary is written and no content from that URL enters slide generation.
- Skipped URLs are reported separately in the generation summary (`🚨 Suspected prompt injection — sources skipped`) so you can investigate and decide how to proceed.

See [ADR-0006](./docs/adr/0006-prompt-injection-defence-for-source-fetching.md) for the full rationale.

## Installation

You can install any skill from this repository using:

```bash
npx skills@latest add ken-guru/skills/<skill-name>
```

