export async function inspectGallerySlides(page, selectedSlideNumbers) {
  return page.evaluate((selected) => {
    const issues = [];
    const rgba = (value) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
    };
    const composite = (front, back) => ({
      r: front.r * front.a + back.r * (1 - front.a),
      g: front.g * front.a + back.g * (1 - front.a),
      b: front.b * front.a + back.b * (1 - front.a),
    });
    const luminance = (color) => {
      const channel = (value) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    };
    const contrast = (first, second) => {
      const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const overlap = (left, right) =>
      Math.min(left.right, right.right) - Math.max(left.left, right.left) > 2 &&
      Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 2;
    const pointInPolygon = (point, polygon) => {
      let inside = false;
      for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
        const [currentX, currentY] = polygon[current];
        const [previousX, previousY] = polygon[previous];
        const crosses = currentY > point.y !== previousY > point.y &&
          point.x < ((previousX - currentX) * (point.y - currentY)) / (previousY - currentY) + currentX;
        if (crosses) inside = !inside;
      }
      return inside;
    };

    const sections = [...document.querySelectorAll('section[data-theme]')];
    for (const slideNumber of selected) {
      const section = sections[slideNumber - 1];
      if (!section) { issues.push(`missing selected slide ${slideNumber}`); continue; }
      const sectionRect = section.getBoundingClientRect();
      const scale = sectionRect.width / 1280 || 1;
      const slots = [...section.querySelectorAll(':scope > [class*="slot-"]')];
      if (!section.querySelector('h1, h2')) issues.push(`slide ${slideNumber} has no semantic heading`);

      for (const image of section.querySelectorAll('img')) {
        if (!image.hasAttribute('alt') || !image.getAttribute('alt')?.trim()) issues.push(`slide ${slideNumber} has empty image alt`);
        const portrait = section.classList.contains('variation-portrait');
        const landscape = section.classList.contains('variation-landscape');
        if (portrait && image.naturalWidth >= image.naturalHeight) issues.push(`slide ${slideNumber} received non-portrait media in a portrait variation`);
        if (landscape && image.naturalWidth <= image.naturalHeight) issues.push(`slide ${slideNumber} received non-landscape media in a landscape variation`);
        if (!(image.getAttribute('src') ?? '').endsWith('.svg')) {
          const rect = image.getBoundingClientRect();
          if (rect.width > image.naturalWidth + 1 || rect.height > image.naturalHeight + 1) issues.push(`slide ${slideNumber} enlarges raster media beyond native dimensions`);
        }
        if ((image.getAttribute('src') ?? '').endsWith('collaboration-portrait.png')) {
          const imageRect = image.getBoundingClientRect();
          const imageStyle = getComputedStyle(image);
          const drawScale = imageStyle.objectFit === 'contain'
            ? Math.min(imageRect.width / image.naturalWidth, imageRect.height / image.naturalHeight)
            : Math.max(imageRect.width / image.naturalWidth, imageRect.height / image.naturalHeight);
          const drawnWidth = image.naturalWidth * drawScale;
          const drawnHeight = image.naturalHeight * drawScale;
          const drawnLeft = imageRect.left + (imageRect.width - drawnWidth) / 2;
          const drawnTop = imageRect.top + (imageRect.height - drawnHeight) / 2;
          const media = image.closest('.slot-media');
          const mediaRect = media?.getBoundingClientRect();
          const clip = media ? getComputedStyle(media).clipPath : 'none';
          let clipPolygon = null;
          if (mediaRect && clip.startsWith('polygon(')) {
            const coordinate = (token, size) => token.endsWith('%')
              ? (Number.parseFloat(token) / 100) * size
              : Number.parseFloat(token);
            clipPolygon = clip.slice(8, -1).split(',').map((pair) => {
              const [x, y] = pair.trim().split(/\s+/);
              return [coordinate(x, mediaRect.width), coordinate(y, mediaRect.height)];
            });
          }
          for (const [x, y] of [[0.15, 0.5], [0.85, 0.5], [0.5, 0.15], [0.5, 0.85]]) {
            const point = { x: drawnLeft + x * drawnWidth, y: drawnTop + y * drawnHeight };
            const outsideImage = point.x < imageRect.left - 1 || point.x > imageRect.right + 1 || point.y < imageRect.top - 1 || point.y > imageRect.bottom + 1;
            const outsideClip = clipPolygon && !pointInPolygon(
              { x: point.x - mediaRect.left, y: point.y - mediaRect.top },
              clipPolygon,
            );
            if (outsideImage || outsideClip) {
              issues.push(`slide ${slideNumber} crop removes part of the protected central focal region`);
              break;
            }
          }
        }
      }

      for (const metric of section.querySelectorAll('.metric')) {
        const style = getComputedStyle(metric);
        const background = composite(rgba(style.backgroundColor), rgba(getComputedStyle(section).backgroundColor));
        if (Number.parseFloat(style.borderTopWidth) >= 3 && contrast(rgba(style.borderTopColor), background) < 3) issues.push(`slide ${slideNumber} has a meaningful metric boundary below 3:1 contrast`);
      }

      const orderedSelectors = [
        'h1, h2',
        '.slot-body, .slot-subtitle, .slot-orientation, .slot-takeaway',
        '.slot-media, [role="img"]',
        '.slot-caption',
      ];
      let previousIndex = -1;
      const descendants = [...section.querySelectorAll('*')];
      for (const selector of orderedSelectors) {
        const element = section.querySelector(selector);
        if (!element) continue;
        const position = descendants.indexOf(element);
        if (position < previousIndex) { issues.push(`slide ${slideNumber} violates semantic DOM reading order`); break; }
        previousIndex = position;
      }

      for (const slot of slots) {
        const rect = slot.getBoundingClientRect();
        const style = getComputedStyle(slot);
        if (style.display === 'none') continue;
        const contentRect = {
          left: rect.left + Number.parseFloat(style.paddingLeft),
          top: rect.top + Number.parseFloat(style.paddingTop),
          right: rect.right - Number.parseFloat(style.paddingRight),
          bottom: rect.bottom - Number.parseFloat(style.paddingBottom),
        };
        const permitsBleed = slot.classList.contains('slot-media') ||
          ((slot.classList.contains('slot-context') || slot.classList.contains('slot-attribution')) &&
            Math.max(...['Top', 'Right', 'Bottom', 'Left'].map((side) => Number.parseFloat(style[`padding${side}`]))) >= 32);
        if (!permitsBleed && (contentRect.left < sectionRect.left + 32 * scale - 1 || contentRect.top < sectionRect.top + 32 * scale - 1 || contentRect.right > sectionRect.right - 32 * scale + 1 || contentRect.bottom > sectionRect.bottom - 32 * scale + 1)) issues.push(`slide ${slideNumber} enters the essential-content safe margin`);
        if (!slot.classList.contains('slot-media')) {
          const range = document.createRange();
          range.selectNodeContents(slot);
          const textRect = range.getBoundingClientRect();
          if (textRect.width > 0 && (textRect.left < sectionRect.left - 1 || textRect.top < sectionRect.top - 1 || textRect.right > sectionRect.right + 1 || textRect.bottom > sectionRect.bottom + 1)) issues.push(`slide ${slideNumber} has clipped text content`);
          const clipsX = ['auto', 'hidden', 'scroll'].includes(style.overflowX);
          const clipsY = ['auto', 'hidden', 'scroll'].includes(style.overflowY);
          if ((clipsX && slot.scrollWidth > slot.clientWidth + 1) || (clipsY && slot.scrollHeight > slot.clientHeight + 1)) issues.push(`slide ${slideNumber} clips or scrolls content`);
        }
      }
      for (let first = 0; first < slots.length; first += 1) {
        for (let second = first + 1; second < slots.length; second += 1) {
          if (section.classList.contains('variation-landscape') || section.classList.contains('variation-full-image')) continue;
          if (overlap(slots[first].getBoundingClientRect(), slots[second].getBoundingClientRect())) issues.push(`slide ${slideNumber} has a Content Slot collision`);
        }
      }

      const minimums = [
        ['.slot-title', 54], ['.slot-heading', 36], ['.slot-body', 28], ['.slot-body li', 28],
        ['.metric span', 28], ['.slot-subtitle', 28], ['.slot-orientation', 28], ['.slot-takeaway', 28],
        ['.slot-caption', 20], ['.slot-attribution', 20], ['.slot-label', 18], ['.slot-context', 18],
      ];
      for (const [selector, minimum] of minimums) {
        for (const element of section.querySelectorAll(selector)) {
          const size = Number.parseFloat(getComputedStyle(element).fontSize);
          if (size < minimum) issues.push(`slide ${slideNumber} ${selector} is ${size}px; minimum is ${minimum}px`);
        }
      }
      for (const element of section.querySelectorAll('.slot-body, .slot-subtitle, .slot-orientation, .slot-takeaway')) {
        const style = getComputedStyle(element);
        const ratio = Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
        if (ratio < 1.25 || ratio > 1.5) issues.push(`slide ${slideNumber} body line-height ratio ${ratio.toFixed(2)} is outside 1.25–1.5`);
      }
      for (const heading of section.querySelectorAll('h1:not(.sr-only), h2:not(.sr-only)')) {
        const style = getComputedStyle(heading);
        const ratio = Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
        if (ratio < 1) issues.push(`slide ${slideNumber} heading line-height ratio ${ratio.toFixed(2)} is below 1.0`);
      }
    }
    return issues;
  }, selectedSlideNumbers);
}

