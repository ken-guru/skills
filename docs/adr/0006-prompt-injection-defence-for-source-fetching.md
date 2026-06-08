# ADR-0006: Prompt Injection Defence for Source Fetching

The `generate-slides` skill defends against indirect prompt injection during source fetching through instruction hardening, not URL confirmation. Fetched content is explicitly treated as untrusted data throughout the pipeline. Any source URL whose content contains directive-like language (e.g. "ignore previous instructions", "act as", `SYSTEM:`) is skipped entirely — no summary file is written — and reported to the user as a separate category in the final report (`🚨 Suspected prompt injection — sources skipped`), distinct from ordinary fetch failures.

**Why not a per-URL confirmation step:** Requiring the user to approve each URL before fetching would interrupt the generation flow and cause confirmation fatigue, making the defence easy to click through without real scrutiny. The skill is primarily single-author, meaning the author already knows the sources they added; the marginal security benefit of a confirmation step does not justify the UX cost. If collaborative authoring with untrusted source contributors becomes a supported workflow in the future, a review step can be added at the Structure phase, where sources are first introduced, rather than at generation time.

**Why skip rather than flag and continue:** Writing a summary file for a suspected-injection URL and flagging it keeps the potentially adversarial content in the pipeline — it would still be read back during slide generation (Step 4), which is the exact attack path we are closing. Treating the URL like a failed fetch (no file written, logged, reported at the end) fully removes the content from generation context while preserving the user's ability to investigate.

**Considered alternatives:**

- Per-URL confirmation before fetching — rejected; see above.
- Write the summary with a warning header — rejected; the content still enters the generation context.
- Sanitise or strip directive-like content before writing — rejected; sanitisation is fragile and hard to audit. Skipping entirely is unambiguous.
