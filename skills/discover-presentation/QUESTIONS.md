# Discovery Questions

Ask these questions conversationally, one at a time. Extract structured data from free-form answers.

## Required questions

1. **Topic** — What is the presentation about?
2. **Audience** — Who will attend?

Once topic and audience are known, proceed to the defaults confirmation (see SKILL.md Step 2) rather than asking remaining questions individually.

## Optional follow-up questions (only if not inferrable)

3. **Duration** — How long is the presentation? (default: 45 minutes)
4. **Occasion** — What type of event? (e.g., intern fagdag, konferanse, workshop, all-hands)
5. **Language** — What language should the slides be in? (default: Norwegian bokmål)

## Extraction rules

- If the user says "30 min talk at a conference", extract duration = "30 minutes" and occasion = "conference"
- If the user gives a topic that implies an audience (e.g., "intro to Kubernetes for the dev team"), infer audience = "developers"
- If the user mentions a language or writes in a specific language, use that
- Fill remaining gaps with defaults from [DEFAULTS.md](DEFAULTS.md)
