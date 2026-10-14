# Changelog

## 1.0.0

- First release. Writes D2 with fixed Diagram Roles, renders an SVG with PNG and ASCII previews, and checks Effective Text Size against a slot (20 px minimum on a 1280×720 reference).
- `setup` installs pinned D2 0.9.0 with a verified checksum into the shared per-user tool cache.
- Catches silent D2 pitfalls (`#` and `;` in unquoted labels), colour and font-size literals, unknown role classes, and legends.
- Reuses the Presentation suite 2.x D2 render core and legibility check, without its Project Folder or theme-lock coupling.
