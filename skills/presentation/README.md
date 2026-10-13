# Presentation Skill Suite

Turn a topic, an audience, and an occasion into a finished, good-looking slide deck with speaker notes, while you stay in control of the story.

The process runs **Interview → Research → Storyline → Draft → Visuals → Render → Review**, but every skill is useful on its own: start from an outline, a single diagram, a deck to restyle, or a deck to check.

## Suite skills

| Skill | What it does |
|---|---|
| [planning-presentation](planning-presentation/SKILL.md) | Interviews you until the Brief is clear, then builds and agrees the Storyline |
| [drafting-slides](drafting-slides/SKILL.md) | Writes the Deck Source: one Marp Markdown file with speaker notes, citations, and Visual Intents |
| [rendering-slides](rendering-slides/SKILL.md) | Applies the theme, exports HTML, tagged PDF, and a notes script, and checks the Accessibility Bar |
| [reviewing-presentation](reviewing-presentation/SKILL.md) | Reviews facts, language, legibility, timing, and the rendered deck, grouped by what to fix where |

## General-purpose skills it uses

| Skill | What it does |
|---|---|
| [researching-sources](../researching-sources/SKILL.md) | Finds and vets sources into a Source Set, raising conflicts as questions |
| [creating-diagrams](../creating-diagrams/SKILL.md) | D2 diagrams styled by role and checked for legibility |
| [creating-charts](../creating-charts/SKILL.md) | Static, accessible Vega-Lite charts from real data |
| [generating-images](../generating-images/SKILL.md) | AI illustrations after cost approval, always marked as generated |

Prose is edited with [unslop](../unslop/SKILL.md) when it is installed.

## Install

All eight skills, as the `presentation-skills` Claude plugin or with `npx skills`:

```bash
npx skills@latest add ken-guru/skills \
  --skill planning-presentation --skill drafting-slides \
  --skill rendering-slides --skill reviewing-presentation \
  --skill researching-sources --skill creating-diagrams \
  --skill creating-charts --skill generating-images
```

Any skill can also be installed on its own.

## Tools

Skills that render install their pinned tools once, with verified checksums, into a shared per-user cache (`~/.cache/ken-guru-skills/`, or `$KEN_GURU_SKILLS_CACHE`). Each tells you the exact `setup` command when a tool is missing. Run `setup` outside your harness's sandbox.

## Documentation

- [Glossary](CONTEXT.md)
- [Accessibility Bar](docs/accessibility-bar.md)
- [Deck Folder](docs/deck-folder.md)
- [Decisions](docs/adr/)
