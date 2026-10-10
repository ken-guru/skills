# Themes

## Shipped themes

| Theme | Look |
|---|---|
| `editorial` | Light: warm paper, aubergine text, a coral accent, serif headings |
| `editorial-inverse` | Dark: Editorial's layout on a dark canvas; only the colours differ |

Apply one with `node scripts/rendering-slides.mjs theme --deck <folder> --name <theme>`. Both meet the Accessibility Bar's colour pairs.

## Brand themes

A brand theme starts from a shipped theme and changes only colours, fonts, and a title-slide logo. Layout, sizing, and the slots never change, so a brand cannot break legibility.

Write a brand file next to the assets it names, for example `brand.json`:

```json
{
  "base": "editorial",
  "colours": {
    "--color-accent": "#0b5394",
    "--color-text": "#1b2a3a"
  },
  "fonts": {
    "--font-heading": "\"Brand Serif\", Georgia, serif",
    "--font-body": "\"Brand Sans\", Arial, sans-serif"
  },
  "fontFiles": [
    { "family": "Brand Serif", "file": "BrandSerif-Regular.woff2", "weight": 400 },
    { "family": "Brand Sans", "file": "BrandSans-Regular.woff2", "weight": 400 }
  ],
  "logo": "logo.svg"
}
```

Then run `node scripts/rendering-slides.mjs theme --deck <folder> --brand brand.json`.

- **base**: `editorial` (light) or `editorial-inverse` (dark). For both, make two brand files.
- **colours**: any of `--color-bg`, `--color-text`, `--color-surface`, `--color-muted`, `--color-accent`, `--color-on-accent`.
- **fonts**: `--font-heading`, `--font-body`, `--font-mono`, each with fallbacks. Always end with a generic family (`serif`, `sans-serif`, `monospace`).
- **fontFiles**: only font files the person supplies and may use. They are copied to the Deck Folder's `fonts/`. Nothing is fetched from the web.
- **logo**: an image file, copied to `media/brand-logo.*` and shown on the title slide only.

When a brand colour misses the Accessibility Bar, the theme is still written exactly as given, and the command lists each failing pair with a nearby shade that passes. Show this to the person and let them choose; never change their brand colours silently.

## Changing the look of one deck

`theme.css` in the Deck Folder is the deck's own copy. Small adjustments to the values on `:root` are fine; run `check` afterwards. To switch themes, run `theme` again: it replaces `theme.css`.
