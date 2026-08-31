#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const specPath = path.resolve(args.find(a => !a.startsWith('--')) || 'IMAGE_SPEC.md');
const force = args.includes('--force');
const slideArg = args.find(a => a.startsWith('--slide='));
const slideFilter = slideArg ? parseInt(slideArg.split('=')[1], 10) : null;
const slidesArg = args.find(a => a.startsWith('--slides='));
const slidesFilter = slidesArg ? slidesArg.split('=')[1].split(',').map(n => parseInt(n.trim(), 10)) : null;
const delayArg = args.find(a => a.startsWith('--delay='));
const delayMs = delayArg ? parseFloat(delayArg.split('=')[1]) * 1000 : 1000;
const provider = args.find(a => a.startsWith('--provider='))?.split('=')[1] ?? 'gemini';
const defaultModels = {
  gemini: 'gemini-3.1-flash-image',
  atlas: 'openai/gpt-image-1-mini/text-to-image',
};

if (!Object.hasOwn(defaultModels, provider)) {
  console.error(`❌ Unknown provider: ${provider}`);
  console.error('   Supported providers: gemini, atlas');
  process.exit(1);
}

const apiKeyName = provider === 'atlas' ? 'ATLASCLOUD_API_KEY' : 'GEMINI_API_KEY';
const apiKey = process.env[apiKeyName];
if (!apiKey) {
  console.error(`❌ ${apiKeyName} is not set in the environment`);
  console.error(`   Use direnv: add \`export ${apiKeyName}=your-key\` to .envrc in your project folder`);
  console.error('   See PROVIDERS.md for full setup instructions');
  process.exit(1);
}

const model = args.find(a => a.startsWith('--model='))?.split('=')[1] ?? defaultModels[provider];

const projectDir = path.dirname(specPath);

let ai;
if (provider === 'gemini') {
  const { GoogleGenAI } = require('@google/genai');
  ai = new GoogleGenAI({ apiKey });
}

const ATLAS_API_BASE = 'https://api.atlascloud.ai';
const ATLAS_MAX_POLLS = 60;
const ATLAS_POLL_INTERVAL_MS = 3000;

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

function isPng(buffer) {
  return buffer.length >= 8
    && buffer[0] === 0x89
    && buffer.subarray(1, 4).toString('ascii') === 'PNG'
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a;
}

async function atlasJson(response, action) {
  if (!response.ok) {
    throw new Error(`Atlas ${action} failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (Number(payload.code) !== 200 || !payload.data) {
    throw new Error(`Atlas ${action} failed: ${payload.message || `code ${payload.code}`}`);
  }
  return payload.data;
}

async function downloadAtlasImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Atlas image download failed with HTTP ${response.status}`);
  }

  const image = Buffer.from(await response.arrayBuffer());
  if (!isPng(image)) {
    throw new Error('Atlas output was not PNG; use an Atlas text-to-image model that supports output_format=png');
  }
  return image;
}

async function generateWithAtlas(prompt) {
  let submitResponse;
  try {
    submitResponse = await fetch(`${ATLAS_API_BASE}/api/v1/model/generateImage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        output_format: 'png',
      }),
    });
  } catch (err) {
    throw new Error(`Atlas submission failed without retry: ${err.message}`);
  }

  let prediction = await atlasJson(submitResponse, 'submission');
  if (!prediction.id) {
    throw new Error('Atlas submission returned no prediction id');
  }

  for (let attempt = 1; attempt <= ATLAS_MAX_POLLS; attempt++) {
    if (prediction.status === 'completed') {
      const outputUrl = prediction.outputs?.[0];
      if (!outputUrl) throw new Error('Atlas completed without an output URL');
      return downloadAtlasImage(outputUrl);
    }
    if (['failed', 'timeout'].includes(prediction.status)) {
      throw new Error(`Atlas generation ${prediction.status}: ${prediction.error || 'no details provided'}`);
    }

    try {
      const pollResponse = await fetch(
        `${ATLAS_API_BASE}/api/v1/model/result/${encodeURIComponent(prediction.id)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      prediction = await atlasJson(pollResponse, 'result polling');
    } catch (err) {
      if (attempt === ATLAS_MAX_POLLS) throw err;
    }

    if (prediction.status !== 'completed' && attempt < ATLAS_MAX_POLLS) {
      await new Promise(resolve => setTimeout(resolve, ATLAS_POLL_INTERVAL_MS));
    }
  }

  throw new Error(`Atlas generation did not complete after ${ATLAS_MAX_POLLS} polls`);
}

async function generateWithGemini(prompt) {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }

  throw new Error('Response contained no image data');
}

async function generateOne(entry) {
  const outPath = safeOutPath(entry.filename);

  if (!force && fs.existsSync(outPath)) {
    console.log(`⏭️  Slide ${entry.slideNumber}: ${path.basename(outPath)} (exists — use --force to regenerate)`);
    return 'skipped';
  }

  console.log(`🎨 Slide ${entry.slideNumber} — ${entry.slideTitle}`);
  console.log(`   Prompt: ${entry.prompt.substring(0, 90)}${entry.prompt.length > 90 ? '…' : ''}`);

  const image = provider === 'atlas'
    ? await generateWithAtlas(entry.prompt)
    : await generateWithGemini(entry.prompt);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, image);
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
  console.log(`   Provider: ${provider}`);
  console.log(`   Model: ${model}`);
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
