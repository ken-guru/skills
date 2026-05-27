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

## Extraction rules

- If the user says "30 min talk at a conference", extract duration = "30 minutes" and occasion = "conference"
- If the user gives a topic that implies an audience (e.g., "intro to Kubernetes for the dev team"), infer audience = "developers"
- If the user mentions a language or writes in a specific language, use that
- Fill remaining gaps with defaults from [DEFAULTS.md](DEFAULTS.md)
