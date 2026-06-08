---
name: generate-images
description: Generate PNG images for a presentation by submitting prompts from IMAGE_SPEC.md to an AI image generation API. Use when user wants to generate, create, or render presentation images, mentions IMAGE_SPEC.md and generating images, asks to automate image creation, or wants to run image generation after generate-slides has completed.
---

# Generate Images

Phase skill that follows `generate-slides`. Reads `IMAGE_SPEC.md`, submits each entry's prompt to an AI image generation API, and saves the resulting PNG files to the project's `images/` folder.

## Startup

Before proceeding:

1. Resolve the project folder: check `DISCOVERY.json` for the `paths.imageSpec` field, or ask if ambiguous.
2. Check `IMAGE_SPEC.md` exists. If not:
   > ❌ `IMAGE_SPEC.md` not found. Run `generate-slides` first to create image specifications.
   Abort.
3. Check `GEMINI_API_KEY` is set: `echo "$GEMINI_API_KEY"`. If empty, show setup instructions from [PROVIDERS.md](PROVIDERS.md) and abort.
4. Check `node` is available: `which node`. If not found, abort: ❌ `node` not installed.
5. Ensure the skill's dependencies are installed:
   ```bash
   [ -d ~/.claude/skills/generate-images/scripts/node_modules ] || \
     (cd ~/.claude/skills/generate-images/scripts && npm install --loglevel=error)
   ```

## Procedure

### Step 1: Resolve scope

Parse all entries from `IMAGE_SPEC.md`. Check which filenames already exist in the project folder.

If **no images exist yet**, scope = all entries — skip to Step 2.

If **at least one image already exists**, present:

```
⚠️  images/ — existing files detected (N of M images already present)

  Already present:    • images/foo.png  (Slide 1 — Title)  [...]
  Not yet generated:  • images/bar.png  (Slide 3 — Title)  [...]

  A  Generate missing only   — skip the N that already exist
  B  Regenerate everything   — overwrite all M images
  C  Choose specific slides  — I'll tell you which slide numbers
  D  Cancel
```

Wait for choice. For **C**, follow up: "Which slide numbers? (e.g. `1 3 5`)"

### Step 2: Select generation mode

```
💡 N image(s) will be generated
   Gemini charges per image, not per token.
   Pricing: https://ai.google.dev/gemini-api/docs/pricing

  1  All at once   — generate selected images in sequence
  2  One at a time — pause after each image for your review
```

### Step 3: Generate

**Batch (choice 1)**

```bash
node ~/.claude/skills/generate-images/scripts/generate-images.js \
  <IMAGE_SPEC.md path> [--force] [--slides=N,M,...] [--model=<id>] [--delay=<seconds>]
```

- Scope A → no extra flags (script skips existing files by default)
- Scope B → add `--force`
- Scope C → add `--slides=N,M,...`

**Interactive (choice 2)**

For each image in scope, run:

```bash
node ~/.claude/skills/generate-images/scripts/generate-images.js \
  <IMAGE_SPEC.md path> --slide=N --force [--model=<id>]
```

After each, present:

```
✅ Saved: images/foo.png  (Slide N — Title)
   Open to review, then choose:

     N  Next  — accept and continue to the next image
     R  Redo  — regenerate with the same prompt (different result)
     S  Stop  — exit and keep what has been generated so far
```

Note: to change a prompt before redoing, edit `IMAGE_SPEC.md` first, then choose R.

**R** re-runs the same script call. **S** exits the loop early.

### Step 4: Report results

Present the script's summary output. On failure, suggest editing the prompt in `IMAGE_SPEC.md` and retrying with `--slide=N`.

## Options

These flags bypass the interactive prompts — useful for scripting or repeat runs.

| Flag | Effect |
|------|--------|
| `--force` | Skip scope prompt — regenerate all images in batch |
| `--slide=N` | Skip all prompts — generate only slide N |
| `--slides=N,M,...` | Skip scope prompt — generate specific slides in batch |
| `--model=<id>` | Override the default model (see [PROVIDERS.md](PROVIDERS.md#models)) |
| `--delay=<seconds>` | Pause between requests (default: 1s; increase on free-tier rate limits) |

## Providers

Default: **Gemini** (`gemini-3.1-flash-image`). For setup, other providers, and security guidance, see [PROVIDERS.md](PROVIDERS.md).
