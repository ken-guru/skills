# Can a `scaffold_script` point a `claude plugin eval` run at an existing tool cache?

Ticket: ken-guru/skills#556

**No. Not documented.** The docs describe the scaffold script's environment as fixed, with `HOME` set to the run's temporary home, and they name no way to link, copy, or reference a directory outside the workspace. A script could hard-code an absolute path to a cache and symlink it, but that is inferred from the script's privileges, not a documented feature.

## Evidence

Primary source: https://code.claude.com/docs/en/plugin-evals (fetched 2026-10-21).

### Scaffold script environment

> A scaffold script starts in the empty workspace with a small fixed environment: your shell's `PATH`, `HOME` set to the run's temporary home directory, `TMPDIR`, and a few constants such as `TERM=dumb`. Nothing else from your shell reaches it, and neither do the case's `EVAL_*` variables. If the script exits non-zero or runs longer than 120 seconds, that run scores 0 with a `scaffold failed` error. Use the script for files and git state only, since project configuration it writes isn't loaded.

### Who runs the script, and what it can do

> `context.scaffold_script`: write a Bash script in the case directory and name it in `context.scaffold_script`. The script runs as you, outside the agent's sandbox, and only when you pass `--scaffold`, so pass that flag only for suites you or your organization wrote.

The "outside the agent's sandbox" and "runs as you" wording is the only hint of broader filesystem reach. The docs do not say what the script may touch, and they do not say that it may write outside the workspace or the temporary home.

### Field reference

> `context.scaffold_script`: A Bash script in the case directory that runs in the empty workspace before Claude starts, to create fixture files or a git repository. It runs only when you pass `--scaffold`, with a minimal environment and a 120-second limit, and a non-zero exit fails the run.

> `context.add_dirs`: Directories inside the case directory that Claude may read during the run, granted read-only.

`add_dirs` is limited to directories inside the case directory. It cannot reference a path outside it.

### Run isolation

> Each run gets a temporary home directory, working directory, and Claude Code configuration, and the agent under test runs there as a `claude -p` child process with only your plugin loaded.

> Most of your shell environment is withheld too; only an allowlist and `EVAL_*` variables reach the run.

Source: the "How runs are isolated" section of the same page.

### Other routes checked

- `env` / `EVAL_*` keys: the prior research (`research/eval-run-tool-cache.md` on branch `research/eval-run-tool-cache`) covers these. The scaffold script does not receive `EVAL_*` variables, per the quote above.
- `--no-scaffold`, `--scaffold`, `--keep-sandbox`, and `--json` flags: no option in the docs names a cache or an existing directory.
- Mock MCP servers and recorded mock answers: the docs describe these as separate features, not as a way to share a tool cache.

## Inferred, not documented

- The scaffold script runs as the user with bash and no sandbox. A script could therefore create a symlink inside its temporary `HOME`, or read an absolute path such as `/home/<user>/.cache/ken-guru-skills`, and so reach an existing cache. The docs do not describe or endorse this. The "fixed environment" wording and "files and git state only" suggest it is not the intended use. Such a script would also depend on the machine layout and would not be portable.
- Whether the temporary home is deleted after each run, and whether a symlink made there survives, is not documented.

## Not verified

- No eval run was executed, so the scaffold behaviour is documented, not observed.
- The page was fetched with curl and text-extracted. The quoted passages come from that text. Check the live page before relying on exact wording.
