# Shared Environment Validation

All phase skills call this validation contract at startup before doing any work.

## Validation steps

Run the following checks in order:

1. **marp CLI** — run `which marp`. If not found:
   > ❌ `marp-cli` is not installed. Run: `npm install -g @marp-team/marp-cli`
   Abort.

2. **Project folder writable** — confirm the target project folder exists or can be created, and that the agent has write access. If not:
   > ❌ Cannot write to folder `<path>`. Check permissions.
   Abort.

3. **Node/npm available** — run `which node`. Only required if source fetching is needed (Phase 3). If not found, warn but do not abort:
   > ⚠️ `node` not found — source fetching may fail.

## Return contract

Each skill should behave as follows:

```
validate():
  errors   = []   ← fatal; skill must abort
  warnings = []   ← non-fatal; skill continues but reports

  if errors.length > 0:
    print each error
    abort

  if warnings.length > 0:
    print each warning
    continue
```

## Usage

At the top of each phase skill's procedure, include:

```
## Startup
Run validation checks per [shared/validation.md](../shared/validation.md).
Abort if any errors are returned.
```
