#!/usr/bin/env node
// generating-images: generate one illustration with an Image Provider and mark it as AI-generated.
//
//   node scripts/generating-images.mjs plan --count <n> [--provider gemini|openai] [--model <id>]
//   node scripts/generating-images.mjs generate --prompt "<text>" --alt "<description>" --out <file.png>
//          --approved [--provider gemini|openai] [--model <id>] [--shape landscape|portrait|square]
//
// Uses only Node's built-in fetch: nothing to install.
// Exit codes: 0 success; 1 the provider refused or failed; 2 usage or configuration error.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SKILL_VERSION = '1.0.0';

// Models carried over from the Presentation suite 2.x adapters, which were tested live.
const PROVIDERS = {
  gemini: {
    key: 'GEMINI_API_KEY',
    models: ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image'],
    defaultModel: 'gemini-3.1-flash-image',
    pricing: 'https://ai.google.dev/gemini-api/docs/pricing',
    baseUrl: () => process.env.GENERATING_IMAGES_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  },
  openai: {
    key: 'OPENAI_API_KEY',
    models: ['gpt-image-1-mini', 'gpt-image-1', 'gpt-image-1.5', 'gpt-image-2'],
    defaultModel: 'gpt-image-1-mini',
    pricing: 'https://openai.com/api/pricing/',
    baseUrl: () => process.env.GENERATING_IMAGES_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  },
};

// Text that belongs on a slide or page stays real text (WCAG 1.4.5).
const NO_TEXT_RULE = 'Do not include any text, letters, or numbers in the image.';
const SHAPES = {
  landscape: { openai: '1536x1024', gemini: '16:9' },
  portrait: { openai: '1024x1536', gemini: '9:16' },
  square: { openai: '1024x1024', gemini: '1:1' },
};
// Generous enough for slow image models; the run fails cleanly instead of hanging.
const REQUEST_TIMEOUT_MS = 180_000;

class UsageError extends Error {}
class ProviderError extends Error {}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!['plan', 'generate'].includes(command)) throw new UsageError(`Unknown command "${command ?? ''}". Use plan or generate.`);
  const options = { command, count: null, provider: null, model: null, prompt: null, alt: null, out: null, approved: false, shape: 'landscape' };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    const value = () => {
      const next = rest[index + 1];
      if (next === undefined || next.startsWith('--')) throw new UsageError(`${argument} needs a value.`);
      index += 1;
      return next;
    };
    if (argument === '--count') options.count = Number(value());
    else if (argument === '--provider') options.provider = value();
    else if (argument === '--model') options.model = value();
    else if (argument === '--prompt') options.prompt = value().trim();
    else if (argument === '--alt') options.alt = value().trim();
    else if (argument === '--out') options.out = path.resolve(value());
    else if (argument === '--shape') options.shape = value();
    else if (argument === '--approved') options.approved = true;
    else throw new UsageError(`Unknown option ${argument}.`);
  }
  if (options.provider && !(options.provider in PROVIDERS)) throw new UsageError(`Unknown provider "${options.provider}". Use gemini or openai.`);
  if (!(options.shape in SHAPES)) throw new UsageError('--shape must be landscape, portrait, or square.');
  if (command === 'plan' && !(Number.isInteger(options.count) && options.count > 0)) throw new UsageError('plan needs --count <number of images>.');
  if (command === 'generate') {
    const missing = [];
    if (!options.prompt) missing.push('--prompt "<what to draw>"');
    if (!options.alt) missing.push('--alt "<what the image shows>"');
    if (!options.out) missing.push('--out <file.png>');
    if (missing.length) throw new UsageError(`generate needs ${missing.join(', ')}.`);
    if (!options.approved) {
      throw new UsageError('generate costs money. Run `node scripts/generating-images.mjs plan --count <n>`, show the person the provider, model, and pricing, and pass --approved only after they approve.');
    }
  }
  return options;
}

// Provider Selection: an explicit --provider wins; otherwise the key that is set, Gemini first.
function selectProvider(options) {
  if (options.provider) {
    const { key } = PROVIDERS[options.provider];
    if (!process.env[key]) throw new UsageError(`--provider ${options.provider} needs ${key} to be set.`);
    return options.provider;
  }
  const available = Object.keys(PROVIDERS).filter((name) => process.env[PROVIDERS[name].key]);
  if (!available.length) throw new UsageError('No Image Provider is configured. Set GEMINI_API_KEY or OPENAI_API_KEY in the environment.');
  return available[0];
}

function selectModel(provider, requested) {
  const { models, defaultModel } = PROVIDERS[provider];
  if (!requested) return defaultModel;
  if (!models.includes(requested)) throw new UsageError(`--model ${requested} is not a ${provider} model. Choose one of: ${models.join(', ')}.`);
  return requested;
}

