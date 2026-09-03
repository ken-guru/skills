#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PROVIDERS = {
  gemini: {
    key: 'GEMINI_API_KEY',
    models: ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image'],
    defaultModel: 'gemini-3.1-flash-image',
  },
  openai: {
    key: 'OPENAI_API_KEY',
    models: ['gpt-image-1-mini', 'gpt-image-1', 'gpt-image-1.5', 'gpt-image-2'],
    defaultModel: 'gpt-image-1-mini',
  },
};

// Assumes exactly two providers; extend deliberately (not this lookup) if a third joins.
function otherProvider(provider) {
  return Object.keys(PROVIDERS).find((p) => p !== provider);
}

function decodeBase64Image(base64) {
  if (!base64) {
    throw new Error('Response contained no image data');
  }
  return Buffer.from(base64, 'base64');
}

const args = process.argv.slice(2);
const specPath = path.resolve(args.find(a => !a.startsWith('--')) || 'IMAGE_SPEC.md');
const force = args.includes('--force');
const slideArg = args.find(a => a.startsWith('--slide='));
const slideFilter = slideArg ? parseInt(slideArg.split('=')[1], 10) : null;
const slidesArg = args.find(a => a.startsWith('--slides='));
const slidesFilter = slidesArg ? slidesArg.split('=')[1].split(',').map(n => parseInt(n.trim(), 10)) : null;
const delayArg = args.find(a => a.startsWith('--delay='));
const delayMs = delayArg ? parseFloat(delayArg.split('=')[1]) * 1000 : 1000;
const providerArg = args.find(a => a.startsWith('--provider='))?.split('=')[1];
const modelArg = args.find(a => a.startsWith('--model='))?.split('=')[1];

const projectDir = path.dirname(specPath);
const projectStatePath = path.join(projectDir, 'PROJECT.json');

function readProjectState() {
  try {
    return JSON.parse(fs.readFileSync(projectStatePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeImagesPhaseFields(fields) {
  const state = readProjectState();
  state.phases = state.phases || {};
  state.phases.images = { ...state.phases.images, ...fields };
  fs.writeFileSync(projectStatePath, JSON.stringify(state, null, 2) + '\n');
}

const persistedImages = readProjectState().phases?.images ?? {};

function resolveProvider() {
  if (providerArg) {
    if (!(providerArg in PROVIDERS)) {
      console.error(`❌ Unknown provider "${providerArg}" — expected "gemini" or "openai"`);
      process.exit(1);
    }
    const cfg = PROVIDERS[providerArg];
    if (!process.env[cfg.key]) {
      console.error(`❌ --provider=${providerArg} requires ${cfg.key} to be set (see PROVIDERS.md)`);
      process.exit(1);
    }
    return { provider: providerArg, providerSource: 'flag' };
  }

  if (persistedImages.providerSource === 'flag' && persistedImages.provider in PROVIDERS) {
    const provider = persistedImages.provider;
    const cfg = PROVIDERS[provider];
    if (!process.env[cfg.key]) {
      console.error(
        `❌ Project is configured for provider "${provider}" (see PROJECT.json) but ${cfg.key} is not set. Set it, or pass --provider=${otherProvider(provider)} to switch.`
      );
      process.exit(1);
    }
    return { provider, providerSource: 'flag' };
  }

  const geminiSet = !!process.env[PROVIDERS.gemini.key];
  const openaiSet = !!process.env[PROVIDERS.openai.key];
  let resolved;

  if (geminiSet && openaiSet) {
    resolved = 'gemini';
    console.log('ℹ️  Both provider keys detected — using Gemini (default). Pass --provider=openai to use OpenAI instead.');
  } else if (geminiSet) {
    resolved = 'gemini';
  } else if (openaiSet) {
    resolved = 'openai';
  } else {
    console.error('❌ No image provider configured — set GEMINI_API_KEY or OPENAI_API_KEY (see PROVIDERS.md)');
    process.exit(1);
  }

  if (persistedImages.provider && persistedImages.provider !== resolved) {
    console.log(`ℹ️  Provider changed from ${persistedImages.provider} to ${resolved} since last run (auto-detected — pass --provider to lock one in)`);
  }

  return { provider: resolved, providerSource: 'auto' };
}

function resolveModel(provider) {
  const cfg = PROVIDERS[provider];

  if (modelArg) {
    if (!cfg.models.includes(modelArg)) {
      console.error(`❌ --model=${modelArg} is not a valid model for provider "${provider}" — did you mean --provider=${otherProvider(provider)}?`);
      process.exit(1);
    }
    return { model: modelArg, modelSource: 'flag' };
  }

  if (
    persistedImages.modelSource === 'flag' &&
    persistedImages.provider === provider &&
    cfg.models.includes(persistedImages.model)
  ) {
    return { model: persistedImages.model, modelSource: 'flag' };
  }

  return { model: cfg.defaultModel, modelSource: 'default' };
}

const providerResolution = resolveProvider();
const modelResolution = resolveModel(providerResolution.provider);
writeImagesPhaseFields({ ...providerResolution, ...modelResolution });

const provider = providerResolution.provider;
const model = modelResolution.model;

function createGeminiGenerator() {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env[PROVIDERS.gemini.key] });

  return async (prompt) => {
    const interaction = await ai.interactions.create({
      model,
      input: prompt,
      response_format: { type: 'image', mime_type: 'image/png' },
    });

    return decodeBase64Image(interaction.output_image?.data);
  };
}

function createOpenAIGenerator() {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env[PROVIDERS.openai.key] });

  return async (prompt) => {
    let response;
    try {
      response = await openai.images.generate({
        model,
        prompt,
        size: '1024x1024',
        quality: 'auto',
        n: 1,
        output_format: 'png',
      });
    } catch (err) {
      if (err.code === 'moderation_blocked') {
        const stage = err.error?.moderation_details?.moderation_stage ?? 'unknown';
        const categories = err.error?.moderation_details?.categories?.join(', ') || 'unspecified';
        throw new Error(
          `Prompt blocked by content moderation (stage: ${stage}, categories: ${categories}) — edit the prompt in IMAGE_SPEC.md and retry with --slide=N`
        );
      }
      if (err.status === 403) {
        throw new Error(
          'OpenAI permission denied (403) — your organization may need API verification for this model (see PROVIDERS.md)'
        );
      }
      throw err;
    }

    return decodeBase64Image(response.data?.[0]?.b64_json);
  };
}

