### Step 3: Write state files

Write `DISCOVERY.json` with the confirmed topic, audience fields, duration, occasion,
language, `projectType: "presentation"`, Theme selection, editorial preferences,
and these path fields:
`agenda`, `imageSpec`, `diagramSpec`, `presentation`, `html`, `pdf`, `images`,
`videos`, `docs`, `sources`, `themes`, and `themeLock`.

Write or update `PROJECT.json` with `projectType: "presentation"`, its original
`createdDate`, and phase records for `discovery`, `structure`, `generation`, `images`,
`diagrams`, and `proofread`. Every phase record has `status` and `completedAt`.
Preserve existing phase state unless the confirmed restart path invalidated it.

Persist the confirmed Presentation Theme as one structured value:

```json
"theme": {
  "id": "editorial",
  "fontOverride": null
}
```

Persist confirmed editorial preferences as one structured value. Use empty
arrays and `null` when the user supplied no preference:

```json
"editorialPreferences": {
  "tone": null,
  "prefer": [],
  "avoid": []
}
```

Use only `editorial`, `signal`, `compact-signal`, or `field-notes`. When the user explicitly requested a font, replace `null` with an object containing the exact `family` and, only when approved, `sourceUrl`.

Mark `phases.discovery.status = "done"` and record its completion timestamp in
`PROJECT.json`.

### Step 4: Report to user

```
✅ Discovery complete
📁 Project folder: [path]
▶️  Next step: Run `structure-agenda` to build the agenda
```
