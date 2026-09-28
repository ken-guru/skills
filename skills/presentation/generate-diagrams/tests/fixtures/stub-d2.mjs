#!/usr/bin/env node
// Stand-in for the D2 CLI. Behaviour is driven by marker words in the D2 input
// so a test controls one entry at a time:
//   stub-invalid    `d2 validate` fails
//   stub-render-fail rendering fails
//   stub-not-svg    rendering writes a non-SVG document
//   stub-no-viewbox rendering writes an SVG whose root has no viewBox
//   stub-hang       rendering writes a partial file, then waits to be killed
//   stub-font-N     text is emitted at N px (default 28)
//   stub-size-WxH   root viewBox is W×H (default 600×300)
// Every invocation is appended to $STUB_D2_LOG as one JSON line.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (process.env.STUB_D2_LOG) appendFileSync(process.env.STUB_D2_LOG, `${JSON.stringify(args)}\n`);

if (args[0] === '--version') {
  process.stdout.write('0.7.1\n');
  process.exit(0);
}

if (args[0] === 'validate') {
  const source = readFileSync(args[1], 'utf8');
  if (source.includes('stub-invalid')) {
    process.stderr.write(`err: ${args[1]}:3:1: unexpected token\n`);
    process.exit(1);
  }
  process.stdout.write(`Success! [${args[1]}] is valid D2.\n`);
  process.exit(0);
}

const [input, output] = args.filter((argument) => !argument.startsWith('--'));
const source = readFileSync(input, 'utf8');

if (source.includes('stub-render-fail')) {
  process.stderr.write('err: failed to layout diagram\n');
  process.exit(1);
}
if (source.includes('stub-hang')) {
  writeFileSync(output, '<?xml version="1.0"?><svg');
  setTimeout(() => process.exit(0), 30_000);
} else {
  const font = source.match(/stub-font-(\d+)/)?.[1] ?? '28';
  const [width, height] = (source.match(/stub-size-(\d+)x(\d+)/)?.slice(1) ?? ['600', '300']);
  const viewBox = source.includes('stub-no-viewbox') ? '' : ` viewBox="0 0 ${width} ${height}"`;
  const svg = source.includes('stub-not-svg')
    ? '<!doctype html><html><body>not a diagram</body></html>'
    : `<?xml version="1.0" encoding="utf-8"?><svg xmlns="http://www.w3.org/2000/svg" data-d2-version="0.7.1"${viewBox}><svg class="d2-svg" viewBox="-89 -89 ${width} ${height}"><text x="10" y="40" style="text-anchor:middle;font-size:${font}px">Label</text></svg></svg>`;
  writeFileSync(output, svg);
  process.stdout.write(`success: successfully compiled ${input} to ${output}\n`);
}