export async function inspectGalleryFontFallbacks({ page, manifest, selectedSlideNumbers }) {
  const fallbackFonts = Object.fromEntries(['display', 'body', 'label'].map((role) => [role, manifest.fonts[role].at(-1).toLowerCase()]));
  await page.addStyleTag({ content: `
    section, section .slot-body, section .slot-subtitle, section .slot-orientation, section .slot-caption, section .slot-attribution, section .slot-takeaway { font-family: ${fallbackFonts.body} !important; }
    section h1, section h2, section blockquote, section .metric strong { font-family: ${fallbackFonts.display} !important; }
    section .slot-label, section .slot-context, section .metric span { font-family: ${fallbackFonts.label} !important; }
  ` });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(({ expectedFallbacks, selected }) => {
    const issues = [];
    const sections = [...document.querySelectorAll('section[data-theme]')];
    for (const slideNumber of selected) {
      const section = sections[slideNumber - 1];
      const representatives = {
        body: section,
        display: section.querySelector('h1, h2, blockquote'),
        label: section.querySelector('.slot-label, .slot-context, .metric span'),
      };
      for (const [role, element] of Object.entries(representatives)) {
        if (element && !getComputedStyle(element).fontFamily.toLowerCase().includes(expectedFallbacks[role])) issues.push(`slide ${slideNumber} final ${role} generic fallback was not applied`);
      }
      const sectionRect = section.getBoundingClientRect();
      const slots = [...section.querySelectorAll(':scope > [class*="slot-"]')];
      for (const slot of slots.filter((element) => !element.classList.contains('slot-media'))) {
        const range = document.createRange(); range.selectNodeContents(slot); const rect = range.getBoundingClientRect();
        if (rect.width > 0 && (rect.left < sectionRect.left - 1 || rect.top < sectionRect.top - 1 || rect.right > sectionRect.right + 1 || rect.bottom > sectionRect.bottom + 1)) issues.push(`slide ${slideNumber} generic fallback moves text outside the slide`);
        const style = getComputedStyle(slot);
        const clipsX = ['auto', 'hidden', 'scroll'].includes(style.overflowX);
        const clipsY = ['auto', 'hidden', 'scroll'].includes(style.overflowY);
        if ((clipsX && slot.scrollWidth > slot.clientWidth + 1) || (clipsY && slot.scrollHeight > slot.clientHeight + 1)) issues.push(`slide ${slideNumber} generic fallback clips or scrolls content`);
      }
      const overlap = (left, right) =>
        Math.min(left.right, right.right) - Math.max(left.left, right.left) > 2 &&
        Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 2;
      for (let first = 0; first < slots.length; first += 1) {
        for (let second = first + 1; second < slots.length; second += 1) {
          if (section.classList.contains('variation-landscape') || section.classList.contains('variation-full-image')) continue;
          if (overlap(slots[first].getBoundingClientRect(), slots[second].getBoundingClientRect())) issues.push(`slide ${slideNumber} generic fallback causes a Content Slot collision`);
        }
      }
    }
    return issues;
  }, { expectedFallbacks: fallbackFonts, selected: selectedSlideNumbers });
}
