# Vega-Lite patterns

Specs hold only `mark`, `encoding`, and optional `transform` or `layer`. The script adds data, size, fonts, and colours. Each pattern has a runnable copy with sample data in [../examples/](../examples/), and every copy passes `check`.

## Sorted bar chart with one highlighted bar

```json
{
  "mark": "bar",
  "encoding": {
    "y": { "field": "team", "type": "nominal", "sort": "-x", "title": null },
    "x": { "field": "hours", "type": "quantitative", "title": "Hours saved per month" },
    "color": {
      "condition": { "test": "datum.team === 'Platform'", "value": "#b42318" },
      "value": "#57606a"
    }
  }
}
```

Use the theme's accent and muted colours for the `condition` values when a theme is given.

## Line chart over time, labelled directly

```json
{
  "layer": [
    { "mark": { "type": "line", "strokeWidth": 4 } },
    {
      "mark": { "type": "text", "align": "left", "dx": 8 },
      "transform": [{ "filter": "datum.month === '2026-09'" }],
      "encoding": { "text": { "field": "series" } }
    }
  ],
  "encoding": {
    "x": { "field": "month", "type": "temporal", "title": "Month" },
    "y": { "field": "value", "type": "quantitative", "title": "Requests (thousands)" },
    "color": { "field": "series", "type": "nominal", "legend": null },
    "strokeDash": { "field": "series", "type": "nominal", "legend": null }
  }
}
```

`strokeDash` keeps the series apart without colour; the text layer replaces the legend.

## Stacked bar for parts of a whole

```json
{
  "mark": "bar",
  "encoding": {
    "x": { "field": "year", "type": "ordinal", "title": "Year" },
    "y": { "field": "share", "type": "quantitative", "stack": "normalize", "title": "Share of cost", "axis": { "format": "%" } },
    "color": { "field": "category", "type": "nominal", "title": "Category" }
  }
}
```

## Scatter plot

```json
{
  "mark": { "type": "point", "filled": true, "size": 200 },
  "encoding": {
    "x": { "field": "team_size", "type": "quantitative", "title": "Team size" },
    "y": { "field": "lead_time_days", "type": "quantitative", "title": "Lead time (days)" },
    "shape": { "field": "group", "type": "nominal", "title": "Group" },
    "color": { "field": "group", "type": "nominal", "title": "Group" }
  }
}
```

Both `shape` and `color` encode the group, so it reads without colour.
