# Does `npx skills` offer any content-validation lever beyond trusting the source name?

Investigates ken-guru/skills#213: `skills/setup-devcontainer` runs
`npx -y skills add <source> --skill '*' -a '*' -y --copy -g` unattended on every
container start. A security audit flagged this as an indirect-prompt-injection
risk (unattended ingestion of remote content, no per-skill review, no content
validation). This researches whether the `skills` CLI (npm package `skills`,
published by Vercel — `vercel-labs/skills`) has ANY mechanism to inspect,
pin, filter, or gate skill content before it lands in the container, beyond
trusting the source name.

Researched against `skills@1.5.25` (current as of 2026-09-09), its `--help`
output run directly, its GitHub README (`vercel-labs/skills`, commit at time
of research), and its TypeScript source on GitHub (`src/skill-lock.ts`,
`src/install.ts`, `src/update.ts`, `src/add.ts`).

## Verdict (for the downstream decision ticket)

| # | Question | Exists? | One-line answer |
|---|---|---|---|
| 1 | Dry-run/diff/preview before applying | **No** | No flag anywhere in `--help`; `-l/--list` on `add` prints only skill name + description + file count/names, never content or a diff. `update` reports "Found N update(s)" by name only, with no diff shown, before overwriting. |
| 2 | Content-hash pinning + verified restore | **Partial / not what it sounds like** | The lock file (actual name `.skill-lock.json`, not `skills-lock.json`) does store a content hash (`skillFolderHash`, a GitHub tree SHA or SHA-256 of the folder) — but it's used only for update **drift-detection** (is upstream different from what I have?), never to pin-and-verify a fetch. `experimental_install` restores by re-running `add <source> --skill <name> -y` — it re-fetches whatever HEAD/ref currently returns and never compares the result against the recorded hash. |
| 3 | Allowlist/filter for files within a named skill | **No** | `-s/--skill` selects whole skills by name; nothing sub-selects files inside one skill's directory. Confirmed against every subcommand's flag list and against `add.ts` source — no `--include`/`--exclude`/file-glob concept exists in the codebase. |
| 4 | Review/approval gate beyond the default confirm prompt | **No** | The only gate is the interactive confirmation `-y/--yes` bypasses. No `--review`, no staged/two-step apply, no policy hook. `setup-devcontainer` always passes `-y`, so this gate is fully disabled in the flagged usage. |
| 5 | Null-result statement | **Confirmed** | Beyond the source name (and, weakly, an optional `ref`/subpath in that source string), the CLI gives the operator **no lever** to inspect, pin-and-verify, sub-filter, or gate skill content before `add`/`update`/`experimental_install` write it to disk. Everything downstream of "which source string do I trust" is unattended fetch-and-overwrite. |

Tangential, not load-bearing to the above: the npm package `skills` is
published by `rauchg <rauchg@gmail.com>` and `quuu <qual1337@gmail.com>`
(`npm view skills maintainers`), and version 1.5.25's npm registry metadata
carries an SLSA provenance attestation (`attestations.provenance.predicateType:
https://slsa.dev/provenance/v1`). That only attests "this tarball was built by
this GitHub Actions workflow from this commit" — it says nothing about the
third-party skill *content* the CLI fetches at runtime, which is the actual
concern in #213.

---

## 1. Dry-run / diff / preview mode

**Finding: does not exist.**

Full `--help` output, run directly (`npx --yes skills --help`, `skills@1.5.25`):

```
Add Options:
  -g, --global           Install skill globally (user-level) instead of project-level
  -a, --agent <agents>   Specify agents to install to (use '*' for all agents)
  -s, --skill <skills>   Specify skill names to install (use '*' for all skills)
  -l, --list             List available skills in the repository without installing
  -y, --yes              Skip confirmation prompts
  --copy                 Copy files instead of symlinking to agent directories
  --metadata <json>      Attach valid JSON to the install telemetry event
  --subagent <names>     Install to Eve subagents (use 'root' for the root agent)
  --all                  Shorthand for --skill '*' --agent '*' -y
  --full-depth           Search all subdirectories even when a root SKILL.md exists
```

No `--dry-run`, `--diff`, or `--preview` flag appears in this block or in any
other subcommand's options (`use`, `remove`, `list`, `find`, `update`,
`experimental_install`, `experimental_sync` — all share this one help block;
there is no per-subcommand `--help`).

The only thing that comes close is `-l/--list`, described as "List available
skills in the repository without installing." Checked against source
(`src/add.ts`, two call sites implementing `--list`, lines ~616 and ~1260):

```ts
if (options.list) {
  console.log();
  p.log.step(pc.bold('Available Skills'));
  for (const skill of skills) {
    p.log.message(`  ${pc.cyan(skill.installName)}`);
    p.log.message(`    ${pc.dim(skill.description)}`);
    if (skill.files.size > 1) {
      p.log.message(`    ${pc.dim(`Files: ${skill.files.size}`)}`);
    }
  }
  console.log();
  p.outro('Run without --list to install');
  process.exit(0);
}
```

