# Changelog

## 1.0.0

- First release. Generates one image per call with Gemini or OpenAI, chosen by `--provider` or by whichever API key is set (Gemini first).
- `plan` states provider, model, image count, and pricing; `generate` refuses to run until the cost is approved (`--approved`).
- Every image gets a sidecar recording provider, model, prompt, and date, and alt text prefixed with `AI-generated:`. Prompts always forbid text in the image.
- Calls the providers with Node's built-in `fetch`, so nothing is installed. Provider and model choices carry over from the Presentation suite 2.x adapters.
