# Can a `claude plugin eval` run see a tool cache?

Ticket: ken-guru/skills#555

## Answers

- **Route 1: pass `KEN_GURU_SKILLS_CACHE` into each run via the case `env` field.** No. Documented. `env` keys must match `EVAL_[A-Z0-9_]*`; any other key fails the run.
- **Route 2: rely on the shell's `KEN_GURU_SKILLS_CACHE` being inherited.** No. Documented. The run inherits only an allowlist (PATH, locale, proxy/certificate settings, provider auth variables, most `ANTHROPIC_*` and `CLAUDE_CODE_*` configuration, and `EVAL_*`).
- **Route 3: pass it renamed as `EVAL_KEN_GURU_SKILLS_CACHE`.** Reaches the run, but no for the current tool. Documented that `EVAL_*` keys reach the run. `tools.mjs` reads only `KEN_GURU_SKILLS_CACHE`, so the renamed variable is ignored.
- **Route 4: point a run's home folder at an existing cache.** No. Documented. Each run gets a temporary home directory; no documented setting points it at an existing directory.
- **Route 5: pass `XDG_CACHE_HOME` to redirect the default cache.** No, not documented. `XDG_CACHE_HOME` is not named in the allowlist. The allowlist is described as "basics such as", so this is not certain. Not observed.
- **Observed runs:** none. No eval suite was executed, so every answer above is from documentation.

## Evidence

### Documentation (primary source)

Source: https://code.claude.com/docs/en/plugin-evals

**Run isolation** ("How runs are isolated" section):

> Each run gets a temporary home directory, working directory, and Claude Code configuration, and the agent under test runs there as a `claude -p` child process with only your plugin loaded.

> Most of your shell environment is withheld too; only an [allowlist] and `EVAL_*` variables reach the run.

**`env` field** (case `prompt.md` / `execution` fields table):

> Extra environment variables for the child session. Keys must match `EVAL_[A-Z0-9_]*`; any other key fails the run. The run inherits only an allowlist from your shell: basics such as `PATH` and locale, proxy and certificate settings, the variables that select and authenticate your model provider, most `ANTHROPIC_*` and `CLAUDE_CODE_*` configuration, and `EVAL_*`. To pass the plugin anything else, such as a toolchain setting, export it as an `EVAL_*` variable.

The docs suggest exporting other settings as `EVAL_*`. That only helps if the tool reads the `EVAL_*` name.

**Scaffold script environment:**

> A scaffold script starts in the empty workspace with a small fixed environment: your shell's `PATH`, `HOME` set to the run's temporary home directory, `TMPDIR`, and a few constants such as `TERM=dumb`. Nothing else from your shell reaches it, and neither do the case's `EVAL_*` variables.

This confirms that `HOME` is set to a temporary directory, not a user-chosen one.

### Repo code (what the tool reads)

Source: `skills/presentation/rendering-slides/scripts/tools.mjs`, lines 15-21:

```js
export const CACHE_ENV = 'KEN_GURU_SKILLS_CACHE';

export function cacheRoot(env = process.env) {
  if (env[CACHE_ENV]) return path.resolve(env[CACHE_ENV]);
  const base = env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(base, 'ken-guru-skills');
}
```

The default cache is `~/.cache/ken-guru-skills` (or under `XDG_CACHE_HOME`). It depends on `HOME` and `XDG_CACHE_HOME`, and under an eval run both point into the temporary home. So a default cache is not visible to a run.

### Not verified

- `claude plugin eval --help` was not captured. Bash calls were refused by the worktree guard in this session. Eval flags were taken from the docs page only.
- The docs page was read through a summarizing fetch, and the quoted passages were taken from the saved full page. The wording should be checked against the live page before relying on exact phrasing.
- No eval run was executed, so the behaviour of the allowlist and the temporary home is documented, not observed.
