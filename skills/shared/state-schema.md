# State File Schema

Each project folder contains persistent state files written by phase skills and read by the orchestrator.

---

## DISCOVERY.json

Written by `discover-presentation`. Required input for `structure-agenda`.

```json
{
  "topic": "string",
  "audience": "string",
  "duration": "string",
  "occasion": "string",
  "language": "string",
  "projectType": "presentation",
  "paths": {
    "agenda": "AGENDA.md",
    "presentation": "PRESENTASJON.md",
    "html": "PRESENTASJON.html",
    "images": "images/",
    "videos": "videos/",
    "docs": "docs/",
    "sources": "docs/sources/",
    "themes": "themes/"
  }
}
```

---

## PROJECT.json

Written by `discover-presentation` and updated by subsequent phase skills.

```json
{
  "projectType": "presentation",
  "createdDate": "ISO 8601 date string",
  "phases": {
    "discovery": {
      "status": "done | pending",
      "completedAt": "ISO 8601 date string | null"
    },
    "structure": {
      "status": "done | pending",
      "completedAt": "ISO 8601 date string | null"
    },
    "generation": {
      "status": "done | pending",
      "completedAt": "ISO 8601 date string | null"
    }
  }
}
```

---

## AGENDA.md

Written and iterated by `structure-agenda`. Required input for `generate-slides`.

Expected sections:

```markdown
# [Presentation Title]

## Begreper og definisjoner

- **Term**: Definition

## [Section 1 Title]

### [Slide Topic]
- Key point
- [Bilde](images/filename.png) <!-- Forslag: ... -->
- [Kilde](url)

## [Section N Title]
...
```

---

## Phase status detection rules (used by orchestrator)

| Condition | Phase state |
|-----------|-------------|
| `PROJECT.json` missing | Nothing started |
| `PROJECT.json` exists, `phases.discovery.status == "done"` | Discovery complete |
| `AGENDA.md` exists, `phases.structure.status == "done"` | Structure complete |
| `PRESENTASJON.html` exists, `phases.generation.status == "done"` | Generation complete |
