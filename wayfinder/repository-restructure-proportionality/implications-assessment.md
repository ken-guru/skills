# Repository restructuring implications assessment

Snapshot: 2026-08-04

## Conclusion

The approved specification is disproportionate to the repository's present shape.
Its core ownership move is useful, but the specification couples that move to a
general dependency, governance, and extraction framework whose main justification
was focused installation of individual Presentation Skills. That guarantee has now
been withdrawn.

The recommended direction is a **minimum viable Collection**:

- keep the Collection → Presentation Skill Suite source-tree seam;
- preserve stable Skill names, independent invocation, full-suite installation,
  plugin identity, and current behavior;
- move active Presentation material to its owner;
- fix the existing `generate-images` portability defect locally;
- use direct suite-local references and existing behavioral verification;
- defer generic dependency and structural governance machinery until real repetition
  supplies requirements.

Leaving the layout unchanged remains a rational low-cost option, but it does not
address the presentation-centric ownership and navigation concern and would retain
the existing generator path defect. The minimum viable Collection provides the best
balance.

## Evidence about the current repository

- The repository has 233 tracked files.
- The current `skills/` tree has 45 tracked files, all Presentation-owned.
- Active Presentation theme verification has 95 tracked files, including 48 reviewed
  baseline PNGs.
- Presentation documentation contains seven ADRs, one active theme document, and
  thirteen public gallery files.
- There are three existing routing-eval files.
- Completed pre-restructuring Wayfinder history contains 28 Markdown files.
- The seven Skill names and plugin manifest are genuine public interfaces.
- `generate-images` currently hardcodes `~/.claude/skills/generate-images` and installs
  npm dependencies inside the installed Skill. This is a present portability defect,
  not a hypothetical future requirement.
- Active verification has roughly a dozen source seams into member Skills, shared
  files, root documentation, and public assets. Moving active owners therefore
  requires coordinated path updates even under the simpler design.

The active move will still produce a large path diff because PNGs, verification
fixtures, and member files move with their owner. That is one-time migration breadth,
not permanent architectural complexity. Byte-preserving moves should be reviewed
separately from semantic edits.

## Three approaches

| Approach | One-time effort | Permanent maintenance | Cognitive surface | Migration failure surface | Future optionality |
|---|---|---|---|---|---|
| Approved specification | High | High | High | High: structural cutover plus new frameworks | Highest immediate extraction and enforcement |
| Minimum viable Collection | Medium to high | Low | Low | Medium: coordinated active path cutover | Adequate; later extraction is deliberate work |
| Keep current layout | Low | Lowest | Lowest initially | Low | Acceptable for a few flat Skills, but ownership becomes less clear as domains accumulate |

### Approved specification

The approved design creates or requires:

- seven strict Dependency Declarations;
- four generated Dependency Snapshot trees;
- two strict Shared Module manifests;
- one dependency resolver with five documented commands, graph validation,
  canonical hashing, provenance, atomic synchronization, stable diagnostics, and
  fixture tests;
- one whole-Collection checker with human and JSON interfaces;
- a pinned Collection tooling package and an additional CI workflow;
- strict suite-marker and root-adapter registries;
- four contribution blueprints and a pull-request contract;
- new structural and routing evidence beyond existing behavior;
- historical-path relocation and link repair;
- five migration waves and an exhaustive release matrix.

This buys strong focused-install guarantees, deterministic Shared Module extraction,
and machine-enforced future Collection conventions. Today there is one suite, no
standalone Skill, no second suite, and no longer a focused-install requirement. Most
of that leverage therefore has only one caller or no present caller.

Under the deletion test, removing the dependency and Collection Modules does not
spread equivalent present-day complexity across multiple consumers. It mostly
removes schemas, snapshots, synchronization, registries, diagnostics, and their
tests. Those Modules are shallow relative to today's needs even if they could become
deep after the repository gains independent distribution boundaries.

### Minimum viable Collection

This approach keeps the source-tree seam and active-owner locality while using
ordinary directory and Markdown interfaces:

- root Collection navigation;
- one `skills/presentation/` suite directory;
- seven named member Skill directories;
- one suite landing page and domain context where useful;
- direct member references to suite-shared files;
- the existing plugin manifest as the distribution adapter;
- existing verification and CI updated for new paths;
- one localized, reproducibly bundled `generate-images` runtime;
- a concise compatibility note and behavior-focused acceptance.

The interface remains small: install the Presentation suite, invoke any member by its
stable name, and run existing verification. Complexity remains inside the suite
instead of being exposed through declarations and synchronization procedures.

### Keep the current layout

The current flat `skills/<name>/` tree can technically accept future standalone
Skills. A root README rewrite and clearer naming could reduce the presentation-only
appearance without moving most files.

This option has the lowest immediate risk and should not be dismissed. Its drawbacks
are that the Presentation relationship remains implicit, suite-owned shared material
continues to look Collection-wide, active documentation and verification remain
scattered, and the generator's installation assumptions still need a separate fix.
It postpones rather than clarifies the first real ownership seam.

