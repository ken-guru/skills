---
name: generate-images
description: "Media Renderer. Load when IMAGE_SPEC.md exists or the user explicitly requests presentation image rendering."
---

# Generate Images (Media Renderer)

Reads `IMAGE_SPEC.md`, submits each entry's prompt to an AI image generation API, and saves the resulting PNG files to the project's `images/` folder.

## Output voice

Apply a lightweight human-voice pass to scope questions, review prompts, and
result reports. Keep prompts and user-provided Media Intent intact when
transporting them, and keep filenames, paths, commands, and state values exact.
Before approving any presentation-facing text, invoke the standalone `unslop`
Skill as a required full editorial pass using
`DISCOVERY.json.editorialPreferences`; preserve prompts and machine-readable
media metadata where their contract requires exact wording.

Protocol: resolve Media Scope, choose Generation Mode, review and report results,
update only the owned media phase, leave it pending on cancellation or failure,
and preserve unrelated phase records. Gemini setup remains local.

## Startup

Before proceeding:

1. Resolve the project folder: check `DISCOVERY.json` for the `paths.imageSpec` field, or ask if ambiguous.
2. Check `IMAGE_SPEC.md` exists. If not:
   > ❌ `IMAGE_SPEC.md` not found. Create and approve an image specification before rendering images.
   Abort.
3. Resolve the provider (`gemini` by default, or `atlas` when the user explicitly selects it) and check its key without printing the value: `test -n "$GEMINI_API_KEY"` or `test -n "$ATLASCLOUD_API_KEY"`. If missing, show setup instructions from [PROVIDERS.md](PROVIDERS.md) and abort.
4. Check `node` is available: `which node`. If not found, abort: ❌ `node` not installed.
5. Resolve the absolute directory containing this invoked `SKILL.md`. Set the runtime
   bundle path to `<skill-directory>/scripts/generate-images.js` and require that
   file to exist. Quote the absolute path whenever invoking it. Never infer the path
   from cwd or an agent-home convention, and never install runtime dependencies.

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
   The selected provider charges per generated image.
   Confirm current pricing in the provider documentation before continuing.

  1  All at once   — generate selected images in sequence
  2  One at a time — pause after each image for your review
```

### Step 3: Generate

**Batch (choice 1)**

```bash
node "<absolute skill directory>/scripts/generate-images.js" \
  "<IMAGE_SPEC.md path>" [--force] [--slides=N,M,...] [--provider=<id>] [--model=<id>] [--delay=<seconds>]
```

- Scope A → no extra flags (script skips existing files by default)
- Scope B → add `--force`
- Scope C → add `--slides=N,M,...`

**Interactive (choice 2)**

For each image in scope, run:

```bash
node "<absolute skill directory>/scripts/generate-images.js" \
  "<IMAGE_SPEC.md path>" --slide=N --force [--provider=<id>] [--model=<id>]
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
| `--provider=<id>` | Select `gemini` (default) or `atlas` |
| `--model=<id>` | Override the default model (see [PROVIDERS.md](PROVIDERS.md#models)) |
| `--delay=<seconds>` | Pause between requests (default: 1s; increase on free-tier rate limits) |

## Providers

Default: **Gemini** (`gemini-3.1-flash-image`). Atlas Cloud is an explicit opt-in provider with its own credential and model default. For setup, models, and security guidance, see [PROVIDERS.md](PROVIDERS.md).

## Project state

Read `paths.imageSpec` and `paths.images` from `DISCOVERY.json`, falling back to
`IMAGE_SPEC.md` and `images/`. After all selected entries succeed, set
`PROJECT.json` `phases.images.status` to `"done"` and record its completion
timestamp. On cancellation or any failed entry, do not mark the phase done.
