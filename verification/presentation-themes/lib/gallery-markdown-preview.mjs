import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import MarkdownIt from 'markdown-it';

export async function inspectGalleryMarkdownPreviews({ context, repositoryDirectory }) {
  const issues = [];
  const markdown = new MarkdownIt({ html: false, linkify: true });
  for (const [name, filename, baseDirectory] of [
    ['README', 'README.md', repositoryDirectory],
    ['Gallery', 'docs/presentation-themes.md', path.join(repositoryDirectory, 'docs')],
  ]) {
    const sourcePath = path.join(repositoryDirectory, filename);
    if (!existsSync(sourcePath)) continue;
    const html = markdown.render(await readFile(sourcePath, 'utf8'));
    for (const width of [320, 768, 1280]) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(`<base href="${pathToFileURL(`${baseDirectory}${path.sep}`).href}"><style>*{box-sizing:border-box}body{margin:16px;max-width:920px;font:16px/1.5 system-ui}img{display:block;max-width:100%;height:auto}pre{max-width:100%;overflow:auto}</style>${html}`);
      const overflow = await page.evaluate(() => ({
        body: document.body.scrollWidth - document.body.clientWidth,
        root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        images: [...document.images].filter((image) => image.getBoundingClientRect().right > innerWidth + 1).length,
      }));
      if (overflow.body > 1 || overflow.root > 1 || overflow.images) issues.push(`${name} has horizontal overflow at ${width}px.`);
      await page.close();
    }
  }
  return issues;
}
