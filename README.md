# Ken Sørevåge's Skills

[![skills.sh](https://skills.sh/b/ken-guru/skills)](https://skills.sh/ken-guru/skills)

A Collection of agent Skills and cohesive Skill Suites.

## Skill Suites

| Suite | Description |
|---|---|
| [Presentation](skills/presentation/README.md) | Eight Skills for discovering, structuring, generating, validating, rendering, and proofreading presentations, with a required editorial pass |

## Standalone Skills

| Skill | Description |
|---|---|
| [unslop](skills/unslop/SKILL.md) | Edit prose to remove AI tells while preserving meaning, tone, technical precision, structured output, and explicit user style preferences |
| [setup-devcontainer](skills/setup-devcontainer/SKILL.md) | Generate a shared devcontainer baseline, optionally with SSH deploy-key/signing-key automation |
| [setup-claude-devcontainer](skills/setup-claude-devcontainer/SKILL.md) | Install Claude Code into an existing shared devcontainer |
| [setup-codex-devcontainer](skills/setup-codex-devcontainer/SKILL.md) | Install Codex into an existing shared devcontainer |
| [setup-antigravity-devcontainer](skills/setup-antigravity-devcontainer/SKILL.md) | Install Antigravity into an existing shared devcontainer |
| [setup-copilot-devcontainer](skills/setup-copilot-devcontainer/SKILL.md) | Install GitHub Copilot CLI into an existing shared devcontainer |

Install a standalone Skill directly:

```bash
npx skills@latest add ken-guru/skills --skill unslop
npx skills@latest add ken-guru/skills --skill setup-devcontainer
npx skills@latest add ken-guru/skills --skill setup-claude-devcontainer
```

## Versions

Each Standalone Skill, and each Skill Suite as a whole, has its own
[semantic version](https://semver.org) and `CHANGELOG.md`. A major version
means something you already have (a Project Folder, a generated devcontainer,
a script flag) needs you to act; its changelog entry says what to do.

**Check what you have.** Claude plugin users:

```bash
claude plugin details presentation-skills
```

`npx skills` users: every installed `SKILL.md` records its version under
`metadata.version`. `npx skills list` shows where each Skill lives; for a
global install:

```bash
find ~/.agents/skills ~/.claude/skills -maxdepth 2 -name SKILL.md -exec grep -H '^  version:' {} + 2>/dev/null
```

For a project install, run it from the project with `.agents/skills
.claude/skills` in place of the two home paths. Each `SKILL.md` also links to
its changelog under `metadata.changelog`.

**Pin a version.** Releases are tagged `<skill-or-suite>-v<version>`, and
`npx skills` installs from a tag. `npx skills update` then stays on it:

```bash
npx skills@latest add ken-guru/skills#unslop-v1.0.0 --skill unslop
```

**See what's new.** [GitHub Releases](https://github.com/ken-guru/skills/releases)
lists every release of every Skill and Skill Suite, with the same notes as its
changelog.

## Repository structure

- `skills/<name>/SKILL.md` is a Standalone Skill.
- `skills/<suite>/<name>/SKILL.md` is a Skill Suite member.
- A suite root contains `README.md` and no `SKILL.md`.
- Skill nesting stops at one suite level.

See [CONTRIBUTING.md](CONTRIBUTING.md) for ownership and contribution rules and
[CONTEXT-MAP.md](CONTEXT-MAP.md) for the Collection and Presentation glossaries.

## License

[MIT](LICENSE)
