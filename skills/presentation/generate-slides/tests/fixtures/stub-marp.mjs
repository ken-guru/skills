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
  process.stderr.write('[  ERROR ] Failed converting Markdown. (Error: Failed to launch the browser process!)\n');
  process.exit(1);
}
writeFileSync(output, args.includes('--pdf') ? '%PDF-1.7 stub' : '<!doctype html><title>stub</title>');
