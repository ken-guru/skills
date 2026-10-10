# Layouts: direction, engine, and splitting

## Fit the direction to the slot

- A wide slot (most slides): `direction: right`.
- A tall slot (a side panel): `direction: down`.
- Compare the shape the `check` command reports (`diagram 4.26:1`) with the slot's (`1164x616` is 1.89:1). A diagram much wider than its slot shrinks until its text is too small.

## Keep rows short

About four shapes per row is the most a 16:9 slot holds at 20 px text. A six-step pipeline in one row reaches only about 16 px. Raising font sizes does not help: the layout grows with them.

When `check` fails on legibility, try in this order:

1. Shorten labels, or wrap them with a Markdown label.
2. Change direction so the diagram's shape matches the slot.
3. Group related steps into a container, so a row holds fewer items.
4. Split into two diagrams, each with one message.

## Layout engines

The scripts use **ELK** with no padding (`--pad=0`): orthogonal routes and the most compact result. That is the right default.

- **TALA** suits non-hierarchical architecture pictures, but its layout can change shape completely when one node is added, and it ignores `direction`. Only use it after looking at the result, by running D2 directly.
- **Dagre** is wider and curvier; avoid it for slides.

## When to split

Split when the diagram makes two points, when `check` still fails after shortening and changing direction, or when a person needs more than a few seconds to find the message. Two clear diagrams beat one dense one.
