---
name: creating-diagrams
description: Creates legible diagrams from D2 source (flows, architectures, sequences, decision paths) and checks they stay readable at their final size. Use when a request needs a diagram, flowchart, architecture, sequence, or process picture, or mentions D2.
metadata:
  version: "1.0.0"
  changelog: "https://github.com/ken-guru/skills/blob/main/skills/creating-diagrams/CHANGELOG.md"
---

# Creating diagrams

Turn a description of what a diagram must show into D2 source, a rendered SVG, and alt text, then prove it is readable where it will be shown.

Script paths below are relative to this skill's folder. Run each as one command with the folder's absolute path in front, never chained with `&&`, `$(…)`, or heredocs.

## Inputs

- **What it must show**: the message, the subjects, and the relationships. In a slide deck this is the slide's Visual Intent.
- **Output path** for the `.svg`. The PNG and ASCII previews are written beside it.
- **Theme values** (optional): a JSON file of CSS custom properties (`--color-bg`, `--color-text`, `--color-surface`, `--color-muted`, `--color-accent`, `--color-on-accent`). Without one, a neutral palette is used.
- **Slot size** (optional): the space the diagram will fill, in px on a 1280×720 reference, as `WIDTHxHEIGHT`. The default is a 16:9 slide's content area, `1164x616`.

## Workflow

Copy this checklist and tick it off:

```
- [ ] 1. D2 is installed
- [ ] 2. One message stated
- [ ] 3. D2 written with role classes
- [ ] 4. check passes
- [ ] 5. render written and the PNG looked at
- [ ] 6. Alt text written
```

1. Run `node scripts/creating-diagrams.mjs setup --status`. If D2 is missing, ask the person to run `node scripts/creating-diagrams.mjs setup` once, outside the sandbox. It downloads the pinned D2 with a verified checksum into a shared cache.
2. Write the diagram's one message as a comment on the first line, for example `# One message: only the API crosses the network boundary.` Split anything that needs two messages into two diagrams.
3. Write D2 that styles every shape and connection with a **role class** only, never colours or font sizes:

   | Role | Use for |
   |---|---|
   | `base` | ordinary shapes |
   | `emphasis` | the one or two shapes the message is about |
   | `muted` | context that matters less |
   | `risk` | failure, danger, or cost |
   | `boundary` | containers such as networks or teams (dashed) |
   | `flow` | ordinary connections |
   | `optional-flow` | conditional or fallback paths (dashed) |
   | `risk-flow` | failure paths |

4. Run `node scripts/creating-diagrams.mjs check <file.d2> [--theme <values.json>] [--slot WxH]`. Fix every reported problem and run it again until it passes. A legibility failure names the fix: change direction, shorten or wrap labels, or split the diagram.
5. Run `node scripts/creating-diagrams.mjs render <file.d2> --out <file.svg> [--theme <values.json>] [--slot WxH]`. Look at the `.png` preview, and check that every label in the reported **Labels** list belongs to the diagram. A green check is not proof: rendered layouts can still mislead.
6. Write the alt text, and a long description when the diagram carries more than one sentence of information. See [references/text-alternatives.md](references/text-alternatives.md).

## Rules agents most often miss

These compile without any error yet produce the wrong diagram:

- Quote any label containing `#` (it starts a comment) or `;` (it splits the shape in two). The `check` command catches these.
- Connect **keys**, not labels: `api -> db`, not `API service -> Postgres`, which creates new shapes.
- Inside containers, connect by full path (`public.user -> private.api`). A short name outside its container creates a new top-level shape.
- In a sequence diagram, declare every actor before any group. An actor first seen inside a group turns the group into an actor.
- Keep about four shapes per row. Legibility comes from layout, not font size.
- Never add a legend. Put meaning in labels and role styles.

## References

- **D2 syntax and silent pitfalls**: [references/d2-essentials.md](references/d2-essentials.md)
- **Choosing direction, layout engine, and when to split**: [references/layouts.md](references/layouts.md)
- **Diagram design (one message, labels, colour by role)**: [references/design.md](references/design.md)
- **Alt text and long descriptions**: [references/text-alternatives.md](references/text-alternatives.md)
- **Verified examples** (each passes `check`): [examples/](examples/)

For icons, imports, layers, animation, SQL tables, UML classes, and LaTeX, query the installed D2 (`d2 --help`, `d2 layout`) or read [d2lang.com](https://d2lang.com) rather than guessing syntax.
