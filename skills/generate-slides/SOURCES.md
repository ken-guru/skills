# Source Fetching

During generation, all `[Kilde](url)` links in `AGENDA.md` are fetched and summarized.

## Fetch procedure

For each source URL:
1. Fetch the URL content
2. Extract key facts, statistics, quotes, and context relevant to the slide topic
3. Write a concise markdown summary to `docs/sources/<slug>.md`

The slug is derived from the URL: lowercase, non-alphanumeric characters replaced with hyphens, truncated to 60 characters.

## Summary file format

```markdown
# Source: [Page Title]

**URL:** [original url]  
**Fetched:** [date]

## Key facts
- ...

## Relevant quotes
> "..."

## Context for slides
...
```

## Error handling

If a fetch fails (timeout, 404, etc.):
- Log the failure: `❌ Kilde feilet: [url] — [reason]`
- Skip the file; do not halt generation
- Include the failed URL in the final report

## Skip rules

- Any URL marked `(IKKE BESØK)` in `AGENDA.md` must **never** be fetched
- Internal doc references (no `http`) are skipped silently
