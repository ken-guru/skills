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

Protocol: resolve Media Scope, Batch by default (Interactive on request), review and report results,
update only the owned media phase, leave it pending on cancellation or failure,
and preserve unrelated phase records. Provider setup remains local.

## Startup

Before proceeding:

1. Resolve the project folder: check `DISCOVERY.json` for the `paths.imageSpec` field, or ask if ambiguous.
2. Check `IMAGE_SPEC.md` exists. If not:
   > ❌ `IMAGE_SPEC.md` not found. Create and approve an image specification before rendering images.
   Abort.
3. Provider and model resolve automatically inside the script — from `--provider=`/`--model=` flags, `GEMINI_API_KEY`/`OPENAI_API_KEY`, or any prior choice persisted in `PROJECT.json`. No separate check is needed here: if misconfigured, the script exits with a clear, actionable error pointing at [PROVIDERS.md](PROVIDERS.md).
4. Check `node` is available: `which node`. If not found, abort: ❌ `node` not installed.
5. Resolve the absolute directory containing this invoked `SKILL.md`. Set the runtime
   bundle path to `<skill-directory>/scripts/generate-images.js` and require that
   file to exist. Quote the absolute path whenever invoking it. Never infer the path
   from cwd or an agent-home convention, and never install runtime dependencies.

## Procedure

### Step 1: Resolve scope and confirm spending in one prompt

Parse all entries from `IMAGE_SPEC.md`. Check which filenames already exist in the project folder.

Every render is a paid API call, so exactly one Decision Prompt names the count
in scope and the provider and model the script will use, in plain text in one
message (a harness's structured question tool may carry it). Take them in the
script's order: `--provider=`/`--model=` flags the user gave, then a flag choice
persisted in `PROJECT.json` `phases.images` (`providerSource` or `modelSource`
is `"flag"`), then the provider whose API key is set (Gemini when both are) with
that provider's default model from [PROVIDERS.md](PROVIDERS.md#models).

- **Named scope:** the request or the Decision Prompt the user just answered
  resolves unambiguously to entries: slide numbers, filenames, "all",
  "missing", or a description matching exactly one entry. If a named slide or
  filename has no entry, say so and treat the scope as unknown. Otherwise list
  one `Overwriting images/foo.png (Slide N)` line per existing file in scope,
  then confirm:

  ```
  💡 Generate N images with <provider>/<model>? (yes / one at a time / cancel)
     See PROVIDERS.md for pricing details.
  ```

- **Unknown scope, no images exist:** scope is every entry; use the same confirmation.
- **Unknown scope, at least one image exists:** combine scope and cost:

  ```
  💡 images/: N of M present. Generate with <provider>/<model>?
     Already present:    • images/foo.png  (Slide 1 — Title)  [...]
     Not yet generated:  • images/bar.png  (Slide 3 — Title)  [...]

     A  Missing only (M−N)     B  Everything (M)
     C  Slides — e.g. "C 1 3"  D  Cancel
     Add "one at a time" to review each image. See PROVIDERS.md for pricing.
  ```

  **C** takes its slide numbers from the same reply; ask "Which slide numbers?
  (e.g. `1 3 5`)" only after a bare `C`, and then confirm the count once more.

Answers: **yes**, **A**, **B**, or **C** → Batch; with "one at a time" →
Interactive; **cancel** or **D** → stop without calling the script; leave files
and `phases.images` unchanged.

### Step 2: Generate

**Batch**

```bash
node "<absolute skill directory>/scripts/generate-images.js" \
  "<IMAGE_SPEC.md path>" [--force] [--slides=N,M,...] [--provider=<gemini|openai>] [--model=<id>] [--delay=<seconds>]
```

- Every entry, or missing only → no extra flags (the script skips existing files)
- Everything → add `--force`
- Selected slides → add `--slides=N,M,...`, plus `--force` to overwrite any that exist

**Interactive (one at a time)**

For each image in scope, run:

```bash
node "<absolute skill directory>/scripts/generate-images.js" \
  "<IMAGE_SPEC.md path>" --slide=N --force [--provider=<gemini|openai>] [--model=<id>]
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

### Step 3: Report results

Present the script's summary output. On failure, suggest editing the prompt in `IMAGE_SPEC.md` and retrying with `--slide=N`.

## Options

Flags of `generate-images.js`. The script itself never prompts.

| Flag | Effect |
|------|--------|
| `--force` | Overwrite images that already exist |
| `--slide=N` | Generate only slide N |
| `--slides=N,M,...` | Generate only these slides |
| `--provider=<gemini\|openai>` | Override the auto-detected provider (see [PROVIDERS.md](PROVIDERS.md)) |
| `--model=<id>` | Override the default model for the resolved provider (see [PROVIDERS.md](PROVIDERS.md#models)) |
| `--delay=<seconds>` | Pause between requests (default: 1s; increase to avoid rate limits — see [PROVIDERS.md](PROVIDERS.md)) |

## Providers

Auto-detected from whichever key is set — `GEMINI_API_KEY` or `OPENAI_API_KEY`. Gemini is the default when both are present. Override with `--provider=gemini|openai`. For setup and security guidance, see [PROVIDERS.md](PROVIDERS.md).

## Project state

Read `paths.imageSpec` and `paths.images` from `DISCOVERY.json`, falling back to
`IMAGE_SPEC.md` and `images/`. The script persists the resolved `provider`,
`providerSource`, `model`, and `modelSource` (see
[docs/state-schema.md](../docs/state-schema.md)) to `PROJECT.json`
`phases.images` as soon as they're resolved, independent of generation outcome.
After all selected entries succeed, set `phases.images.status` to `"done"` and
record its completion timestamp. On cancellation or any failed entry, do not
mark the phase done.
