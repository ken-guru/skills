function paths(discovery) {
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
  const projectPaths = paths(discovery);
  const outputs = [projectPaths.presentation, projectPaths.html, projectPaths.pdf];
  if (change === 'font') {
    return {
      preserve: [
        projectPaths.agenda,
        projectPaths.imageSpec,
        projectPaths.diagramSpec,
        projectPaths.images,
        projectPaths.videos,
        projectPaths.themes,
      ],
      stale: outputs,
      pendingPhases: ['generation', 'proofread'],
    };
  }
  if (change === 'theme' || change === 'refresh') {
    return {
      preserve: [projectPaths.agenda, projectPaths.images, projectPaths.videos],
      stale: [
        projectPaths.imageSpec,
        projectPaths.diagramSpec,
        ...outputs,
        '.marprc.yml',
        '.vscode/settings.json',
        projectPaths.themes,
      ],
      pendingPhases: ['generation', 'images', 'diagrams', 'proofread'],
    };
  }
  throw new Error(`Unknown Presentation Theme change kind: ${change}.`);
}
