// The diagram archetype declares a conservative media box on the 1280×720
// reference: the space a diagram gets under the worst-case heading and caption.
// The capacity deck's diagram slide is that worst case, so the rendered slot
// there must match the declaration: never smaller than declared, and no more
// than MEDIA_BOX_SLACK px larger (the declaration may round down, not guess).
export const MEDIA_BOX_SLACK = 8;

export function diagramMediaBoxIssues({ declared, measured }) {
  const issues = [];
  for (const dimension of ['width', 'height']) {
    const expected = declared?.[dimension];
    const actual = measured[dimension];
    if (!Number.isFinite(expected)) {
      issues.push(`diagram media box declares no ${dimension}`);
    } else if (expected > actual) {
      issues.push(`diagram media box declares ${dimension} ${expected}px but the rendered slot is ${actual}px`);
    } else if (actual - expected > MEDIA_BOX_SLACK) {
      issues.push(`diagram media box declares ${dimension} ${expected}px but the rendered slot is ${actual}px; update the declaration`);
    }
  }
  return issues;
}

// Layout size of the diagram slot's <img>, in slide px. Semantic Slide Markup
// embeds diagrams as <img>; its offset sizes ignore Marp's viewport scaling and
// decorative transforms such as Field Notes' tilted panel.
export async function measureDiagramSlot(page) {
  return page.evaluate(() => {
    const media = document.querySelector('section.archetype-diagram .slot-media img');
    return media ? { width: media.offsetWidth, height: media.offsetHeight } : null;
  });
}
