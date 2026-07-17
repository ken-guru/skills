# PROTOTYPE — Presentation theme gallery

Throwaway UI answering: which concrete visual systems should become the three production Presentation Themes?

Three four-slide mini-decks are switchable via `?variant=` on one local route. Every deck uses the same content and sample images so only the visual system changes.

Run with one command from the repository root:

```bash
./verification/presentation-themes/prototype/run.sh
```

Then open <http://localhost:4173/?variant=editorial>.

Variants:

- `editorial` — warm, typographic, asymmetric
- `signal` — vivid, modular, technical
- `field-notes` — tactile, documentary, organic

Use the floating arrows or the keyboard left/right arrows to switch. The bar is only shown on localhost.
