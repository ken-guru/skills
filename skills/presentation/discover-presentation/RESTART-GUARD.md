# Restart Guard

Run before writing revised Discovery state when downstream project artifacts exist.

## General Discovery changes

Inventory existing Agenda, Media Specs, source summaries, presentation outputs, and
files beneath `images/` and `videos/`. Show only paths that exist and ask the user to
choose:

- **Delete obsolete text (recommended):** remove Agenda, Media Specs, source
  summaries, Markdown, HTML, and PDF; preserve generated media.
- **Delete everything:** list every media filename and require a second explicit
  `yes` before removing it.
- **Keep everything:** retain all files and warn that downstream content may be
  inconsistent.

After either deletion option, preserve `phases.discovery`, set every existing
downstream phase (`structure`, `generation`, `images`, `diagrams`, `proofread`) to
`pending`, and clear its completion timestamp. Do not write the revised
`DISCOVERY.json` until the user has confirmed the inventory and choice.

## Focused theme or font changes

Resolve this Skill's directory from the invoked `SKILL.md`, then calculate the exact
preserved paths, stale paths, and pending phases with its Skill Executable, called
by unquoted absolute path:

```bash
<skill-directory>/scripts/discover-presentation invalidate <project> --change=<theme or font>
```

It prints the plan as JSON and exits `2` with the fix when Node.js is missing.

- **Theme identifier:** preserve Agenda and generated media; invalidate both Media
  Specs, presentation outputs, Marp configuration, and the locked Theme Package.
- **External Font Override:** preserve Agenda, both Media Specs, generated media, and
  the locked Theme Package; invalidate only Markdown, HTML, and PDF.

Show the calculated inventory and require confirmation before removing stale files
or updating state. A focused change never offers media deletion.
