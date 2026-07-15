---
name: generate-slides
description: "Generator. Use when generating or regenerating presentation slides."
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
- Always use `<img>` with a class attribute on content slides
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

Before running the restart guard or creating any project output, validate every Diagram entry in `AGENDA.md`. Each requires a named `Diagram brief` with non-empty `Message`, `Show`, and `Takeaway` fields. If any Diagram entry is incomplete, list every affected slide, direct the user to rerun `structure-agenda` to complete the briefs, and abort without changing output:

```text
❌ Diagram briefs are incomplete. No project files were changed.

  Affected slides: [Slide N — Title], [...]

Run `structure-agenda` to add a complete Diagram brief, then run `generate-slides` again.
```

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

**Error handling:** Collect all failed fetches. Continue generation on error. Report failures at the end.

### Step 3: Generate media specifications (IMAGE_SPEC.md and DIAGRAM_SPEC.md)

Before writing any slides, produce the media specifications for the presentation.

**`AGENDA.md` is the single source of truth for which visuals are needed, what they should communicate, and what they are named.**

First, scan `AGENDA.md` for every visual reference (e.g., `[Visual: Picture — \`images/example.png\`]`, `[Visual: Diagram — \`images/example.svg\`]`, or `[Visual: None]`). Collect the corresponding filenames in the order they appear. These filenames are canonical — use them exactly in the specs.

For each Picture visual entry, write an entry to `IMAGE_SPEC.md`:

```markdown
## Slide [N] — [Slide Title]
- **Concept:** [what the image must communicate]
- **Style:** [mood, colour scheme, rendering style — e.g. "dark background, neon accent, technical diagram"]
- **Elements:** [specific visual components — e.g. "file tree, threat arrow, padlock icon"]
- **Filename:** `[exact-filename-from-agenda]`
- **Prompt suggestion:** "[ready-to-use Midjourney / DALL-E prompt]"
```

For each Diagram visual entry, write an entry to `DIAGRAM_SPEC.md`:

```markdown
## Slide [N] — [Slide Title]
- **Message:** [copied from the Diagram brief]
- **Show:** [copied from the Diagram brief]
- **Takeaway:** [copied from the Diagram brief]
- **Filename:** `[exact-filename-from-agenda]`
- **D2 Source:**
  ```d2
  [Write complete D2 syntax that shows the requested content, communicates the message, and supports the takeaway. Use the ELK layout engine where appropriate.]
  ```
```

If a slide is marked `[Visual: None]`, skip it entirely.

Write the files to the project root (`IMAGE_SPEC.md` and `DIAGRAM_SPEC.md`). Do not create a spec file if it would be empty.

#### Step 3a: Validate alignment

After writing the specs, cross-check against `AGENDA.md`:

- Every Picture visual entry must have a matching entry in `IMAGE_SPEC.md` (matched by filename).
- Every Diagram visual entry must have a matching entry in `DIAGRAM_SPEC.md` (matched by filename).

If any mismatch is found, fix the specs to match `AGENDA.md` and report what was corrected. Proceed only when the specs and AGENDA.md are fully aligned.

#### Step 3b: Report spec changes

Before presenting the approval prompt:

1. Check if an old `IMAGE_SPEC.md` or `DIAGRAM_SPEC.md` exists.
2. If yes, run the diff detection procedure from [image-spec-diff.md](../shared/image-spec-diff.md) (applying it to both specs).
3. If changes detected (added, removed, or modified media):
   - Show the formatted diff feedback.

Then present the approval prompt:

> "Media specifications have been generated. You can review `IMAGE_SPEC.md` (for AI images) and `DIAGRAM_SPEC.md` (for D2 diagrams) before we generate the slides. Would you like to review them now?"

Wait for the user to approve or adjust specs before proceeding.

### Step 4: Generate PRESENTASJON.md
Read the external pointer file `SLIDE_GENERATION.md` for the exact generation steps ONLY AFTER the user has explicitly approved the IMAGE_SPEC.md.
