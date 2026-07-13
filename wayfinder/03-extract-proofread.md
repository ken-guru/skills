## Question

How should the extracted `proofread-presentation` skill be structured?

Currently, `build-presentation` instructs the agent to run a proofreading pass from `../generate-slides/QUALITY.md`. 
If we extract it into `proofread-presentation/SKILL.md`:
1. Should it be model-invoked or user-invoked?
2. How should `build-presentation` orchestrate it?
3. What happens to `generate-slides/QUALITY.md`?

Let's outline the prototype for this new skill.

Labels: `wayfinder:prototype`

## Resolution

`proofread-presentation` will be extracted as a model-invoked skill (with triggers to allow user-invocation if they ask to proofread). `build-presentation` will be updated to call it as the 4th phase. The file `generate-slides/QUALITY.md` will be deleted and its contents migrated directly into `proofread-presentation/SKILL.md`.

(CLOSED)
