# Which Marp and Chrome flags the rendering-slides render path needs

Research for [#520](https://github.com/ken-guru/skills/issues/520), under the map
[#519](https://github.com/ken-guru/skills/issues/519). Date: 2026-10-10.

Code under study: `feat/presentation-3` (PR #518) at `3be0603`:
`skills/presentation/rendering-slides/scripts/rendering-slides.mjs` (Marp called with
`--html --allow-local-files`, and `MARP_USER=rendering-slides` in the child env) and
`scripts/checks.mjs` (puppeteer launches Chrome with
`--no-sandbox --allow-file-access-from-files`).

Pinned tools, as installed by `rendering-slides.mjs setup`: Marp CLI 4.5.1 (with
marp-core 4.4.0, Marpit 3.2.3, markdown-it 14.3.2, puppeteer-core 24.43.1, cosmiconfig
9.0.2) and chrome-headless-shell 155.0.8059.39 (linux-arm64).

Experiment host: Ubuntu 26.04 dev container on Docker (linuxkit kernel), aarch64, run
as uid 1000 unless stated. Unprivileged user namespaces are allowed there
(`unshare -Ur` works, and there is no `apparmor_restrict_unprivileged_userns` sysctl).
Chrome's missing system libraries were installed with apt. Every experiment ran on a
scratch copy of the branch; nothing on `feat/presentation-3` was changed.

## Summary

| Flag | Needed? | Evidence |
| --- | --- | --- |
| Marp `--html` | **No.** Drop it. | Experiments 1 and 6: the default allowlist keeps everything a Deck Source uses, and the fixture's `deck.html` is byte-identical with and without the flag. |
| Marp `--allow-local-files` | **Yes**, for PDF, PNG, and PPTX (not for HTML). | Experiment 3: without it, `media/` images and `fonts/` faces are missing from all three. |
| Marp config auto-discovery | **Must be switched off**: this is a new finding. | Experiment 2: a `marp.config.mjs` in the Deck Folder runs arbitrary code, and a `.marprc.yml` or `package.json` `marp` key can turn `html: true` back on. Pass `--no-config-file`, or `--config-file <skill-owned file>`. |
| `MARP_USER` env | **Replace it.** It silently adds `--no-sandbox`. | Experiment 8 and marp-cli `src/utils/container.ts`. |
| puppeteer `--allow-file-access-from-files` | **No.** Drop it. | Experiment 4: images and fonts load without it; it only lets page scripts read `file://` via XHR. |
| puppeteer `--no-sandbox` | **Not on a normal host.** Needed as root, and where user namespaces are blocked (likely including GitHub's `ubuntu-24.04`). | Experiments 5 and 7, Chromium and Puppeteer docs, runner-images issues. |

## 1. Marp's default HTML allowlist, and a narrower one

**Answer: the default keeps every construct a Deck Source relies on. Marp CLI also
takes a narrower allowlist from a config file, for example `{"span": ["lang"], "br": []}`.**

Sources:

- marp-core README, "`html`" constructor option: the default is "Marp's default
  allowlist"; `true` allows all HTML; an object sets the allowed tags and attributes.
  It also says: "Whatever any option is selected, `<!-- HTML comment -->` and `<style>`
  tags are always parsed by Marpit for directives / tweaking style."
  ([marp-core v4.4.0 README](https://github.com/marp-team/marp-core/blob/v4.4.0/README.md#html-boolean--object))
- marp-core
  [`src/html/allowlist.ts`](https://github.com/marp-team/marp-core/blob/v4.4.0/src/html/allowlist.ts):
  every allowed element gets the global attributes `class`, `dir`, `lang`, and `title`.
  `span` and `br` are allowed. There is no `script`, `iframe`, `object`, `embed`, or
  `style` element, and no `style` attribute or `on*` attribute anywhere. `img src` is
  allowed, but only with `http`, `https`, or `data:image/` schemes or a scheme-less
  (relative or absolute) path, so `file:` is stripped. `a href` allows only
  `http`/`https`.
- Marp CLI README, configuration options table: `html` takes "boolean | object"
  ("Configuration file can pass the whitelist object if you are using Marp Core").
  ([marp-cli v4.5.1 README](https://github.com/marp-team/marp-cli/blob/v4.5.1/README.md#options))

**Experiment 1** (`allow.md`, rendered with `--template bare`, with and without `--html`):

| Construct | Default (no `--html`) | `--html` |
| --- | --- | --- |
| `<span lang="fr">…</span>` | kept as is | kept |
| `<br>` | kept (`<br />`) | kept |
| `<span class="tf">` | kept | kept |
| `<span style="font-size:12px">` | `style` dropped (`<span>`) | kept |
| `<script>…</script>` | escaped to text (`&lt;script&gt;`) | **kept and live** |
| `<iframe src="file:///etc/hostname">` | escaped to text | **kept and live** |
| `<a href=… onclick=…>` | `onclick` dropped | kept |
| `<img src="media/red.png">` (raw) | kept | kept |
| `<!-- _class: … -->`, `<!-- _paginate: … -->`, front-matter `lang`/`paginate` | applied (`data-class`, `lang="en"`) | same |
| `<style scoped>` | applied | same |
| `<!-- decorative -->`, `<!-- Visual intent: … -->`, notes comments | removed from the HTML and kept as presenter notes (`--notes` lists all three) | same |

The comments are never in the rendered HTML in either mode. That is expected: the
skill reads them from `deck.md` with its own parser (`parseDeck`, `notesScript`), not
from Marp's output.

**Experiment 2a** (narrow allowlist): `--config-file narrow.json`, where `narrow.json`
holds `{"html": {"span": ["lang"], "br": []}}`. Output: `<span lang="fr">` and `<br />`
were kept. `<span class>` and `<span style>` became a bare `<span>`. Raw `<img>`, `<a>`,
`<script>`, and `<iframe>` were all escaped to text. So a narrower allowlist works.
Note that this also drops `class` on spans; the fixture deck uses no raw HTML except
the WCAG 3.1.2 `<span lang>`, so nothing it needs is lost.

## 2. `--allow-local-files`: still needed, and what it exposes once raw HTML is off

**Answer: it is still needed for PDF, PNG, and PPTX. Without it, `media/` images and
`fonts/` faces silently disappear. HTML output never uses the browser, so it does not
need the flag. With raw HTML off, the flag still lets a deck pull any local image, CSS
file, or font that the user can read into the rendered output, through relative
`../` or absolute paths and through CSS `url()` or `@import` in a `<style>`. No file can
be read as text, and nothing can run script.**

Source, marp-cli
[`src/converter.ts` `usePuppeteer()`](https://github.com/marp-team/marp-cli/blob/v4.5.1/src/converter.ts):

- With `allowLocalFiles`, Marp writes the HTML to a temp file and opens it as a
  `file://` page.
- Without it, Marp opens `data:text/html,` and calls `page.setContent(…)`, and Chrome
  blocks `file:` subresources. Marp then warns "That is blocked by security reason"
  (`trackFailedLocalFileAccess`).
- For non-HTML output, `resolveBase()` sets `<base>` to the Markdown file's `file://`
  URL, which is why relative `media/…` paths resolve.
- The README says the same: "conversion that is using the browser cannot use local
  files by default … `--allow-local-files` … Please use only to the trusted Markdown"
  ([README, Security about local files](https://github.com/marp-team/marp-cli/blob/v4.5.1/README.md#security-about-local-files)).

**Experiment 3** (`assets.md`: a Markdown image `media/red.png`, plus a span in an
`@font-face` family loaded from `fonts/TestFace.ttf`; no `--html`):

| Output | With `--allow-local-files` | Without |
| --- | --- | --- |
| PDF | 1 raster image (`pdfimages`); the font embedded as `LiberationMono` (the copied face) | 0 images; the font falls back to Liberation Serif; Marp warns about blocked local files |
| PNG | 90,000 red pixels | 0 |
| PPTX (slide image) | 360,000 red pixels | 0 |

**Experiment 4** (what the flag exposes with raw HTML off). A folder `secret/` sits next
to the Deck Folder, holding a blue PNG and a CSS file. The deck has no `--html`.

| Deck Source construct | Result |
| --- | --- |
| `![](file:///…/secret.png)` | **blocked.** markdown-it's `validateLink` rejects `file:` (`BAD_PROTO_RE = /^(vbscript\|javascript\|file\|data):/`, [markdown-it 14 `lib/index.mjs`](https://github.com/markdown-it/markdown-it/blob/14.3.2/lib/index.mjs)) |
| `![](../secret/secret.png)` | **loaded** into the PNG |
| `![](/abs/path/secret.png)` | **loaded** into the PDF |
| `<style scoped>section{background:url("file:///…/secret.png")}</style>` | **loaded** |
| `<style>@import url("file:///…/secret.css");</style>` | **loaded** (its `content:` text appears in the PDF on every slide) |
| raw `<img src="../secret/secret.png">` (allowed by the default list) | **loaded** |

So the residual exposure is "any image, stylesheet, or font the user can read can be
painted into the deliverable". That is a visual leak into a file the user then shares;
it is not a script read. CSS can also beacon to the network (`url(https://…)`), but that
works with or without this flag. Ways to narrow it further (not tested here): render
from a copy of the Deck Folder that holds only `deck.md`, `theme.css`, `media/`, and
`fonts/`; or reject `../`, absolute paths, and `file:` in `<style>` during the source
checks.

## 3. The check page and `--allow-file-access-from-files`

**Answer: not needed. The check page's images and `@font-face` fonts load from
`file://` without it. The flag only lets page scripts read `file://` URLs (XHR or fetch).
That is the capability the must-fix is about, so drop it.**

**Experiment 5.** This mirrors `render()` + `renderedFindings()`: copy `media/` and
`fonts/` into `dist/`, write `dist/.check.html` with `--template bare`, then load it
with the bundled puppeteer-core and `waitUntil: 'load'`:

| Chrome args | `<img>` `naturalWidth` | `@font-face` status | computed `font-family` | `XMLHttpRequest` to `media/red.png` |
| --- | --- | --- | --- | --- |
| `--no-sandbox --allow-file-access-from-files` (current) | 64 | loaded | TestFace | status 200 |
| `--no-sandbox` | 64 | loaded | TestFace | blocked (`NetworkError`) |
| none | 64 | loaded | TestFace | blocked (`NetworkError`) |

There are no primary docs on this flag beyond Chromium's switch list. Neither the
Puppeteer troubleshooting page nor Marp mentions it, and Marp itself never passes it
(Experiment 8 logs Marp's real Chrome command line).

## 4. When Chrome really needs `--no-sandbox`

**Answer:**

- **macOS:** no. Chrome uses the Seatbelt `sandbox(7)` API, which needs no root and no
  kernel feature.
- **Linux as a normal user:** no, as long as unprivileged user namespaces are allowed.
- **As root:** yes, always. Chrome refuses to start.
- **In a container:** only if it runs as root, or if user namespaces are blocked.
  Docker's default seccomp profile allows `CLONE_NEWUSER`.
- **GitHub's `ubuntu-24.04` runner:** very likely yes, for the downloaded
  chrome-headless-shell, unless the job lifts the AppArmor restriction or points Chrome
  at a setuid helper.
- **Marp's own PDF conversion:** it launches Chrome with `--no-sandbox` whenever
  `MARP_USER` is set, and rendering-slides always sets it. So today every Marp render
  runs unsandboxed on every OS.

### Marp's launch logic

marp-cli
[`src/browser/browsers/chrome.ts`](https://github.com/marp-team/marp-cli/blob/v4.5.1/src/browser/browsers/chrome.ts)
`puppeteerArgsEnableSandbox()` returns false, and Marp adds `--no-sandbox`, when any of
these holds:

- `CHROME_NO_SANDBOX` is set
- `process.getuid() === 0`
- `isInsideContainer()`
- `isWSL()`

[`src/utils/container.ts`](https://github.com/marp-team/marp-cli/blob/v4.5.1/src/utils/container.ts)
defines it:

```ts
export const isInsideContainer = () =>
  isOfficialContainerImage() || (_isInsideContainer() && !process.env.MARP_TEST_CI)
export const isOfficialContainerImage = () => !!process.env.MARP_USER
```

`MARP_USER` is how Marp detects its own Docker image. The skill sets it to keep temp
files out of `$HOME`. The only temp-file effect is in
[`src/utils/tmp.ts`](https://github.com/marp-team/marp-cli/blob/v4.5.1/src/utils/tmp.ts):
on Linux, unless `MARP_USER` is set, the `--allow-local-files` temp HTML goes to
`os.homedir()`, a workaround for snap Chromium. On macOS it changes nothing about temp
files, yet it still turns the sandbox off. A replacement that keeps the sandbox: leave
`MARP_USER` unset and give the Marp child process `HOME=<a writable scratch dir>` on
Linux. This is untested, but it follows from `tmp.ts`. The puppeteer user data dir is
already under `os.tmpdir()`.

**Experiment 8.** `CHROME_PATH` was pointed at a wrapper that logs Marp's Chrome
arguments, then a PDF render ran in each case:

| Environment | Chrome args from Marp |
| --- | --- |
| `MARP_USER=rendering-slides` (as the skill does) | `--headless=new --no-sandbox --test-type …` |
| `MARP_USER` set, container detection off (`MARP_TEST_CI=1`) | `--no-sandbox` still added |
| `MARP_USER` unset, container detection off (an ordinary host) | **no `--no-sandbox`** |
| `MARP_USER` unset, inside this Docker container (`/.dockerenv`) | `--no-sandbox` (container heuristic) |
| `CHROME_NO_SANDBOX=1` | `--no-sandbox` |

With `MARP_USER` unset and container detection off, a sandboxed Marp PDF render
succeeded here, image included.

Marp has no switch that forces the sandbox back *on* inside a container. Its
container heuristic always disables it. So in Docker, keeping Marp sandboxed means
driving Chrome yourself.

### Chrome's own behaviour

**Experiment 5b** (puppeteer-core, pinned chrome-headless-shell, inspecting
`/proc/<renderer>/ns/user` and `Seccomp:`):

| Who / where | Args | Result |
| --- | --- | --- |
| uid 1000, userns allowed | none | launches; renderers in their **own user namespace**, `Seccomp: 2` (BPF filter): sandbox active |
| uid 1000 | `--no-sandbox` | launches; renderers share the browser's namespace, `Seccomp: 0` |
| root | none | **fails**: `Running as root without --no-sandbox is not supported. See https://crbug.com/638180.` |
| root | `--no-sandbox` | launches, unsandboxed |

**Experiment 7.** This simulates a host that blocks user namespaces:
`bwrap --unshare-user --disable-userns`, uid 1000, with no args. Chrome fails with:

> FATAL … No usable sandbox! If you are running on Ubuntu 23.10+ or another Linux
> distro that has disabled unprivileged user namespaces with AppArmor, see …
> apparmor-userns-restrictions.md … you can try using --no-sandbox.

With `--no-sandbox` it launches. The chrome-headless-shell archive ships **no**
`chrome-sandbox` setuid helper (checked in the unpacked archive), so it cannot fall
back to the setuid sandbox by itself.

### Docs

- Chromium,
  [AppArmor user namespace restrictions](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md):
  Ubuntu 23.10+ restricts unprivileged user namespaces, which Chromium's sandbox uses.
  It lists four ways out:
  - an AppArmor profile for the binary
  - `echo 0 | sudo tee /proc/sys/kernel/apparmor_restrict_unprivileged_userns`
  - `CHROME_DEVEL_SANDBOX` pointing at a setuid helper such as
    `/opt/google/chrome/chrome-sandbox` from an installed Google Chrome
  - `--no-sandbox`, which "should never be used when browsing the open web"

  Ubuntu ships an AppArmor profile only for Google Chrome stable at
  `/opt/google/chrome/chrome`.
- Puppeteer, [Troubleshooting](https://pptr.dev/troubleshooting): "This AppArmor
  policy prevents Chrome for Testing binaries downloaded by Puppeteer from using user
  namespaces", which ends in "No usable sandbox!". `--no-sandbox` is for content you
  "absolutely trust", and is "strongly discouraged". The Docker example adds a non-root
  user "so we don't need --no-sandbox". The page also says it is "fine to re-use the
  same sandbox executable for different Chrome versions".
- Chromium, [`sandbox/linux/README.md`](https://chromium.googlesource.com/chromium/src/+/main/sandbox/linux/README.md):
  the layers are namespaces where supported, the setuid helper, and seccomp-BPF.
- Chromium, [`sandbox/mac/README.md`](https://chromium.googlesource.com/chromium/src/+/main/sandbox/mac/README.md):
  macOS uses `sandbox(7)` ("Seatbelt").
- Docker,
  [seccomp default profile](https://github.com/docker/docs/blob/main/content/manuals/engine/security/seccomp.md):
  `clone` is "gated by `CAP_SYS_ADMIN` for CLONE_* flags, except `CLONE_NEWUSER`", and
  `unshare` is gated "with the exception of `unshare --user`". So a non-root container
  user can normally use Chrome's namespace sandbox, as Experiment 5b showed.

### GitHub `ubuntu-24.04`: medium-high confidence, not run

CI (`.github/workflows/presentation-skills.yml` on the branch) runs `rendering-slides
setup` and the tests directly on `ubuntu-24.04`, as the non-root `runner` user, using
the downloaded chrome-headless-shell. The evidence:

- [actions/runner-images#10443](https://github.com/actions/runner-images/issues/10443)
  shows `unshare` failing with "Operation not permitted" on `ubuntu-24.04`, and gives
  the workaround `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`.
- The PR to disable the restriction in the image,
  [#11489](https://github.com/actions/runner-images/pull/11489), was closed unmerged.
- The current image scripts (`images/ubuntu/scripts/build/*.sh` on `main`) contain no
  `apparmor` or `userns` setting.
- [#12096](https://github.com/actions/runner-images/issues/12096) reports headless
  Chrome failing for the same reason on 24.04, and a working fix: enable the setuid
  `chrome-sandbox` helper.
- The image installs Google Chrome stable from Google's `.deb`
  (`install-google-chrome.sh`). Per the Chromium doc, Google Chrome has the helper at
  `/opt/google/chrome/chrome-sandbox` and an Ubuntu AppArmor profile, but neither covers
  a chrome-headless-shell binary unpacked into the skill cache.

The expected result is that a sandboxed launch of the pinned binary fails on the runner
with "No usable sandbox!". The CI options that keep the sandbox (untested):

- add `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` before the tests
  (the runner has passwordless sudo); this is the simplest
- set `CHROME_DEVEL_SANDBOX=/opt/google/chrome/chrome-sandbox` (Puppeteer says the
  helper can be shared across Chrome versions)

Either way the product code would not need `--no-sandbox`. This has to be confirmed by
one real CI run.

## 5. Small text in the failing deck without raw HTML

**Answer: use a scoped `<style>`. Marpit always parses it, whatever the `html` setting
is. `<style scoped>p { font-size: 12px; }</style>` reproduces the text-size failure,
and `<style scoped>p { color: #d8d0c4; }</style>` reproduces the contrast failure. The
current `<span style="…">` decks would silently pass once `--html` is gone, so both tests
must change.**

Sources: the marp-core README note quoted in §1 (`<style>` is "always parsed by Marpit
for … tweaking style"), and Marpit's
[Tweak style through Markdown](https://marpit.marp.app/theme-css?id=tweak-style-through-markdown),
which covers `<style>` and `<style scoped>`.

**Experiment 9.** A scratch copy of the skill had `--html` removed from both Marp calls
and the puppeteer args emptied. Each variant was rendered with the real
`rendering-slides.mjs render`:

| Deck body | Result |
| --- | --- |
| `<span style="font-size:12px">tiny print</span>` (the current test) | **passes all checks**: the style is dropped |
| `<style scoped>p { font-size: 12px; }</style>` + `tiny print` | `Slide 1 [text-size]: has 12px text ("tiny print")` |
| `<!-- _class: tiny -->` + `<style>section.tiny p { font-size: 12px; }</style>` | same finding |
| `<small><small><small>tiny print</small></small></small>` (allowlisted tags) | passes: the theme keeps it at 20 px or more |
| `<style scoped>p { color: #d8d0c4; }</style>` + `faint text` | `Slide 1 [contrast]: has text ("faint text") at 1.25:1` |

**Experiment 10.** The branch's own suite ran against that patched copy (`node --test
tests/*.test.mjs`): 23 passed and 2 failed. The two failures are exactly
`render ends with the checks and reports rendered text below 20 px` and
`render reports low-contrast rendered text`, the two `<span style>` decks. Every other
test passed, including:

- the tagged PDF and outline
- the PPTX and PNG export
- the brand theme with copied fonts and logo

**Experiment 6** rendered the verification fixture (`verification/presentation-skills/fixture`,
with placeholder SVGs for the diagram and chart) with `--images`, using the branch as is
and then the patched copy. All checks passed both times. `deck.html` was identical and
`deck-notes.md` was identical.

## New finding: Marp CLI loads a config file from the Deck Folder

marp-cli
[`src/config.ts` `loadConf()`](https://github.com/marp-team/marp-cli/blob/v4.5.1/src/config.ts)
calls `cosmiconfig('marp').search(process.cwd())` unless `--config-file` or
`--no-config-file` is given. rendering-slides runs Marp with `cwd: deckFolder`, so a
Deck Source author controls the config. The README lists `marp.config.js`, `.mjs`,
`.cjs`, `.marprc` (JSON or YAML), and the `marp` key of `package.json`; its `engine`
option also takes a JS file.

**Experiment 2b:**

| File in the Deck Folder | CLI without `--html` |
| --- | --- |
| `.marprc.yml` with `html: true` | raw `<script>` and `<iframe>` are back in the output |
| `package.json` with `{"marp": {"html": true}}` | same |
| `marp.config.mjs` that writes a file | **the file is written**: arbitrary code runs at render time |
| any of the above, with `--no-config-file` | ignored |
| `marp.config.mjs`, with `--config-file <skill-owned narrow.json>` | ignored (an explicit path calls `explorer.load`, not `search`) |
| `marp.config.mjs` in the *parent* of the cwd | not loaded (cosmiconfig 9 searches only the cwd here) |

This makes dropping `--html` insufficient on its own. The render and check calls must
also pass `--no-config-file`, or `--config-file` pointing at a file the skill owns,
which can carry the narrow allowlist from §1.

## What could not be verified

- **GitHub `ubuntu-24.04`:** inferred from runner-images issues, the closed PR, image
  scripts, and Chromium and Puppeteer docs, plus a local namespace-blocking simulation
  (bubblewrap's `--disable-userns`). That simulation is not AppArmor's mechanism.
  Confirm with one CI run of a sandboxed launch.
- **macOS:** not run. The Seatbelt behaviour and the `MARP_USER` → `--no-sandbox`
  effect are from source. On macOS, `MARP_USER` changes nothing except disabling the
  sandbox. Whether Chrome's own Seatbelt sandbox works inside Codex's or Claude Code's
  macOS sandbox (the `bootstrap_check_in` signature the skill already handles) was not
  tested.
- **x86-64:** all browser experiments ran on linux-arm64 chrome-headless-shell 155.
  The x64 build is not expected to differ in flag handling.
- **The `HOME=` replacement for `MARP_USER`, and the CI sandbox workarounds,** follow
  from source and docs but were not run.
