# Research portable installed Skill self-location

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:research`
Status: Closed
Assignee: Codex
Blocked by: [Define discovery, packaging, and compatibility policy](06-define-discovery-packaging-and-compatibility.md)

## Question

What supported mechanism can Skill instructions and scripts use to locate their own installed directory across `npx skills` targets, the managed Claude plugin, and the currently supported Codex and Claude Code environments without hardcoded agent-home paths?

## Resolution

Research is captured in [Portable installed Skill self-location](research-portable-skill-self-location.md).

There is no documented Skill-directory environment variable shared by the Agent Skills standard, `npx skills`, Codex, and Claude Code. Use a two-stage portable contract:

1. Skill instructions name resources relative to the Skill root and explicitly resolve `<skill-dir>` as the directory containing the invoked `SKILL.md`. Commands launch entry scripts through a quoted absolute path derived from that host-supplied Skill location, never from the process working directory or an agent-home convention.
2. Once launched, executable code locates bundled files relative to its own module: `.mjs` scripts use `import.meta.url`, and CommonJS scripts use `__dirname`. Bundled resources and Dependency Snapshots must not be located through `process.cwd()`, `$HOME`, `CODEX_HOME`, `.agents/skills`, `.codex/skills`, or `.claude/skills`.

Claude Code's `${CLAUDE_SKILL_DIR}` is the supported Claude specialization for the directory containing an invoked Skill's `SKILL.md`. `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are reserved for Claude-plugin-owned adapters and state; they are not part of the cross-installer member-Skill contract. A bare executable placed on a Claude plugin's `PATH` is likewise an optional Claude adapter, not a portable Skill interface.

Canonical command-bearing instructions should use this pattern:

```markdown
Resolve `<skill-dir>` to the directory containing this invoked `SKILL.md`.
In Claude Code, `${CLAUDE_SKILL_DIR}` is that directory. In other supported
hosts, use the actual Skill path supplied by the host. Then run:

node "<skill-dir>/scripts/render.mjs" …

Never derive `<skill-dir>` from the current working directory or an agent-home path.
```

Acceptance tests must launch scripts from an unrelated working directory whose path contains spaces and cover repository-source use, `npx skills` copy and symlink installations, supported Codex discovery, Claude Code standalone Skill discovery, and the marketplace-installed Claude plugin cache. Maintained instructions and executables must fail validation if they hardcode an agent-home path or use the process working directory to locate bundled content.
