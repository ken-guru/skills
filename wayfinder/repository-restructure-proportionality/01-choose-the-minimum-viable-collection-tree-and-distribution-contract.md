# Choose the minimum viable Collection tree and distribution contract

Map: [Simplify the repository restructuring before implementation](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Assess the cost and implications of the approved design](00-assess-the-cost-and-implications-of-the-approved-design.md)

## Question

What is the smallest source tree, discovery surface, and distribution contract that
makes Presentation a clear Skill Suite, leaves room for future standalone Skills,
preserves stable invocation names and full-suite installs, and does not imply focused
member installation?

Define the exact root, suite, member, plugin, and installer responsibilities without
introducing speculative registries or schemas.

## Resolution

Use this minimum structural convention:

```text
/
├── README.md
├── CONTRIBUTING.md
├── CONTEXT.md
├── CONTEXT-MAP.md
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json
├── skills/
│   ├── <future-standalone-skill>/
│   │   └── SKILL.md
│   └── presentation/
│       ├── README.md
│       ├── CONTEXT.md
│       ├── build-presentation/
│       ├── discover-presentation/
│       ├── structure-agenda/
│       ├── generate-slides/
│       ├── generate-images/
│       ├── generate-diagrams/
│       └── proofread-presentation/
└── …
```

The active-artifact migration decision owns the remaining suite documentation and
verification placement.

The tree itself distinguishes owner shapes:

- `skills/<name>/SKILL.md` is a standalone Skill;
- `skills/<suite>/<name>/SKILL.md` is a suite member;
- a suite root contains `README.md` but no `SKILL.md`;
- nesting stops at one suite level beneath `skills/`.

Do not add `skill-suite.json`, a registry, or a structural schema. Root README is a
human-maintained Collection index with **Skill Suites** and **Standalone Skills**
tables. Presentation README owns the purpose, complete-install instructions,
seven-member catalog, external prerequisites, and links to active suite documentation.
Member `SKILL.md` files remain focused on invocation contracts.

Keep the domain context split:

- root `CONTEXT.md` owns Collection language;
- `skills/presentation/CONTEXT.md` owns Presentation language;
- root `CONTEXT-MAP.md` links both contexts.

Use one concise root `CONTRIBUTING.md` for the flat standalone and one-level
suite-member conventions, stable names, owner-local documentation and tests, index
updates, existing behavioral checks, and the rule that shared tooling requires
demonstrated repetition. Do not add the four prior blueprints, a pull-request
contract, or a custom catalog checker.

Distribution has one supported unit: the complete Presentation suite.

- Preserve all seven Skill frontmatter names and independent invocation after the
  suite is installed.
- Support both the interactive **Presentation** group and a deterministic command
  explicitly selecting all seven names.
- Remove focused-install examples and guarantees. An installer may still expose
  individual selection, but that result is unsupported. Every installed member is
  nevertheless self-contained because complete `npx skills` selection installs
  member directories separately rather than preserving their suite parent.
- Keep `.claude-plugin/marketplace.json` sourced from `"./"`.
- Keep the root `presentation-skills` plugin and update its seven explicit paths to
  `./skills/presentation/<stable-name>`.
- Add no root-adapter registry. The Claude manifest is the single concrete adapter
  at its externally fixed seam.

This design preserves default nested `npx skills` discovery and stable Claude
invocation while exposing no new machine-readable Collection interface.
