# How a skill gets a working headless browser in each harness's sandbox

Research for [#492](https://github.com/ken-guru/skills/issues/492), a child of
the map [#481](https://github.com/ken-guru/skills/issues/481). It builds on
[#484](https://github.com/ken-guru/skills/issues/484)
([`slide-rendering-stacks.md`](https://github.com/ken-guru/skills/blob/research/slide-rendering-stacks/docs/research/slide-rendering-stacks.md))
and [#485](https://github.com/ken-guru/skills/issues/485)
([`harness-skill-features.md`](https://github.com/ken-guru/skills/blob/research/harness-skill-features/docs/research/harness-skill-features.md)).
Researched 2026-10-08.

## Question

How can a skill reliably get a working headless browser (for PDF export and
slide images) in Claude Code, Copilot CLI, and Codex, on macOS and Linux
sandboxes? Compare naming the browser explicitly, a pinned
`chrome-headless-shell`, Playwright's browser install, and Docker. Also
confirm whether `marp --notes` needs a browser, and whether Marp's PDF stays
tagged for accessibility.

This note gives evidence and a ranked leaning. The decision belongs to the map.

## Answer in brief

- **Getting the binary is the easy part.** `npx @puppeteer/browsers install
  chrome-headless-shell@<exact version> --path <dir>` downloaded a working
  274 MB Chrome for Testing headless shell in 16 s. Pointing Marp at it with
  `CHROME_PATH` produced PDF, PNG, and notes on the first try (measured, Linux
  arm64).
- **Linux needs system libraries.** The shell ships a `deb.deps` file listing
  its Debian packages. Installing the 16 missing libraries pulled in 39
  packages (206 MB) and needed root (measured). `@puppeteer/browsers install
  --install-deps` and `playwright install --with-deps` automate this, but both
  need root.
- **The harness sandboxes are the hard part, and they fail differently:**
  - **Codex, Linux (default `workspace-write`, network off):** Chrome cannot
    start. Codex's seccomp filter denies `shutdown()` and other socket calls
    when network is off, and Chrome aborts in `sandbox_host_linux.cc`. This
    happens even with Chrome's own sandbox disabled (measured with
    `codex sandbox`, 0.154.0). It works with
    `sandbox_workspace_write.network_access = true`, or outside the sandbox
    (escalation, or an allow `prefix_rule`).
  - **Codex and Claude Code, macOS (Seatbelt):** Chrome dies at launch
    because the profiles do not allow `mach-register`, which Chromium needs
    for `MachPortRendezvousServer`. No setting fixes it, and the documented
    workaround is to run the command unsandboxed (read: source plus open
    issues; not measured, no Mac here).
  - **Claude Code, Linux (bubblewrap + seccomp):** Chrome runs (measured with
    `@anthropic-ai/sandbox-runtime` 0.0.79, the engine behind the Bash
    sandbox). Downloads work through the proxy only for allowed domains and
    only if the downloader honours `HTTPS_PROXY`.
  - **Copilot CLI:** the sandbox is off by default and experimental. With it
    on, the default policy allows outbound network and the user profile
    (read: `copilot help sandbox`, 1.0.85).
- **Marp has its own sandbox trap on Linux.** Marp writes its temporary HTML
  to `$HOME`, not `/tmp`, on Linux (a workaround for snap Chromium). Codex and
  Claude Code sandboxes make `$HOME` read-only, so PDF and PNG fail with
  `EROFS` even when the browser works. Set `MARP_USER` (or point `HOME` at a
  writable directory) for the Marp process (measured).
- **`marp --notes` does not need a browser.** It only asks for one while
  working out the HTML base URL. With `--base-url .` (or Markdown on stdin) it
  exports notes with no browser installed (measured).
- **Marp's PDF is tagged.** Through Chrome for Testing 155, the plain PDF and
  the PDFs made with `--pdf-outlines` and `--pdf-notes` all had `Tagged: yes`,
  a structure tree (`Document`, `H1`, `H2`, `P`, `L`/`LI`, `Figure`), `/Lang
  (en)`, and the image's alt text (measured).

## Experiments (what was measured)

Environment: Linux arm64 (Ubuntu 26.04 dev container, uid 1000, sudo
available), Node 24.21.0, Marp CLI 4.5.1 (Marp Core 4.4.0),
`@puppeteer/browsers` 3.2.4, Playwright 1.64.0, Codex CLI 0.154.0, Copilot
CLI 1.0.85, `@anthropic-ai/sandbox-runtime` 0.0.79. The test deck had two
slides, a heading, a list, an image with alt text, `lang: en`, and a note per
slide. No macOS machine was available.

| # | Experiment | Result |
|---|---|---|
| 1 | `marp deck.md --notes`, no browser installed | Fails: "No suitable browser found" (reproduces #484) |
| 2 | Same, plus `--base-url ./` | Works, notes TXT written, no browser |
| 3 | `marp --notes -o y.txt < deck.md` (stdin) | Works, no browser |
| 4 | `npx @puppeteer/browsers install chrome-headless-shell@stable --path ./browsers` | 155.0.8059.39, linux-arm64, 274 MB, 16 s |
| 5 | `ldd` on the shell before installing libraries | 19 missing: glib, gobject, gio, nspr4, nss3, nssutil3, atk, atspi, dbus, X11, Xcomposite, Xdamage, Xext, Xfixes, Xrandr, xcb, xkbcommon, gbm, asound |
| 6 | `apt-get install --no-install-recommends` of the 16 packages behind those libraries | 39 packages, 206 MB, root needed; then `ldd` clean |
| 7 | `CHROME_PATH=<shell> marp --pdf` / `--images png` / `--notes` (no sandbox) | All work; 1.3 s, 1.4 s, 0.6 s. PNG text rendered with the DejaVu fonts already present |
| 8 | PDF structure (`pdfinfo`, `qpdf --qdf`) for plain, `--pdf-outlines`, `--pdf-notes` | All `Tagged: yes`, `StructTreeRoot`, `MarkInfo /Marked true`, `/Lang (en)`, `/Alt (…)`; outlines and note annotations present where asked |
| 9 | `npx playwright@1.64.0 install --only-shell chromium` | Fails here: `cdn.playwright.dev` unreachable (this environment's egress allowlist). Would have fetched Chrome Headless Shell 156.0.8078.4 from Playwright's CDN |
| 10 | `playwright install-deps --dry-run chromium` | Fails until `apt-get update`; it lists Ubuntu 24.04 `t64` package names |
| 11 | Egress probe from this environment | Reachable: `googlechromelabs.github.io`, `storage.googleapis.com`, `registry.npmjs.org`, `github.com`. Unreachable: `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`, `registry-1.docker.io` |
| 12 | `codex sandbox -c sandbox_mode="workspace-write"`: Marp PDF / PNG | Fails: `EROFS … open '/home/vscode/tmp-…html'` (Marp's temp file in `$HOME`) |
| 13 | Same, notes | Works |
| 14 | Same, with `HOME=<writable dir>` or `MARP_USER=1`, with and without `CHROME_NO_SANDBOX=1` | Fails: Chrome `FATAL:content/browser/sandbox_host_linux.cc:41 Check failed: . shutdown: Operation not permitted` |
| 15 | Same, plus `-c sandbox_workspace_write.network_access=true` | Works with `HOME=<writable dir>` (Chrome sandbox on or off) and with `MARP_USER=1`; still `EROFS` with the default `HOME` |
| 16 | Network and `$HOME` probes inside `codex sandbox` | `curl` fails (exit 6); `mkdir ~/.cache/…` → read-only file system |
| 17 | `srt` (Claude Code's sandbox runtime; bubblewrap + seccomp Unix-socket filter, write only to the deck directory and `/tmp/claude`): Marp PDF | Fails: `EROFS` on the `$HOME` temp file (and `ENOENT` until `/tmp/claude`, its `TMPDIR`, existed) |
| 18 | Same with `MARP_USER=1`: PDF, PNG; and notes | All work, Chrome's own sandbox on |
| 19 | `srt` with `allowedDomains` = npm registry, `googlechromelabs.github.io`, `storage.googleapis.com`: `npx @puppeteer/browsers install chrome-headless-shell@stable` | Fails: `EAI_AGAIN` (the downloader ignores the proxy) |
| 20 | Same with `NODE_USE_ENV_PROXY=1` | Works (274 MB) |
| 21 | Exact version `chrome-headless-shell@155.0.8059.39`, `googlechromelabs.github.io` removed from the allowlist | Works: an exact build needs only `storage.googleapis.com` (plus npm for `npx`) |

Not tested: macOS anything; Copilot's sandbox (needs `slirp4netns`, `iptables`
and more on Linux); Docker (not installed, Docker Hub unreachable);
Playwright's browser download (CDN unreachable); Firefox with Marp; x86-64.

## Why each failure happens (from source)

### Marp CLI 4.5.1

- **Notes ask for a browser by accident.** `Converter.convert()` resolves a
  base URL for every non-HTML type, including notes. Unless `baseUrl` is set,
  it awaits `this.browser` to check whether the browser runs in a WSL host,
  and the finder throws before any conversion happens
  ([`src/converter.ts` @ v4.5.1](https://github.com/marp-team/marp-cli/blob/v4.5.1/src/converter.ts),
  `resolveBase`). Stdin input is not a `File`, so it skips the check too.
- **Temp files go to `$HOME` on Linux.** "Snapd Chromium cannot access from
  sandbox container to user-land `/tmp` directory so always create tmp file
  to home directory if in Linux. (Except an official docker image)"
  ([`src/utils/tmp.ts`](https://github.com/marp-team/marp-cli/blob/v4.5.1/src/utils/tmp.ts),
  from [marp-cli#201](https://github.com/marp-team/marp-cli/issues/201)). The
  exception is keyed on `MARP_USER`
  ([`src/utils/container.ts`](https://github.com/marp-team/marp-cli/blob/v4.5.1/src/utils/container.ts)).
- **`MARP_USER` has a side effect.** It also makes Marp treat the process as
  "inside a container", and the bundled launcher then adds `--no-sandbox` to
  Chrome (`puppeteerArgsEnableSandbox()` is false when `CHROME_NO_SANDBOX`
  is set, uid is 0, inside a container, or WSL; read in
  `lib/manager-*.js`). Pointing `HOME` at a writable directory avoids that
  but changes `HOME` for everything Marp starts.
- **Browser data directory** is under `os.tmpdir()`, which every sandbox here
  allows (read in `lib/manager-*.js`, `puppeteerDataDir`).
- **Finder:** `CHROME_PATH` or `--browser-path` wins on every platform. On
  Linux the automatic finder only looks for `google-chrome*`, `chromium*`
  and desktop files, so it never finds a downloaded `chrome-headless-shell`.
  On macOS it prefers Canary (see #484).
- **Docker image:** `marpteam/marp-cli` installs Chromium with
  `npx playwright install --with-deps chromium` and sets `MARP_USER`,
  `CHROME_PATH`, and `CHROME_CONFIG_HOME`
  ([Dockerfile @ v4.5.1](https://github.com/marp-team/marp-cli/blob/v4.5.1/Dockerfile)).
  Usage is on [Docker Hub](https://hub.docker.com/r/marpteam/marp-cli/).
- **Options** (`--browser`, `--browser-path`, `--browser-protocol`,
  `--browser-timeout`, `--notes`, `--pdf-notes`, `--pdf-outlines`) are in the
  [README](https://github.com/marp-team/marp-cli#readme).

### `@puppeteer/browsers` 3.2.4 and Chrome for Testing

- `install <browser>@<buildId|channel>`; `--path` defaults to the **current
  working directory**, not `~/.cache` (read in `lib/CLI.js`). Downloads come
  from `https://storage.googleapis.com/chrome-for-testing-public`. A channel
  such as `stable` is resolved through
  `https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json`
  (read in `lib/browser-data/chrome.js`; data from
  [Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/)).
- `--install-deps` reads the shell's `deb.deps` and runs `apt-get` ("only
  supported on Linux, requires root privileges"; `lib/install.js`).
- Proxy support needs the optional peer dependency `proxy-agent`. Plain
  `npx @puppeteer/browsers` does not install it, so the download ignores
  `HTTPS_PROXY` (`lib/httpUtil.js`, `package.json` `peerDependenciesMeta`).
  Node 24's `NODE_USE_ENV_PROXY=1` fixed this (experiment 20).
- `chrome-headless-shell` is the old headless mode as a separate binary,
  meant for automation and screenshots
  ([Chrome for Developers: headless](https://developer.chrome.com/docs/chromium/headless),
  [Puppeteer: headless modes](https://pptr.dev/guides/headless-modes)).
  linux-arm64 builds now exist (this environment got one).

### Playwright 1.64.0

- `npx playwright install [--only-shell] [--with-deps] chromium`.
  `--with-deps` installs system packages and needs root; `install-deps` keys
  its package list to the distribution
  ([Playwright: Browsers](https://playwright.dev/docs/browsers)).
- Its `chromium-headless-shell` is a Chrome for Testing build served from
  Playwright's own CDN (`cdn.playwright.dev`, with Microsoft fallbacks),
  pinned to the Playwright release (experiment 9 dry run). It is the same
  kind of binary as option 2, from a different host, at a version chosen by
  Playwright.
- Default location is `~/.cache/ms-playwright`; `PLAYWRIGHT_BROWSERS_PATH`
  moves it.

### Codex (source at `openai/codex@9b73858`)

- **Linux:** bubblewrap plus a seccomp filter. In `Restricted` network mode
  (network off) it denies `connect`, `accept`, `bind`, `listen`, `shutdown`,
  `sendto`, `getsockopt`, `setsockopt` and more, and allows only `AF_UNIX`
  sockets
  ([`linux-sandbox/src/landlock.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/linux-sandbox/src/landlock.rs)).
  Chrome's sandbox host calls `shutdown()` on a socket pair at startup, so it
  aborts (experiment 14).
- **macOS:** Seatbelt with `(deny default)`, a short `mach-lookup` list, and
  no `mach-register`
  ([`seatbelt_base_policy.sbpl`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/sandboxing/src/seatbelt_base_policy.sbpl),
  [`seatbelt_network_policy.sbpl`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/sandboxing/src/seatbelt_network_policy.sbpl)).
  [openai/codex#21292](https://github.com/openai/codex/issues/21292) (open)
  reports Playwright Chromium dying with
  `bootstrap_check_in org.chromium.Chromium.MachPortRendezvousServer.<pid>:
  Permission denied (1100)`, and working "with escalated permissions".
- **Ways out:** under the default `on-request` approval the model may ask to
  escalate a command out of the sandbox, which prompts the user. An allow
  `prefix_rule` makes a fully matched command bypass the sandbox
  (`bypass_sandbox` in
  [`core/src/exec_policy.rs`](https://github.com/openai/codex/blob/9b738582b13c2cdbeff54af0afd04c50c3e7ba09/codex-rs/core/src/exec_policy.rs)).
  `sandbox_workspace_write.network_access = true` lifts the seccomp network
  filter on Linux (experiment 15). See also #451's
  [`harness-shell-approvals.md`](https://github.com/ken-guru/skills/blob/research/harness-shell-approvals/skills/presentation/docs/research/harness-shell-approvals.md).
- `workspace-write` makes `$HOME` read-only (experiment 16), so both the
  Marp temp file and a default `~/.cache` browser install fail inside it.

### Claude Code

- The Bash sandbox is **off by default**. When on: writes to the working
  directory, a per-user temp directory (`$TMPDIR`), and added directories;
  network only through a local proxy that checks hosts against
  `allowedDomains`, which start empty; Seatbelt on macOS, bubblewrap and
  `socat` on Linux, plus an optional seccomp filter that blocks Unix sockets.
  A failed command may be retried unsandboxed (`dangerouslyDisableSandbox`)
  unless `allowUnsandboxedCommands` is false; `excludedCommands` runs matching
  commands outside the sandbox; `docker` "is incompatible with the sandbox"
  ([code.claude.com: sandboxing](https://code.claude.com/docs/en/sandboxing)).
- **macOS:** the Seatbelt profile in `sandbox-runtime` allows a fixed list of
  `mach-lookup` names plus user `allowMachLookup` entries, and has no
  `mach-register` rule (read in `dist/sandbox/macos-sandbox-utils.js`,
  0.0.79). [anthropics/claude-code#82660](https://github.com/anthropics/claude-code/issues/82660)
  (open) reports the same `MachPortRendezvousServer` failure, confirms
  `allowMachLookup` cannot help, and lists `excludedCommands` or
  `dangerouslyDisableSandbox` as the only workarounds.
- **Linux:** Chrome runs under bubblewrap plus the Unix-socket seccomp filter
  (experiment 18). `$HOME` is read-only, so Marp needs `MARP_USER` or a
  writable `HOME`.
- **Downloads** must use the proxy: tools that ignore `HTTPS_PROXY` fail
  (experiment 19). Claude Code on the web and cloud sessions have their own
  egress gateway, with open issues about headless Chromium traffic
  ([#85757](https://github.com/anthropics/claude-code/issues/85757),
  [#94640](https://github.com/anthropics/claude-code/issues/94640)). These
  affect a browser that loads remote URLs, not a local Marp render.

### Copilot CLI 1.0.85

- "Command Sandboxing (experimental)", **disabled by default**; available
  only with experimental features or a managed policy. It uses Microsoft
  Execution Containers: Seatbelt on macOS, bubblewrap plus a private network
  namespace on Linux (needs `bwrap` 0.5+, `slirp4netns`, `iptables`, and
  more). The starting policy allows the working directory, `PATH`
  directories, the temp directory, and "your user profile", **allows outbound
  network**, and offers a per-command bypass (`copilot help sandbox`;
  [GitHub Docs: cloud and local sandboxes](https://docs.github.com/en/copilot/concepts/about-cloud-and-local-sandboxes)).
- Unconfirmed: whether Copilot's macOS policy allows `mach-register`. The MXC
  helper found on this machine (`@microsoft/mxc-sdk` 0.6.0, shipped with VS
  Code Server, not Copilot) allows it only in a `guiAccess` mode.
- Without the sandbox, the main friction is the "Allow directory access"
  prompt for a browser or script outside the working directory (#451).

## Options compared

| | 1. Name an installed browser | 2. Pinned `chrome-headless-shell` (`@puppeteer/browsers`) | 3. Playwright browser install | 4. Docker `marpteam/marp-cli` |
|---|---|---|---|---|
| What the skill does | Finds stable Chrome/Edge/Chromium, passes `--browser-path` | Downloads an exact build once to a known directory, passes `CHROME_PATH` | `playwright install --only-shell chromium`, passes the path | `docker run … marpteam/marp-cli deck.md --pdf` |
| Download | None | 274 MB (linux-arm64), from `storage.googleapis.com` | Similar size, from `cdn.playwright.dev` | Image pull from Docker Hub or GHCR |
| Version control | None; follows the user's updates | Exact build | Tied to the Playwright version | Tied to the image tag |
| macOS | Usually present (`/Applications/Google Chrome.app`) | Works, no extra libraries (read, not measured) | Works (read) | Needs Docker Desktop |
| Linux libraries | Come with the distro package | Root install of ~39 packages, or `--install-deps` | `--with-deps`, root | Inside the image |
| Linux distro risk | Ubuntu's `chromium-browser` is a snap (Marp has snap special cases) | Generic `deb.deps`/`rpm.deps` list | Package list per distro; 26.04 not mapped | None |
| Claude Code sandbox | Linux: works with `MARP_USER`. macOS: needs unsandboxed run | Same; download needs allowed domains and a proxy-aware downloader | Same; also needs Playwright CDN allowed | Incompatible (docs); needs `excludedCommands` |
| Codex sandbox | Linux: needs network on or escalation. macOS: escalation | Same; download needs escalation (no network, read-only `$HOME`) | Same | Docker socket `connect` denied; escalation |
| Copilot CLI | Works (sandbox off by default) | Works | Works | Works if Docker is installed |
| Offline after setup | Yes | Yes | Yes | Yes |
| Cost to a skill | Least code, least deterministic | One script to provision, one to render | Pulls in Playwright for one binary | Requires Docker, heavy |

## Recommendation (for the map to decide)

**Leaning: option 2. A pinned `chrome-headless-shell`, provisioned once by an
explicit setup step and always passed by path, with option 1 as a fallback.
Treat "the render runs outside the harness sandbox" as a documented
requirement on macOS and on Codex, not something the skill can work around.**

Ranked:

1. **Pinned `chrome-headless-shell` via `npx @puppeteer/browsers install
   chrome-headless-shell@<exact version> --path <dir>`, then
   `CHROME_PATH=<dir>/…/chrome-headless-shell`.** It is the only option that
   makes the renderer the same in every harness and OS, gives repeatable
   slide images, and was proven end to end here. The exact build needs only
   one download host.
   Trade-offs:
   - 274 MB per machine, and a setup step that needs network. In Codex it
     needs escalation; in Claude Code's sandbox it needs the allowed domains
     and `NODE_USE_ENV_PROXY=1` (or `proxy-agent`).
   - On Linux, root to install the libraries (`--install-deps` or `apt`). A
     skill cannot do that silently; it must tell the user.
   - Someone must bump the pin.
   - The install directory must be writable at setup and readable at render
     time. A user-level cache (outside the project) avoids 274 MB in the repo
     but is read-only inside Codex and Claude Code sandboxes, so setup must
     run outside them.
2. **Name an installed stable browser explicitly** (the old suite's
   approach). No download, works on most Macs today, and fixes the Canary
   problem. But versions drift, so slide images can change between runs, and
   on Linux CI or minimal containers there is often nothing to find. Good as
   a fallback when the pinned shell is missing.
3. **Playwright install.** Same binary type as option 1 with a more polished
   `--with-deps`, but it adds Playwright for nothing else. Its CDN was blocked
   in this environment, and its Linux dependency map lags new distro
   releases. Worth it only if the skill set adopts Playwright anyway.
4. **Docker.** Fully reproducible and bundles fonts and libraries, so it is
   good for CI. It is a poor default for skills: macOS needs Docker Desktop,
   Claude Code documents Docker as incompatible with its sandbox, and Codex's
   sandbox blocks the socket.

Whatever is chosen, the render command should also:

- Pass the browser by path (`--browser-path` or `CHROME_PATH`), never rely on
  the finder.
- On Linux, set `MARP_USER` (or a writable `HOME`) for the Marp process, so
  the `$HOME` temp file does not break sandboxed runs. `MARP_USER` also turns
  off Chrome's own sandbox, which is acceptable for local decks with
  `--allow-local-files` but should be stated.
- Use `--base-url .` (or stdin) for `--notes`, so notes never need a browser.
- Be one stable command, so a user can allow it once: Claude Code
  `excludedCommands`, a Codex allow `prefix_rule` (which bypasses the
  sandbox), or Copilot's per-command bypass. This fits #481's open
  "one-command, literal-path command-shape rule".
- Detect the known sandbox signatures and say what to do, not just fail:
  `EROFS` on `~/tmp-*.html`; `sandbox_host_linux.cc … shutdown: Operation
  not permitted`; `bootstrap_check_in … MachPortRendezvousServer … (1100)`.

## Open questions surfaced

1. **Where does the pinned browser live?** In a per-user cache shared by all
   decks, or per project? This decides whether setup is once per machine and
   whether sandboxes can read it.
2. **Who installs Linux libraries?** A skill can print the `apt` line from
   `deb.deps`, but it cannot get root. Is "render on Linux requires a
   one-time admin step" acceptable?
3. **Should a skill rely on harness escalation for every render on macOS?**
   With Claude Code's or Codex's sandbox on, every PDF or PNG render needs an
   unsandboxed run. Does the skill tell the user to add an exclusion rule
   once?
4. **Fonts.** Rendering here used fonts already installed (DejaVu). A pinned
   browser does not pin fonts, so slide images may differ between machines.
   Should the theme bundle its fonts (also relevant to the open theming
   question)?
5. **Firefox as a second engine?** Marp supports it via WebDriver BiDi and it
   avoids Chromium's Mach registration, but its PDFs were not checked for
   tagging and it was not tested in any sandbox.
6. **Copilot's sandbox on macOS** was not tested; it may or may not allow
   `mach-register`.

## Method and limits

- Primary sources: Marp CLI 4.5.1 npm tarball (README, bundled `lib/`) and
  GitHub source at tag `v4.5.1`; `@puppeteer/browsers` 3.2.4 package source;
  Playwright 1.64.0 CLI output and docs; Codex source at `9b73858` and its
  issue tracker; `@anthropic-ai/sandbox-runtime` 0.0.79 package source and
  README; code.claude.com sandboxing docs; Claude Code issue tracker; Copilot
  CLI 1.0.85 `copilot help sandbox`.
- Measured on Linux arm64 only. The Codex Linux sandbox was exercised with
  the real `codex sandbox` command. Claude Code's Linux sandbox was
  exercised with its standalone runtime (`srt`), not through a Claude Code
  session; the settings mirrored Claude Code's defaults (write to the working
  directory and its temp directory, empty or explicit domain allowlist).
- macOS findings come from source and issue reports, not from runs.
- This environment has its own egress allowlist, which is why Playwright's
  CDN and Docker Hub were unreachable. That is a property of this
  environment, not of those tools, but it shows that a download host is part
  of the choice.
