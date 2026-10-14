# Chart design

## Choose the form from the point

| The point is… | Use |
|---|---|
| comparing amounts across categories | bar chart, sorted, horizontal when labels are long |
| change over time | line chart (area only when the total matters) |
| parts of a whole, two to four parts | stacked bar; a pie only for two or three parts |
| relationship between two measures | scatter plot |
| distribution | histogram |
| one or two numbers | no chart: state the numbers as text |

## One message per chart

A chart answers one question. Put the answer in the slide heading or caption ("Revenue doubled in 2026"), and design the chart so that answer is the first thing seen:

- Highlight the series or bar the message is about with the accent colour; keep the rest muted.
- Sort bars by value unless the categories have a natural order (time, size bands).
- Remove anything that does not serve the message: extra series, gridlines that compete, decorative effects.

## Labels

- Every axis has a title with units ("Revenue (MNOK)").
- Label lines and highlighted bars directly instead of using a legend when there are three series or fewer.
- Shorten category names rather than rotating them.
- Show values on bars only when exact numbers matter more than the shape.

## Colour and contrast

- Colours come from the theme values: the accent for the highlighted series, text and muted colours for the rest. Every mark meets 3:1 contrast against the background (WCAG 1.4.11).
- Colour is never the only way to tell series apart: add direct labels, point shapes, or dash patterns (WCAG 1.4.1).

## Text alternatives and data

- **Alt text** states the takeaway in one or two sentences.
- **Source caption** names where the data came from, visibly next to the chart.
- **Data table** gives the exact numbers to anyone who cannot read the chart; in a slide deck it goes in the speaker notes. `render` writes all three into the `.md` file beside the chart.