const generateWithProvider = provider === 'gemini' ? createGeminiGenerator() : createOpenAIGenerator();

function parseImageSpec(content) {
  const entries = [];
  const sections = content.split(/^## /m).slice(1);
  for (const section of sections) {
    const lines = section.split('\n');
    const m = lines[0].match(/^Slide (\d+) — (.+)$/);
    if (!m) continue;
    const entry = { slideNumber: parseInt(m[1], 10), slideTitle: m[2].trim() };
    for (const line of lines) {
      const fn = line.match(/\*\*Filename:\*\* `([^`]+)`/);
      const pr = line.match(/\*\*Prompt suggestion:\*\* "(.+)"$/);
      if (fn) entry.filename = fn[1];
      if (pr) entry.prompt = pr[1];
    }
    if (entry.filename && entry.prompt) entries.push(entry);
  }
  return entries;
}

function safeOutPath(filename) {
  const resolved = path.resolve(projectDir, filename);
  const boundary = path.resolve(projectDir) + path.sep;
  if (!resolved.startsWith(boundary)) {
    throw new Error(`Filename escapes project directory: ${filename}`);
  }
  return resolved;
}

async function generateOne(entry) {
  const outPath = safeOutPath(entry.filename);

  if (!force && fs.existsSync(outPath)) {
    console.log(`⏭️  Slide ${entry.slideNumber}: ${path.basename(outPath)} (exists — use --force to regenerate)`);
    return 'skipped';
  }

  console.log(`🎨 Slide ${entry.slideNumber} — ${entry.slideTitle}`);
  console.log(`   Prompt: ${entry.prompt.substring(0, 90)}${entry.prompt.length > 90 ? '…' : ''}`);

  const buffer = await generateWithProvider(entry.prompt);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log(`   ✅ Saved: ${path.relative(process.cwd(), outPath)}`);
  return 'generated';
}

async function main() {
  if (!fs.existsSync(specPath)) {
    console.error(`❌ ${specPath} not found`);
    console.error('   Run generate-slides first to create IMAGE_SPEC.md');
    process.exit(1);
  }

  let entries = parseImageSpec(fs.readFileSync(specPath, 'utf8'));

  if (slideFilter !== null) {
    entries = entries.filter(e => e.slideNumber === slideFilter);
    if (!entries.length) {
      console.error(`❌ No image entry for slide ${slideFilter} in ${path.basename(specPath)}`);
      process.exit(1);
    }
  } else if (slidesFilter !== null) {
    entries = entries.filter(e => slidesFilter.includes(e.slideNumber));
    if (!entries.length) {
      console.error(`❌ No image entries for slides [${slidesFilter.join(', ')}] in ${path.basename(specPath)}`);
      process.exit(1);
    }
  }

  console.log(`📋 ${entries.length} image specification(s) in ${path.basename(specPath)}`);
  console.log(`   Provider: ${provider}   Model: ${model}`);
  console.log();

  const counts = { generated: 0, skipped: 0, failed: [] };

  for (let i = 0; i < entries.length; i++) {
    try {
      const result = await generateOne(entries[i]);
      counts[result === 'skipped' ? 'skipped' : 'generated']++;
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
      counts.failed.push(`Slide ${entries[i].slideNumber} (${path.basename(entries[i].filename)}): ${err.message}`);
    }
    if (i < entries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log();
  console.log('─'.repeat(40));
  console.log(`✅ Generated: ${counts.generated}`);
  if (counts.skipped) console.log(`⏭️  Skipped:   ${counts.skipped}`);
  if (counts.failed.length) {
    console.log(`❌ Failed:    ${counts.failed.length}`);
    counts.failed.forEach(f => console.log(`   • ${f}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
