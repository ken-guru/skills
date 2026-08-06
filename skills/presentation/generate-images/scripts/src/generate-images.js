#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY is not set in the environment');
  console.error('   Use direnv: add `export GEMINI_API_KEY=your-key` to .envrc in your project folder');
  console.error('   See PROVIDERS.md for full setup instructions');
  process.exit(1);
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
const model = args.find(a => a.startsWith('--model='))?.split('=')[1] ?? 'gemini-3.1-flash-image';

const projectDir = path.dirname(specPath);

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: API_KEY });

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

  const response = await ai.models.generateContent({
    model,
    contents: entry.prompt,
    config: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, 'base64'));
      console.log(`   ✅ Saved: ${path.relative(process.cwd(), outPath)}`);
      return 'generated';
    }
  }

  throw new Error('Response contained no image data');
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
