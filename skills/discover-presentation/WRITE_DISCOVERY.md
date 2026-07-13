### Step 3: Write state files

Write `DISCOVERY.json` and `PROJECT.json` to the project folder per [../shared/state-schema.md](../shared/state-schema.md).

Mark `phases.discovery.status = "done"` in `PROJECT.json`.

### Step 4: Report to user

```
✅ Discovery complete
📁 Project folder: [path]
▶️  Next step: Run `structure-agenda` to build the agenda
```
