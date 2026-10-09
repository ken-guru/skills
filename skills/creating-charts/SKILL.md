---
name: creating-charts
description: Creates static, accessible data charts (bar, line, scatter, area, and more) from a data file with Vega-Lite, checks their text is readable at final size, and writes alt text, a source caption, and a data table. Use when a request needs a chart, graph, or plot of real data.
metadata:
  version: "1.0.0"
  changelog: "https://github.com/ken-guru/skills/blob/main/skills/creating-charts/CHANGELOG.md"
---

# Creating charts

Turn real data into a static chart that makes one point, stays readable where it is shown, and carries its own text alternative and source.

Script paths below are relative to this skill's folder. Run each as one command with the folder's absolute path in front, never chained with `&&`, `$(…)`, or heredocs.

## Inputs

- **The data**, as a `.csv` or `.json` file the person supplied or a source vouches for. Never type numbers into the chart, never estimate them, and never invent data to fill a gap: ask for it instead.
- **The point** the chart must make, and where the data came from.
- **Output path** for the `.svg`.
- **Theme values** (optional): a JSON file of CSS custom properties (`--color-bg`, `--color-text`, `--color-muted`, `--color-accent`, `--font-body`, …). Without one, a neutral palette is used.
- **Slot size** (optional): the space the chart will fill, in px on a 1280×720 reference, as `WIDTHxHEIGHT`. The default is `1164x616`.

## Workflow

```
- [ ] 1. vl-convert is installed
- [ ] 2. Chart form chosen for the point
- [ ] 3. Spec written, with no data inside it
- [ ] 4. check passes
- [ ] 5. render written and the PNG looked at
- [ ] 6. Alt text, source, and data table placed with the chart
```

1. Run `node scripts/creating-charts.mjs setup --status`. If vl-convert is missing, ask the person to run `node scripts/creating-charts.mjs setup` once, outside the sandbox.
2. Choose the chart form from the point it makes. See [references/chart-design.md](references/chart-design.md).
3. Write a Vega-Lite spec (`.vl.json`) with `mark` and `encoding` only. Leave out `data`, `width`, `height`, and fonts and colours: the script adds the data from the file and sizes and styles the chart for its slot. Give every axis a `title` with units.
4. Run `node scripts/creating-charts.mjs check <spec.vl.json> --data <file> [--theme <values.json>] [--slot WxH]` and fix what it reports.
5. Run `node scripts/creating-charts.mjs render <spec.vl.json> --data <file> --out <file.svg> --alt "<takeaway>" --source "<source>" [--theme <values.json>] [--slot WxH]`. Look at the `.png` preview: labels must not overlap, and the takeaway must be visible at a glance.
6. Place the chart with its alt text, and put the source caption and the data table from the generated `.md` file next to it. In a slide deck, the caption goes on the slide and the data table goes in the speaker notes.

The render keeps the spec and a copy of the data beside the SVG, so the chart can be re-rendered or changed later.

## Rules

- **Alt text states the takeaway**, not the chart type: "Revenue doubled from Q1 to Q4", not "A bar chart of revenue".
- **Colour is never the only signal.** Label series directly, or use different shapes or dash patterns, so the chart reads in greyscale.
- **No interactive charts.** They only work in a browser and freeze in PDF and slide exports.
- **Text stays at 20 px or more** at the slot size. `check` enforces it; when it fails, shorten labels or give the chart more space rather than shrinking text.

When Anthropic's `dataviz` skill is also loaded, this skill's theme values and slide legibility rules take precedence for slide charts; `dataviz` may still inform the choice of chart form and its contrast check.

## References

- **Choosing a chart form, emphasis, and labelling**: [references/chart-design.md](references/chart-design.md)
- **Vega-Lite specs for common chart forms**: [references/vega-lite-patterns.md](references/vega-lite-patterns.md)
