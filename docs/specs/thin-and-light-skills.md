# Thin and light Skills

Status: **Ready for implementation**

Labels: `ready-for-agent`

Decision history: the approved Thin and light Skills planning map.

## Problem Statement

The Presentation Skill Suite is reliable but carries more context and cognitive load than necessary. Its Skills repeat lifecycle terminology, Project Folder state rules, renderer interaction protocols, routing dialogue, and explanatory reference material. The repetition makes the important interfaces harder to find, increases maintenance drift, and creates overlapping trigger paths for image and diagram rendering.

The current domain model also has a mismatch: the glossary describes four lifecycle phases, while the Project Folder state and Orchestrator operate with six records, including Images and Diagrams. Thinning the Skills before resolving that mismatch would preserve contradictory language and make later pointers unreliable.

## Solution

Reduce the context load and cognitive load of the Presentation Skill Suite through three related seams:

1. **Project Folder lifecycle contract** — make the four lifecycle phases and two media phases explicit, with the state schema as the authoritative Project Folder contract and each Skill embedding only the fields and invariants it reads or writes.
2. **Orchestrator routing interface** — keep `build-presentation` deep around state → next action, while disclosing Git checkpoint mechanics and detailed state-specific dialogue behind conditional owner-local references.
3. **Media Renderer protocol** — share the common scope, review, reporting, and state-preservation protocol between image and diagram rendering while keeping Gemini/API and D2/CLI behavior local.

The refactor preserves phase gates, Restart Guards, prompt-injection defenses, Project Folder state transitions, user approval points, provider-specific failure behavior, and existing routing behavior. It measures success using always-loaded words, duplicated rules, pointer count, and routing reliability—not word count alone.

## User Stories

1. As a presentation author, I want the Orchestrator to show me the next valid action from my Project Folder state, so that I do not need to understand the internal workflow.
2. As a presentation author, I want phase gates to remain enforced, so that later Skills cannot run against incomplete upstream artifacts.
3. As a presentation author, I want media phases to remain independently invokable, so that I can render images or diagrams without rerunning unrelated phases.
4. As a presentation author, I want existing Project Folder files and unrelated phase records preserved, so that a focused rerun does not destroy valid work.
5. As a presentation author, I want Restart Guards to remain specific to the files made stale by each phase, so that cleanup choices are accurate and safe.
6. As a presentation author, I want Git checkpoints to remain available when my Project Folder is version-controlled, so that I can revisit completed phase states.
7. As a presentation author, I want ambiguous or corrupt state reported before mutation, so that the Orchestrator cannot silently make an unsafe routing decision.
8. As a presentation author, I want image rendering to recognize an existing `IMAGE_SPEC.md`, so that the correct Media Renderer loads without relying on a vague upstream-phase trigger.
9. As a presentation author, I want diagram rendering to recognize an existing `DIAGRAM_SPEC.md`, so that the correct Media Renderer loads without requiring me to name an internal Skill sequence.
10. As a presentation author, I want explicit image- or diagram-rendering requests to load the corresponding Media Renderer, so that focused work remains discoverable.
11. As a presentation author, I want unrelated slide-generation requests not to load a Media Renderer, so that the agent does not spend context on irrelevant provider instructions.
12. As a presentation author, I want to choose missing-only, regenerate, specific-scope, batch, interactive, redo, stop, and cancel behavior consistently for both media types, so that image and diagram workflows feel predictable.
13. As a presentation author, I want a cancelled or failed media run to leave its phase pending, so that the Orchestrator does not report incomplete work as complete.
14. As a presentation author, I want provider-specific setup and failure messages to remain accurate, so that Gemini and D2 requirements are not blurred into a generic renderer abstraction.
15. As a Skill maintainer, I want one canonical lifecycle vocabulary, so that phase names and media-phase relationships do not drift between the glossary, state schema, Orchestrator, and phase Skills.
16. As a Skill maintainer, I want each Skill to embed the small runtime contract it needs, so that independently installed members do not fail because a broad shared instruction file is missing.
17. As a Skill maintainer, I want the common Media Renderer protocol documented once for authoring, so that changes to scope, review, reporting, or state preservation are made consistently.
18. As a Skill maintainer, I want provider adapters to remain local, so that changing Gemini or D2 behavior does not expand the common media seam.
19. As a Skill maintainer, I want the suite glossary to contain domain terms rather than teaching examples, so that agents reach the definitions they need with less cognitive load.
20. As a Skill maintainer, I want the suite README to remain a public navigation surface, so that installation and distribution guidance stay discoverable without duplicating Skill internals.
21. As a Skill maintainer, I want state-schema and ADR documents to remain maintainer references, so that runtime Skills do not pay for broad documentation they do not read.
22. As a Skill maintainer, I want every moved rule to have one authoritative owner, so that future changes do not require synchronized edits across duplicate instructions.
23. As a Skill maintainer, I want before-and-after load measurements, so that a refactor can demonstrate reduced context and cognitive load rather than merely moving prose.
24. As a Skill maintainer, I want routing evals for positive, negative, and boundary cases, so that thinner triggers do not trade context savings for invocation errors.
25. As a Skill maintainer, I want the refactor staged in vertical slices, so that lifecycle changes, Orchestrator changes, and renderer changes can be reviewed and reverted independently.

