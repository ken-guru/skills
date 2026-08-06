import { planSlide } from './slide-composition.mjs';

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const lines = (value) =>
  (Array.isArray(value) ? value : [value]).map(escapeHtml).join('<br>');
const optionalLabel = (value) =>
  typeof value === 'string' && value.trim() ? `<p class="slot-label">${escapeHtml(value)}</p>` : '';
const list = (items, tag = 'ul') =>
  `<div class="slot-body"><${tag}>\n${items.map((item) => `<li>${lines(item)}</li>`).join('\n')}\n</${tag}></div>`;
const image = (slide) => {
  if (!slide.visual?.filename || !slide.visual?.alt) {
    const error = new Error('Meaningful media requires a filename and purpose-based alternative text.');
    error.code = 'MISSING_MEDIA_ALTERNATIVE';
    throw error;
  }
  return `<figure class="slot-media"><img src="${escapeHtml(slide.visual.filename)}" alt="${escapeHtml(slide.visual.alt)}"></figure>`;
};

function slideMarkup(slide, plan) {
  const directive = plan.directive;
  switch (plan.archetype) {
    case 'title':
      return `${directive}\n\n<h1 class="slot-title">${lines(slide.title)}</h1>\n<p class="slot-label">${escapeHtml(slide.label)}</p>\n<p class="slot-subtitle">${lines(slide.subtitle)}</p>\n${image(slide)}`;
    case 'section':
      return `${directive}\n\n<h1 class="slot-title">${lines(slide.title)}</h1>\n<p class="slot-context">${escapeHtml(slide.context)}</p>\n<p class="slot-orientation">${lines(slide.orientation)}</p>`;
    case 'text-only':
      return `${directive}\n\n<h2 class="slot-heading">${lines(slide.heading)}</h2>\n${optionalLabel(slide.label)}\n${list(slide.body, 'ol')}`;
    case 'text-plus-image':
      return `${directive}\n\n<h2 class="slot-heading">${lines(slide.heading)}</h2>\n${list(slide.body)}\n${image(slide)}\n<p class="slot-caption">${lines(slide.caption)}</p>`;
    case 'data':
      if (slide.metrics && !slide.metricsAlt) {
        const error = new Error('Metric groups require a purpose-based accessible summary.');
        error.code = 'MISSING_METRICS_ALTERNATIVE';
        throw error;
      }
      return `${directive}\n\n<h2 class="slot-heading">${lines(slide.heading)}</h2>\n<p class="slot-takeaway">${lines(slide.takeaway)}</p>\n${
        slide.metrics
          ? `<div class="slot-metrics" role="img" aria-label="${escapeHtml(slide.metricsAlt)}">\n${slide.metrics.map((metric) => `<div class="metric"><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(metric.label)}</span></div>`).join('\n')}\n</div>`
          : image(slide)
      }`;
    case 'diagram':
      return `${directive}\n\n<h2 class="slot-heading">${lines(slide.heading)}</h2>\n<p class="slot-takeaway">${lines(slide.takeaway)}</p>\n${image(slide)}\n<p class="slot-caption">${lines(slide.caption)}</p>`;
    case 'quotation':
      return `${directive}\n\n<h2 class="sr-only">Quotation</h2>\n<p class="slot-context">${escapeHtml(slide.context)}</p>\n<blockquote class="slot-quote">${lines(slide.quote)}</blockquote>\n<p class="slot-attribution">${lines(slide.attribution)}</p>`;
    default:
      throw new Error(`Unsupported Slide Archetype: ${plan.archetype}.`);
  }
}

export function renderPresentationMarkdown({ frontMatter, slides, manifest }) {
  const plans = slides.map((slide) => planSlide({ slide, manifest }));
  const split = plans.findIndex((plan) => plan.action === 'split');
  if (split !== -1) {
    const error = new Error(`Slide ${split + 1} exceeds Content Capacity and must be split.`);
    error.code = 'SLIDE_SPLIT_REQUIRED';
    throw error;
  }
  const yaml = Object.entries(frontMatter)
    .map(([key, value]) =>
      typeof value === 'string' && value.includes('\n')
        ? `${key}: |\n${value.split('\n').map((line) => `  ${line}`).join('\n')}`
        : `${key}: ${value}`,
    )
    .join('\n');
  return `---\n${yaml}\n---\n\n${slides
    .map((slide, index) => {
      const markup = slideMarkup(slide, plans[index]);
      return slide.notes?.length
        ? `${markup}\n\n<!--\n${slide.notes.map((note) => `- ${escapeHtml(note)}`).join('\n')}\n-->`
        : markup;
    })
    .join('\n\n---\n\n')}\n`;
}
