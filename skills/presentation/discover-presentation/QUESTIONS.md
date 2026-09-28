# Discovery Questions

Ask in three rounds. Each round is one message listing that round's open
questions together as plain text; wait for the reply before the next round. A
harness's structured question tool may carry a round when it fits, but the
plain-text message always works. Extract structured data from free-form answers.

Skip any question the user has already answered or that you can infer (see
Extraction rules); drop a round whose questions are all answered. Later rounds
build on earlier answers, so keep the rounds in order.

## Round 1: Topic and audience

1. **Topic** — What is the presentation about?
2. **Audience** — Who will attend?

Record anything else the user volunteers in this reply, and skip those
questions in later rounds.

## Round 2: Persona depth and takeaways

Persona depth drives tone, depth, and takeaway prioritisation. Aim to capture at
least 3 of these 4 dimensions:

3. **Experience level** — Where are the audience members in their career? (entry-level / mid / senior / lead/architect)
4. **Goal** — Will they *implement* the solution afterwards, or is the goal to *understand* the concepts?
5. **Skepticism** — What is their greatest fear or reservation about this topic?
6. **Concrete problem** — What specific problem does this presentation solve for them?

In the same message, ask explicitly:
> "What are the 3 most important things the audience should walk away with?"

Store these as `audience.experience_level`, `audience.goal`, `audience.top_concerns`, and `audience.top_takeaways` in `DISCOVERY.json`.

If the reply leaves fewer than 3 persona dimensions known, ask only for the
missing ones before Round 3.

## Round 3: Logistics, preferences, and theme

Ask the open questions from 7–11, then close the message with the theme choice
(12).

7. **Duration** — How long is the presentation? (default: 45 minutes)
8. **Occasion** — What type of event? (e.g., intern fagdag, konferanse, workshop, all-hands)
9. **Language** — What language should the slides be in? (default: inferred from your input language)
10. **Visual preference** — Should the slides default to having pictures, diagrams, or no media? (default: Picture)
11. **Editorial preferences** — Ask: "Are there any writing styles you want me to
avoid or consistently use in the presentation?" Capture concrete preferences,
such as avoiding em dashes or bold lead-ins with colons, or preferring short
declarative sentences. This is optional; do not invent preferences when the
user has none.
12. **Presentation Theme** — Last in the message, present these choices in order using descriptions translated into the presentation language:
   - **Editorial** (`editorial`, recommended) — “Warm, typographic, and composed like a modern magazine.”
   - **Signal** (`signal`) — “Bold, high-contrast, and structured for energy, systems, and data.”
   - **Compact Signal** (`compact-signal`) — “Compact, clear, and high-contrast for information-dense stories with supportive or full-bleed imagery.”
   - **Field Notes** (`field-notes`) — “Tactile, natural, and shaped like a documented working session.”

Include the side-by-side visual comparison link with the theme choice: [Compare the themes](../docs/presentation-themes.md#compare-the-themes).

Theme selection is required for new projects. Do not infer it from topic, audience, or occasion. Do not proactively ask about fonts. If the user explicitly volunteers a particular font family, capture it as an External Font Override with the exact family and an optional source URL that the user approves.

## Extraction rules

- If the user says "30 min talk at a conference", extract duration = "30 minutes" and occasion = "conference"
- If the user gives a topic that implies an audience (e.g., "intro to Kubernetes for the dev team"), infer audience = "developers"
- If the user mentions a language or writes in a specific language, use that
- Fill remaining gaps with defaults from [DEFAULTS.md](DEFAULTS.md)
- Keep theme names and identifiers untranslated. Translate only their descriptions and surrounding prompt.
