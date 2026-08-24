# Discovery Questions

Ask these questions conversationally, one at a time. Extract structured data from free-form answers.

## Required questions

1. **Topic** — What is the presentation about?
2. **Audience** — Who will attend?

Once topic and audience are known, probe for **persona depth** before moving on (see below).

## Persona depth (ask after audience is identified)

Aim to capture at least 3 of these 4 dimensions. They drive tone, depth, and takeaway prioritisation:

3. **Experience level** — Where are the audience members in their career? (entry-level / mid / senior / lead/architect)
4. **Goal** — Will they *implement* the solution afterwards, or is the goal to *understand* the concepts?
5. **Skepticism** — What is their greatest fear or reservation about this topic?
6. **Concrete problem** — What specific problem does this presentation solve for them?

After persona is clear, ask explicitly:
> "What are the 3 most important things the audience should walk away with?"

Store these as `audience.experience_level`, `audience.goal`, `audience.top_concerns`, and `audience.top_takeaways` in `DISCOVERY.json`.

## Optional follow-up questions (only if not inferrable)

7. **Duration** — How long is the presentation? (default: 45 minutes)
8. **Occasion** — What type of event? (e.g., intern fagdag, konferanse, workshop, all-hands)
9. **Language** — What language should the slides be in? (default: inferred from your input language)
10. **Visual preference** — Should the slides default to having pictures, diagrams, or no media? (default: Picture)
11. **Presentation Theme** — Immediately after Visual preference, present these choices in order using descriptions translated into the presentation language:
   - **Editorial** (`editorial`, recommended) — “Warm, typographic, and composed like a modern magazine.”
   - **Signal** (`signal`) — “Bold, high-contrast, and structured for energy, systems, and data.”
   - **Field Notes** (`field-notes`) — “Tactile, natural, and shaped like a documented working session.”

Theme selection is required for new projects. Do not infer it from topic, audience, or occasion. Do not proactively ask about fonts. If the user explicitly volunteers a particular font family, capture it as an External Font Override with the exact family and an optional source URL that the user approves.

12. **Editorial preferences** — Ask: "Are there any writing styles you want me to
avoid or consistently use in the presentation?" Capture concrete preferences,
such as avoiding em dashes or bold lead-ins with colons, or preferring short
declarative sentences. This is optional; do not invent preferences when the
user has none.

## Extraction rules

- If the user says "30 min talk at a conference", extract duration = "30 minutes" and occasion = "conference"
- If the user gives a topic that implies an audience (e.g., "intro to Kubernetes for the dev team"), infer audience = "developers"
- If the user mentions a language or writes in a specific language, use that
- Fill remaining gaps with defaults from [DEFAULTS.md](DEFAULTS.md)
- Keep theme names and identifiers untranslated. Translate only their descriptions and surrounding prompt.
