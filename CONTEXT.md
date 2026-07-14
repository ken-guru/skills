# Domain Glossary

## Skill

A reusable, standalone unit of work with a clear input/output contract that an agent can invoke by name. Two kinds exist:

**Phase Skill** — operates on a persistent project folder as part of a pipeline. Reads and writes state files. Can be called independently or sequenced by an orchestrator.
_Avoid_: pipeline skill, workflow step

**Utility Skill** — stateless and conversational. Performs a standalone task without a project folder or persistent state. Not part of a phase pipeline.
_Avoid_: helper skill, tool skill

## Phase

One logical step in the content creation pipeline. Current phases:

1. **Discovery** — gather requirements from the user (topic, audience, duration, language, occasion)
2. **Structure** — build and iterate on the content outline
3. **Generation** — render the final output files
4. **Proofread** — quality check the generated output; skippable but recommended

## Project Type

The category of content a pipeline produces (e.g., presentation). Determines default values, output templates, and validation rules for all phase skills.
_Avoid_: content type, project kind

## Project Folder

The on-disk directory that a Phase Skill reads and writes. Contains all state files for a single project. The schema for those files lives in `skills/shared/state-schema.md`.
_Avoid_: working directory, output folder

## Orchestrator

A Phase Skill that coordinates a full pipeline — detecting project state and routing the user to the next phase.
_Avoid_: coordinator, controller, runner

## Exit Criteria

The conditions an orchestrator verifies before advancing from one phase to the next. Defined per phase transition; all conditions must pass before the next phase skill is called.
_Avoid_: completion checklist, done criteria

## Restart Guard

A protocol invoked at phase startup when re-running that phase would make downstream files stale. Presents the user with an explicit inventory of affected files and a choice before any modifications are made.
_Avoid_: cleanup prompt, stale file handler

## Eval

A test case that documents expected skill routing behaviour for a given query. Three types:
- **positive** — the skill should load
- **negative** — the skill should not load
- **boundary** — correct routing depends on project state

## Trigger

The `description` field in a skill's frontmatter. Written as a `Load when…` instruction that the agent uses to decide which skill to invoke for a given user request.
_Avoid_: activation condition, routing description

---

## Example dialogue

> **Dev:** I want to add a new phase skill for translating a finished presentation into another language. Where does it fit?
>
> **Domain expert:** It'd be a phase skill — it reads from the project folder and writes back to it. You'd add a fifth phase after Proofread, with its own exit criteria.
>
> **Dev:** Does it need a restart guard?
>
> **Domain expert:** Only if running it again would make downstream files stale. If it just overwrites the translated output in place, the guard isn't needed.
>
> **Dev:** And how does the orchestrator know when to offer it?
>
> **Domain expert:** It checks the phase status in `PROJECT.json`. Once proofread is done, it offers the translation step as the next logical action.
>
> **Dev:** What trigger should I write for the skill?
>
> **Domain expert:** Something like "Load when the user wants to translate an existing presentation into another language." Keep it narrow — the trigger competes with every other skill's trigger, so vague language causes wrong routing.

---

## Presentation-specific terminology

**Slide** — One page in the final rendered output.

**Agenda** — The structured outline containing sections, slide topics, image placeholders, source references, and a glossary. Produced during the Structure phase and consumed by Generation.

**Media Specs** — Files produced during the Structure phase (`IMAGE_SPEC.md` and `DIAGRAM_SPEC.md`) that map slides to visual assets. `IMAGE_SPEC.md` contains AI image generation prompts; `DIAGRAM_SPEC.md` contains D2 source code for diagrams.
_Avoid_: image plan, prompt file, media plan

**Media Scope** — The subset of Media Spec entries targeted for generation in a given run: all entries, missing-only entries, or a user-specified subset by slide number.
_Avoid_: image set, generation targets

**Generation Mode** — How media (images or diagrams) is produced within a run. **Batch**: all media in scope are generated sequentially without pausing. **Interactive**: one visual is generated at a time, pausing after each for user review before proceeding.
_Avoid_: run mode, output mode, step-by-step mode

**Narrative structure** — The logical flow of a presentation (e.g., "problem → solution → implications")

**Glossary** (Begreper og definisjoner) — Canonical definitions of all domain-specific terms used in the presentation
