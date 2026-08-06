# Media Spec diff reporting

Report semantic changes whenever Generate Slides creates or regenerates
`IMAGE_SPEC.md` or `DIAGRAM_SPEC.md`.

## Procedure

For each Media Spec independently:

1. Preserve the previous content in memory before writing the new version.
2. Parse entries by `## Slide [N] — [Title]`.
3. Use `**Filename:**` as the stable identity; slide numbers may change.
4. Classify entries as:
   - **Added:** filename exists only in the new spec.
   - **Removed:** filename exists only in the previous spec.
   - **Modified:** filename exists in both but any semantic field changed.
5. Treat every entry as Added when no previous spec exists.
6. Skip the diff report when all three groups are empty.

For Pictures, compare Media Intent, Intended Media Orientation, Concept, Theme
Treatment, Elements, Filename, and Prompt suggestion. For Diagrams, compare Message,
Show, Takeaway, Theme Treatment, Palette and line guidance, Filename, and D2 Source.

## User-facing report

Report Added, Removed, then Modified entries. For every entry include slide number,
title, filename, and the changed generation material:

- Pictures show the current prompt and, for Modified entries, the previous prompt.
- Diagrams show the current Message and, for Modified entries, which brief,
  treatment, palette, or D2 Source fields changed.

Warn that removed filenames may still exist in the Project Folder and must not be
deleted without user confirmation. Explain that Modified media should be regenerated
to match the approved spec.

End with the path and total entry count for each generated spec. Present the diff
before asking the user to approve the complete Media Specs.

## Edge cases

- A filename reused for another media type is Removed from one spec and Added to the
  other.
- A duplicate filename within either resulting spec is a blocking error.
- Pure slide renumbering is reported as Modified only when another semantic field
  also changed.
- Do not create or report an empty spec when its media type is absent from the
  Agenda.
