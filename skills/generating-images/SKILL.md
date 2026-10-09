---
name: generating-images
description: Generates illustrations and photos with an AI image provider (Gemini or OpenAI) after the person approves the cost, and marks every result as AI-generated. Use when a request needs a generated image, illustration, or picture rather than a diagram or chart.
metadata:
  version: "1.0.0"
  changelog: "https://github.com/ken-guru/skills/blob/main/skills/generating-images/CHANGELOG.md"
---

# Generating images

Turn a description of what an image must achieve into one generated image, with a record of how it was made and alt text that discloses it is AI-generated.

Script paths below are relative to this skill's folder. Run each as one command with the folder's absolute path in front, never chained with `&&`, `$(…)`, or heredocs. The script uses Node's built-in `fetch`; there is nothing to install.

## Before generating: provider and cost

The image provider is chosen like this: `--provider gemini` or `--provider openai` when the person asked for one; otherwise whichever of `GEMINI_API_KEY` or `OPENAI_API_KEY` is set, Gemini first. If neither is set, ask the person to set one; never ask them to paste a key into the conversation.

Generating costs money, so the person approves first:

1. Run `node scripts/generating-images.mjs plan --count <n>` for all the images planned.
2. Show the person the provider, model, image count, and pricing link it prints, and wait for approval. When the images are part of a larger plan (for example a slide deck's visuals plan), include this in that approval instead of asking twice.
3. Only then generate, passing `--approved`.

## Generating one image

```
node scripts/generating-images.mjs generate --prompt "<prompt>" --alt "<what it shows>" --out <file.png> --approved [--shape landscape|portrait|square]
```

- **Prompt**: describe the subject, composition, mood, and style the image must have, plus any style hint from the theme (for example "warm paper tones, muted colours"). See [references/prompting.md](references/prompting.md).
- **Alt text**: what the image shows and why it is there, in one sentence. The script prefixes it with `AI-generated:`.
- The script tells the provider never to draw text, letters, or numbers. Words belong in the surrounding page or slide as real text (WCAG 1.4.5).
- Gemini returns JPEG, so the file may be written as `.jpg` even when `--out` says `.png`. Use the path the script reports.

Each image gets a sidecar file beside it (`<name>.json`) recording the provider, model, prompt, and date.

## After generating

- Look at the image. Regenerate (with approval for the extra cost) if it shows text, distorted people or hands, or anything that misrepresents the subject.
- Wherever the image is used, show a visible label such as "AI-generated illustration", and use the `AI-generated:` alt text.
- If the provider refuses a prompt for content moderation, rewrite the prompt without that content; do not try to work around the filter.