## Implementation Decisions

- The Presentation domain distinguishes four lifecycle phases—Discovery, Structure, Generation, and Proofread—from two independently invokable media phases—Images and Diagrams.
- The Presentation context owns canonical domain vocabulary. The Project Folder state schema owns the artifact and state contract. The state schema may represent all six phase records while the domain model distinguishes lifecycle phases from media phases.
- Each Phase Skill remains independently callable and embeds the small state fields and invariants it reads or writes. Runtime behavior does not depend on a broad shared suite reference.
- `build-presentation` remains an intelligent Orchestrator rather than a thin dispatcher. Its visible interface is Project Folder identification, six-state detection, phase-gate enforcement, next-action guidance, Skill invocation, and sequential routing.
- Git checkpoint mechanics move behind an owner-local reference reached when the Project Folder is Git-backed.
- Detailed state-specific user scripts, recovery options, and restart explanations move behind conditional routing references. The high-level routing table remains visible in the Orchestrator.
- Existing transition exit criteria remain the authoritative gate for advancing between lifecycle phases.
- Ambiguous or corrupt state pauses before mutation and directs the user to inspection.
- Images and diagrams become explicit Media Renderers with one shared authoring protocol covering Media Scope, existing-asset choices, Generation Mode, review controls, result reporting, phase completion, cancellation, failure, and preservation of unrelated state.
- The shared Media Renderer protocol is an authoring source of truth, not a runtime dependency. Image and diagram Skills embed their small common interface locally.
- Gemini/API setup, D2/CLI setup, installation, retries, provider-specific failures, and provider-specific security guidance remain local adapters.
- `generate-slides` remains the owner of Media Spec creation and approval. `proofread-presentation` retains its independent validation contract.
- Image routing is artifact-specific: an existing `IMAGE_SPEC.md` or an explicit image-rendering request. Diagram routing is artifact-specific: an existing `DIAGRAM_SPEC.md` or an explicit diagram-rendering request. “After generate-slides” is not a renderer trigger.
- The suite README remains responsible for public installation, Skill navigation, distribution contract, prerequisites, security pointers, and active documentation links.
- The glossary remains domain-only. State schema and ADRs remain maintainer references. Root Collection guidance is unchanged.
- Implementation proceeds in this order: align lifecycle contract; thin the Orchestrator; unify Media Renderer guidance; sharpen renderer triggers; remove duplicated or unreachable guidance; then measure and review the result.
- No new Skill, registry, runtime schema, or generalized documentation index is introduced.

## Testing Decisions

- Tests exercise external behavior at the Skill interface: whether the right Skill loads, what state it reads and writes, which user decision points appear, and which files and phase records remain after each outcome. They do not assert prose layout or internal pointer placement except where link reachability is the behavior under test.
- Preserve and rerun the existing `build-presentation`, `discover-presentation`, and `generate-slides` positive, negative, and boundary routing evals.
- Add image-renderer and diagram-renderer trigger evals for: matching artifact present; explicit matching request; unrelated slide-generation request; missing spec; and ambiguous request.
- Add Orchestrator state scenarios for: no Project Folder; discovery complete; structure complete; generation complete with pending media; media complete with proofread pending; proofread complete; and ambiguous or corrupt state.
- Add state-preservation scenarios proving every phase update preserves unrelated phase records, successful selected media marks only its owned phase done, and cancellation or failure leaves that phase pending.
- Add pointer checks proving every new reference resolves, conditional pointers are reached only for their branch, and no moved rule has two authoritative copies.
- Add lifecycle consistency checks proving the context, state schema, Orchestrator, and Phase Skills agree on the four lifecycle phases and two media phases.
- Add a load report before and after the refactor covering always-loaded words, duplicated rules, pointer count, and routing-case changes.
- Use the existing routing eval corpus and Presentation verification tests as prior art. Add the smallest focused fixtures needed for renderer triggers and Project Folder state preservation rather than building a new test framework.

## Out of Scope

- Redesigning the Presentation domain, state schema semantics beyond making the existing six-state model consistent, visual themes, or rendering implementation.
- Changing the public names of the seven Presentation Skills.
- Making focused installation of individual suite members a supported product guarantee.
- Re-litigating accepted ADRs without concrete friction demonstrated by the implementation.
- Replacing provider-specific Gemini or D2 behavior with a generic runtime adapter.
- Adding Standalone Skills or a second Skill Suite.
- Implementing the refactor as part of this specification publication.

## Further Notes

The closed Wayfinder map is the decision history and this document is the implementation authority. Begin implementation with lifecycle alignment because all later pointers and routing evals depend on canonical phase language.

The first review should compare the current and proposed Orchestrator interface, then inspect the two Media Renderer interfaces side by side. The acceptance bar is behavior preservation plus demonstrable reduction in context and cognitive load; a shorter document that hides required behavior behind unnecessary pointers does not pass.
