# Choose the canonical collection, suite, and Skill source tree

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Verify nested Skill discovery and Claude plugin paths](01-verify-nested-discovery-and-plugin-paths.md)

## Question

What canonical directory structure should represent the collection, standalone Skills, the Presentation Skill Suite, its member Skills, and suite-owned support material while keeping every promoted Skill discoverable and extractable?

## Resolution

Use a vertical Presentation Skill Suite at `skills/presentation/`, with independently discoverable member Skills and suite-owned support material as direct children:

```text
/
├── README.md
├── <collection-level configuration and indexes>
├── docs/                         # only when collection-owned material exists
├── wayfinder/                    # only collection-wide maps
└── skills/
    ├── presentation/             # Skill Suite; no SKILL.md
    │   ├── README.md
    │   ├── CONTEXT.md
    │   ├── build-presentation/   # member Skill
    │   ├── discover-presentation/
    │   ├── …
    │   ├── shared/
    │   ├── docs/
    │   ├── evals/
    │   ├── verification/
    │   └── wayfinder/
    └── <standalone-skill>/       # standalone Skill
        └── SKILL.md
```

The structural rules are:

- A Skill Suite is a vertical ownership slice, not a separately invokable Skill. Its root contains no `SKILL.md`; its Orchestrator remains an ordinary member Skill.
- Standalone Skills live flat at `skills/<stable-skill-name>/`.
- Suite member Skills live at `skills/<suite-name>/<stable-skill-name>/`, the maximum conventional nesting supported by default `npx skills` discovery.
- Member Skills and conventional suite support directories are direct children of the suite root. The presence of `SKILL.md` distinguishes a Skill directory from support material.
- Repository-root paths exist only for collection-owned interfaces, configuration, indexes, and genuinely cross-collection artifacts. Root directories are not retained merely to mirror suite structure.
- Exact artifact classification and portable dependency rules remain decisions owned by their dedicated tickets.

This structure favors locality and makes the Presentation Skill Suite's full footprint visible without compromising stable Skill names or the direct move from suite member to standalone Skill.
