# Nested Skill discovery and Claude plugin paths

Research snapshot: `vercel-labs/skills` at [`1164afa`](https://github.com/vercel-labs/skills/tree/1164afa5f0e21ebd01e6fc11249759353f494ad1), reviewed 2026-08-04.

## Findings

### `npx skills` supports one suite/category level beneath `skills/`

The current CLI deliberately discovers both `skills/<skill>/SKILL.md` and `skills/<category>/<skill>/SKILL.md` without extra flags. It walks known Skill containers one level for the flat layout and one additional level for catalog layouts. A shallower `SKILL.md` shadows Skills beneath it. Deeper or nonstandard locations require `--full-depth`, unless they are explicitly declared in a Claude plugin manifest ([CLI discovery documentation](https://github.com/vercel-labs/skills/blob/1164afa5f0e21ebd01e6fc11249759353f494ad1/README.md#skill-discovery), [implementation](https://github.com/vercel-labs/skills/blob/1164afa5f0e21ebd01e6fc11249759353f494ad1/src/skills.ts), [nested-layout tests](https://github.com/vercel-labs/skills/blob/1164afa5f0e21ebd01e6fc11249759353f494ad1/tests/nested-container-discovery.test.ts)).

Therefore `skills/presentation/<skill>/SKILL.md` is a supported normal layout. A deeper shape such as `skills/suites/presentation/<skill>/SKILL.md` is not a safe convention for default repository discovery: it would depend on `--full-depth` or manifest declarations.

Manifest-declared Skill paths may be nested more deeply. The CLI resolves local `skills` entries from root `plugin.json` and `marketplace.json`, requires paths to begin with `./`, constrains them to the repository, and searches them at their declared depth. It also deduplicates Skills found through both the normal catalog walk and manifests ([manifest implementation](https://github.com/vercel-labs/skills/blob/1164afa5f0e21ebd01e6fc11249759353f494ad1/src/plugin-manifest.ts), [manifest tests](https://github.com/vercel-labs/skills/blob/1164afa5f0e21ebd01e6fc11249759353f494ad1/tests/plugin-manifest-discovery.test.ts)).

### Claude supports explicit nested Skill directories

Claude Code's `skills` manifest field accepts one relative path or an array of relative paths, all rooted at the plugin root and beginning with `./`. A path may point directly to a directory containing `SKILL.md`; the Skill's frontmatter `name` controls its stable invocation name, with the directory basename only a fallback. Custom Skill paths are added alongside the default `skills/` scan ([Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference#component-path-fields)).

Consequently, the existing plugin can keep its `presentation-skills` name and replace entries such as `./skills/build-presentation` with `./skills/presentation/build-presentation`. The public Claude invocation remains `presentation-skills:build-presentation` as long as the plugin name and Skill frontmatter name stay unchanged. The explicit list should remain authoritative; the specification should not rely on undocumented recursive behavior in Claude's default `skills/` scan.

### The root marketplace source can continue to package the nested tree

The marketplace's relative `source` is resolved from the marketplace repository root. Claude copies the resolved plugin directory into its cache, and installed plugins cannot reach outside that copied directory ([marketplace source rules](https://code.claude.com/docs/en/plugin-marketplaces#plugin-sources), [plugin caching and traversal rules](https://code.claude.com/docs/en/plugins-reference#plugin-caching-and-file-resolution)).

The current `"source": "./"` therefore continues to work when presentation Skills move deeper inside this repository: the repository root remains the plugin root and the nested directories are still inside the cached plugin. This also means every runtime dependency used by a Skill must remain within the repository/plugin root. Moving the marketplace source down to a presentation-only subdirectory would be a different packaging design and would require relocating or copying its manifest and all dependencies; it is unnecessary for this restructuring.

## Compatibility decision

Use `skills/presentation/<stable-skill-name>/SKILL.md` as the maximum conventional nesting for Presentation member Skills.

- Preserve every Skill's frontmatter `name` and the plugin name `presentation-skills`.
- Update `.claude-plugin/plugin.json` to explicitly enumerate each new nested Skill directory with `./`-prefixed paths.
- Keep the marketplace plugin source at `./`.
- Treat old repository paths, deep links, scripts, imports, and generated references as migration inputs; source-path compatibility is separate from Skill-name compatibility.
- Verify the final manifest with `claude plugin validate .` and verify the repository selection list with the current `npx skills@latest add ...` flow during implementation.
- Do not choose a deeper canonical layout that requires `--full-depth`; manifest support is useful redundancy, not a substitute for ordinary `npx skills` discovery.

No dependency installation or state-changing external test was needed: the current CLI implementation and tests plus Claude's official manifest specification answer the layout question directly.
