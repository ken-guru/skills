### Step 3: Write state files

Write `DISCOVERY.json` and `PROJECT.json` to the project folder per [../shared/state-schema.md](../shared/state-schema.md).

Persist the confirmed Presentation Theme as one structured value:

```json
"theme": {
  "id": "editorial",
  "fontOverride": null
}
```

Use only `editorial`, `signal`, or `field-notes`. When the user explicitly requested a font, replace `null` with an object containing the exact `family` and, only when approved, `sourceUrl`.

Mark `phases.discovery.status = "done"` in `PROJECT.json`.

### Step 4: Report to user

```
✅ Discovery complete
📁 Project folder: [path]
▶️  Next step: Run `structure-agenda` to build the agenda
```
