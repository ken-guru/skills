# ADR 0008: Image Provider Selection by API Key Auto-Detection

## Context
`generate-images` hardcoded Gemini as the only Image Provider. Adding OpenAI's
GPT Image API as a second provider requires a way to pick which one runs for
a given project, without adding new required setup for existing Gemini users.

## Decision
Provider Selection auto-detects from whichever provider's API key
(`GEMINI_API_KEY` or `OPENAI_API_KEY`) is set in the environment — consistent
with the existing per-project `direnv`/`.envrc` pattern, where only the
relevant key exists in scope. An explicit `--provider=gemini|openai` flag
overrides auto-detection. If both keys are present and no flag is given,
Gemini wins, preserving current behavior for existing projects.

We considered requiring an explicit provider field (e.g. in `DISCOVERY.json`)
instead, but rejected it: it would force every existing project to be
migrated or default-filled, and duplicates information the API key already
carries.

## Consequences
- **Positive:** Zero-config for both new and existing single-provider
  projects; the `.envrc` a user already sets up doubles as provider choice.
- **Negative:** A project with both keys set silently prefers Gemini unless
  `--provider` is passed explicitly — non-obvious without reading this ADR.
