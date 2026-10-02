#!/usr/bin/env node
// Stand-in for Marp CLI. Writes the `-o` target and succeeds unless told not to:
//   STUB_MARP_HTML=fail        HTML export fails
//   STUB_MARP_PDF_DEFAULT=fail PDF export without --browser-path fails
//   STUB_MARP_GOOD=a,b         PDF export with --browser-path succeeds only for
//                              a binary whose basename is listed
// Every invocation is appended to $STUB_MARP_LOG as one JSON line.
import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (process.env.STUB_MARP_LOG) appendFileSync(process.env.STUB_MARP_LOG, `${JSON.stringify(args)}\n`);

const output = args[args.indexOf('-o') + 1];
const browserPath = args.includes('--browser-path') ? args[args.indexOf('--browser-path') + 1] : null;
let ok;
if (!args.includes('--pdf')) ok = process.env.STUB_MARP_HTML !== 'fail';
else if (browserPath) ok = (process.env.STUB_MARP_GOOD ?? '').split(',').includes(path.basename(browserPath));
else ok = process.env.STUB_MARP_PDF_DEFAULT !== 'fail';

if (!ok) {
  // Real Marp 4.5 output: a wrapped [ ERROR ] message, then an uncaught crash.
  process.stderr.write([
    '[  INFO ] Converting 1 markdown...',
    '[ ERROR ] Failed converting Markdown. (No suitable browser found. Please ensure',
    '          one of the following browsers is installed: chrome)',
    '/opt/marp-cli/lib/manager-BW1Isdga.js:18',
    'const Z=/\\r?\\n/;function V(){return process.env.CHROME_PATH}',
    '                ^',
    '',
    'Error: No suitable browser found.',
    '    at gA (/opt/marp-cli/lib/manager-BW1Isdga.js:18:2201)',
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {',
    '  errorCode: 2',
    '}',
    '',
    'Node.js v24.21.0',
    '',
  ].join('\n'));
  process.exit(1);
}
writeFileSync(output, args.includes('--pdf') ? '%PDF-1.7 stub' : '<!doctype html><title>stub</title>');
