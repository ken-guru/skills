# Portable installed Skill self-location

Research snapshot: Agent Skills, Claude Code, OpenAI Codex, `vercel-labs/skills` at [`1164afa`](https://github.com/vercel-labs/skills/tree/1164afa5f0e21ebd01e6fc11249759353f494ad1), and Node.js documentation, reviewed 2026-08-04.

## Answer

There is **no documented Skill-directory environment variable shared by the Agent Skills standard, `npx skills`, Codex, and Claude Code**. `${CLAUDE_SKILL_DIR}` is a useful Claude Code substitution, but it is a Claude extension. `${CLAUDE_PLUGIN_ROOT}` is narrower still: it identifies an installed Claude plugin, not an independently installed Skill. The open standard specifies skill-root-relative file references but does not specify a process environment or shell-launch variable; Codex documents that it exposes a Skill's `SKILL.md` path to the model, while Claude documents its own substitutions ([Agent Skills file references](https://agentskills.io/specification#file-references), [Codex Skill loading](https://learn.chatgpt.com/docs/build-skills#how-chatgpt-and-codex-use-skills), [Claude Skill substitutions](https://code.claude.com/docs/en/slash-commands#available-string-substitutions), [Claude plugin variables](https://code.claude.com/docs/en/plugins-reference#environment-variables)).

The portable contract therefore has two stages:

1. At the **instruction layer**, resources are named relative to the Skill root and the agent resolves the actual directory containing the invoked `SKILL.md`.
2. At the **program layer**, a launched script resolves adjacent files from its own module location, never from the process working directory or an agent-home convention.

`<skill-dir>` should be documented as an instruction placeholder, not invented as an environment variable.

## Four distinct path contexts

### A. Relative resources in `SKILL.md`

The Agent Skills specification explicitly requires references such as `references/REFERENCE.md` and `scripts/extract.py` to be relative to the Skill root. It also defines `scripts/`, `references/`, and `assets/` as optional contents of the Skill directory ([file-reference rule](https://agentskills.io/specification#file-references), [optional directories](https://agentskills.io/specification#optional-directories)).

Claude Code gives the same authoring guidance for supporting files, using Markdown links such as `[reference.md](reference.md)`, and defines a Skill as the directory containing `SKILL.md` plus those resources ([Claude supporting files](https://code.claude.com/docs/en/slash-commands#add-supporting-files)). Codex likewise defines a Skill as one directory containing `SKILL.md` and optional scripts, references, and assets; its initial Skill list includes the path of each `SKILL.md` ([Codex Skill structure and loading](https://learn.chatgpt.com/docs/build-skills#how-chatgpt-and-codex-use-skills)).

This relative-reference convention is portable for telling an agent what to read or run. It does **not** mean that a literal shell command such as `node scripts/render.mjs` is automatically rebased to the Skill directory.

`npx skills add` preserves the Skill as a directory and installs it by copy or symlink into target-specific locations; those locations differ by target and scope ([`npx skills` installation scope and methods](https://github.com/vercel-labs/skills/blob/1164afa5f0e21ebd01e6fc11249759353f494ad1/README.md#installation-scope)). Its non-installing `skills use` flow is consistent with the same model: when supporting files exist, it materializes them in a temporary Skill directory, supplies that absolute directory to the generated prompt, and tells the agent to resolve relative `SKILL.md` paths from there ([`skills use` prompt construction](https://github.com/vercel-labs/skills/blob/1164afa5f0e21ebd01e6fc11249759353f494ad1/src/use.ts#L148-L180)).

### B. Shell commands launched from an arbitrary working directory

A child Node process inherits or is assigned a process working directory independently of the file containing its instructions; `process.cwd()` reports that process directory, not the script's directory ([Node `process.cwd()`](https://nodejs.org/api/process.html#processcwd)). Consequently, instructions must not assume the agent starts a shell in the Skill directory.

For a cross-host Skill, use wording with an explicit resolution step:

> Resolve `<skill-dir>` to the directory containing this invoked `SKILL.md`, then run `node "<skill-dir>/scripts/render.mjs" …`. Do not infer `<skill-dir>` from the project working directory or an agent-home path.

Codex can perform that step because its Skill metadata includes the `SKILL.md` file path; the app-server interface also accepts and injects a Skill by its absolute `SKILL.md` path ([Codex Skill loading](https://learn.chatgpt.com/docs/build-skills#how-chatgpt-and-codex-use-skills), [Codex app-server Skill input](https://github.com/openai/codex/blob/4c25d6cc5cf51b1864411d916f66431f681d5192/codex-rs/app-server/README.md#skills)). This is an agent-visible locator, not a shell environment variable.

Claude Code has a more direct adapter: `${CLAUDE_SKILL_DIR}` expands in Skill Markdown to the directory containing that Skill's `SKILL.md`, including the Skill subdirectory when it came from a plugin. Claude explicitly recommends it for invoking bundled scripts independently of the current working directory ([Claude `${CLAUDE_SKILL_DIR}`](https://code.claude.com/docs/en/slash-commands#available-string-substitutions)). A shared `SKILL.md` may state that Claude Code uses `${CLAUDE_SKILL_DIR}` while other hosts resolve `<skill-dir>` from their Skill locator; it must not present the Claude name as universal.

### C. Node scripts locating their own files

Once Node has launched the entry script, location is runtime-portable and independent of the installer:

- In an ES module, resolve files with `new URL("./relative-file", import.meta.url)` or derive a filesystem path with `fileURLToPath(import.meta.url)`. Node defines `import.meta.url` as the absolute URL of the current module and documents relative file loading from it ([Node ESM `import.meta.url`](https://nodejs.org/api/esm.html#importmetaurl)).
- In a CommonJS module, use `__dirname`, which Node defines as the directory of the current module ([Node CommonJS `__dirname`](https://nodejs.org/api/modules.html#__dirname)).

Prefer `import.meta.url` rather than `import.meta.dirname` for this repository's `.mjs` scripts unless the runtime baseline is raised: `import.meta.dirname` was added only in Node 20.11/21.2 and became non-experimental later ([Node `import.meta.dirname` history](https://nodejs.org/api/esm.html#importmetadirname)).

Scripts must use these module-relative mechanisms for their Dependency Snapshot, templates, schemas, and sibling modules. They must not use `process.cwd()`, `$HOME`, `CODEX_HOME`, `.agents/skills`, `.codex/skills`, or `.claude/skills` to find bundled content. Those names describe host discovery or installer destinations, not the identity of the currently invoked Skill; `npx skills` may also install by target-specific copy or symlink ([Codex Skill locations](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills), [`npx skills` target paths](https://github.com/vercel-labs/skills/blob/1164afa5f0e21ebd01e6fc11249759353f494ad1/src/agents.ts#L10-L14), [`npx skills` installation methods](https://github.com/vercel-labs/skills/blob/1164afa5f0e21ebd01e6fc11249759353f494ad1/README.md#installation-methods)).

### D. Claude plugin-only paths

`${CLAUDE_PLUGIN_ROOT}` resolves to a Claude plugin's installation directory and is substituted in plugin Skill content, hooks, monitors, MCP configuration, and other documented plugin fields. Marketplace plugins are copied into a versioned Claude cache, and installed plugins cannot reach outside their copied plugin directory ([Claude plugin variables](https://code.claude.com/docs/en/plugins-reference#environment-variables), [plugin caching and path limits](https://code.claude.com/docs/en/plugins-reference#plugin-caching-and-file-resolution)).

It is appropriate for plugin-owned adapters such as hooks, MCP servers, or plugin-root configuration. It is not the canonical locator for member Skill instructions because:

- it is absent when the same Skill is installed independently through `npx skills`;
- it points to the plugin root, whereas `${CLAUDE_SKILL_DIR}` points directly to the invoked member Skill;
- its cached absolute value changes across plugin updates ([Claude plugin path lifetime](https://code.claude.com/docs/en/plugins-reference#environment-variables)).

Likewise, a Claude plugin may put executables in `bin/`, which Claude adds to Bash `PATH`, but an independently installed Agent Skill receives no equivalent guarantee. A bare plugin command is therefore an optional Claude adapter, not the portable Skill interface ([Claude plugin executables](https://code.claude.com/docs/en/plugins-reference#file-locations-reference)).

## Repository recommendation

Adopt these rules in the restructuring specification:

1. Keep every runtime resource inside its Artifact Owner's installed boundary. A member Skill refers only to its own files and committed Dependency Snapshot; the managed plugin must not require a Skill to traverse to a suite or repository parent.
2. Use Skill-root-relative Markdown links and resource names in `SKILL.md`, following the Agent Skills convention.
3. Before an agent-launched command, explicitly resolve the directory containing the invoked `SKILL.md` as `<skill-dir>` and invoke the entry script by an absolute, quoted path. State the Claude Code specialization as `${CLAUDE_SKILL_DIR}`; do not create or require a guessed `SKILL_DIR` environment variable.
4. Make each Node entry script self-locating. Use `import.meta.url` in `.mjs` files and `__dirname` in existing CommonJS `.js` files for all bundled inputs after launch.
5. Reserve `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` for Claude-plugin-owned adapters and persistent plugin state. Do not mention them in the cross-installer runtime contract.
6. Treat installed Skill directories as read-only content. Module-relative lookup locates bundled files; it must not be used to choose a writable cache or persistent-state directory.

Suggested canonical wording for a command-bearing Skill:

```markdown
Resolve `<skill-dir>` to the directory containing this invoked `SKILL.md`.
In Claude Code, `${CLAUDE_SKILL_DIR}` is that directory. In other supported
hosts, use the actual Skill path supplied by the host. Then run:

node "<skill-dir>/scripts/render.mjs" …

Never derive `<skill-dir>` from the current working directory or an agent-home path.
```

Suggested script pattern:

```js
// ESM
const schemaUrl = new URL("../dependency-snapshot/schema.json", import.meta.url);
```

```js
// CommonJS
const schemaPath = path.join(__dirname, "..", "dependency-snapshot", "schema.json");
```

Acceptance tests should launch each script from an unrelated working directory containing spaces and cover: repository-source use, `npx skills` copy installation, `npx skills` symlink installation, supported Codex discovery, Claude Code standalone Skill discovery, and the marketplace-installed Claude plugin cache. The test should fail if any maintained instruction or executable contains an agent-home path or consults the process working directory to locate bundled content.