## Mechanism-by-mechanism assessment

| Approved mechanism | Present justification | Cost and implication | Recommendation |
|---|---|---|---|
| `skills/presentation/<name>` nesting | Directly addresses presentation dominance and ownership | Broad path churn; low permanent cost | Keep |
| Stable seven Skill names and plugin identity | Existing public interface | Constrains path/manifest edits; little maintenance | Keep |
| Full-suite discovery and installation | Current distribution behavior | Requires installer and plugin verification | Keep |
| Focused member installation | Guarantee explicitly withdrawn | Drives isolation, duplication, dependency graph, and extra install matrices | Remove |
| Dependency Declarations | Only useful to automated focused installs and extraction | Seven authored files plus a new contributor concept | Remove |
| Dependency Snapshots | Only useful when a member is installed without its suite | Generated duplication, hashing, provenance, sync conflicts, and review noise | Remove |
| Dependency resolver/checker | Supports declarations and snapshots | New permanent Module, schemas, diagnostics, tests, package boundary, and commands | Remove |
| Shared Module manifests | Supports graph identity and snapshots | Adds indirection to two small shared directories | Remove; use direct suite-local files |
| Skill Dependency graph | Protects suite Orchestrator installed alone | Build is no longer advertised outside the suite | Replace with a simple runtime availability check if needed |
| `generate-images` self-location and bundle | Fixes a current hardcoded-path and writable-install defect | Local build/check maintenance, but a narrow interface with real leverage | Keep |
| Suite marker schema | Helps a future generic Collection checker | One suite is already visible from its directory and README | Defer |
| Root-adapter registry | Classifies externally fixed root paths | Registry and validator duplicate information visible in named workflow/plugin files | Defer |
| Four contribution blueprints | Anticipates several future contribution modes | More policy surface than current contributors need | Replace with one concise contribution section |
| Whole-Collection checker and workflow | Enforces speculative multi-owner rules | New Module, fixtures, diagnostics, dependency install, and CI failure mode | Defer |
| Split root/suite navigation and context | Directly addresses presentation-centric repository language | Some link and glossary maintenance | Keep, with minimal files |
| Move active docs, evals, verification, and shared material | Improves locality for current maintainers | Large mechanical move and coordinated path updates | Keep |
| Move closed maps, prototypes, and archives | Theoretical ownership purity | Twenty-eight historical files plus archive/prototype link churn; no runtime value | Remove |
| Add missing three-kind evals for every Skill | Uniform contribution contract | Creates tests because a framework requires them, not because migration changes routing | Defer; add only evidence tied to observed routing risk |
| Byte-preserve reviewed images | Protects accepted evidence during path moves | Hash capture and comparison, little permanent cost | Keep |
| Old-path migration note without shims | Small install base still benefits from understandable source moves | Small documentation cost | Keep concise |
| Five-wave migration | Isolates several new frameworks from the cutover | Process overhead after those frameworks are removed | Reduce to baseline, coordinated move, and acceptance checkpoints |
| Exhaustive structural acceptance | Required by the new schemas and focused installs | Large test matrix and permanent CI ownership | Replace with present-behavior acceptance |

## Implications of simplifying

### Benefits

- Fewer authored and generated files change during ordinary Skill maintenance.
- Contributors learn the suite tree and existing Skill interfaces, not a parallel
  dependency and governance system.
- CI remains focused on behavior instead of repository taxonomy.
- The migration has fewer semantic changes interleaved with file moves.
- There is less risk of stale snapshots, misleading registries, schema/tool version
  skew, or tooling failures blocking unrelated documentation changes.
- The architecture can be revised using evidence from an actual second suite or
  extraction request.

### Costs accepted deliberately

- A Presentation member cannot be installed independently as a supported product.
- Extracting a member later requires copying or transferring its shared material,
  changing direct references, and adding whatever packaging that real use case
  needs.
- Directory and documentation conventions rely more on review and less on automated
  structural enforcement.
- A future second suite may require a new registry, contribution contract, or
  Collection check, causing a later refactor.
- Shared-file changes are not propagated through deterministic consumer snapshots
  because the suite consumes one canonical copy.

These are acceptable because they occur at an explicit future ownership or
distribution change, not on every present-day edit.

## Complexity should return only with evidence

Deferred machinery should be reconsidered when one of these events occurs:

- a Presentation member must be distributed independently;
- a second Skill Suite needs the same machine-readable rule;
- at least two real adapters require a shared registry or validator;
- repeated contribution errors show that prose guidance is insufficient;
- direct shared references create an actual release or versioning conflict;
- manual structural review repeatedly misses the same defect.

The future design should be based on the concrete cases then present. The approved
specification remains useful research for that future decision, but it should not be
implemented pre-emptively now.

## Recommendation

Proceed with the minimum viable Collection rather than the approved specification or
the unchanged layout. The next tickets should define its exact tree and full-suite
distribution interface, direct shared/runtime contract, active migration boundary,
and behavior-focused acceptance before rewriting the implementation authority.
