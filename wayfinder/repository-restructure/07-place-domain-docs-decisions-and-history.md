# Place domain documentation, decisions, and planning history

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by:

- [Choose the canonical collection, suite, and Skill source tree](02-choose-the-canonical-source-tree.md)
- [Define collection, suite, and Skill artifact ownership](03-define-artifact-ownership-rules.md)
- [Inventory current presentation paths and references](04-inventory-current-paths-and-references.md)

## Question

How should the repository split collection and Presentation contexts, and where should suite-specific ADRs, public documentation, completed Wayfinder maps, and future cross-repository decisions live?

## Resolution

Place domain documentation, decisions, and planning history with their Artifact Owners:

- Add root `CONTEXT-MAP.md` as the index of domain contexts and their relationships.
- Keep genuinely Collection-wide terminology in root `CONTEXT.md`. Move presentation pipeline and visual-domain language to `skills/presentation/CONTEXT.md`. Promote a term to the Collection context only when its responsibility genuinely spans independent owners.
- Put suite-wide public documentation under `skills/presentation/docs/` and its approved public assets under `skills/presentation/docs/assets/`.
- Keep Skill-specific protocols, examples, and references inside their owning member Skill directory.
- Reserve root `docs/` for Collection-owned material and remove it if no such material remains.
- Place ADRs with the scope that owns the decision:
  - Collection decisions in `docs/adr/`.
  - Presentation-wide decisions in `skills/presentation/docs/adr/`.
  - Skill-specific decisions in `skills/presentation/<skill>/docs/adr/`.
- Place Wayfinder maps with the Artifact Owner of their destination:
  - Collection maps under root `wayfinder/`.
  - Presentation maps under `skills/presentation/wayfinder/`.
  - Skill-specific maps under the owning Skill's `wayfinder/`.
- Keep open and completed maps together; their status is the archive distinction. Rewrite moved ticket links and context pointers as portable relative links, including existing absolute `file:` URLs.
- Preserve `IMPLEMENTATION_SUMMARY.md` and `VERIFICATION_CHECKLIST.md` under `skills/presentation/docs/history/` with explicit non-authoritative archival banners. Maintained documentation must not cite them as current behavior.
- Write the final consolidated Collection restructuring specification to `docs/specs/repository-restructure.md`; keep this root Wayfinder map as its decision index and history.

Acceptance must prove that every context, ADR, map, public document, and historical record is classified by Artifact Owner; `CONTEXT-MAP.md` reaches every context; context files remain glossary-only; maintained links resolve without duplicated authoritative detail or absolute `file:` URLs; archives are marked non-authoritative; root documentation and planning contain only Collection material; and suite documentation remains reachable from `skills/presentation/README.md`.
