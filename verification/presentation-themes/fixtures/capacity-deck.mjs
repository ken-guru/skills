import { renderPresentationMarkdown } from '../../../skills/generate-slides/scripts/semantic-markup.mjs';

export function capacityDeck(themeId, manifest) {
  const slides = [
    { role: 'opener', title: ['Ideas take', 'shape', 'together'], label: 'Collaborative intelligence', subtitle: ['Human judgment gives direction.', 'AI gives momentum.'], visual: { type: 'picture', filename: 'media/portrait.svg', alt: 'A protected portrait fixture representing a collaborator shaping an idea' }, capacity: { titleLines: 3, subtitleLines: 2 } },
    { role: 'section-boundary', title: ['From fragments', 'to one shared', 'story'], context: '02', orientation: ['A visible sequence turns useful mess', 'into a direction people can improve together.'], capacity: { titleLines: 3, orientationLines: 2 } },
    { heading: ['Clarity is a sequence,', 'not a spark'], label: 'Five moves', body: [['Collect the useful mess', 'before narrowing.'], ['Name the audience decision', 'that matters.'], ['Arrange evidence around', 'one narrative spine.'], ['Test whether every slide', 'earns its place.'], ['Refine language until', 'the direction is obvious.']], capacity: { headingLines: 2, bullets: 5, bulletLines: 2 } },
    { heading: ['Make the reasoning', 'visible'], body: [['Externalize incomplete', 'ideas early.'], ['Keep the central subject', 'clearly protected.'], ['Use feedback to sharpen', 'the shared model.'], ['Preserve intent while', 'changing presentation.']], caption: ['Portrait media selects the portrait composition', 'without changing the slide’s semantic role.'], visual: { type: 'picture', filename: 'media/portrait.svg', alt: 'A central collaborator protected within a portrait frame', intendedOrientation: 'portrait', actualOrientation: 'portrait' }, capacity: { headingLines: 2, bullets: 4, bulletLines: 2, captionLines: 2 } },
    { heading: ['One table, several', 'useful perspectives'], body: [['Explore broadly enough', 'to discover alternatives.'], ['Align visibly enough', 'to inspect trade-offs.'], ['Express precisely enough', 'to support action.'], ['Keep essential wording', 'outside the image.']], caption: ['Landscape media selects the wide composition', 'while preserving every protected focal marker.'], visual: { type: 'picture', filename: 'media/landscape.svg', alt: 'Three collaborators arranged around one shared work surface', intendedOrientation: 'landscape', actualOrientation: 'landscape' }, capacity: { headingLines: 2, bullets: 4, bulletLines: 2, captionLines: 2 } },
    { quantitative: true, heading: ['Three modes create', 'one shared direction'], takeaway: ['The proportions differ, but every mode contributes', 'to a decision people can explain.'], metricsAlt: 'Explore 40 percent, align 25 percent, express 25 percent, and reflect 10 percent', metrics: [{ value: '40%', label: 'Explore widely' }, { value: '25%', label: 'Align visibly' }, { value: '25%', label: 'Express clearly' }, { value: '10%', label: 'Reflect together' }], capacity: { headingLines: 2, metrics: 4, takeawayLines: 2 } },
    { heading: ['The process loops', 'while direction holds'], takeaway: ['Explore flows to Align and Express;', 'feedback then returns to Explore.'], caption: ['Theme decoration stays outside the protected diagram panel,', 'labels, and connectors.'], visual: { type: 'diagram', filename: 'media/diagram.svg', alt: 'Explore flows to Align, Align flows to Express, and feedback returns from Express to Explore' }, capacity: { headingLines: 2, diagrams: 1, captionLines: 2 } },
    { role: 'quotation', context: 'Design principle', quote: ['The theme should', 'carry the mood—', 'never obscure', 'the meaning.'], attribution: ['Presentation Theme contract', 'Collaborative design system'], capacity: { quoteLines: 4, attributionLines: 2, contextLines: 1 } },
  ];
  for (const slide of slides) {
    if (slide.visual?.type === 'picture') {
      slide.visual.themeTreatment = manifest.media.pictureTreatment;
    } else if (slide.visual?.type === 'diagram') {
      slide.visual.themeTreatment = manifest.media.diagramTreatment;
    }
  }
  return renderPresentationMarkdown({
    frontMatter: { marp: true, theme: themeId, size: '16:9', paginate: true, lang: 'en' },
    slides,
    manifest,
  });
}
