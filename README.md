# Ken Sørevåge's Skills

[![skills.sh](https://skills.sh/b/ken-guru/skills)](https://skills.sh/ken-guru/skills)

A collection of agent skills.

## Skills

### Orchestrator

| Skill | Description |
|-------|-------------|
| [build-presentation](./skills/build-presentation/SKILL.md) | Full presentation pipeline — detects state and routes through the installed phase skills |

`build-presentation` is orchestration-only: install it with the phase skills below. It does not embed or install its dependencies.

For `npx skills` browsing and installation, this suite is also published as the nested **Presentation Skills** group. You can toggle the group to select the full workflow or select any phase skill inside it.

### Phase skills

| Skill | Description |
|-------|-------------|
| [discover-presentation](./skills/discover-presentation/SKILL.md) | Start or revise a presentation brief; writes `DISCOVERY.json` and `PROJECT.json` |
| [structure-agenda](./skills/structure-agenda/SKILL.md) | Independently refine an existing presentation’s agenda; requires `DISCOVERY.json` |
| [generate-slides](./skills/generate-slides/SKILL.md) | Independently generate or regenerate slides; requires `DISCOVERY.json` and approved `AGENDA.md` |
| [generate-images](./skills/generate-images/SKILL.md) | Independently render selected AI images; requires `IMAGE_SPEC.md` and a Gemini API key |
| [generate-diagrams](./skills/generate-diagrams/SKILL.md) | Independently render selected D2 diagrams; requires `DIAGRAM_SPEC.md` and D2 |
| [proofread-presentation](./skills/proofread-presentation/SKILL.md) | Independently validate and proofread a generated `PRESENTASJON.md` |

The phase skills are deliberately separate because they support focused, resumable work. Their prerequisites are project artifacts, not the orchestrator: for example, use `generate-images` to re-render a changed image without re-running discovery, agenda work, or slide generation.

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

To install the complete guided workflow, select the orchestrator and every phase skill together:

```bash
npx skills@latest add ken-guru/skills \
  --skill build-presentation \
  --skill discover-presentation \
  --skill structure-agenda \
  --skill generate-slides \
  --skill generate-images \
  --skill generate-diagrams \
  --skill proofread-presentation
```

To install a phase skill for a focused task, select it by name:

```bash
npx skills@latest add ken-guru/skills --skill generate-images
```

Run `npx skills@latest add ken-guru/skills --list` to browse the available skills. Install `build-presentation` only as part of the complete workflow; every other listed skill is useful on its own when its documented project artifacts already exist.

### D2 for presentation diagrams

The presentation skills use the [D2 CLI](https://d2lang.com/tour/install/) to render SVG diagrams. D2 is only required when a presentation includes diagrams; image-only presentations do not need it.

`generate-diagrams` checks whether D2 is available before rendering. If it is missing, it can help install it after you confirm, or you can install it yourself and tell the agent when it is ready. On macOS with Homebrew, run:

```bash
brew install d2
```

For Linux and Windows, or another installation method, follow the [official D2 installation guide](https://d2lang.com/tour/install/).
