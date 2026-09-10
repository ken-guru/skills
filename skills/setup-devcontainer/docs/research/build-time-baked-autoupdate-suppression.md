# Would baking `DISABLE_AUTOUPDATER` into the Docker image at build time close the gap that defeated three runtime mechanisms? — research input

Serves [issue #233](https://github.com/ken-guru/skills/issues/233), a wayfinder follow-up to the
decided-against [issue #222](https://github.com/ken-guru/skills/issues/222) ("Claude Code
version-pinning feature", closed after three runtime mechanisms each failed to hold in live
testing; reverted in commit `59030dd`, see `skills/setup-devcontainer/docs/adding-tool-later.md`
history and PR [#225](https://github.com/ken-guru/skills/pull/225)).

**This document is research legwork, not a decision.** It gathers primary-source facts and
reasons from them about one specific untried lever (build-time baking). It does not propose
re-opening #222, does not change `setup-devcontainer`'s behavior on its own, and does not
recommend for or against reviving Claude Code version pinning — that call belongs to a future
session or maintainer with this document in hand.

Research date: 2026-09-10. All URLs below were fetched live on that date via `WebFetch` and
`gh` (both `ken-guru/skills` and the public `anthropics/claude-code` repository, unauthenticated
— read access to public issues worked without a token). Vendor docs are living pages and vendor
issue trackers are living data; both can change or be reinterpreted without notice. Treat every
GitHub issue number and doc quote below as a snapshot, not a permanent fact.

---

## Verdict, up front

**The evidence does not support a confident call either way, but leans against "build-time
baking closes the gap" for the exact mechanism already tried (rewriting the same
`DISABLE_AUTOUPDATER=1` into `managed-settings.json`, just earlier).** Ticket #222's own
account establishes that mechanism 3's managed-settings write was already present, unmodified,
and un-clobbered at the moment of the failing re-test — and Anthropic's current docs (§1, §2
below) describe file-based managed settings as read at every startup and reloaded on change,
which is consistent with "the write already held by the time baking-into-the-image could have
mattered." That points at a failure *downstream* of settings-read — inside Claude Code's own
update-check/apply logic — which is a genuinely-recurring, unresolved bug class reported
repeatedly against `anthropics/claude-code` across many versions and months, specifically for
native installs (§1). Nothing found suggests that class of bug is sensitive to *when in the
container lifecycle* the setting was written, only to *whether Claude Code's updater consults
it at all* under some as-yet-undocumented condition.

Anthropic does not document the exact defect, so this is inference from a pattern of external
reports, not a confirmed root cause — **treat the lean above as informed, not proven.** Given
that, the concrete empirical test in §3 is the actual recommendation, not a fallback: it is
cheap, and it should specifically try the newer `DISABLE_UPDATES` environment variable
(documented as strictly stronger than `DISABLE_AUTOUPDATER`, and never tried in any of #222's
three mechanisms) rather than only re-testing the same setting earlier in the build.

---

## 1. When does Claude Code's own auto-updater check for and apply updates?

This is **documented** by Anthropic, and the current documentation is more specific than what
was available when #222's mechanisms were built (compare commit `c0c8a21`'s citation of the same
page, which quoted only the `DISABLE_AUTOUPDATER` snippet, not the timing sentence below).

- Timing, quoted verbatim from <https://code.claude.com/docs/en/setup> (fetched live
  2026-09-10, "Auto-updates" section):

  > "Claude Code checks for updates on startup and periodically while running. Updates download
  > and install in the background, then take effect the next time you start Claude Code."

  This directly answers the "once per session vs. continuously" question: **both** — a
  startup-time check, plus a periodic check for the lifetime of a running process. A download
  and install can happen mid-session in the background; it only takes visible effect on the
  *next* process start (`claude --version` inside an already-running session would still show
  the old version until relaunch).

