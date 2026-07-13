## Question

How should we eliminate the premature completion risks in `structure-agenda`, `discover-presentation`, and `generate-slides`? 

Specifically, the problem is that interactive "wait for user" gates are placed right above execution steps in the same file, tempting the agent to rush.
- Should we use progressive disclosure (e.g., `DRAFT_AGENDA.md`, `WRITE_DISCOVERY.md`, `SLIDE_GENERATION.md`) that the agent is only instructed to read *after* approval?
- Or should we split the skills (e.g., split `generate-slides` into `generate-image-specs` and `generate-slides`)?

Let's decide the exact architecture.

Labels: `wayfinder:grilling`

## Resolution

Decided to use **Progressive Disclosure** instead of sequence cuts. This keeps the orchestrator (`build-presentation`) simple without adding more skills to the pipeline. We will extract the execution steps into pointer files (e.g., `SLIDE_GENERATION.md`, `DRAFT_AGENDA.md`) that the agent is strictly instructed to read only *after* receiving user approval.

(CLOSED)
