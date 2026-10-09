# D2 essentials and silent pitfalls

## Contents

- Shapes and labels
- Connections
- Containers
- Sequence diagrams
- Grids
- Code blocks
- Silent pitfalls (compile, but wrong)
- Errors only rendering reveals

## Shapes and labels

```d2
api: API service {class: emphasis}
db: Postgres {shape: cylinder; class: base}
ok: "Succeeded?" {shape: diamond; class: base}
```

- The part before `:` is the **key**; after it is the **label**. Keys are short, lowercase, and stable; labels are what people read.
- Useful shapes: `rectangle` (default), `cylinder` (data store), `diamond` (decision), `oval`, `person`, `queue`, `cloud`, `document`, `hexagon`.
- A Markdown block label allows a line break when a label must wrap. Prefer shorter labels first.

  ```d2
  step: |md
    Validate
    input
  | {class: base}
  ```

## Connections

```d2
browser -> api: request {class: flow}
api <-> db: query {class: flow}
api -- cache {class: optional-flow}
```

- `->` one way, `<->` both ways, `--` no arrow.
- Several connections between the same keys are separate edges, which D2 numbers internally; never refer to them by index.

## Containers

```d2
private: Private network {
  class: boundary
  api: API {class: emphasis}
  db: Postgres {shape: cylinder; class: base}
  api -> db: query {class: flow}
}
browser -> private.api: HTTPS {class: flow}
```

- Inside a container, keys are local. Outside it, use the full path `private.api`.
- A dot in a key always means a container: `api.v2` creates a container `api` holding `v2`. Use `api_v2` instead.

## Sequence diagrams

```d2
shape: sequence_diagram
user: Person {class: base}
app: App {class: base}
user -> app: sign in {class: flow}
app -> user: signed in {class: flow}
```

- Declare every actor at the top, in the left-to-right order you want.
- Groups (`login: { user -> app }`) may only use actors already declared.

## Grids

```d2
grid-columns: 3
a: One {class: base}
b: Two {class: base}
c: Three {class: base}
```

Use grids for side-by-side comparisons, not for flows.

## Code blocks

```d2
snippet: |js
  const retries = 3;
| {class: base}
```

Code text is drawn at 16 px before scaling, so code blocks fail legibility quickly. Keep them to one or two short lines, or show the code as slide text instead.

## Silent pitfalls (compile, but wrong)

| You wrote | D2 did | Write instead |
|---|---|---|
| `fix: Fix issue #42` | Cut the label at `#` (comment) | `fix: "Fix issue #42"` |
| `step: Read; write` | Made two shapes, `Read` and `write` | `step: "Read; write"` |
| `class: bas` | Ignored the unknown class (unstyled shape) | a role from the SKILL.md table; `check` reports it |
| `API service -> Postgres` | Created two new shapes named by the labels | `api -> db` (keys) |
| `container.a -> b` at top level | Created a new top-level `b` | `container.a -> container.b` |
| `api.v2: API v2` | Created a container `api` | `api_v2: API v2` |
| `a - b` | One shape named `a - b` | `a -- b` |
| `title：Text` (full-width colon) | One shape named `title：Text` | an ASCII `:` |
| A group using an undeclared actor | Turned the group into an actor | declare actors first |

## Errors only rendering reveals

`d2 validate` passes inputs that rendering then rejects (reserved words as edge labels, style typos, unknown shapes, class lists written with commas, `near` pointing at an object under ELK). Always prove a diagram with `check`, which renders it.
