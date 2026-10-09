# 1. Rebuild the presentation skills from scratch as skill-native, loosely coupled skills

Status: accepted

## Context

The Presentation Skill Suite 2.x grew into something close to a CLI: an Orchestrator, Exit Criteria, Restart Guards, JSON Project Folder state, Theme Packages with manifests and locks, Slide Archetypes, and eight members that could only be installed together. Field use proved some of it (tested media and export scripts, diagram legibility checks, visual proof of rendered slides, batched questions with key approvals kept) and showed phase state and Restart Guards only as cost. A bare-agent baseline showed what agents already do well without skills and where they fall short.

The decisions behind this rebuild are recorded on the map [Rebuild the presentation skills from scratch as skill-native, loosely coupled skills](https://github.com/ken-guru/skills/issues/481) and its spec [Spec: rebuild the presentation skills as eight skill-native, loosely coupled skills](https://github.com/ken-guru/skills/issues/504). The lessons from 2.x are in the [quarry research note](https://github.com/ken-guru/skills/blob/research/presentation-suite-quarry/docs/research/presentation-suite-quarry.md); the 2.x suite remains available at its last `presentation-v2.x` tag.

## Decision

- Replace the 2.x suite in one breaking release (3.0.0) with four suite skills (`planning-presentation`, `drafting-slides`, `rendering-slides`, `reviewing-presentation`) and four general-purpose Standalone Skills (`researching-sources`, `creating-diagrams`, `creating-charts`, `generating-images`).
- No orchestrator and no persisted phase state: the Deck Folder's files are the state, approvals are frontmatter that warns and never blocks, and skills hand off by naming the next skill.
- Plain Marp Markdown is the Deck Source; Marp CLI renders every format.
- Shared contracts (the Accessibility Bar and the Deck Folder) are authored once in this suite's `docs/` and copied verbatim into each suite skill's `references/`, because every installed skill must carry its own runtime instructions. CI keeps the copies identical, as it does for the shared tool-cache module.

## Consequences

- This ADR supersedes ADRs 0001–0008 of the 2.x suite.
- Old Project Folders are not converted; work restarts from a Deck Source.
- Each skill can be installed and used alone; a missing neighbour is covered by the skill naming the problem that neighbour would solve.
