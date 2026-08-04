# Verify nested Skill discovery and Claude plugin paths

Map: [Restructure the repository around portable Skill Suites](map.md)
Labels: `wayfinder:research`
Status: Closed
Assignee: Codex
Blocked by: None

## Question

Which nested Skill layouts are currently supported by `npx skills`/skills.sh discovery and Claude plugin manifests, and what compatibility constraints must the target repository tree satisfy?

## Resolution

Use `skills/presentation/<stable-skill-name>/SKILL.md` for Presentation member Skills:

- `npx skills` supports this one-level catalog nesting beneath `skills/` without flags; deeper suite nesting would require `--full-depth` or manifest discovery.
- Preserve Skill frontmatter names and the `presentation-skills` plugin name.
- Explicitly update the Claude plugin's `skills` paths to the new nested directories, each beginning with `./`.
- Keep the marketplace plugin source at the repository root (`./`), which continues to package the nested tree and its in-repository dependencies.
- Treat old source paths and links as migration concerns even though public Skill names remain stable.

### Context pointer

[Nested Skill discovery and Claude plugin paths](research-nested-discovery-and-plugin-paths.md)
