## Destination

Audit the remaining 17 non-presentation skills against `/writing-great-skills` guidelines, surface any necessary refactors (like eliminating premature completion risks or negations), and document them in the wayfinder map.

## Notes

- Domain: Agentic skills for presentation generation (`build-presentation`, `discover-presentation`, `structure-agenda`, `generate-slides`, `generate-images`).
- Preferences: Maintain the existing state machine (`PROJECT.json`, `DISCOVERY.json`) and restart guards. Prefer progressive disclosure (pointers) over sequence cuts (new skills) unless a distinct new capability emerges (like `proofread-presentation`).

## Decisions so far

## Decisions so far

- [01-fix-premature-completion.md](file:///Users/ken/Workspace/ken-guru/skills/wayfinder/01-fix-premature-completion.md) — Use progressive disclosure (pointers) to hide execution steps until approved, rather than splitting into more skills.
- [02-fix-negations-and-prune.md](file:///Users/ken/Workspace/ken-guru/skills/wayfinder/02-fix-negations-and-prune.md) — Rephrase negative Gotchas positively; remove Norwegian synonyms and identity lists from descriptions.
- [03-extract-proofread.md](file:///Users/ken/Workspace/ken-guru/skills/wayfinder/03-extract-proofread.md) — Extract to `proofread-presentation/SKILL.md`, delete `QUALITY.md`, and update orchestrator to call it.

## Not yet specified

- Should `proofread-presentation` be user-invoked or model-invoked? It's currently an automatic pass in the orchestrator.
- How do we structure the pointer for `generate-slides` Step 4? Should we move Steps 4-8 into `GENERATE_SLIDES_EXECUTION.md`?

## Out of scope
