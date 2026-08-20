const CLASSIFICATION = [
  ['title', (slide) => slide.role === 'opener'],
  ['section', (slide) => slide.role === 'section-boundary'],
  ['diagram', (slide) => slide.visual?.type === 'diagram'],
  ['data', (slide) => slide.visual?.type === 'chart' || slide.quantitative === true],
  ['text-plus-image', (slide) => slide.visual?.type === 'picture'],
  ['quotation', (slide) => slide.role === 'quotation'],
];

export function classifySlide(slide) {
  return CLASSIFICATION.find(([, matches]) => matches(slide))?.[0] ?? 'text-only';
}

const lineCount = (value) =>
  Array.isArray(value) ? value.length : value == null ? 0 : String(value).split('\n').length;
const maximumLines = (items = []) =>
  items.length === 0 ? 0 : Math.max(...items.map(lineCount));

function measuredCapacity(slide, archetype) {
  switch (archetype) {
    case 'title':
      return { titleLines: lineCount(slide.title), subtitleLines: lineCount(slide.subtitle) };
    case 'section':
      return { titleLines: lineCount(slide.title), orientationLines: lineCount(slide.orientation) };
    case 'text-only':
      return {
        headingLines: lineCount(slide.heading),
        bullets: slide.body?.length ?? 0,
        bulletLines: maximumLines(slide.body),
      };
    case 'text-plus-image':
      return {
        headingLines: lineCount(slide.heading),
        bullets: slide.body?.length ?? 0,
        bulletLines: maximumLines(slide.body),
        captionLines: lineCount(slide.caption),
      };
    case 'data':
      return {
        headingLines: lineCount(slide.heading),
        charts: slide.metrics ? 0 : 1,
        metrics: slide.metrics?.length ?? 0,
        takeawayLines: lineCount(slide.takeaway),
      };
    case 'diagram':
      return {
        headingLines: lineCount(slide.heading),
        diagrams: 1,
        captionLines: Math.max(lineCount(slide.caption), lineCount(slide.takeaway)),
      };
    case 'quotation':
      return {
        quoteLines: lineCount(slide.quote),
        attributionLines: lineCount(slide.attribution),
        contextLines: lineCount(slide.context),
      };
    default:
      return {};
  }
}

function selectedVariation(definition, slide, archetype) {
  if (archetype !== 'text-plus-image') return definition.variations[0];
  const intended = slide.visual.intendedOrientation?.toLowerCase();
  const actual = slide.visual.actualOrientation?.toLowerCase();
  if (!['portrait', 'landscape', 'full-image'].includes(intended)) {
    throw new Error('Picture slides require portrait, landscape, or full-image Intended Media Orientation.');
  }
  if (actual && actual !== intended) {
    const error = new Error(
      `Picture media is ${actual} but Intended Media Orientation is ${intended}.`,
    );
    error.code = 'ORIENTATION_MISMATCH';
    throw error;
  }
  return definition.variations.find((variation) => variation.id === intended);
}

export function planSlide({ slide, manifest }) {
  const archetype = classifySlide(slide);
  const definition = manifest.archetypes[archetype];
  const variation = selectedVariation(definition, slide, archetype);
  if (!variation) throw new Error(`No applicable variation for ${archetype}.`);

  const capacity = measuredCapacity(slide, archetype);
  const exceeded = Object.entries(capacity).filter(
    ([measure, value]) =>
      definition.capacity[measure] !== undefined && value > definition.capacity[measure],
  );
  const expectedThemeTreatment =
    slide.visual?.type === 'diagram'
      ? manifest.media.diagramTreatment
      : slide.visual?.type === 'picture'
        ? manifest.media.pictureTreatment
        : null;
  if (
    expectedThemeTreatment &&
    slide.visual.themeTreatment !== expectedThemeTreatment
  ) {
    const error = new Error('Slide media handoff does not match the locked Theme Treatment.');
    error.code = 'THEME_TREATMENT_MISMATCH';
    throw error;
  }
  return {
    archetype,
    variation: variation.id,
    tone: definition.tone,
    directive: `<!-- _class: ${definition.class} ${variation.class} ${definition.tone} -->`,
    action: exceeded.length === 0 ? 'compose' : 'split',
    exceeded: exceeded.map(([measure]) => measure),
    themeTreatment: expectedThemeTreatment,
  };
}
