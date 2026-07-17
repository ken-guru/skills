import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PNG } from 'pngjs';

import { gallerySlides } from './gallery-contract.mjs';

export async function createGalleryReviewMatrix({ context, reportsDirectory, themeIds }) {
  const cells = [];
  const labelCells = [];
  for (const slide of gallerySlides) {
    for (const theme of themeIds) {
      const filename = `${theme}-${slide.archetype}.png`;
      cells.push(`<figure><figcaption>${theme} · ${slide.archetype}</figcaption><img src="${filename}"></figure>`);
      labelCells.push(`<figure><figcaption>${theme} · ${slide.archetype}</figcaption><div class="image-space"></div></figure>`);
    }
  }
  const common = 'body{margin:24px;background:#202124;color:#fff;font:14px system-ui;display:grid;grid-template-columns:repeat(3,384px);gap:24px}figure{margin:0;width:384px;height:240px}figcaption{height:24px;line-height:16px;text-transform:capitalize}';
  await writeFile(
    path.join(reportsDirectory, 'presentation-themes-review-matrix.html'),
    `<style>${common}img{display:block;width:384px;height:216px}</style>${cells.join('')}`,
  );
  const page = await context.newPage();
  await page.setViewportSize({ width: 1260, height: 1080 });
  await page.setContent(`<style>${common}.image-space{width:384px;height:216px}</style>${labelCells.join('')}`);
  const labelLayerPath = path.join(reportsDirectory, 'presentation-themes-review-labels.png');
  await page.screenshot({ path: labelLayerPath, fullPage: true });
  await page.close();

  const matrix = PNG.sync.read(await readFile(labelLayerPath));
  for (const [row, slide] of gallerySlides.entries()) {
    for (const [column, theme] of themeIds.entries()) {
      const slidePng = PNG.sync.read(await readFile(path.join(reportsDirectory, `${theme}-${slide.archetype}.png`)));
      const left = 24 + column * 408;
      const top = 48 + row * 264;
      for (let y = 0; y < 216; y += 1) {
        const sourceY = Math.min(slidePng.height - 1, Math.floor((y / 216) * slidePng.height));
        for (let x = 0; x < 384; x += 1) {
          const sourceX = Math.min(slidePng.width - 1, Math.floor((x / 384) * slidePng.width));
          const sourceOffset = (sourceY * slidePng.width + sourceX) * 4;
          const destinationOffset = ((top + y) * matrix.width + left + x) * 4;
          for (let channel = 0; channel < 4; channel += 1) matrix.data[destinationOffset + channel] = slidePng.data[sourceOffset + channel];
        }
      }
    }
  }
  await writeFile(path.join(reportsDirectory, 'presentation-themes-review-matrix.png'), PNG.sync.write(matrix));
}
