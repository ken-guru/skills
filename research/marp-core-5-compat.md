# Findings: marp-core@5 compatibility for clearing the mathjax-full deprecation

Primary-source research resolving [ken-guru/skills#163](https://github.com/ken-guru/skills/issues/163),
part of the wayfinder map at [ken-guru/skills#161](https://github.com/ken-guru/skills/issues/161).

Question: is upgrading/overriding `@marp-team/marp-core@4.4.0` (a transitive dependency of
`skills/presentation/verification/presentation-themes`'s pinned `@marp-team/marp-cli@4.5.0`) to
`@marp-team/marp-core@5.0.1` a viable way to clear the npm-deprecated `mathjax-full@3.2.2` warning?

## Recommendation: **Defer**

Do not adopt the override. Track two external trigger conditions instead:

1. **marp-core promotes v5 out of release-candidate status** — i.e. npm's `latest` dist-tag for
   `@marp-team/marp-core` moves off `4.4.0` onto a `5.x` release. As of this research (2026-09-04),
   `npm view @marp-team/marp-core dist-tags` returns `{"latest":"4.4.0","next":"5.0.1"}`, and both
   `v5.0.0` and `v5.0.1` are marked `"prerelease": true` by GitHub Releases API
   (`gh api repos/marp-team/marp-core/releases`), with the release notes for both stating verbatim:
   > "Marp Core v5 is a release candidate. You can install it with the `next` tag ... If you are
   > upgrading from v4, see the [v4-to-v5 migration guide]."
   The marp-core team itself has not called this stable.
2. **marp-cli ships a release that raises its own `@marp-team/marp-core` dependency to `^5.x`** (or
   otherwise adopts the `/full` or plugin-based entrypoint). No such release, open PR, or open issue
   exists yet — checked `gh api search/issues -f q="repo:marp-team/marp-cli is:pr marp-core"` and
   `repo:marp-team/marp-cli marp-core v5"` (2026-09-04): nothing. marp-core's own tracking issue for
   the v5 split ([marp-core#417](https://github.com/marp-team/marp-core/issues/417)) says explicitly:
   > "Effect to Marp ecosystem tools: Both of Marp CLI and Marp for VS Code will install all external
   > dependencies by default, so existing slides will not be affected by this change."
   — i.e. the marp-core team's own plan assumes marp-cli will be updated to carry the full plugin set
   forward. That update hasn't happened.

Until then: **accept-and-track** the `mathjax-full@3.2.2` deprecation notice as low-severity/cosmetic
— it is an npm "this package was renamed" notice, not a CVE (see §4 below for why the override
wouldn't clear the one real CVE in this chain anyway). Re-run this investigation once either trigger
condition above fires.

---

## 1. Does marp-cli's internal usage of marp-core's API still work when marp-core@5.x is forced via an npm `overrides` entry?

**Mechanically, yes — but it silently drops features.** Tested empirically in a throwaway git
worktree on branch `research/marp-core-5-compat` (this branch), by adding
`"@marp-team/marp-core": "5.0.1"` to `skills/presentation/verification/presentation-themes/package.json`'s
existing `overrides` block, then `npm install` (Node v26.3.0, npm 12.0.2):

- `npm install` completes with exit 0. `npm ls @marp-team/marp-core` reports
  `@marp-team/marp-core@5.0.1 overridden` under `@marp-team/marp-cli@4.5.0` — npm accepts the
  semver-mismatched override without erroring (marp-cli's own `package.json` still declares
  `"@marp-team/marp-core": "^4.4.0"`).
- `node_modules/.bin/marp <file>.md -o out.html --html` runs and exits 0, producing valid HTML, for
  both a synthetic test slide and this repo's own generated `editorial` theme fixture
  (`.generated/editorial/PRESENTASJON.md` via `npm run fixtures`). No crash, no thrown error — the
  `Marp` class's constructor/render API surface that marp-cli's `engine.ts` calls
  (`import type { Marp } from '@marp-team/marp-core'` → `new Marp(...)` → `.render()`) is unchanged
  between v4.4.0 and v5.0.1.
- **But it's not full-fidelity.** marp-cli's engine resolution
  (`repos/marp-team/marp-cli/src/engine.ts` at tag `v4.5.0`) always imports the bare
  `'@marp-team/marp-core'` specifier — never `@marp-team/marp-core/full`. Marp Core v5's default
  entrypoint (`src/index.ts` at tag `v5.0.1`) is:
  ```ts
  export * from './marp'
  export { Marp as default } from './marp'
  ```
  a bare `Marp` class with **zero plugins registered** — versus `src/full.ts`, which registers all
  four core plugins in its constructor:
  ```ts
  export class Marp extends MarpBase {
    constructor(...rest) {
      super(...rest)
      this.use(mathJaxPlugin())
      this.use(katexPlugin())
      this.use(shikiPlugin())
      this.use(mermaidPlugin())
    }
  }
  ```
  Confirmed with a synthetic slide containing a fenced code block, a `$$E=mc^2$$` math block, and a
  `mermaid` fence, rendered through the *overridden* install vs. the *stock v4.4.0* baseline install
  (both via the real `node_modules/.bin/marp` binary, `--html` output):

  | Marker in output HTML | v4.4.0 baseline | v5.0.1 forced override |
  |---|---|---|
  | `hljs` (code syntax highlight classes) | 45 | **0** |
  | `MathJax` | 1 | **0** |
  | Raw `E=mc^2` text left un-typeset | 0 | **1** (present verbatim, unrendered) |
  | `mermaid`/`marp-mermaid` class markers | 1 | 2 (class present; no renderer library installed to draw it — see §2) |

  So: no crash, but **math typesetting and code syntax highlighting silently stop working** — the
  markdown converts, the HTML is valid, and nothing errors, it just doesn't do what v4 did. This is a
  direct, deliberate consequence of marp-core v5's "lightweight core + optional plugins" split
  (`marp-core#417`, `v5.0.0` changelog: *"`@marp-team/marp-core` entrypoint now provides a lightweight
  core, and some features are splitted into core plugins... You can use
  `@marp-team/marp-core/full` for the full build"*), combined with marp-cli@4.5.0 never having been
  updated to ask for the `/full` build.

## 2. What do the new peer dependencies cost?

`npm view @marp-team/marp-core@5.0.1 peerDependencies` / `peerDependenciesMeta`:

```
peerDependencies: {
  "@mathjax/mathjax-bbm-font-extension": "^4.1.3",
  "@mathjax/mathjax-bboldx-font-extension": "^4.1.3",
  "@mathjax/mathjax-dsfont-font-extension": "^4.1.3",
  "@mathjax/mathjax-mhchem-font-extension": "^4.1.3",
  "@mathjax/src": "^4.1.3",
  "beautiful-mermaid": "^1.1.3",
  "katex": "^0.18.2",
  "shiki": "^4.0.2"
}
```
**Every one of these is marked `optional: true`** in `peerDependenciesMeta`, so npm does **not**
auto-install any of them. Confirmed empirically: after `npm install` with the override, `npm ls
mathjax-full katex highlight.js shiki beautiful-mermaid` reports **none present** — `node_modules`
shrank from 114M (baseline, 91 packages) to 52M (82 packages), because marp-core v5's own no-longer-
bundled `katex`, `highlight.js`, and `mathjax-full` were removed and nothing replaced them. This is
consistent with §1's finding that features silently stop working: the packages that would render
math/code/mermaid simply aren't there.

If you *did* install the full parity set to match v4's feature set (per the v4→v5 migration guide's
"For developers" step 1), unpacked sizes via `npm view <pkg> dist.unpackedSize`:

| Package | Unpacked size |
|---|---|
| `@mathjax/src@4.1.3` | 33.7 MB |
| `@mathjax/mathjax-bbm-font-extension@4.1.3` | 0.84 MB |
| `@mathjax/mathjax-bboldx-font-extension@4.1.3` | 0.66 MB |
| `@mathjax/mathjax-dsfont-font-extension@4.1.3` | 0.19 MB |
| `@mathjax/mathjax-mhchem-font-extension@4.1.3` | 0.10 MB |
| `katex@0.18.2` | 4.0 MB |
| `shiki@4.0.2` | 0.60 MB |
| `beautiful-mermaid@1.1.3` | 2.1 MB |
| **Total new-peer footprint** | **~42.2 MB** |

Compared to what v4.4.0 bundled directly: `mathjax-full@3.2.2` was already 34.3 MB unpacked (so the
MathJax swap is roughly a wash), `highlight.js@11.11.1` was 5.4 MB (shiki saves ~4.8 MB), and v4 had
**no** real mermaid rendering at all (the `mermaid` CSS class existed on code fences, but no renderer
shipped — `marp-core#139` "Add support for mermaidjs" was only closed *by* the v5 `beautiful-mermaid`
addition). Net: full parity is **not a meaningful install-size or CI-time win** — it's roughly a wash
on math, a real but modest win on code highlighting, and a genuinely new ~4 MB cost for a feature
(mermaid) this repo's fixtures don't use. There's no free lunch here; the "clear a deprecation
warning" motivation doesn't come with a size dividend.

## 3. Does the acceptance/gallery fixture output change or break?

**For the fixtures as they exist today: no functional change.** Checked
`skills/presentation/verification/presentation-themes/fixtures/capacity-deck.mjs` (used by both the
theme acceptance deck and, via the same `renderPresentationMarkdown` helper, structurally similar to
the gallery deck) and `fixtures/gallery/AGENDA.md`: neither uses math (`$$`/`\(`), fenced code blocks,
or `mermaid` fences — the decks are built entirely from the semantic slide-role vocabulary (opener,
section-boundary, quotation, quantitative metrics, picture/diagram media). `grep` across
`fixtures/**` for `` ``` ``, `$$`, `\$` returned nothing.

Rendered the `editorial` theme's actual generated fixture (`npm run fixtures` → `.generated/editorial/PRESENTASJON.md`)
through both a stock v4.4.0 install and the v5.0.1-forced-override install (same `marp
<file> -o out.html --html` invocation) and diffed the two HTML outputs byte-for-byte. The diff was
2 hunks / 27 lines out of ~112–116 KB of output, and both hunks are exclusively inside an embedded,
minified `<script>` block (Marpit's `marp-auto-scaling`/custom-elements helper) — the *only*
difference is minifier output style (e.g. `HTMLHeadingElement` referenced via `()=>HTMLHeadingElement`
vs `e=>e.HTMLHeadingElement`, single-quoted vs backtick-quoted string literals). This is consistent
with marp-core v5's changelog entry *"Migrate the build system from rollup to tsdown"* — a different
minifier, not a behavioral change. All slide content, layout CSS, class names, and structure are
identical.

Also ran the repo's fast test tier (`npm test` — the only CI-gated tier per this suite's own
`README.md`) against the override: **50/50 tests pass**, unchanged from baseline. This is expected
and not reassuring on its own: `grep -l "marp-cli\|marp-core\|child_process\|spawn" tests/*.mjs`
shows the fast tier never actually invokes `marp`/`marp-core` — only `scripts/render-fixtures.mjs`
and `scripts/render-gallery.mjs` (the "full" tier, explicitly **not CI-gated**, per the suite's own
README: *"This tier is not run in CI... Whether a theme actually looks right is a judgment call for a
human, not a pass/fail gate"*) do. So **CI would show green under the override even if math/code/
mermaid rendering silently broke** — the regression in §1 would only surface in a human's local
`npm run test:full` review of the generated gallery/contact sheets, or the day someone adds a code
fence or math expression to a fixture or a real presentation skill's gallery example.

**Conclusion for this question:** safe *today*, for *these specific fixtures*, by coincidence of
fixture content — not by design, and not durably. It's a latent trap: nothing in the fast (CI-gated)
tier would catch a future fixture/gallery slide silently losing math or code-highlighting under this
override.

## 4. Viable alternatives short of the major bump?

- **`patch-package`**: not applicable/needed here. There's no marp-cli source bug to patch — the
  gap is architectural (marp-cli imports the bare `@marp-team/marp-core` entrypoint; marp-core v5
  intentionally ships that entrypoint without plugins). Patching would mean rewriting marp-cli's
  `engine.ts` resolution logic itself, which is a much larger and more fragile undertaking than a
  patch-package diff, and would need to be redone on every marp-cli bump.

- **A custom `--engine` module** (untested, flagged as a possible future path, not verified here):
  marp-cli supports `--engine <module>` to load a custom engine
  (`gh api repos/marp-team/marp-cli/contents/README.md` → "Engine" section). In principle, a small
  local `engine.mjs` doing `export default (await import('@marp-team/marp-core/full')).Marp` (or
  explicitly `.use()`-ing only the plugins actually needed) could let this repo consume marp-core v5's
  plugin architecture without waiting for marp-cli to update its own default resolution — decoupling
  from marp-cli's bundled-engine assumption while still using its PDF/browser conversion pipeline.
  This was not empirically tested in this research pass (time-boxed to the override experiment); it's
  a genuine candidate for a follow-up ticket **if and when** a fixture actually needs math/mermaid/code
  highlighting under a forced v5, but it adds real complexity (a maintained custom engine file,
  ESM/CJS entrypoint compatibility to verify) for a deprecation-warning-only motivation.

- **Accept-and-track (recommended, see above)**: the `mathjax-full@3.2.2` deprecation notice itself
  carries no CVE — `npm audit` on the current, unmodified `presentation-themes` install shows exactly
  2 moderate advisories, both for `@xmldom/xmldom` (`GHSA-6gmq-8vp8-gcm6`, "XML fragment injection via
  invalid EntityReference.nodeName", affecting `>=0.9.0 <=0.9.11`) via `speech-rule-engine` (a
  `mathjax-full` dependency used for math accessibility text) — **not** the deprecation warning
  itself. Notably, **upgrading to marp-core v5 would not clear that CVE either**: `@mathjax/src@4.1.3`
  (the "successor" package pulled in as v5's optional MathJax peer) depends on
  `speech-rule-engine@5.0.0-rc.4`, which itself still depends on `@xmldom/xmldom@^0.9.10` — squarely
  in the same vulnerable range. So the one real security advisory in this dependency chain is
  orthogonal to this ticket's v4→v5 question; it would need its own fix (e.g. an `overrides` pin on
  `@xmldom/xmldom` to a patched version) regardless of which marp-core major version is in use. Worth
  flagging to whoever scopes #161's CVE-clearing child ticket.

---

## Source file index / commands run

- `gh issue view 163 -R ken-guru/skills` — ticket question text.
- `npm view @marp-team/marp-core@5.0.1 --json`, `npm view @marp-team/marp-core versions --json` —
  registry metadata, dist-tags, `peerDependencies`/`peerDependenciesMeta`, `engines`.
- `gh api repos/marp-team/marp-core/releases` / `.../releases/tags/v5.0.0` / `.../v5.0.1` — prerelease
  flags and release-note text (release-candidate language, changelog entries).
- `gh api repos/marp-team/marp-core/contents/src/index.ts?ref=v5.0.1`,
  `.../src/full.ts?ref=v5.0.1`, `.../package.json?ref=v5.0.1` (`exports` map) — lightweight-core vs.
  full-entrypoint source comparison.
- `gh api repos/marp-team/marp-core/contents/docs/migration-v5.md?ref=v5.0.1` — official v4→v5
  migration guide.
- `gh api repos/marp-team/marp-core/issues/417` — "[v5] Make huge package dependencies optional"
  (the design issue that produced the plugin split), including its "Effect to Marp ecosystem tools"
  note.
- `gh api repos/marp-team/marp-cli/contents/src/engine.ts?ref=v4.5.0` — confirms marp-cli's default
  engine resolution imports the bare `@marp-team/marp-core` specifier.
- `gh api repos/marp-team/marp-cli/contents/package.json?ref=v4.5.0` — confirms
  `"@marp-team/marp-core": "^4.4.0"` is still marp-cli's own declared dependency.
- `gh api repos/marp-team/marp-cli/contents/README.md?ref=main` — `--engine` custom-engine option
  documentation.
- `gh api search/issues -f q="repo:marp-team/marp-cli is:pr marp-core"` and similar queries — no
  open/closed marp-cli work toward marp-core v5 support found.
- Empirical experiment: git worktree on this branch (`research/marp-core-5-compat`), Node v26.3.0 /
  npm 12.0.2, in `skills/presentation/verification/presentation-themes/`:
  - Baseline `npm ci` (stock `package.json`/`package-lock.json`): confirms
    `@marp-team/marp-cli@4.5.0 → @marp-team/marp-core@4.4.0 → mathjax-full@3.2.2`, the
    `mathjax-full@3.2.2` deprecation warning, `node_modules` at 114 MB / 91 packages, `npm test`
    50/50 passing, `npm audit` showing the 2 `@xmldom/xmldom`-rooted moderate advisories.
  - Override experiment: added `"@marp-team/marp-core": "5.0.1"` to the existing `overrides` block,
    `npm install`, re-ran `npm test` (50/50 still passing), rendered a synthetic math/code/mermaid
    test slide and the real `editorial` fixture through `node_modules/.bin/marp` directly, diffed
    against baseline renders, ran `npm ls`/`npm audit`/`du -sh node_modules` for the size and
    dependency-tree comparisons above.
  - **The experimental `package.json`/`package-lock.json` override was reverted** (`git checkout --`)
    before this findings file was written and committed — this branch ships only this research
    document, not the override itself. This ticket is investigate-only, not a merge, per #161's scope
    decision.
