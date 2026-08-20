# Presentation theme verification

This isolated suite verifies the three bundled Presentation Theme packages without adding runtime dependencies to the skills themselves.

## Fast tier

```sh
npm install
npm run test:fast
```

The fast tier checks catalog resolution, package integrity, legacy and invalid state, locked snapshots, version behavior, project wiring, and external-font fallback behavior.

## Dependency updates

The gallery source fingerprint includes this package's `package-lock.json`. Updating
even an indirect dependency can make the approved gallery manifest stale. For a
Dependabot update, run:

```sh
npm ci
npm run fixtures:gallery
npm run render:gallery
npm run check-gallery
npm test
```

Review the generated gallery before updating the tracked
`../../docs/assets/presentation-themes/manifest.json` source fingerprint. Keep that
manifest update in the same PR as the lockfile update. The generated `reports/` and
`.generated/` directories are local verification output and must not be committed.

## Full render tier

The full tier needs a Chromium-family browser and Ghostscript. It generates the identical eight-slide capacity deck for Editorial, Signal, Compact Signal, and Field Notes, exports HTML and PDF, and checks accessibility, geometry, type size, safe margins, collisions, PDF page count, and exported text parity. Structural and accessibility violations are blocking. Rendered slide images and contact sheets are retained as local/CI artifacts for human review, but browser-dependent pixel comparisons are deliberately not automated. The production gallery check also generates review screenshots and checks their structure and accessibility.

```sh
npm run test:full
```

Set `PRESENTATION_THEME_MARP` to a Marp CLI executable when the local CLI cannot launch the installed browser. Set `PRESENTATION_THEME_BROWSER` to a Chromium-family browser executable when Edge or Chrome is not in its standard macOS location.

Generated decks, screenshots, contact sheets, and reports are ignored. When a theme or composition changes, inspect the generated contact sheets as part of human review.