This prints the skill's `installName`, its `description` (from SKILL.md
frontmatter), and — if the skill has more than one file — either a file-name
list or a file count. It never prints file contents, a diff against what's
currently installed, or any body text. So `-l/--list` is a catalog browser,
not a content preview.

`update`'s check pass (`src/update.ts`, `checkGlobalSkillUpdates` /
`updateProjectSkills`) is the closest thing to "shows what would change" —
but it only says:

```
console.log(`${TEXT}Found ${updates.length} global update(s)${RESET}`);
...
console.log(`${TEXT}Updating ${safeName}…${RESET}`);
```

by skill *name*, then immediately re-invokes `add <source> --skill <name> -y
-g` as a child process to overwrite the files. No diff of the changed content
is ever rendered to the user, interactively or otherwise, before the
overwrite happens.

README (`https://github.com/vercel-labs/skills`, fetched 2026-09-09) contains
no mention of "dry-run," "diff," or "preview" anywhere in its ~580 lines.

## 2. Content-hash pinning and `skills-lock.json`

**Finding: a content hash is recorded, but only for drift-detection, not for
pin-and-verify on install/restore.**

First correction to the ground truth: the lock file's actual filename (per
`src/skill-lock.ts`) is **`.skill-lock.json`** (global) — a per-project
variant is referred to in user-facing text and `install.ts` comments as
"`skills-lock.json`" — the CLI is not fully consistent about the name in
prose vs. code, but neither form is a semver lockfile.

What the entry actually stores (`src/skill-lock.ts`, `SkillLockEntry`
interface):

```ts
export interface SkillLockEntry {
  /** Normalized source identifier (e.g., "owner/repo", "mintlify/bun.com") */
  source: string;
  /** The provider/source type (e.g., "github", "mintlify", "huggingface", "local") */
  sourceType: string;
  /** The original URL used to install the skill (for re-fetching updates) */
  sourceUrl: string;
  /** Branch or tag ref used for installation (for ref-aware updates) */
  ref?: string;
  /** Subpath within the source repo, if applicable */
  skillPath?: string;
  /**
   * GitHub tree SHA for the entire skill folder.
   * This hash changes when ANY file in the skill folder changes.
   * Fetched via GitHub Trees API by the telemetry server.
   */
  skillFolderHash: string;
  /** ISO timestamp when the skill was first installed */
  installedAt: string;
  /** ISO timestamp when the skill was last updated */
  updatedAt: string;
  ...
}
```

So: **yes, there is a content hash** — `skillFolderHash` — either a GitHub
Trees-API tree SHA (for GitHub sources) or a SHA-256 over the folder's
contents (`computeContentHash`/`computeSkillFolderHash`, same file, for
non-GitHub sources). It is **not** an npm-style semver and **not** a pin to a
specific commit that installs are constrained to. `ref` (a branch/tag) is the
only thing resembling a version pin, and it's optional and mutable (a branch
can move).

How `skillFolderHash` is actually used — traced through `src/update.ts`
(`checkGlobalSkillUpdates`, lines ~561–646):

```ts
const latestHash = getSkillFolderHashFromTree(tree, entry.skillPath!);
if (latestHash && latestHash !== entry.skillFolderHash) {
  updates.push({ name: skillName, source, entry });
}
...
const latestHash = usesGitTreeHash
  ? await getGitTreeHash(tempDir, skillPath)
  : await computeSkillFolderHash(join(tempDir, dirname(skillPath)));
...
if (relocated || (latestHash && latestHash !== entry.skillFolderHash)) {
  updates.push({ name: skillName, source, entry: { ...entry, skillPath } });
}
```

This is **only** an "is the upstream folder different from last time I
installed it?" check, run by `skills update`, used to decide which skills to
flag as updatable. It is never used to **verify** a freshly fetched skill
against an expected hash before writing it to disk — there is no code path
that computes a hash after fetch and refuses/warns if it doesn't match an
expected value.

`experimental_install` — the command that "restores skills from
skills-lock.json" — confirms this directly. Full source, `src/install.ts`
(`runInstallFromLock`):

```ts
export async function runInstallFromLock(args: string[]): Promise<void> {
  const cwd = process.cwd();
  const lock = await readLocalLock(cwd);
  const skillEntries = Object.entries(lock.skills);
  ...
  for (const [skillName, entry] of skillEntries) {
    ...
    const installSource = buildLocalUpdateSource(entry);
    ...
  }
  ...
  for (const [source, { skills }] of bySource) {
    try {
      await runAdd([source], {
        skill: skills,
        agent: universalAgentNames,
        yes: true,
      });
    } catch (error) { ... }
  }
  ...
}
```

`experimental_install` re-derives the install **source string** (owner/repo,
URL, ref) from the lock entry and calls `runAdd` — the exact same code path
as a fresh `skills add <source> --skill <name> -y` — against whatever the
source currently returns. **It never re-reads or re-checks `skillFolderHash`
after the fetch.** So "restore from lock file" means "re-fetch the current
HEAD of the named source by name/ref again," not "fetch and verify the exact
previously-recorded content." If the upstream source has since been
compromised or altered, `experimental_install` (and a normal `update`) will
happily install the new content — the hash's only job is telling the *user*
"something changed," not blocking or verifying the write.

