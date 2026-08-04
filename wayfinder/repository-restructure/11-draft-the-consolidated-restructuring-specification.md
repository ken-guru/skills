# Draft the consolidated repository restructuring specification

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:task`
Status: Closed
Assignee: Codex
Blocked by: [Decide the migration manifest and implementation sequence](10-decide-the-migration-manifest-and-sequence.md)

## Question

What single draft specification faithfully consolidates every resolved architecture, ownership, compatibility, governance, and migration decision into an implementation-ready artifact for user review?

## Resolution

Drafted the single Collection-owned specification at
[Repository restructuring around portable Skill Suites](../../docs/specs/repository-restructure.md).

The draft consolidates the approved domain model, target tree, Artifact Owner rules,
discovery and compatibility policy, exact dependency schemas and tooling interfaces,
portable installed-path contract, documentation and verification placement, contribution
governance, path-family Migration Manifest, five-wave implementation sequence, and
release-blocking acceptance criteria.

During consolidation, the draft identified and closed one evidence gap in the Migration
Manifest: the contribution contract requires positive, negative, and boundary routing evals
for every Skill, so the migration now explicitly adds owner-local eval suites for
`structure-agenda`, `generate-images`, `generate-diagrams`, and
`proofread-presentation`. This adds verification evidence without changing runtime behavior.

The specification is intentionally marked **Draft for approval**. GitHub issue
[Restructure the repository around portable Skill Suites](https://github.com/ken-guru/skills/issues/51)
remains blocked, without `ready-for-agent`, and no migration pull request may be opened until
the approval decision closes.
