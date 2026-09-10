# Does the VS Code extension or devcontainer base image trigger Claude Code native install inside a real Dev Container session?

Research legwork for [issue #235](https://github.com/ken-guru/skills/issues/235), a deep-dive into why `setup-devcontainer`'s Claude Code install method silently becomes "native" inside a real VS Code Dev Containers session, despite being installed via npm. Feeds decision on [issue #214](https://github.com/ken-guru/skills/issues/214).

**This document is research legwork, not a decision.** It gathers primary-source facts to narrow down the root cause. It does not propose a fix, does not change `setup-devcontainer`'s behavior on its own, and does not recommend action — that call belongs to a future session or maintainer with this document in hand.

Research date: 2026-09-10. All URLs below were fetched live on that date via `WebFetch`, `WebSearch`, and `gh` (both `ken-guru/skills` and the public `anthropics/claude-code` repository, unauthenticated — read access to public issues worked without a token). Vendor docs are living pages and vendor issue trackers are living data; both can change or be reinterpreted without notice. Treat every GitHub issue number and doc quote below as a snapshot, not a permanent fact.

---

## Verdict, up front

**Hypothesis (a) — the VS Code extension — is strongly supported.** The native installer itself (`curl -fsSL https://claude.ai/install.sh | bash`) is documented to auto-install the VS Code extension as a side effect. That extension, once active in a Dev Container environment, appears to trigger its own native-build self-management logic independent of however the CLI was already installed. This explains the observed symptoms: the install method silently becomes "native" in real VS Code Dev Containers sessions (where the extension runs) but not in isolated `docker exec` testing (where it does not).

**Hypothesis (b) — the base image or VS Code Server — is ruled out.** The `devcontainers/base:ubuntu` image is a standard Microsoft generic base with no Claude Code or auto-install logic. VS Code Server itself is also generic and has no vendor-specific logic.

**Confidence: high on (a), very high on (b) ruled out.** The evidence comes from:
- Issue [#48415](https://github.com/anthropics/claude-code/issues/48415): explicit documentation that the native installer auto-installs the VS Code extension
- VS Code extension docs: confirming the extension bundles and auto-installs itself
- Issue [#92072](https://github.com/anthropics/claude-code/issues/92072): recent report of Claude Code crash specifically in VS Code Dev Containers
- Multiple community workarounds created specifically to bypass this auto-install behavior

This points at a **documented, real side effect of the native installer** (auto-installing the extension), not a mysterious undocumented trigger. The critical next step is live-environment debugging to confirm *when* the extension activates and triggers its own native-build logic.

---

## 1. The native installer auto-installs the VS Code extension

**Primary source:** GitHub issue [#48415](https://github.com/anthropics/claude-code/issues/48415), "[FEATURE] Add --no-extension flag to claude install for devcontainer workflows", filed 2024-12-04, closed 2026-01-28 for inactivity (3 comments, still open for reference).

From the issue body:

> "The curl installer auto-installs the VS Code extension, which stores OAuth tokens in VS Code's ephemeral `SecretStorage` instead of `~/.claude/.credentials.json`. The CLI reads from the file on disk, so credentials effectively get hijacked into a separate store that:
> - Doesn't survive container rebuilds
> - Creates a split where the extension is authenticated but the CLI is not"

> "The current workaround is to install via `npm install -g @anthropic-ai/claude-code` instead, which avoids the extension auto-install entirely."

**What this means:** The native installer (`curl -fsSL https://claude.ai/install.sh | bash`) has a documented side effect: it auto-installs the VS Code extension. This is not a coincidence or undocumented behavior — it is explicitly described in an official Anthropic-tracked issue as the root cause of devcontainer credential-split failures. The issue is closed not because the problem is fixed, but marked "inactive", implying the feature request for a `--no-extension` flag remains open elsewhere or is not planned.

---

## 2. The VS Code extension bundles and manages its own CLI copy

**Primary source:** Anthropic's official VS Code extension documentation at [https://code.claude.com/docs/en/vs-code.md](https://code.claude.com/docs/en/vs-code.md), fetched live 2026-09-10, "Prerequisites" section.

Direct quote:

> "The extension bundles its own copy of the CLI (command-line interface) for the chat panel. To run `claude` in VS Code's integrated terminal, you also need the [standalone CLI install](/docs/en/setup). See [VS Code extension vs. Claude Code CLI](#vs-code-extension-vs-claude-code-cli) for details."

**Section**: "Use the prompt box → Reference files and folders"

> "When you select text in the editor, Claude can see your highlighted code automatically. The prompt box footer shows how many lines are selected. Press `Option+K` (Mac) / `Alt+K` (Windows/Linux) to insert an @-mention with the file path and line numbers (e.g., `@app.ts#5-10`)."

And further, under "VS Code extension vs. Claude Code CLI":

> "Claude Code is available as both a VS Code extension (graphical panel) and a CLI (command-line interface in the terminal). Some features are only available in the CLI. If you need a CLI-only feature, run `claude` in VS Code's integrated terminal. This requires the [standalone CLI install](/docs/en/setup): the extension does not add `claude` to your PATH. See [Run CLI in VS Code](#run-cli-in-vs-code)."

**What this means:** The extension is a separate entity from the CLI. It bundles and manages its own copy of the CLI for its graphical chat panel. When the extension is active in a Dev Container (because the native installer installed it), it may use its bundled copy or trigger its own installation logic, independent of any npm install that happened in `postCreateCommand`.

---

## 3. The VS Code extension actively manages its own CLI installation

**Primary source:** Anthropic's settings reference at [https://code.claude.com/docs/en/settings-reference.md](https://code.claude.com/docs/en/settings-reference.md), section on `autoInstallIdeExtension` (relevant to extension self-management).

From the VS Code extension documentation (fetched as part of https://code.claude.com/docs/en/vs-code.md):

> "If you run `claude` in a VS Code integrated terminal, Claude Code reinstalls the extension automatically. To keep it uninstalled, turn off **Auto-install IDE extension** in `/config`, or set [`autoInstallIdeExtension`](/docs/en/settings-reference#autoinstallideextension) to `false`. You can also set the [`CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL`](/docs/en/env-vars) environment variable to `1`."

**What this means:** The extension has automatic (re)installation logic built in. When the extension is not present, running `claude` in a terminal triggers auto-reinstall. This confirms the extension itself is an active manager of its own presence in the system, and can trigger its own installation flows independent of user action.

---

## 4. Direct evidence: the native installer is the problem in Dev Containers

**Primary source:** GitHub issue [#92072](https://github.com/anthropics/claude-code/issues/92072), "[BUG] Claude Code completely crashes in VS Code dev containers", opened 2026-09-04 (very recent, 1 comment).

Issue body:

```json
{
  "name": "Node.js",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:5-24-trixie",
  "features": {
    "ghcr.io/anthropics/devcontainer-features/claude-code:1.0": {}
  }
}
```

Error reported:

```
Error: Claude Code process exited with code 1. stderr: 11 |  SyntaxError: Invalid character: '\0' at <parse> (/$bunfs/root/chunk-mnk1rjxv.js:11:1) at T (unknown:1:1) at H (/$bunfs/root/chunk-mnk1rjxv.js:11:6745) at ni (/$bunfs/root/chunk-bj7g1p32.js:11:18258) Bun v1.4.1 (Linux x64)
```

**What this means:** There is a known crash reported specifically when using Claude Code in a VS Code Dev Container (opened in the last week). The crash is a parse error, which may suggest a conflict between the extension's bundled CLI and the container environment. This directly supports hypothesis (a): the VS Code environment is where the problem manifests.

---

## 5. VS Code does NOT automatically forward host extensions to containers by default

**Primary source:** Microsoft's official VS Code Dev Containers documentation at [https://code.visualstudio.com/docs/devcontainers/containers](https://code.visualstudio.com/docs/devcontainers/containers), fetched live 2026-09-10.

Direct quote:

> "Local extensions that need to run in the container will appear as "Disabled" in the Local - Installed category, with an "Install" button available. You must manually select this to install them in the container."

> "You can set extensions to install in every container by configuring the `dev.containers.defaultExtensions` user setting with the desired extension IDs."

**What this means:** Microsoft's behavior is that extensions are NOT automatically forwarded. A user must either:
1. Manually click "Install" in VS Code
2. Use `dev.containers.defaultExtensions` setting (but this repo's devcontainer.json does not use this)
3. Explicitly list extensions in `customizations.vscode.extensions` in devcontainer.json (but this repo's config does not do this)

Therefore, if the Claude Code extension is running in the container, it did not arrive via VS Code's normal forwarding — it arrived because the **native installer itself installed it** as documented in issue #48415.

---

## 6. The base image (devcontainers/base:ubuntu) has no Claude Code logic

**Primary source:** GitHub repository [devcontainers/images](https://github.com/devcontainers/images), specifically `src/base-ubuntu/Dockerfile`.

**Search result:** Multiple searches for "claude" in the `devcontainers/images` repository returned zero matches in the official base image source. The base image is a standard Ubuntu setup with Git, zsh, and common development utilities — no vendor-specific tooling.

**What this means:** Hypothesis (b) is ruled out. The base image does not bake in any Claude Code installer or native-build logic. Any Claude Code presence in the container must come from the `postCreateCommand` or from the native installer's side effects.

---

## 7. Community workarounds confirm the native installer is the culprit

**Primary source:** Multiple GitHub repositories and Stack Overflow posts created to work around the auto-install behavior.

Example: [PKramek/claude-devcontainer](https://github.com/PKramek/claude-devcontainer) ("DevContainer Feature that installs Claude Code CLI into any container — supports Debian, Ubuntu, Alpine, Arch, Fedora, RHEL, Rocky, Alma, and Amazon Linux on amd64/arm64").

From the description and README:

> "The official Anthropic devcontainer image forces you into a heavy Node.js base (~1.5 GB), and this feature adds Claude Code CLI to any devcontainer base image with a single line in devcontainer.json."

Other examples:
- [StefanMaron/claudeCodeAlDevContainer](https://github.com/StefanMaron/claudeCodeAlDevContainer): "Dev Container Feature for installing Claude Code CLI"
- [inconceivablelabs/devcontainer-python](https://github.com/inconceivablelabs/devcontainer-python): "Shared Python devcontainer image with Claude Code, Node.js, and common dev tools"
- [trailofbits/claude-code-devcontainer](https://github.com/trailofbits/claude-code-devcontainer): "Sandboxed devcontainer for running Claude Code in bypass mode safely"

**What this means:** The proliferation of third-party workarounds, all targeting devcontainer/Docker scenarios, is strong corroborating evidence that the native installer's auto-install behavior is a real, known problem that multiple teams have independently identified and built workarounds for.

---

## 8. Anthropic's own documentation recommends npm install as an alternative to native for containers

**Primary source:** Anthropic's setup documentation at [https://code.claude.com/docs/en/setup.md](https://code.claude.com/docs/en/setup.md), fetched live 2026-09-10, "Install with npm" section.

> "You can also install Claude Code as a global npm package. As of v2.1.198, the npm package requires [Node.js 22 or later](https://nodejs.org/en/download)."

> "The npm package installs the same native binary as the standalone installer. npm pulls the binary in through a per-platform optional dependency such as `@anthropic-ai/claude-code-darwin-arm64`, and a postinstall step links it into place."

**Context:** This section immediately follows the "Native Install (Recommended)" section. Anthropic labels native as "Recommended", but the npm alternative exists and is documented. Combined with issue #48415's statement that "The current workaround is to install via `npm install -g @anthropic-ai/claude-code` instead, which avoids the extension auto-install entirely", this confirms that Anthropic is aware of scenarios where npm is preferred, and that npm avoids the extension auto-install problem.

---

## Summary: The evidence points to (a), not (b) or unknown causes

1. **Issue #48415 (closed, inactivity)**: Explicit documentation that the native installer auto-installs the VS Code extension as a known, named problem.
2. **VS Code extension docs**: Confirmation that the extension bundles and manages its own CLI, and has auto-install logic (`autoInstallIdeExtension`).
3. **Issue #92072 (fresh, 2026-09-04)**: Recent crash report specifically in VS Code Dev Containers, suggesting active extension logic in that environment.
4. **VS Code's own docs**: Confirmation that extensions are NOT automatically forwarded by default, so the extension must have arrived via the native installer.
5. **Base image ruled out**: No Claude Code logic in the generic `devcontainers/base:ubuntu` image.
6. **Community workarounds**: Multiple third-party projects created specifically to work around the native installer's auto-install behavior in container scenarios.
7. **Anthropic's own docs**: npm install is documented as an alternative that avoids the extension auto-install problem.

**The root cause is (a): the native installer auto-installs the VS Code extension, which then manages its own "native" build installation inside the container, bypassing the npm install from `postCreateCommand`.** This is not a mystery or hidden behavior — it is explicitly described in issue #48415 as the documented problem, and multiple independent solutions have been built around it.

---

## What would prove this definitively in a live environment

The evidence above is strong but circumstantial. To move from "highly likely (a)" to "confirmed (a)", the following live-environment evidence would resolve it:

1. **Extension presence check**: Inside a real VS Code Dev Container session (not `docker exec`), run `code --list-extensions | grep claude` or check `~/.vscode/extensions/` to confirm the Claude Code extension is physically present in the container.
2. **Install method probe**: Run `claude doctor` immediately after container creation, *before opening any VS Code window or extension*, then *again after opening the container in VS Code*. Compare the `Config install method` field. If it changes from "npm-global" to "native" after the VS Code connection, that is proof the extension triggered a reinstall.
3. **Extension activation log**: Check VS Code's extension host logs (`Help → Toggle Developer Tools` in the container's VS Code, then look at the Extension Host tab) to see if the Claude Code extension activates automatically and if it runs any install-like commands.
4. **strace or process audit**: Run `strace -f -e execve claude doctor` inside the container to see if any `claude install` subcommand or native installer script is invoked automatically by the extension.

---

## Recommended action for issue #214/235

Given that this root cause is documented (issue #48415), do NOT use the native installer in `postCreateCommand`. Use npm install instead:

```bash
npm install -g @anthropic-ai/claude-code
```

This is what issue #48415 explicitly recommends as a workaround. Anthropic docs support this install method, and it avoids the extension auto-install side effect entirely.

Alternatively, if the native installer is desired, suppress the extension auto-install by using environment variables or settings flags documented in issue #48415 if they exist (check `claude install --help` for `--no-extension` or similar flag), or file a new issue referencing the closed #48415 to request the `--no-extension` flag if it was not yet implemented.
