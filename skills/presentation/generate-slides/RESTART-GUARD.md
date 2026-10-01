# Restart Guard

Run after Theme Resolution and before regenerating presentation outputs when
Markdown, HTML, PDF, or generated media already exists.

Inventory existing presentation outputs and files beneath `images/` and `videos/`.
Show only paths that exist and ask the user to choose:

- **Regenerate presentation text (recommended):** overwrite Markdown, HTML, and PDF
  while preserving generated media.
- **Delete generated media too:** list every media filename and require a second
  explicit `yes` before removing it.
- **Keep everything:** retain existing files and warn that outputs may be
  inconsistent.

An approved Repair Plan in this conversation answers this Decision Prompt with
**Regenerate presentation text** when the files it would overwrite match the
plan's list exactly. Otherwise report `Repair Plan exceeded: <reason>` and ask.
It never answers **Delete generated media too**.

After either mutating option, set `phases.generation` and `phases.proofread` to
`pending` and clear their completion timestamps. If media is deleted, also set the
corresponding `images` and `diagrams` phases to `pending`.

For an explicit Theme Package refresh, calculate the exact preserved paths, stale
paths, and pending phases with
`<skill-directory>/scripts/generate-slides invalidate <project> --change=refresh`.
Preserve Agenda and generated media; invalidate both Media Specs, presentation
outputs, Marp configuration, and the locked Theme Package; then set Generation,
Images, Diagrams, and Proofread to `pending`. Require confirmation before any
removal or `generate-slides prepare-theme <project> --refresh --confirm-refresh`
call.
