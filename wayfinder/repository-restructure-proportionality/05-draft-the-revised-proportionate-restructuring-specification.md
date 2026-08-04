# Draft the revised proportionate restructuring specification

Map: [Simplify the repository restructuring before implementation](map.md)
Labels: `wayfinder:task`
Status: Closed
Assignee: Codex
Blocked by: [Define proportionate acceptance and deferred-complexity triggers](04-define-proportionate-acceptance-and-deferred-complexity-triggers.md)

## Question

What single revised specification and migration manifest consolidate the chosen
minimum viable architecture, its implications, active migration boundary,
behavior-focused acceptance, and explicit triggers for deferred complexity?

The draft must clearly supersede the earlier implementation authority, reconcile
GitHub issue 51 and draft pull request 52, and remain blocked from implementation
until human approval.

## Resolution

Replaced the live Collection specification with the
[Proportionate repository restructuring](../../docs/specs/repository-restructure.md)
draft and created its normative
[Proportionate restructuring Migration Manifest](migration-manifest.md).

The revised draft consolidates:

- the minimum Collection and Presentation suite tree;
- complete-suite distribution through `npx skills` and the existing Claude plugin;
- self-contained member runtime contracts without suite-parent dependencies;
- owner-local state, restart, Media Spec, validation, and external preflight behavior;
- the reproducible `generate-images` bundle;
- the exact active-versus-historical migration boundary;
- path-family actions and byte-preservation rules;
- three migration checkpoints;
- permanent behavioral gates and one-time migration evidence;
- concrete triggers for reconsidering deferred complexity.

The original approved specification is preserved through immutable commit links in
its historical drafting and approval tickets. Its implementation authority is
withdrawn.

The revised document is intentionally **Draft revision for approval**. GitHub issue
51 remains paused without `ready-for-agent`, pull request 52 remains draft, and no
migration checkpoint may begin until the final approval ticket closes.
