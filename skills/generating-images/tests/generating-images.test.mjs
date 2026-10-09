// Exercises generating-images through its command interface, against a local
// stub of each Image Provider's API (no real API calls, no cost).

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(skill, 'scripts', 'generating-images.mjs');

// 1×1 images: a PNG for OpenAI, a JPEG for Gemini (which always returns JPEG).
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

let server;
let baseUrl;
const requests = [];

before(async () => {
  server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const parsed = body ? JSON.parse(body) : {};
      requests.push({ url: request.url, headers: request.headers, body: parsed });
      response.setHeader('content-type', 'application/json');
      if (request.url.startsWith('/openai/images/generations')) {
        if (parsed.prompt.includes('BLOCKED')) {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: { code: 'moderation_blocked', message: 'blocked', moderation_details: { moderation_stage: 'input', categories: ['violence'] } } }));
          return;
        }
        response.end(JSON.stringify({ data: [{ b64_json: PNG }] }));
      } else if (request.url.startsWith('/gemini/models/')) {
        response.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/jpeg', data: JPEG } }] } }] }));
      } else {
        response.statusCode = 404;
        response.end('{}');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

function run(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], {
      env: {
        ...process.env,
        GEMINI_API_KEY: '', OPENAI_API_KEY: '',
        GENERATING_IMAGES_OPENAI_BASE_URL: `${baseUrl}/openai`,
        GENERATING_IMAGES_GEMINI_BASE_URL: `${baseUrl}/gemini`,
        ...env,
      },
    });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { out += chunk; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

function target(name) {
  return path.join(mkdtempSync(path.join(os.tmpdir(), 'generating-images-test-')), 'media', name);
}

const BASE_ARGS = ['--prompt', 'A calm harbour at dawn, editorial photo style', '--alt', 'A calm harbour at dawn'];

test('with no API key it names both keys and generates nothing', async () => {
  const out = target('a.png');
  const result = await run(['generate', ...BASE_ARGS, '--out', out, '--approved']);
  assert.equal(result.code, 2);
  assert.match(result.out, /GEMINI_API_KEY or OPENAI_API_KEY/);
  assert.equal(existsSync(out), false);
});

test('generate refuses to spend money before the cost is approved', async () => {
  const result = await run(['generate', ...BASE_ARGS, '--out', target('a.png')], { OPENAI_API_KEY: 'sk-test' });
  assert.equal(result.code, 2);
  assert.match(result.out, /--approved/);
  assert.match(result.out, /plan/);
});

test('plan states provider, model, and image count without generating', async () => {
  const before = requests.length;
  const result = await run(['plan', '--count', '3'], { GEMINI_API_KEY: 'g-test' });
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /gemini/);
  assert.match(result.out, /3 images?/);
  assert.match(result.out, /No image has been generated/);
  assert.equal(requests.length, before);
});

test('OpenAI is used when only its key is set, and the output is marked as AI-generated', async () => {
  const out = target('harbour.png');
  const result = await run(['generate', ...BASE_ARGS, '--out', out, '--approved'], { OPENAI_API_KEY: 'sk-test' });
  assert.equal(result.code, 0, result.out);
  assert.ok(existsSync(out));
  const sidecar = JSON.parse(readFileSync(out.replace(/\.png$/, '.json'), 'utf8'));
  assert.equal(sidecar.provider, 'openai');
  assert.ok(sidecar.model);
  assert.match(sidecar.prompt, /calm harbour/);
  assert.match(sidecar.date, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(sidecar.alt, 'AI-generated: A calm harbour at dawn');
  assert.match(result.out, /AI-generated: A calm harbour at dawn/);
  const last = requests.at(-1);
  assert.equal(last.headers.authorization, 'Bearer sk-test');
  assert.match(last.body.prompt, /not include any text, letters, or numbers/i);
});

test('Gemini JPEG output is written with a .jpg extension and the real path is reported', async () => {
  const out = target('harbour.png');
  const result = await run(['generate', ...BASE_ARGS, '--out', out, '--approved'], { GEMINI_API_KEY: 'g-test' });
  assert.equal(result.code, 0, result.out);
  const jpg = out.replace(/\.png$/, '.jpg');
  assert.ok(existsSync(jpg));
  assert.match(result.out, /harbour\.jpg/);
  assert.equal(JSON.parse(readFileSync(out.replace(/\.png$/, '.json'), 'utf8')).provider, 'gemini');
  assert.equal(requests.at(-1).headers['x-goog-api-key'], 'g-test');
});

test('an explicit provider without its key is refused', async () => {
  const result = await run(['generate', ...BASE_ARGS, '--out', target('a.png'), '--approved', '--provider', 'gemini'], { OPENAI_API_KEY: 'sk-test' });
  assert.equal(result.code, 2);
  assert.match(result.out, /GEMINI_API_KEY/);
});

test('a moderation block explains what to change', async () => {
  const out = target('a.png');
  const result = await run(['generate', '--prompt', 'BLOCKED scene', '--alt', 'x', '--out', out, '--approved'], { OPENAI_API_KEY: 'sk-test' });
  assert.equal(result.code, 1);
  assert.match(result.out, /content moderation.*violence/);
  assert.equal(existsSync(out), false);
});
