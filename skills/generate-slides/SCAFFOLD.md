# Project Scaffold

## Folder structure

Create the following structure. Folder names use defaults unless overridden in Phase 1.

```
.
├── AGENDA.md               ← built during Phase 2
├── PRESENTASJON.md         ← generated in Phase 3
├── PRESENTASJON.html       ← built by marp in Phase 3
├── README.md               ← see template below
├── images/                 ← user adds images here
├── videos/                 ← user adds videos here (if needed)
├── themes/
│   └── custom-image-style.css   ← see template below
├── docs/
│   └── sources/            ← auto-fetched source summaries go here
└── .vscode/
    └── settings.json       ← see template below
```

---

## PRESENTASJON.md front matter

Use this **exact** front matter at the top of every generated `PRESENTASJON.md`. The CSS is inlined to ensure correct rendering in both HTML export and PDF/PPTX.

```yaml
---
marp: true
theme: default
class: invert
paginate: true
style: |
  section {
    background-color: #fff;
    color: #333;
  }

  section.invert {
    background-color: #1a1a1a;
    color: #f0f0f0;
  }

  section.invert h1,
  section.invert h2,
  section.invert h3,
  section.invert h4,
  section.invert h5,
  section.invert h6 {
    color: #f0f0f0;
  }

  section {
    display: block;
    overflow: hidden;
    position: relative;
    padding: 2rem;
  }

  section > img,
  section figure > img {
    display: block;
    max-width: 100%;
    max-height: 35vh;
    width: auto;
    height: auto;
    margin: 1rem auto;
    object-fit: contain;
    border-radius: 0.5rem;
  }

  section p > img {
    max-height: 35vh;
    max-width: 100%;
    height: auto;
    width: auto;
    object-fit: contain;
  }

  figure {
    text-align: center;
    margin: 1rem 0;
  }

  figcaption {
    font-size: 0.8em;
    color: #aaa;
    margin-top: 0.5rem;
  }

  .img-left {
    float: left;
    max-width: 33%;
    max-height: 60vh;
    width: 33%;
    height: auto;
    margin: 0 2rem 1rem 0;
    object-fit: contain;
  }

  .img-right {
    float: right;
    max-width: 33%;
    max-height: 60vh;
    width: 33%;
    height: auto;
    margin: 0 0 1rem 2rem;
    object-fit: contain;
  }

  section::after {
    content: "";
    display: block;
    clear: both;
  }

  section h1,
  section h2,
  section h3,
  section h4,
  section h5,
  section h6,
  section p,
  section ul,
  section ol {
    overflow: visible;
  }

  .layout-with-image {
    display: flow-root;
  }

  section > p > video {
    display: block;
    max-width: 100%;
    max-height: 65vh;
    width: auto;
    height: auto;
    object-fit: contain;
  }

  section > p:has(video) {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    margin: 0;
    padding: 0;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
---
```

---

## themes/custom-image-style.css

```css
/*!
 * @theme custom-image-style
 * @auto-scaling true
 */

@import 'default';

section {
  background-color: #fff;
  color: #333;
}

section.invert {
  background-color: #1a1a1a;
  color: #f0f0f0;
}

section.invert h1,
section.invert h2,
section.invert h3,
section.invert h4,
section.invert h5,
section.invert h6 {
  color: #f0f0f0;
}

section {
  display: block;
  overflow: hidden;
  position: relative;
  padding: 2rem;
}

section > img,
section figure > img {
  display: block;
  max-width: 100%;
  max-height: 35vh;
  width: auto;
  height: auto;
  margin: 1rem auto;
  object-fit: contain;
  border-radius: 0.5rem;
}

section p > img {
  max-height: 35vh;
  max-width: 100%;
  height: auto;
  width: auto;
  object-fit: contain;
}

figure {
  text-align: center;
  margin: 1rem 0;
}

figcaption {
  font-size: 0.8em;
  color: #aaa;
  margin-top: 0.5rem;
}

.img-left {
  float: left;
  max-width: 33%;
  max-height: 60vh;
  width: 33%;
  height: auto;
  margin: 0 2rem 1rem 0;
  object-fit: contain;
}

.img-right {
  float: right;
  max-width: 33%;
  max-height: 60vh;
  width: 33%;
  height: auto;
  margin: 0 0 1rem 2rem;
  object-fit: contain;
}

section::after {
  content: "";
  display: block;
  clear: both;
}

section h1,
section h2,
section h3,
section h4,
section h5,
section h6,
section p,
section ul,
section ol {
  overflow: visible;
}

.layout-with-image {
  display: flow-root;
}

section > p > video {
  display: block;
  max-width: 100%;
  max-height: 65vh;
  width: auto;
  height: auto;
  object-fit: contain;
}

section > p:has(video) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
```

---

## .vscode/settings.json

```json
{
  "markdown.marp.themes": [
    "themes/custom-image-style.css"
  ]
}
```

---

## README.md template

````markdown
# [Presentation Title]

Marp-based presentation generated with the `build-presentation` skill.

## Preview

Open `PRESENTASJON.html` in a browser for a quick preview.

## Live presentation

```bash
marp -s .
```

Then open `http://localhost:8080/PRESENTASJON.md` in your browser.

## Export

```bash
# HTML (includes local images)
marp PRESENTASJON.md --html --allow-local-files -o PRESENTASJON.html

# PDF
marp PRESENTASJON.md --pdf --allow-local-files -o PRESENTASJON.pdf

# PowerPoint
marp PRESENTASJON.md --pptx --allow-local-files -o PRESENTASJON.pptx
```

## Prerequisites

- [marp-cli](https://github.com/marp-team/marp-cli): `npm install -g @marp-team/marp-cli`
- [Marp for VS Code](https://marketplace.visualstudio.com/items?itemName=marp-team.marp-vscode) (optional, for in-editor preview)

## Folder structure

```
.
├── AGENDA.md               ← content plan and glossary
├── PRESENTASJON.md         ← generated Marp slides
├── PRESENTASJON.html       ← exported HTML
├── images/                 ← add image files here
├── videos/                 ← add video files here (optional)
├── themes/                 ← custom Marp theme
└── docs/
    └── sources/            ← fetched source summaries
```

## Images

Image placeholders in `PRESENTASJON.md` reference files in `images/`.
See comments in `AGENDA.md` for suggestions on appropriate images per slide.
````

---

## AGENDA.md structure template

Use this structure when building the agenda in Phase 2. Fill in all sections based on user input.

```markdown
# [Presentation Title]

## Metadata

- **Date**: [date]
- **Duration**: [duration]
- **Audience**: [audience]
- **Occasion**: [occasion]
- **Presenter(s)**: [name]
- **Language**: [language from DISCOVERY.json]

## Glossary

- **[Term]**: [Precise definition as used in this presentation]
- **[Term]**: [Precise definition]

## [Section Title]

- [Slide: Title]
  - [Image](images/placeholder.png) <!-- Suggestion: [description]. Search: [keywords] -->
  - [content point]
  - [content point]

- [Slide: Title]
  - [Source](url) <!-- Auto-fetched to docs/sources/ -->
  - [content point]

## [Next Section]

...
```
