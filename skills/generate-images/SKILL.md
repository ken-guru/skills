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
5. Check `@google/genai` is installed: `node -e "require('@google/genai')" 2>/dev/null && echo ok`. If it fails:
   ```bash
   npm install -g @google/genai
   ```

## Procedure

### Step 1: Confirm scope

Parse `IMAGE_SPEC.md` entries (headers matching `## Slide N — Title`, filenames from `**Filename:**` lines) and present the list:

```
🖼️  Found [N] image(s) in IMAGE_SPEC.md:
  • images/foo.png — Slide 1 — Title
  • images/bar.png — Slide 3 — Title

Already-existing images will be skipped unless --force is used.
Generate all?
```

Wait for user confirmation unless `--force` or `--slide=N` was explicitly requested.

### Step 2: Run the generator

```bash
node ~/.claude/skills/generate-images/scripts/generate-images.js \
  <project-folder>/IMAGE_SPEC.md [--force] [--slide=N] [--model=<model-id>] [--delay=<seconds>]
```

`GEMINI_API_KEY` is read from the environment automatically. Do not pass it as an argument.

### Step 3: Report results

Present the script's summary output and, on failure, suggest:
- Edit the prompt in `IMAGE_SPEC.md` for that slide (simplify if too detailed)
- Check API quota at [Google AI Studio](https://aistudio.google.com)
- Retry with `--slide=N` after adjusting the prompt

## Options

| Flag | Effect |
|------|--------|
| `--force` | Regenerate images that already exist |
| `--slide=N` | Generate only the image for slide N |
| `--model=<id>` | Override the default model (see [PROVIDERS.md](PROVIDERS.md#models)) |
| `--delay=<seconds>` | Pause between requests (default: 1s; increase on free-tier rate limits) |

## Providers

Default: **Gemini** (`gemini-3.1-flash-image`). For setup, other providers, and security guidance, see [PROVIDERS.md](PROVIDERS.md).
