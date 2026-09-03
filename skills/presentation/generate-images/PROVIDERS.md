# Image Generation Providers

## Gemini (Default)

### 1. Get an API key

Visit [Google AI Studio](https://aistudio.google.com/app/apikey) and create a key.
Scope it to "Generative Language API" only if your organisation allows key scoping.

### 2. Store it safely with direnv

Install direnv if not already available:

```bash
brew install direnv   # macOS
```

Add the shell hook to your profile (`~/.zshrc` or `~/.bashrc`):

```bash
eval "$(direnv hook zsh)"   # or bash
```

In the **project folder**, create a `.envrc` file:

```bash
export GEMINI_API_KEY=your-key-here
```

Allow it:

```bash
direnv allow
```

Add `.envrc` to `.gitignore`:

```bash
echo ".envrc" >> .gitignore
```

> **Why direnv?** The key is only active while your shell is inside the project folder. It never enters version control, shell history, or environment outside that directory.

### 3. Bundled SDK

The installed Skill includes a self-contained runtime bundle with the pinned SDK.
Running the Skill performs no package installation and writes nothing inside the
installed Skill directory.

### Models

| Model ID | Best for |
|----------|----------|
| `gemini-3.1-flash-image` | Speed and high volume (default) |
| `gemini-3-pro-image` | Professional / print quality |
| `gemini-2.5-flash-image` | Efficiency |

Model availability changes. Check [Google AI's image generation docs](https://ai.google.dev/gemini-api/docs/image-generation) for the current list.

### Rate limits

Free tier allows roughly 15 requests per minute. The script inserts a 1-second pause between requests. For larger batches on the free tier, add `--delay=5` (5-second pause). Upgrade your plan for sustained throughput.

---

## OpenAI

### 1. Get an API key

Visit the [OpenAI Platform dashboard](https://platform.openai.com/api-keys) and create a key.

Image generation models require **API Organization Verification** — a one-time,
account-level check in the OpenAI developer console. If your organization
hasn't completed it, the first request fails with a `403 Permission denied`
error rather than a missing-key error. Complete verification in the
[organization settings](https://platform.openai.com/settings/organization/general)
before generating images.

### 2. Store it safely with direnv

Install direnv if not already available:

```bash
brew install direnv   # macOS
```

Add the shell hook to your profile (`~/.zshrc` or `~/.bashrc`):

```bash
eval "$(direnv hook zsh)"   # or bash
```

In the **project folder**, create a `.envrc` file:

```bash
export OPENAI_API_KEY=your-key-here
```

Allow it:

```bash
direnv allow
```

Add `.envrc` to `.gitignore`:

```bash
echo ".envrc" >> .gitignore
```

> **Why direnv?** The key is only active while your shell is inside the project folder. It never enters version control, shell history, or environment outside that directory.

### 3. Bundled SDK

The installed Skill includes a self-contained runtime bundle with the pinned SDK.
Running the Skill performs no package installation and writes nothing inside the
installed Skill directory.

### Models

| Model ID | Best for |
|----------|----------|
| `gpt-image-1-mini` | Speed and cost efficiency (default) |
| `gpt-image-1` | General-purpose quality |
| `gpt-image-1.5` | Improved fidelity over `gpt-image-1` |
| `gpt-image-2` | Highest quality, flexible sizing, priced per output token rather than per image |

Model availability changes. Check [OpenAI's image generation guide](https://developers.openai.com/api/docs/guides/image-generation) for the current list.

### Pricing

OpenAI has no documented free tier for image generation — every request is
billed. `gpt-image-1-mini`, `gpt-image-1`, and `gpt-image-1.5` are priced per
image (varying by quality/size); `gpt-image-2` is priced per output token.
Review [OpenAI's pricing](https://developers.openai.com/api/docs/guides/image-generation)
before a large batch run — an unattended run of many high-quality images can
add up quickly, unlike Gemini's rate-limited free tier where the ceiling is
throughput, not cost.

`--delay` is still available if the account's own rate limits are ever hit,
but there's no free-tier ceiling to calibrate a default against, so no
specific value is recommended here — start without it and add it only if you
see rate-limit errors.

---

## Adding another provider

Edit the authored source at `scripts/src/generate-images.js`; do not edit the
committed bundle at `scripts/generate-images.js` directly. The source uses a simple
interface internally:

**Input:** a text prompt string  
**Output:** a PNG `Buffer`

To add a provider:

1. Implement an async function that accepts a prompt and returns an image buffer:
   ```javascript
   async function generateWithMyProvider(prompt) {
     // Call your API, decode the response
     return Buffer.from(base64ImageData, 'base64');
   }
   ```
2. Add a `PROVIDERS.myProvider` entry (API key env var, known model list, default
   model), and a `createMyProviderGenerator()` function following the existing
   `createGeminiGenerator()`/`createOpenAIGenerator()` pattern, wired into the
   dispatch that produces `generateWithProvider`.
3. Read your provider's API key from a dedicated environment variable (e.g. `MY_PROVIDER_API_KEY`).
4. From `scripts/`, run `npm run build && npm run check:bundle`, then commit both the
   authored source and rebuilt bundle.

Any API that accepts a text prompt and returns image data (base64, binary, or a URL to download) fits this pattern. See the Gemini and OpenAI sections above for two concrete implementations of this seam.

---

## Security checklist

- [ ] `.envrc` is in `.gitignore`
- [ ] API key set only as an environment variable — never in source files or config
- [ ] Key is not logged: do not add `console.log(process.env.GEMINI_API_KEY)` or `console.log(process.env.OPENAI_API_KEY)` for debugging
- [ ] Rotate the key immediately if accidentally exposed (committed, logged, shared in chat)
