# Specify Discovery and project-state theme behavior

Map: [Three engaging presentation themes](map.md)
Labels: `wayfinder:grilling`
Status: Closed
Assignee: Codex
Blocked by: [Define the Presentation Theme contract](02-define-presentation-theme-contract.md), [Name, describe, and default the three themes](03-name-describe-and-default-the-themes.md)

## Question

How should Discovery present and persist theme selection, handle an explicit external-font request, and behave when regenerating presentations created before theme state existed?

## Resolution

### New-project Discovery

- Discovery always asks for a Presentation Theme immediately after Visual preference; it does not infer one from topic, audience, or occasion.
- Present Editorial, Signal, and Field Notes in that order using translated descriptions, with Editorial marked recommended.
- The confirmed defaults summary includes the selected theme and either the exact External Font Override or “none.”
- Discovery never proactively asks about external fonts. It captures one only when the user explicitly volunteers a family during the interview or defaults correction.
- Bundled themes use offline-safe font stacks and never require paid, separately licensed, or externally loaded fonts.

### Persisted state

Store visual selection as one structured field in `DISCOVERY.json`:

```json
"theme": {
  "id": "editorial",
  "fontOverride": null
}
```

When requested, `fontOverride` becomes an object containing the exact family name and an optional user-approved source URL. The override applies only to slide-rendered text; generated images and diagrams retain their own media-safe typography.

### Missing and invalid state

- A legacy project with no `theme` field continues with Editorial without mutating `DISCOVERY.json`. Generation reports: “Theme selection is absent; using Editorial. Rerun Discovery to choose another theme.”
- A present but unknown `theme.id` is a blocking validation error. Generation stops before changing outputs, reports the invalid identifier, lists `editorial`, `signal`, and `field-notes`, and requires the project to be changed to one of them. It does not auto-correct or silently fall back.

### Focused restart behavior

Changing only `theme.id` preserves the approved `AGENDA.md` because theme choice does not change narrative or Media Intent. It marks `IMAGE_SPEC.md`, `DIAGRAM_SPEC.md`, `PRESENTASJON.md`, and `PRESENTASJON.html` stale; keeps existing media files with a warning that their treatment may no longer match; and returns Generation, Images, Diagrams, and Proofread to pending.

Changing only `theme.fontOverride` preserves the Agenda, Media Specs, and generated media because the override does not apply inside media. It marks `PRESENTASJON.md` and `PRESENTASJON.html` stale and returns Generation and Proofread to pending, leaving Images and Diagrams unchanged.

Both focused paths inventory affected files and ask for confirmation before deletion, following the existing Restart Guard safety model. A general Discovery change continues to use the existing broader restart behavior.

### Context pointer

[Presentation theme domain glossary](../../CONTEXT.md)
