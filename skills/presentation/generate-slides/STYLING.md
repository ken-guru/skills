# Semantic Slide Markup Reference

Every Presentation Theme consumes this shared markup. Never emit theme-specific Content Slot names.

## Shared classes

- Archetypes: `archetype-title`, `archetype-section`, `archetype-text-only`, `archetype-text-plus-image`, `archetype-data`, `archetype-diagram`, `archetype-quotation`.
- Variations: `variation-default`, `variation-portrait`, `variation-landscape`.
- Tonal states come from the Theme Manifest: `tone-light`, `tone-dark`, or `tone-accent`.
- Content Slots: `slot-title`, `slot-heading`, `slot-subtitle`, `slot-orientation`, `slot-label`, `slot-context`, `slot-body`, `slot-metrics`, `slot-media`, `slot-caption`, `slot-takeaway`, `slot-quote`, `slot-attribution`.

## Markup patterns

Use native Markdown headings when possible and semantic HTML when a named slot or figure is required. Keep informative nodes in reading order regardless of their CSS placement.

### Text-plus-image

```markdown
<!-- _class: archetype-text-plus-image variation-portrait tone-light -->

## A heading that fits two lines

<div class="slot-body">
  <ul><li>First point</li><li>Second point</li></ul>
</div>

<figure class="slot-media">
  <img src="images/example.png" alt="Purpose-based alternative text">
</figure>

<p class="slot-caption">A concise two-line caption.</p>
```

Add `class="slot-heading"` to the rendered heading when emitting raw HTML. For Markdown headings, Marp places `h2` directly and theme CSS treats the first heading as the heading slot.

### Data

```html
<h2 class="slot-heading">The primary quantitative message</h2>
<div class="slot-metrics" role="img" aria-label="Four metrics showing the key comparison">
  <div class="metric"><strong>42%</strong><span>Meaningful label</span></div>
</div>
<p class="slot-takeaway">The relationship the audience should retain.</p>
```

### Diagram

```html
<h2 class="slot-heading">The relationship to understand</h2>
<figure class="slot-media">
  <img src="images/example.svg" alt="Summary of the diagram's relationship and takeaway">
</figure>
<p class="slot-caption">Optional supporting explanation.</p>
```

### Quotation

```html
<p class="slot-context">Context label</p>
<blockquote class="slot-quote">A quotation that fits four lines.</blockquote>
<p class="slot-attribution">Name — role or source</p>
```

## Forbidden patterns

- `![bg](...)`, `![bg left](...)`, or `![bg right](...)`.
- The old universal `img-right`, `img-left`, or `layout-with-image` contract.
- Theme-specific wrappers required for semantic content.
- Essential text inside raster media.
- Decorative images with non-empty alternative text or reading-order presence.
- Inline layout styles that compete with the locked Theme Package.