async function post(url, headers, body) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ProviderError(`Could not reach the provider: ${error.message}`);
  }
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ProviderError(`The provider returned ${response.status} with a body that is not JSON.`);
  }
  return { status: response.status, ok: response.ok, json };
}

async function generateOpenAI(model, prompt, shape) {
  const { status, ok, json } = await post(`${PROVIDERS.openai.baseUrl()}/images/generations`, { authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, {
    model, prompt, size: SHAPES[shape].openai, quality: 'auto', n: 1, output_format: 'png',
  });
  if (!ok) {
    const error = json.error ?? {};
    if (error.code === 'moderation_blocked') {
      const details = error.moderation_details ?? {};
      throw new ProviderError(`Prompt blocked by content moderation (stage: ${details.moderation_stage ?? 'unknown'}, categories: ${(details.categories ?? []).join(', ') || 'unspecified'}). Rewrite the prompt without that content and try again.`);
    }
    if (status === 403) throw new ProviderError('OpenAI denied permission (403). The organisation may need API verification for this model; try --model gpt-image-1-mini.');
    throw new ProviderError(`OpenAI returned ${status}: ${error.message ?? 'no message'}`);
  }
  const data = json.data?.[0]?.b64_json;
  if (!data) throw new ProviderError('OpenAI returned no image data.');
  return { buffer: Buffer.from(data, 'base64'), extension: '.png' };
}

async function generateGemini(model, prompt, shape) {
  const { status, ok, json } = await post(`${PROVIDERS.gemini.baseUrl()}/models/${model}:generateContent`, { 'x-goog-api-key': process.env.GEMINI_API_KEY }, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: SHAPES[shape].gemini } },
  });
  if (!ok) throw new ProviderError(`Gemini returned ${status}: ${json.error?.message ?? 'no message'}`);
  const candidate = json.candidates?.[0];
  if (candidate?.finishReason && /SAFETY|PROHIBITED|BLOCK/i.test(candidate.finishReason)) {
    throw new ProviderError(`Prompt blocked by content moderation (${candidate.finishReason}). Rewrite the prompt without that content and try again.`);
  }
  const image = candidate?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!image) throw new ProviderError('Gemini returned no image data.');
  // Gemini image models return JPEG; keep the real format rather than mislabel it.
  return { buffer: Buffer.from(image.data, 'base64'), extension: image.mimeType === 'image/png' ? '.png' : '.jpg' };
}

function plan(options) {
  const provider = selectProvider(options);
  const model = selectModel(provider, options.model);
  console.log(`Plan: ${options.count} image${options.count === 1 ? '' : 's'} with ${provider} (${model}), one request each.`);
  console.log(`Pricing: ${PROVIDERS[provider].pricing}`);
  console.log('No image has been generated. Show this to the person and generate only after they approve the cost.');
  return 0;
}

async function generate(options) {
  const provider = selectProvider(options);
  const model = selectModel(provider, options.model);
  const prompt = `${options.prompt}\n\n${NO_TEXT_RULE}`;
  const result = provider === 'openai' ? await generateOpenAI(model, prompt, options.shape) : await generateGemini(model, prompt, options.shape);
  const stem = options.out.replace(/\.[^.\/]+$/, '');
  const imagePath = `${stem}${result.extension}`;
  const alt = `AI-generated: ${options.alt.replace(/^AI-generated:\s*/i, '')}`;
  await mkdir(path.dirname(imagePath), { recursive: true });
  await writeFile(imagePath, result.buffer);
  await writeFile(`${stem}.json`, `${JSON.stringify({
    generator: `generating-images ${SKILL_VERSION}`, provider, model, prompt, shape: options.shape, date: new Date().toISOString(), alt,
  }, null, 2)}\n`);
  console.log(`✅ ${imagePath}`);
  console.log(`Sidecar: ${stem}.json (provider, model, prompt, date)`);
  console.log(`Alt text: ${alt}`);
  console.log('Show a visible "AI-generated illustration" label wherever the image is used, and look at the image before using it.');
  return 0;
}

async function main(argv) {
  const options = parseArguments(argv);
  return options.command === 'plan' ? plan(options) : generate(options);
}

main(process.argv.slice(2))
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    if (error instanceof ProviderError) {
      process.stdout.write(`❌ ${error.message}\n`);
      process.exitCode = 1;
    } else if (error instanceof UsageError) {
      process.stderr.write(`❌ ${error.message}\n`);
      process.exitCode = 2;
    } else {
      process.stderr.write(`❌ ${error.stack ?? error.message}\n`);
      process.exitCode = 2;
    }
  });
