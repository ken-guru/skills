---
name: unslop
description: "Load when the user asks to edit prose for a more natural voice while preserving meaning, tone, technical precision, and structured output."
---

# Unslop

Edit explanatory prose or presentation copy so it reads clearly and naturally.
Preserve the author's meaning, requested tone, technical precision, and any
content contract.

## Process

1. Identify the output boundary. Separate conversational prose, Presentation
   content, quotations, citations, accessibility text, and protected structured
   content.
2. Load any user- or project-supplied editorial preferences before editing.
3. Scan the editable prose for the universal clarity rules below.
4. Rewrite only what needs rewriting. Keep the intended tone and audience.
5. Apply explicit preferences as requirements, not suggestions. If no preference
   is supplied, choose the clearest form for the medium without inventing a
   house style.
6. Run the protection checks and the final human-voice audit.

## Universal clarity rules

- Replace puffery with the concrete fact or effect.
- Remove filler, stock chatbot phrases, sycophantic openings, and generic
  conclusions.
- Replace vague attribution with a named source or remove the claim.
- Prefer a plain word when it is equally precise.
- Prefer active voice when the actor is known.
- Shorten or split dense sentences that make the reader backtrack.
- Vary rhythm naturally. Do not add forced informality, fake personality, or
  unnecessary first person.
- Replace metaphorical, promotional, or fashionable jargon when a concrete word
  works better.
- Preserve established technical terms when they name a real concept the reader
  needs.
- Ask of every sentence: does it give the reader a fact, instruction, example,
  decision, or useful qualification? If not, cut or rewrite it.

## Contextual style preferences

Treat these as configurable choices. A user's explicit preference overrides
these defaults for editable prose:

- em dashes, colons, parentheses, and other punctuation
- sentence case or title case headings
- boldface, lists, and rule-of-three structures
- first person, opinions, and conversational reactions
- short fragments, when the format or tone calls for them

Interpret `avoid` preferences as a scan requirement: remove the pattern when
it is not protected content, including equivalent constructions that preserve
the same stylistic effect. Interpret `prefer` preferences as a positive target
and use them consistently where the format permits. Do not let a preference
break meaning, accessibility, technical precision, or the output contract.

For presentation projects, preference examples include:

- `avoid`: "bold lead-in followed by a colon", "em dashes", "generic bullet lists"
- `prefer`: "short declarative sentences", "unnumbered statements", "plain headings"
- `tone`: "warm and direct", "formal and restrained", or another user-supplied description

## Protected content

Do not rewrite these merely for style:

- code, commands, schemas, JSON, YAML, and machine-readable reports
- canonical terms from the project's glossary
- quotations and citations
- accessibility text, unless the change makes it clearer or more specific
- wording the user supplied for formatting or transport
- deliberately chosen formal, playful, terse, literary, or otherwise specific
  tone

If editable prose surrounds protected content, improve the surrounding prose
without changing the protected content's contract.

## Presentation content

Presentation content follows the same clarity rules but has tighter constraints.
Keep slide copy concise, preserve narrative hierarchy and Content Capacity, and
do not trade away accessibility or semantic meaning for a more conversational
sound. Apply the project's explicit editorial preferences to slide copy and
presenter notes. A good slide sentence is specific enough to carry the message
without needing the presenter to decode it.

## Final audit

Before returning the result, ask:

- What makes this sound machine-produced?
- Did I remove the tell without removing a useful qualification?
- Did I preserve meaning, tone, technical terms, accessibility, and structure?
- Could a reader act on or learn something concrete from each remaining claim?

Do not promise that the result is undetectably human. Report the edits briefly
when the user asked for a review, and do not add a chatbot-style closing.
