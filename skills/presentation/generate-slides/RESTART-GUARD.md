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

After either mutating option, set `phases.generation` and `phases.proofread` to
`pending` and clear their completion timestamps. If media is deleted, also set the
corresponding `images` and `diagrams` phases to `pending`.

For an explicit Theme Package refresh, resolve this Skill's directory from the
invoked `SKILL.md` and use its local
`scripts/presentation-theme-invalidation.mjs` implementation. Preserve Agenda and
generated media; invalidate both Media Specs, presentation outputs, Marp
configuration, and the locked Theme Package; then set Generation, Images, Diagrams,
and Proofread to `pending`. Require confirmation before any removal or
`prepare-theme.mjs --refresh --confirm-refresh` call.
