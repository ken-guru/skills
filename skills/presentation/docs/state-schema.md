# State File Schema

Maintainer overview of the Project Folder interface shared through user-owned project
artifacts. Installed Skills embed the smaller field and invariant contract they
actually read or write and do not depend on this suite document at runtime.

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
  "editorialPreferences": {
    "tone": "string | null",
    "prefer": ["string"],
    "avoid": ["string"]
  },
  "theme": {
    "id": "editorial | signal | compact-signal | field-notes",
    "fontOverride": "null | { family: string, sourceUrl?: string }"
  },
  "paths": {
    "agenda": "AGENDA.md",
    "imageSpec": "IMAGE_SPEC.md",
    "diagramSpec": "DIAGRAM_SPEC.md",
    "presentation": "PRESENTASJON.md",
    "html": "PRESENTASJON.html",
    "pdf": "PRESENTASJON.pdf",
    "images": "images/",
    "videos": "videos/",
    "docs": "docs/",
    "sources": "docs/sources/",
    "themes": "themes/",
    "themeLock": "themes/theme-lock.json"
  }
}
```

---

## PROJECT.json

Written by `discover-presentation` and updated by subsequent phase skills.

The lifecycle phases are Discovery, Structure, Generation, and Proofread. Images
and Diagrams are independently invokable media phases with their own state
records; they are associated with the Structure-to-Generation flow rather than
being additional lifecycle phases.

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
    },
    "images": {
      "status": "done | pending | skipped",
      "completedAt": "ISO 8601 date string | null"
    },
    "diagrams": {
      "status": "done | pending | skipped",
      "completedAt": "ISO 8601 date string | null"
    },
    "proofread": {
      "status": "done | pending | skipped",
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

## Glossary

- **Term**: Definition

## [Section 1 Title]

### [Slide Topic]
- Key point
- [Image](images/filename.png) <!-- Suggestion: ... -->
- [Source](url)

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
| `PRESENTASJON.md`, `PRESENTASJON.html`, and `PRESENTASJON.pdf` exist, `phases.generation.status == "done"` | Generation complete |
| Generation is complete, `IMAGE_SPEC.md` exists, and `phases.images.status` is neither `"done"` nor `"skipped"` | Images pending |
| Generation is complete, `DIAGRAM_SPEC.md` exists, and `phases.diagrams.status` is neither `"done"` nor `"skipped"` | Diagrams pending |
| `phases.images.status == "done" or "skipped"`, and `phases.diagrams.status == "done" or "skipped"` | Media complete |
| `phases.proofread.status == "done" or "skipped"` | Proofread complete |
