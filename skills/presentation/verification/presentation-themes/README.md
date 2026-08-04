# Presentation theme verification

This isolated suite verifies the three bundled Presentation Theme packages without adding runtime dependencies to the skills themselves.

## Fast tier

```sh
npm install
npm run test:fast
```

The fast tier checks catalog resolution, package integrity, legacy and invalid state, locked snapshots, version behavior, project wiring, and external-font fallback behavior.

## Full render tier

The full tier needs a Chromium-family browser and Ghostscript. It generates the identical eight-slide capacity deck for Editorial, Signal, and Field Notes, exports HTML and PDF, and checks accessibility, geometry, type size, safe margins, collisions, export parity, and approved visual baselines.

```sh
npm run test:full
```

Set `PRESENTATION_THEME_MARP` to a Marp CLI executable when the local CLI cannot launch the installed browser. Set `PRESENTATION_THEME_BROWSER` to a Chromium-family browser executable when Edge or Chrome is not in its standard macOS location.

Generated decks, screenshots, contact sheets, and reports are ignored. Baselines are never changed by tests. After deliberate CSS or composition changes, inspect all three HTML and PDF contact sheets, then explicitly replace the reviewed baselines:

```sh
npm run approve-baselines -- --approve
```
