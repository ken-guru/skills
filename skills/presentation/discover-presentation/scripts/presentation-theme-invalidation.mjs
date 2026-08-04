function projectPaths(discovery) {
  return {
    agenda: discovery.paths?.agenda ?? 'AGENDA.md',
    imageSpec: discovery.paths?.imageSpec ?? 'IMAGE_SPEC.md',
    diagramSpec: discovery.paths?.diagramSpec ?? 'DIAGRAM_SPEC.md',
    presentation: discovery.paths?.presentation ?? 'PRESENTASJON.md',
    html: discovery.paths?.html ?? 'PRESENTASJON.html',
    pdf: discovery.paths?.pdf ?? 'PRESENTASJON.pdf',
    images: discovery.paths?.images ?? 'images/',
    videos: discovery.paths?.videos ?? 'videos/',
    themes: discovery.paths?.themes ?? 'themes/',
  };
}

export function presentationThemeInvalidationPlan({ change, discovery }) {
  const paths = projectPaths(discovery);
  const outputs = [paths.presentation, paths.html, paths.pdf];

  if (change === 'font') {
    return {
      preserve: [
        paths.agenda,
        paths.imageSpec,
        paths.diagramSpec,
        paths.images,
        paths.videos,
        paths.themes,
      ],
      stale: outputs,
      pendingPhases: ['generation', 'proofread'],
    };
  }

  if (change === 'theme' || change === 'refresh') {
    return {
      preserve: [paths.agenda, paths.images, paths.videos],
      stale: [
        paths.imageSpec,
        paths.diagramSpec,
        ...outputs,
        '.marprc.yml',
        '.vscode/settings.json',
        paths.themes,
      ],
      pendingPhases: ['generation', 'images', 'diagrams', 'proofread'],
    };
  }

  throw new Error(`Unknown Presentation Theme change kind: ${change}.`);
}
