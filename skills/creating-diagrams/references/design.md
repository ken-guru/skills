# Diagram design

## One message

Every diagram answers one question. Write it as the first-line comment before any D2. If a shape or connection does not serve that message, remove it or make it `muted`.

## Labels

- Use the words the audience uses, not internal names.
- Two to four words per shape; one to three per connection.
- Label connections only when the verb matters (`enqueue`, `retry`), not when the arrow already says it.

## Emphasis

- Give `emphasis` to the one or two shapes the message is about. Everything else is `base` or `muted`.
- Use `risk` and `risk-flow` only for failure, danger, or cost, so they keep their meaning.

## Colour is never the only signal

Roles differ by more than colour: `emphasis` is a filled dark shape with a heavier stroke, `boundary` and `optional-flow` are dashed, and `risk-flow` is heavier. A label must still carry the meaning ("no, 3rd try"), so the diagram reads correctly in greyscale or for a colour-blind viewer (WCAG 1.4.1).

## Contrast

The roles come from the theme values, which must meet the Accessibility Bar: 4.5:1 for text and 3:1 for lines, borders, and shapes against the background (WCAG 1.4.3 and 1.4.11). Never override them with colour literals; `check` rejects them.

## Size

Text must reach 20 px at the diagram's final size on a 1280×720 reference. `check` measures this against the slot; see [layouts.md](layouts.md) when it fails.
