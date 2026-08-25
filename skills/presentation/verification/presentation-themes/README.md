# Presentation theme verification

This isolated suite verifies the four bundled Presentation Theme packages without adding runtime dependencies to the skills themselves.

## Fast tier

```sh
npm install
npm run test:fast
```

The fast tier checks catalog resolution, package integrity, legacy and invalid state, locked snapshots, version behavior, project wiring, external-font fallback behavior, and that `docs/presentation-themes.md`/`README.md` structurally reference the right gallery images with informative alt text. This is the only tier CI runs (`Presentation theme contracts`) — it is pure Node, needs no browser, and doesn't depend on how anything actually renders.

## Full render tier — local only, not CI-gated

```sh
npm run test:full
```

The full tier needs a Chromium-family browser and Ghostscript. It generates the identical eight-slide capacity deck for Editorial, Signal, Compact Signal, and Field Notes, exports HTML and PDF, checks accessibility/geometry/type-size/safe-margins/collisions/PDF page count/exported text parity, and renders the 32-image public gallery. Set `PRESENTATION_THEME_MARP` to a Marp CLI executable when the local CLI cannot launch the installed browser, and `PRESENTATION_THEME_BROWSER` to a Chromium-family browser executable when Edge or Chrome is not in its standard macOS location.

This tier is **not** run in CI: browser and font rendering differ enough machine to machine that pixel- and layout-level checks produced persistent false positives. Whether a theme actually looks right is a judgment call for a human, not a pass/fail gate. Instead:

- Run `npm run test:full` locally while changing a theme, and look at the generated `reports/` contact sheets and gallery screenshots yourself.
- When a PR touches theme or gallery files, a bot comments a link to the rendered `docs/presentation-themes.md` on that PR's branch — open it and eyeball the comparison tables before approving.
- After you're happy with new gallery images, run `npm run approve-gallery -- --approve` to copy them into `docs/assets/presentation-themes/` and refresh `manifest.json`'s provenance record. This is bookkeeping for future readers, not something CI enforces — nothing blocks a PR if you skip it, but keeping it current makes the next `git blame` on a gallery image meaningful.

Generated decks, screenshots, contact sheets, and reports are ignored and must not be committed; only the approved images under `../../docs/assets/presentation-themes/` are.
