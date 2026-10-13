# Deck Source format

`deck.md` is plain Marp Markdown. Everything below renders with `rendering-slides`.

## Contents

- Front matter
- Slides and Layout Classes
- Speaker notes and citations
- Visuals
- A complete example

## Front matter

```markdown
---
marp: true
theme: deck
title: How a request reaches our database
lang: en
paginate: true
---
```

`theme: deck` uses the Deck Folder's `theme.css`. `title` and `lang` are required by the Accessibility Bar.

## Slides and Layout Classes

Slides are separated by a line with `---`. Each slide picks one Layout Class with a comment on its first line; leave it out for the default layout.

| Class | Use for | Slot for its visual |
|---|---|---|
| (default) | heading and body: a few bullets, a short paragraph, or a table | `--slot-default` |
| `title` | the opening slide: title, then a one-line subtitle | none |
| `section` | a divider between parts of the talk | none |
| `split` | text on the left, one visual on the right | `--slot-split` |
| `visual` | one large diagram, chart, or image with a caption | `--slot-visual` |
| `quote` | one quotation and its attribution | none |

```markdown
<!-- _class: split -->

## Traffic keeps growing
```

Every slide has exactly one `#` or `##` heading, even `title`, `visual`, and `quote` slides. Two slides may share a heading when one topic is split across them.

## Speaker notes and citations

Speaker notes are HTML comments. Write them as the words to say, and cite the Source Set by number:

```markdown
<!--
Requests doubled this year, from 12 to 24 million a month. [S2]
-->
```

Label opinions and personal experience in the notes ("In my experience…"); they need no citation.

## Visuals

Plan a visual with a Visual Intent where it will go:

```markdown
<!-- Visual intent: chart of requests per quarter with Q4 highlighted; the point is that growth is accelerating -->
```

Once made, place it with alt text, then a caption paragraph:

```markdown
![Requests rose from 12 to 24 million per month between Q1 and Q4](media/requests.svg)

Source: platform metrics, 2026
```

- An image that carries no information gets `<!-- decorative -->` right after it and empty alt text.
- A generated image's alt text starts with `AI-generated:`, and its caption says "AI-generated illustration".
- Never use Marp background images (`![bg](…)`) for content: they lose their alt text in the PDF.
- Text belongs in the slide, never inside an image.

## A complete example

```markdown
---
marp: true
theme: deck
title: Why boring technology wins
lang: en
paginate: true
---

<!-- _class: title -->

# Why boring technology wins

A five-minute talk for developers

<!--
Who here adopted a new tool this year? Keep your hand up if it surprised you.
-->

---

## Every new tool spends an innovation token

- Each team can afford only a few
- Spend them on your product, not on plumbing

<!--
Dan McKinley's idea: a team has about three innovation tokens to spend. [S1]
-->

---

<!-- _class: visual -->

## Where the tokens went

<!-- Visual intent: chart of incidents per tool, new tools highlighted; the point is that novelty causes most incidents -->

<!--
Most of last year's incidents came from the two newest tools. [S2]
-->
```
