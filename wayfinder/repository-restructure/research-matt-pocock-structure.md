# Matt Pocock skills repository: structural findings

Research snapshot: [`mattpocock/skills` at `2ab9580`](https://github.com/mattpocock/skills/tree/2ab958093e83e0ec752e6c1c5932da465bf23e0c), reviewed 2026-08-04.

## Findings

### The repository is the collection; directories are taxonomy

Matt's canonical source tree is `skills/<bucket>/<skill>/`. The promoted buckets are `engineering` and `productivity`; other buckets distinguish `misc`, `personal`, `in-progress`, and `deprecated` work. Bucket READMEs index individual Skills, but the buckets are not independently versioned or installed packages. The repository describes the Skills as small and composable and catalogs them individually by invocation mode and domain ([README](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/README.md#reference), [Engineering index](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/README.md)).

There is no first-class equivalent of our proposed **Skill Suite**. Related Skills such as `wayfinder`, `grilling`, `domain-modeling`, `prototype`, and `research` remain separate directories and express their collaboration through instructions and links, not through a shared suite package ([wayfinder source](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/wayfinder/SKILL.md)).

### Skill-owned support material is colocated; collection-wide material stays at root

An individual Skill directory may own more than `SKILL.md`: reference documents, scripts, templates, and agent metadata are colocated with that Skill. For example, `codebase-design` owns `DEEPENING.md` and `DESIGN-IT-TWICE.md`, while `diagnosing-bugs` owns a script template ([repository tree](https://github.com/mattpocock/skills/tree/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering), [colocated `DEEPENING.md`](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/codebase-design/DEEPENING.md)).

Public explanatory pages live separately under `docs/<bucket>/<skill>.md` and point back to the canonical Skill source ([wayfinder documentation](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/wayfinder.md)). Repository-wide domain language and architectural decisions remain collection-level concerns in root `CONTEXT.md` and `.agents/adr/` ([root context](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/CONTEXT.md), [plugin ADR](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/.agents/adr/0002-ship-as-a-claude-code-plugin.md)).

The inspected tree has no conventional repository test, eval, or planning-artifact areas. It therefore does not answer where a tightly integrated suite's cross-skill tests, evals, shared runtime modules, generated baselines, or historical Wayfinder maps should live. Our specification must decide those ownership boundaries rather than copying Matt's taxonomy mechanically.

### Distribution is one bundle plus selectable individual Skills

The Claude Code surface is one repository-level plugin, `mattpocock-skills`. Its manifest explicitly enumerates every promoted Skill across the two promoted buckets, and its marketplace contains that single plugin sourced from the repository root ([plugin manifest](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/.claude-plugin/plugin.json), [marketplace manifest](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/.claude-plugin/marketplace.json)).

For Codex and other Agent Skills-compatible harnesses, the documented universal route is `npx skills@latest add mattpocock/skills`; users choose individual Skills from the repository. The plugin installs the whole managed bundle, whereas `skills.sh` copies selected, editable Skills ([installation documentation](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/README.md#installation-30-second-setup)).

Matt explicitly deferred a native Codex plugin because Codex's manifest accepted only one recursively scanned path, which conflicts with a bucketed tree containing both promoted and non-promoted Skills. This is a layout constraint worth testing, not a reason to make native Codex packaging part of our first restructuring target ([plugin ADR](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/.agents/adr/0002-ship-as-a-claude-code-plugin.md#the-constraint-bucketed-skills-vs-single-path-selection)).

The root npm package is private and used only for repository release tooling; it is not the unit by which Skills or buckets are published ([`package.json`](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/package.json), [release workflow](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/.github/workflows/release.yml)).

## Comparison with this repository

This repository already follows part of Matt's public model: one GitHub repository is browsable through `npx skills`, individual presentation Skills keep stable names, and one Claude plugin explicitly lists the promoted Skills. The mismatch is ownership: presentation-specific documentation, ADRs, evals, verification projects, shared modules, generated baselines, and completed Wayfinder history currently occupy collection-level locations.

Unlike Matt's loose domain buckets, the presentation Skills form an integrated workflow with substantial shared assets and verification. A Presentation Skill Suite therefore needs to be an **ownership boundary inside the collection**, while each member Skill retains its own named, installable directory and contract so it can later be extracted.

## Recommended revised scope boundary

Use Matt's repository as the model for **collection and discovery**, not as a complete template for suite internals:

- The specification should define a platform-neutral collection layout that supports both standalone Skills and explicitly owned Skill Suites.
- It should keep the repository as the `npx skills` source and preserve per-Skill selection and stable public Skill names.
- It should keep the existing `presentation-skills` Claude plugin as the required managed-bundle surface during this restructuring. Do not require a separate published package for every suite or Skill.
- It should define how future suites or standalone Skills are added to repository navigation and manifests, but defer deciding whether they join the existing Claude plugin or warrant additional plugins until a real second domain supplies concrete requirements.
- It should include migration of all presentation-owned support material—docs, domain context, ADRs, evals, verification, shared modules, assets, and planning history—into a Presentation Suite boundary, plus compatibility treatment for affected links and commands.
- It should verify `npx skills` recursive discovery and Claude manifest paths against the proposed nested source layout before the final tree is locked.
- Native Codex plugin packaging, generalized multi-plugin release automation, and other agent ecosystems should remain out of scope for this specification unless the proposed layout would foreclose them.

In short: target **one collection, individually discoverable Skills, and one current presentation bundle**, with suite ownership expressed in the source tree rather than multiplying package identities prematurely.
