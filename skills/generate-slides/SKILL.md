---
name: generate-slides
description: Generate Marp slides from an approved AGENDA.md, including image specs and HTML output. Requires DISCOVERY.json and AGENDA.md. Use when generating or regenerating presentation slides.
---

# Generate Slides

Renders the final presentation from an approved `AGENDA.md`.

## Image Specification Changes

When the agenda changes (via `structure-agenda`) or slides are regenerated, the image specifications may change. You will receive detailed feedback about:
- **Added images**: New images with slide number, filename, and prompt suggestions
- **Removed images**: Images no longer needed
- **Modified images**: Updated prompts for existing images

All feedback is provided before slide generation begins, and you're pointed to `IMAGE_SPEC.md` for full details.

See [image-spec-diff.md](../shared/image-spec-diff.md) for implementation details.

## Gotchas
- Use `<img class="img-right">` on content slides. Restrict `![alt](path)` to title slides.
- Place images inline using `<img class="img-right">` to preserve layout integrity.
- Never use `<img>` without a class attribute on content slides
- Represent code visually by suggesting an image or video instead of using code fences.
- Language must match the `language` field in `DISCOVERY.json` throughout — slides, notes, and glossary

## Startup

Before proceeding:
1. Run `which marp` — if not found, abort: ❌ `marp-cli` not installed. Run `npm install -g @marp-team/marp-cli`
2. Confirm the project folder is writable — if not, abort: ❌ Cannot write to `<path>`
3. Run `which node` — if not found, warn but continue: ⚠️ `node` not found — source fetching may fail

Check that `DISCOVERY.json` exists. If not:
> ❌ `DISCOVERY.json` not found. Run `discover-presentation` first.
Abort.

Check that `AGENDA.md` exists (path from `DISCOVERY.json`). If not:
> ❌ `AGENDA.md` not found. Run `structure-agenda` to build the agenda.
Abort.

If previously generated files exist (`PRESENTASJON.md`, `PRESENTASJON.html`, or media files in `images/` or `videos/`), run the restart guard per [RESTART-GUARD.md](RESTART-GUARD.md) with phase `generate-slides` before proceeding.

## Procedure

### Step 1: Scaffold project (new projects only)

Create all files and folders per [SCAFFOLD.md](SCAFFOLD.md) if they do not already exist.

### Step 2: Fetch and summarize sources

For every `[Source](url)` link in `AGENDA.md`:
- Fetch the URL
- Summarize to `docs/sources/<slug>.md` in concise markdown
- Include: key facts, statistics, quotes, and context useful for slides
- Note the original URL at the top of each summary file

Skip any URL marked `(DO NOT FETCH)`.

**Error handling:** Collect all failed fetches. Do not halt generation. Report failures at the end.

### Step 3: Generate IMAGE_SPEC.md

Before writing any slides, produce `IMAGE_SPEC.md` — a structured specification for every image in the presentation.

**`AGENDA.md` is the single source of truth for which images are needed and what they are named.**

First, scan `AGENDA.md` for every image reference matching `[Image](images/<filename>.png)`. Collect the filenames in the order they appear. These filenames are canonical — use them exactly in IMAGE_SPEC.md.

For each image reference found in `AGENDA.md`, write an entry:

```markdown
## Slide [N] — [Slide Title]
- **Concept:** [what the image must communicate]
- **Style:** [mood, colour scheme, rendering style — e.g. "dark background, neon accent, technical diagram"]
- **Elements:** [specific visual components — e.g. "file tree, threat arrow, padlock icon"]
- **Filename:** `images/[exact-filename-from-agenda].png`
- **Prompt suggestion:** "[ready-to-use Midjourney / DALL-E prompt]"
```

Do not add images to `IMAGE_SPEC.md` that are not referenced in `AGENDA.md`.

Write the file to the project root (default: `IMAGE_SPEC.md`).

#### Step 3a: Validate alignment

After writing `IMAGE_SPEC.md`, cross-check against `AGENDA.md`:

- Every `[Image](images/...)` in `AGENDA.md` must have a matching entry in `IMAGE_SPEC.md` (matched by filename).
- Every entry in `IMAGE_SPEC.md` must correspond to a `[Image](images/...)` in `AGENDA.md`.

If any mismatch is found, fix `IMAGE_SPEC.md` to match `AGENDA.md` and report what was corrected:

```
⚠️ Image alignment corrected:
  Added to IMAGE_SPEC.md:   images/[name].png (Slide N — Title)
  Removed from IMAGE_SPEC.md: images/[old-name].png
```

Proceed only when IMAGE_SPEC.md and AGENDA.md are fully aligned.

#### Step 3b: Report IMAGE_SPEC changes

Before presenting approval prompt:

1. Check if an old `IMAGE_SPEC.md` exists
2. If yes, run the diff detection procedure from [image-spec-diff.md](../shared/image-spec-diff.md)
3. If changes detected (added, removed, or modified images):
   - Show the formatted diff feedback (see [image-spec-diff.md](../shared/image-spec-diff.md) for exact format)
   - Include the path reference: `📄 Full specification: IMAGE_SPEC.md`

Then present the approval prompt:

> "IMAGE_SPEC.md has been generated with [X] image specifications. You can use these directly with Midjourney, DALL-E, or other image generation tools. Would you like to review them before we generate the slides?"

Wait for the user to approve or adjust specs before proceeding.

### Step 4: Generate PRESENTASJON.md
Read the external pointer file `SLIDE_GENERATION.md` for the exact generation steps ONLY AFTER the user has explicitly approved the IMAGE_SPEC.md.
