---
type: llm
focus: {source: file, path: request-flow/deck.md}
---
Check each claim about this Marp deck:

1. Most content slides show a diagram (an image from media/ with descriptive alt text), not only bullets.
2. Across the deck, all seven components appear: browser, CDN, load balancer, API service, job queue, background workers, Postgres.
3. At least one slide covers what happens when a worker fails (for example retries, backoff, or a dead-letter queue).
4. The deck says which architecture details are assumptions for the audience to verify, in the slides or the speaker notes.

Score 1 only if all four hold.
