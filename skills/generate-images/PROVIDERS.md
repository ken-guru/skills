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

### 3. Install the SDK

The SDK is bundled with the skill. It installs automatically on first use. To install manually:

```bash
cd ~/.claude/skills/generate-images/scripts && npm install
```

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

## Adding another provider

The script in `scripts/generate-images.js` uses a simple interface internally:

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
2. Replace the Gemini `generate()` call in the script with your function.
3. Read your provider's API key from a dedicated environment variable (e.g. `MY_PROVIDER_API_KEY`).

Any API that accepts a text prompt and returns image data (base64, binary, or a URL to download) fits this pattern.

---

## Security checklist

- [ ] `.envrc` is in `.gitignore`
- [ ] API key set only as an environment variable — never in source files or config
- [ ] Key is not logged: do not add `console.log(process.env.GEMINI_API_KEY)` for debugging
- [ ] Rotate the key immediately if accidentally exposed (committed, logged, shared in chat)
