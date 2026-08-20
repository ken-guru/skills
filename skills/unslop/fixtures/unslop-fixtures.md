# Unslop review fixtures

These fixtures are reviewed by a human when the editorial rules change. They
are not a numeric prose-quality benchmark.

## Conversational explanation

Before:

> This pivotal change sets the stage for a more seamless and robust workflow,
> ensuring that users can effortlessly navigate the next phase.

After:

> This change moves the workflow into the next phase. Users can navigate to
> the next phase.

Review for concrete effects, plain language, and preserved meaning.

## Presentation copy

Before:

> We are not just improving the process, but also fostering a vibrant culture
> of collaboration across the organization.

After:

> The new process cuts handoff time and gives teams one place to review work.

Review for observable claims, brevity, hierarchy, and slide capacity.

## Technical explanation

Before:

> The API surface serves as a pivotal nexus that facilitates robust data
> interoperability.

After:

> The API defines how the services exchange data.

Review for concrete mechanism and preserved technical meaning. Keep canonical
terms when they name a real project concept.

## Protected structured content

Before and after:

```ts
const result = await client.fetch();
```

Review that code, commands, schemas, machine-readable output, quotations,
citations, accessibility text, and transported user wording are not changed
merely to vary style.
