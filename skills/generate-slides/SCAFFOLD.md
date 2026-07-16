# Project Scaffold

The theme preparation script owns Marp configuration, editor configuration, the selected Theme Package snapshot, and its lock. Generation owns the remaining folders and files.

## Folder structure

```text
.
├── DISCOVERY.json
├── PROJECT.json
├── AGENDA.md
├── IMAGE_SPEC.md             # only when Pictures exist
├── DIAGRAM_SPEC.md           # only when Diagrams exist
├── PRESENTASJON.md
├── PRESENTASJON.html
├── PRESENTASJON.pdf
├── README.md
├── .marprc.yml
├── .vscode/
│   └── settings.json
├── images/
├── videos/
├── docs/
│   └── sources/
└── themes/
    ├── theme-lock.json
    └── <selected-theme-id>/
        ├── theme.json
        ├── theme.css
        └── assets/            # optional; absent from initial packages
```

Exactly one selected Theme Package exists in a Project Folder. Never create `custom-image-style.css`, copy theme CSS into front matter, or retain an obsolete package after a confirmed theme change.

## Front matter

Use the exact object returned by `prepare-theme.mjs`. Without an External Font Override it serializes to:

```yaml
---
marp: true
theme: editorial
size: 16:9
paginate: true
lang: en
---
```

The theme ID and language vary with Discovery. When an explicitly requested font exists, the script adds the only permitted `style` block. Do not add other inline theme CSS.

## Marp configuration

The generated `.marprc.yml` enables local files and semantic HTML and registers the locked project-local stylesheet through `themeSet`. Editor settings register that exact same stylesheet. Export and server commands rely on this shared configuration.

## README contents

Document:

- The presentation title and selected theme with locked package version.
- `PRESENTASJON.html` as the quick preview and Accessible Reference Output.
- `PRESENTASJON.pdf` as the default visual derivative.
- `marp -s .` for live presentation.
- `marp PRESENTASJON.md -o PRESENTASJON.html` for HTML.
- `marp PRESENTASJON.md --pdf -o PRESENTASJON.pdf` for PDF.
- `marp PRESENTASJON.md --pptx --allow-local-files -o PRESENTASJON.pptx` as an optional manual export with lower accessibility and editability expectations.
- Marp CLI as a prerequisite and Marp for VS Code as optional.
- Image and video placement directories and Media Spec workflow.

## Creation rules

- Create absent directories but preserve user media.
- Do not overwrite an approved Agenda.
- Do not overwrite a matching valid Theme Package snapshot during ordinary regeneration.
- An explicit refresh or theme change replaces the snapshot only after the Restart Guard.
- Use configured paths from Discovery rather than assuming defaults when the user changed them.