README: no mention of `skills-lock.json`/`.skill-lock.json` format,
`skillFolderHash`, or any pin/verify vocabulary anywhere in the ~580-line
document (checked via full-text grep of the fetched README for
`lock|hash|pin|diff|preview|verify|sha|checksum|sign|provenance`).

## 3. Allowlist/filter for files within a named skill

**Finding: does not exist.**

Confirmed against the full flag surface (`--help`, reproduced above) and
against `src/add.ts`: `-s/--skill <skills>` is the only selection flag, and
it operates on whole **skill** units — `Specify skill names to install (use
'*' for all skills)`. Each skill is treated as an atomic folder (in
`skillFolderHash`'s own words: "changes when ANY file in the skill folder
changes"); there is no `--include`, `--exclude`, glob pattern, or per-file
selection concept anywhere in the CLI's option parsing (`src/cli.ts`) or in
`add.ts`'s skill-discovery/installation logic. A skill is installed (or
updated, or removed) as a unit — its `SKILL.md` plus every other file
`discoverSkills` finds under that folder — with no sub-filtering available.

README's examples of `-s/--skill` (`npx skills add vercel-labs/agent-skills
--skill frontend-design --skill skill-creator`) likewise only ever name whole
skills, never files within one.

## 4. Review-before-apply / approval gate beyond default confirmation

**Finding: does not exist.**

The full option surface again shows only one relevant flag, on every
mutating subcommand — `-y, --yes: Skip confirmation prompts` (`add`) / `Skip
all confirmation prompts` (`remove`) / `Skip scope prompt` (`update`) /
`Skip confirmation prompts` (`experimental_sync`). Reading `-y`'s own
description confirms it is a bypass for the *default interactive prompt*,
not a distinct approval-gate feature — there is no separate "review" mode
that, say, stages changes for a human or a CI policy check to approve before
they're written. No `--review`, `--approve`, `--staged`, or webhook/policy
hook concept appears in `--help`, the README, or the source files inspected
(`add.ts`, `update.ts`, `install.ts`, `remove.ts`, `sync.ts`).

`setup-devcontainer`'s generated unattended command passes `-y` explicitly,
which — per the flag's own stated purpose — is exactly the one gate this CLI
offers, deliberately disabled.

## 5. Explicit null-result statement

Per items 1–4: **no lever exists, beyond the source name string itself (and
its optional `ref`), to preview, verify-by-hash, sub-filter, or gate the
actual skill content (SKILL.md and any accompanying files/scripts) that
`npx skills add`/`update`/`experimental_install` write to disk.** The one
content-hash the tool does compute (`skillFolderHash`) is a
change-notification signal for `skills update`'s UI, not a security control —
it's never used to pin an install to a specific known-good version or to
verify a fetch's integrity before it's applied. This is a genuine capability
gap in the upstream CLI relative to the audit's concern, not a
configuration the `setup-devcontainer` skill is failing to opt into.

## Sources

- `npx --yes skills --help` — run directly against `skills@1.5.25`, 2026-09-09.
- `npm view skills version|maintainers|repository|dist --json` — run directly, 2026-09-09 (`1.5.25`; maintainers `rauchg`, `quuu`; provenance attestation present).
- GitHub README: https://github.com/vercel-labs/skills (raw README fetched via `gh api repos/vercel-labs/skills/readme`, ~580 lines, 2026-09-09).
- GitHub repo root listing via `gh api repos/vercel-labs/skills/contents/` and `.../contents/.github` — no `SECURITY.md` or `CONTRIBUTING.md` present; confirmed absent repo-wide via `gh api search/code -f 'q=filename:SECURITY.md repo:vercel-labs/skills'` and the `CONTRIBUTING.md` equivalent, both `total_count: 0`.
- Source (fetched via `gh api repos/vercel-labs/skills/contents/src/<file>.ts`, 2026-09-09):
  - `src/skill-lock.ts` — `SkillLockEntry`/`SkillLockFile` shape, `computeContentHash`, `fetchSkillFolderHash`.
  - `src/install.ts` — `runInstallFromLock` (`experimental_install` implementation).
  - `src/update.ts` — `checkGlobalSkillUpdates`/`updateProjectSkills`, hash-diff-based update detection, no diff/preview rendering, re-invokes `add ... -y` to apply.
  - `src/add.ts` — `--list` implementation (two call sites), skill-atomic `--skill` filtering, no file-level filter.
  - `src/types.ts` — `Skill`, `ParsedSource`, `RemoteSkill` shapes (confirms no file-allowlist field anywhere in the type model).
  - npm registry metadata (`npm view skills@1.5.25 dist --json`) — `attestations.provenance.predicateType: https://slsa.dev/provenance/v1` present (tangential, CLI package supply-chain only).