- Same page, on what `DISABLE_AUTOUPDATER` actually stops:

  > "`DISABLE_AUTOUPDATER` only stops the background check; `claude update` and `claude
  > install` still work. To block all update paths, including manual updates, set
  > `DISABLE_UPDATES` instead. Use this when you distribute Claude Code through your own
  > channels and need users to stay on the version you provide."

  This is a **new documented control** (`DISABLE_UPDATES`) that did not exist as documented
  guidance when #222's mechanisms 1–3 were built — none of the three tried it. Its own tracking
  issue in `anthropics/claude-code`, [#52192](https://github.com/anthropics/claude-code/issues/52192)
  ("[DOCS] Update docs missing `DISABLE_UPDATES` env var behavior", closed), quotes the
  changelog entry that introduced it: *"Added `DISABLE_UPDATES` env var to completely block all
  update paths including manual `claude update` — stricter than `DISABLE_AUTOUPDATER`"*, added
  in v2.1.118. Docs have since caught up (the setup.md quote above); at the time #52192 was
  filed they had not.

- Whether managed-settings.json (the file mechanism 3 wrote to) is re-read continuously or only
  at process launch — from <https://code.claude.com/docs/en/managed-settings> (fetched live,
  "Choose a delivery mechanism" table):

  > "File-based | As `managed-settings.json` in a system directory on each machine... | **Read
  > at startup and reloaded when a file changes** | Machines without MDM, Linux hosts, or images
  > you build yourself"

  So the documented behavior is: read at every startup, *and* watched for changes while
  running (unlike, say, `requiredMinimumVersion`, which the same docs call out as one of a
  short list of keys that "take effect at the next session start" specifically — implying most
  keys, including this one by omission, apply live). This matters for §2: it means the
  documented behavior already predicts the managed-settings write should have been visible to
  Claude Code well before the failing re-test's next start, regardless of exactly when in the
  container lifecycle it was written — the write in mechanism 3 finished during
  `postCreateCommand`, which necessarily completes before a developer's first `claude`
  invocation in that container.

- **Independent, primary-source corroboration that Anthropic's own docs and the CLI's actual
  behavior have repeatedly diverged on this exact topic**, from `anthropics/claude-code` issues
  (all fetched live via `gh issue view --repo anthropics/claude-code`):

  - [#10079](https://github.com/anthropics/claude-code/issues/10079) (closed): "DISABLE_AUTOUPDATER
    env documentation refers to undocumented or non-existent setting" — flags that the settings
    reference and the actual implementation didn't match at the time.
  - [#11263](https://github.com/anthropics/claude-code/issues/11263) (closed): "[BUG] Ignores
    disabling auto updates" — reporter set `DISABLE_AUTOUPDATER: 1` and `"autoUpdates": false`
    in `settings.json` and `claude doctor` still showed `Auto-updates: default (true)`. A
    maintainer's reply attributes it to a non-default `CLAUDE_CONFIG_DIR` path
    (`~/.config/claude/settings.json` instead of `~/.claude/settings.json`) — i.e. in that
    specific case the setting wasn't being read from the file Claude Code actually consults, a
    different failure mode than #222's (which used the default path).
  - [#13213](https://github.com/anthropics/claude-code/issues/13213) (closed, labeled `stale`):
    "`autoUpdaterStatus: "disabled"` setting is ignored — CLI auto-updates anyway" — a
    reproduction with exact before/after versions (`2.0.59` → `2.0.60`) despite the setting
    being present. A comment on it notes `autoUpdaterStatus` isn't even a real key
    (`https://www.schemastore.org/claude-code-settings.json`), suggesting confusion in the
    community about which key name is authoritative — itself evidence of documentation churn.
  - [#56723](https://github.com/anthropics/claude-code/issues/56723) (closed, `duplicate`):
    "Docs: clarify or restore documented way to disable auto-updates" — as of that filing, "The
    settings reference at https://code.claude.com/docs/en/settings does not document any
    top-level key to disable auto-updates," referencing prior unresolved issues #10079 and
    #12564.
  - [#12564](https://github.com/anthropics/claude-code/issues/12564) (closed as duplicate of
    #10079): reports the same `docs/en/setup#auto-updates` vs. actual-implementation mismatch.
  - **Most directly relevant — native-install-specific, and matching #222's own install method
    (`curl -fsSL https://claude.ai/install.sh | bash`, the exact "Native Install (Recommended)"
    path documented at `/docs/en/setup`):**
    - A comment on #13213 from `aria-inboxia` reports `autoUpdatesProtectedForNative: true` in
      `~/.claude.json` on native installs, which "overrides `autoUpdates: false`" — i.e. native
      installs carry a separate, undocumented protection flag that specifically defeats the
      `autoUpdates` disable path. The same comment reports a working alternative discovered via
      [#52192](https://github.com/anthropics/claude-code/issues/52192): setting `DISABLE_UPDATES=1`
      in the `env` block "actually stops the auto-updater," calling the older
      `DISABLE_AUTOUPDATER=1` "strictly weaker."
    - [#88030](https://github.com/anthropics/claude-code/issues/88030) (closed): "`autoUpdates:
      false` is not honoured on native installs — version pin silently reverted" (platform:linux,
      platform:wsl — the closest match to this devcontainer's Ubuntu base image among all issues
      found). A bot-labeled reply (`author: claude`, `association: contributor`) states: "On a
      native install the `autoUpdates` field in `~/.claude.json` isn't a user setting — the
      installer writes it... for its own bookkeeping, so editing it has no effect on native
      builds. The supported switch is `DISABLE_AUTOUPDATER=1`... `DISABLE_UPDATES=1`
      additionally blocks manual `claude update`." This reply is useful as a restatement of
      current documented guidance, but it is an automated/bot response on a public issue, not an
      Anthropic staff statement, and it does not explain why mechanism 3's `DISABLE_AUTOUPDATER=1`
      (correctly placed, per this same guidance) still failed in #222's re-test.
    - [#91646](https://github.com/anthropics/claude-code/issues/91646) (**open**, filed
      2026-09-02, eight days before this research date): "`autoUpdates: false` in
      `~/.claude.json` is ignored on native installs; updated twice in two days, once mid-session"
      — a live, unresolved report of the same class of bug, in the same window of time as #222's
      own testing (per this repo's git log, #222's mechanisms were built and reverted on
      2026-09-09, the day before #91646 was filed).

**Conclusion for §1**: Anthropic *does* now document the check timing precisely ("on startup
and periodically while running") and *does* document that `DISABLE_AUTOUPDATER` is weaker than
`DISABLE_UPDATES`. What is **not** documented anywhere found is why a correctly-placed
`DISABLE_AUTOUPDATER=1` in `managed-settings.json` — verified present and unmodified — still
failed to prevent an update in #222's own live re-test. The closest documented explanation for
*a* class of native-install auto-update-ignoring bug (`autoUpdatesProtectedForNative`,
surfaced only in community bug reports, never in official docs) concerns a different setting
(`autoUpdates` in `~/.claude.json`) than the one #222 used (`DISABLE_AUTOUPDATER` in `env`), so
it doesn't transfer cleanly as a root-cause explanation — but its existence, plus #91646 being
open and unresolved as of eight days before this research, establishes that "documented
disable-setting doesn't reliably hold on native installs" is a real, recurring, still-current
bug class at Anthropic, not a one-off #222 fluke.

## 2. Would build-time baking plausibly close the gap?

Reasoning from §1's findings, against the specific claim in #222/PR #225's account that needs
addressing: mechanism 3's write to `managed-settings.json` **did** survive a simulated
onboarding clobber and **was** present, unmodified, at the time of the failing re-test (per
commit `4aebdb5`'s message: *"an unprivileged write to `/etc/claude-code/managed-settings.json`
is rejected outright... a simulated onboarding clobber of the user settings file leaves the
managed file untouched"*; per commit `59030dd`'s revert message: *"pinned to 2.1.265, Claude
Code silently installed 2.1.266 on startup anyway"* — i.e. the setting was there, correctly
placed, at the moment of the very next startup that produced the failure).

Two points follow from that:

1. **"The setting being present and unmodified" was already true in mechanism 3, at the moment
   of failure.** Baking the identical key/value into the Docker image at build time — i.e.
   present even earlier, before `postCreateCommand` ever runs — does not change *that* fact; it
   was already true. The only thing build-time baking could change is *when in the container's
   lifecycle* the file first exists. Per §1's docs quote, file-based managed settings are "read
   at startup and reloaded when a file changes" — i.e. Claude Code is documented to notice the
   file whenever it exists, not only if it existed since image build. Nothing in the docs
   describes a "must have existed since build time" precondition for managed settings to apply
   — no caching keyed to image layers, no build-time snapshot behavior is mentioned anywhere in
   the managed-settings or setup pages fetched for this research.

2. **The observed failure mode (update applied despite an unmodified, correctly-placed disable
   setting) matches a bug class reported against Claude Code's own update-check/apply code
   path, not against managed-settings delivery.** #91646 and the `autoUpdatesProtectedForNative`
   reports in §1 describe the auto-updater proceeding as if the disable setting weren't
   consulted at all, on native installs specifically — which is exactly #222's install method.
   If the actual defect is (for example) a background update-check process that reads its
   "should I update" flag once at its own spawn time rather than per-check, or an update-apply
   code path that doesn't consult `managed-settings.json` under some condition distinct from
   ordinary settings reads, then **no amount of writing the file earlier changes that** — the
   file was already being read (per the "present and unmodified" finding), and still didn't
   prevent the update. This is speculative reasoning about an internal code path Anthropic
   hasn't documented, offered as the most parsimonious explanation consistent with the evidence
   in §1, not a confirmed mechanism.

**Where build-time baking could plausibly help, but for a different reason than "timing":**
none of #222's three mechanisms tried `DISABLE_UPDATES` (documented in §1 as strictly stronger,
blocking "all update paths" rather than only "the background check"). If mechanism 3's failure
is specifically because `DISABLE_AUTOUPDATER` is the weaker of the two controls and doesn't
gate whatever code path actually triggered the 2.1.265→2.1.266 update, then baking
`DISABLE_UPDATES=1` (build-time or runtime, the axis doesn't matter by the reasoning in point 1
above) is a genuinely untried lever with a plausible documented basis for working where
`DISABLE_AUTOUPDATER` didn't. This is a **different variable to test**, not evidence that
*build-time-ness* itself is the fix.

**Conclusion for §2**: No evidence found supports "build-time baking, by virtue of being
earlier in the container lifecycle, closes the gap." The one documented lever that #222 never
tried (`DISABLE_UPDATES` instead of `DISABLE_AUTOUPDATER`) is worth testing, but that is
orthogonal to *when* it's written — it could be tested by editing mechanism 3's existing
`post-create-block.sh` write target without touching the Dockerfile at all. If a session wants
to test build-time baking specifically as a hypothesis about timing, §3 gives the concrete way
to find out empirically, since documentation doesn't settle it.

## 3. Recommended empirical test (since documentation doesn't settle it)

Anthropic's docs do not document the exact reason mechanism 3 failed, and no `anthropics/claude-code`
issue found in this research reproduces #222's precise combination (managed-settings.json,
`DISABLE_AUTOUPDATER`, native install, pinned via `-s <version>` at install time) closely enough
to serve as a confirmed root cause. Treat §2's reasoning as a lean, not a settled answer, and
resolve it empirically before relying on it. This test isolates the one variable this research
can't settle from documentation alone: whether *build-time presence* of the disable setting
changes the outcome versus *post-create-time presence* (which #222 already tried and which
failed).

**Setup** — build two variants of the same test image, differing only in *when* the disable
setting is written, holding the value constant:

- **Variant A (replicates #222's mechanism 3, as a control)**: `managed-settings.json` written
  by `postCreateCommand`, exactly as commit `4aebdb5` did — i.e. do not change the existing
  template, just rebuild and retest it once to confirm the control still reproduces the original
  failure (version drift) before trusting any comparison against Variant B.
- **Variant B (the new hypothesis)**: add a `RUN` step to the Dockerfile itself, before any
  `postCreateCommand`/`postStartCommand` ever executes, that creates
  `/etc/claude-code/managed-settings.json` with `{"env": {"DISABLE_AUTOUPDATER": "1"}}` baked
  into the image layer. Install Claude Code pinned to a specific version (e.g. `curl -fsSL
  https://claude.ai/install.sh | bash -s <version>`) in that same `RUN` step or a subsequent
  one, so the pinned binary and the managed-settings file both exist before the container is
  ever started.
- **Variant C (tests the untried lever from §1/§2, independently of timing)**: same as Variant A
  (write via `postCreateCommand`, not build time) but write `{"env": {"DISABLE_UPDATES": "1"}}`
  instead of `DISABLE_AUTOUPDATER`. This isolates "does the stronger documented control work at
  all" from "does build-time timing matter" — run it whether or not B is run, since it tests a
  different axis.

**What to run and observe, per variant:**

1. Start the container. Immediately run `claude --version` and `claude doctor` and record the
   exact version string and the `Auto-updates:` / `Last update attempt:` lines `claude doctor`
   reports (this repo's own local `claude doctor` output, captured during this research,
   confirms the command exists and reports exactly these fields — see the note at the end of
   this section).
2. Confirm the managed-settings file is present, at the expected path, with the expected
   content, at this point — `cat /etc/claude-code/managed-settings.json`. (This was already
   verified live for mechanism 3, per commit `4aebdb5`'s message — re-confirm for the new
   variant rather than assuming.)
3. Leave the container running and idle for a window long enough to plausibly cross the
   documented "periodically while running" background check interval — the docs quoted in §1
   don't state the interval, so err generous (e.g. 30–60 minutes; note the exact wait chosen,
   since it's a parameter of the test, not a documented constant).
4. During the wait, poll for a background update-related process: `ps aux | grep -i claude` (or
   equivalent) at intervals, to see whether a spawned update-checker process exists and when it
   appears — this directly tests the "spawned background process independent of the foreground
   session" possibility raised as an open question in this research (no evidence either way was
   found in Anthropic's docs or the issues surveyed).
5. After the wait, without touching the container from inside: check whether
   `~/.local/share/claude/versions/` (per the `/docs/en/setup` quote in §1, this is where the
   native installer places versions and where an update download+install lands) contains any
   version newer than the pinned one. This is the same detection method used by `aria-inboxia`'s
   comment on #13213 (parsing installed versions) and matches this repo's own working method
   (comparing `claude --version` before/after, per commit `59030dd`'s message).
6. Restart the container (simulating "next start," which per §1's docs quote is when a
   background-downloaded update "takes effect"). Run `claude --version` and `claude doctor`
   again and compare to step 1.

**What would confirm vs. refute each hypothesis:**

- **If Variant A (control) does *not* reproduce drift this time**: either the original failure
  was version-specific/transient (Claude Code ships very frequently — see the many
  version-specific bug reports in §1, several already superseded by later releases), or the
  original test had an uncontrolled variable. Either way, don't trust a comparison against B
  without first re-confirming A fails under current conditions.
- **If A fails (drifts) and B does not**: build-time baking plausibly does close the gap for
  reasons not evident from documentation — worth investigating *why* (e.g. compare `claude
  doctor`'s reported install/config paths between the two variants; the difference may reveal
  what actually changed).
- **If A and B both fail identically**: confirms this research's lean in §2 — the failure is
  independent of write timing, and `DISABLE_AUTOUPDATER` (regardless of when it's set) doesn't
  reliably hold on this install path. Move to relying on Variant C's result instead.
- **If C (untried `DISABLE_UPDATES`) succeeds where A/B fail**: this is the strongest actionable
  outcome — it would mean the fix all along was the stronger, more-recently-documented
  variable, not the timing of the write, matching the `aria-inboxia` comment on #13213 that
  reported it as a "working fix" in a similar native-install context.
- **If all three fail**: matches the still-open, unresolved #91646 pattern (§1) closely enough
  to conclude Claude Code's native-install auto-updater cannot currently be reliably suppressed
  by any documented setting from inside this skill's control, regardless of mechanism or
  timing — which would be a stronger, better-evidenced version of #222's original "decided
  against" conclusion, worth feeding back into #222/#214 if a future session does this test.

**Note on this session's own local environment**: this machine (Ken's, not a devcontainer) has
`claude` installed natively at `/Users/ken/.local/bin/claude`. Running `claude doctor` here
during this research produced:

```
Running: native (2.1.267)
...
Auto-updates: enabled
Auto-update channel: latest
Last update attempt: success → 2.1.267 (2026-09-09)
Managed settings (remote): not fetched — requires an Enterprise or Team subscription
Organization policy: not applicable to Pro and Max accounts
```

This confirms `claude doctor`'s output format (useful for step 1/6 above) and that this
installation auto-updates by default with no managed settings in play. It is **not**
representative of the devcontainer's install method or account type: this is a macOS install
under a Pro/Max personal account, not the devcontainer's Linux/Ubuntu native install, and the
devcontainer's approach (`managed-settings.json`, a file-based mechanism) is explicitly
different from the "Managed settings (remote)" line shown here, which refers to
server-fetched settings requiring an Enterprise/Team subscription — a third mechanism not used
by #222 at all. Any future build-and-test pass needs to run inside an actual container, not
infer from this local install.

---

## Open questions / things a future session should still decide

- **The exact root cause of mechanism 3's failure remains undocumented by Anthropic and
  unconfirmed by this research.** §2's reasoning (that the failure is downstream of
  settings-read, in update-check/apply logic, and therefore timing-insensitive) is the most
  parsimonious explanation consistent with the evidence gathered, not a proven mechanism. Only
  the empirical test in §3 can confirm or refute it.
- **Whether `DISABLE_UPDATES` (untried by #222, documented as stronger) actually holds on a
  native install inside a devcontainer is unverified.** This is arguably the single highest-value
  thing a future session could test — independent of the build-time-vs-runtime question this
  document was asked to research — since #222 never tried it and at least one community report
  (on #13213) describes it working where `DISABLE_AUTOUPDATER` didn't, in a similarly
  native-install context.
- **Whether `autoUpdatesProtectedForNative` (found only in community bug reports on `autoUpdates`
  in `~/.claude.json`, never in official docs) has any analog affecting `DISABLE_AUTOUPDATER`/
  `DISABLE_UPDATES` in the `env` block is unknown.** These are different settings keys
  (`autoUpdates` top-level vs. `env.DISABLE_AUTOUPDATER`/`env.DISABLE_UPDATES`) and nothing found
  in this research confirms or rules out whether native installs treat them the same way.
- **The exact background-check interval ("periodically while running," per §1) is not
  documented anywhere found.** A future empirical test (§3, step 3) has to choose an arbitrary
  wait window without a documented interval to target, which weakens confidence in a "no drift
  observed" result if the window chosen happens to be shorter than the real interval.
- **Whether Claude Code's update check runs as a distinct spawned background process, or inline
  within the same process on a timer, is not documented and wasn't independently confirmed by
  inspecting a running installation in this research** (no devcontainer was built or run as
  part of this research — this was documentation- and issue-tracker-only research, per the
  task's own instructions). §3, step 4's `ps`-polling approach is the concrete way to find out.
- **This research only found `anthropics/claude-code` issues reachable via unauthenticated `gh`
  read access.** It's possible more targeted or more recent issues/discussions exist that a
  logged-in search, or Anthropic's internal tracker, would surface and that this research
  missed — especially given how frequently this specific topic (`DISABLE_AUTOUPDATER` not
  holding) recurs across the issue numbers found (#10079, #11263, #12564, #13213, #24396,
  #56723, #60956, #67476, #88030, #91646 — a non-exhaustive list assembled from targeted
  searches, not a systematic audit of the whole repository).
- **Whether reviving Claude Code pinning is worth doing at all — even if `DISABLE_UPDATES` or
  build-time baking is empirically confirmed to work — is outside this document's scope.**
  #222 was closed as "decided against," and this document does not reopen that decision; it
  only supplies facts for whoever next considers it.
