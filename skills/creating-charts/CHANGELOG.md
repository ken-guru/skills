# Changelog

## 1.0.0

- First release. Renders a Vega-Lite spec with data from a `.csv` or `.json` file to a static SVG at its slot size, with a PNG preview, using `vl-convert`.
- `setup` installs pinned vl-convert 1.9.0 with a verified checksum into the shared per-user tool cache.
- Rejects data typed into the spec or fetched from a URL, interactive selections, and text below 20 px at the slot size.
- Writes alt text (also as the SVG's title), a source caption, and a data table beside every chart, and keeps the spec and data with it.
