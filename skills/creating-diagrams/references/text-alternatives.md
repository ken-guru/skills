# Text alternatives

A rendered diagram is an image, so people who cannot see it get only its text alternative (WCAG 1.1.1). Write two parts.

## Alt text

One or two sentences that state the diagram's message, not its appearance.

- Good: "A request passes the CDN and reaches the API only on a cache miss; the API then queues the work."
- Poor: "A diagram with four boxes and arrows."

Place it wherever the diagram is shown, for example `![A request passes the CDN …](media/request-path.svg)` in Markdown.

## Long description

When the diagram carries more than one sentence of information (a decision path, several actors, a sequence), also write a long description: the steps or relationships as a short list, in the order a person would follow them. Put it next to the diagram: in a slide deck, in the slide's speaker notes; in a document, directly below the image.

Example for a retry flow:

1. A worker runs the job.
2. If it succeeds, the job is done.
3. If it fails, it is retried with back-off.
4. After the third failure, it goes to the dead-letter queue for a person to inspect.

## What never goes in the image

Text that belongs in the surrounding document (titles, paragraphs, data tables) stays as real text, not inside the diagram (WCAG 1.4.5).
