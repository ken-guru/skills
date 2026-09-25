# Copilot CLI credential storage on Linux, and the plain-text-token prompt

Research for the Wayfinder ticket *Research how Copilot CLI stores credentials on Linux and what silences or satisfies the plain-text-token prompt* (parent map: *Decide Copilot CLI's first-run auth story in the Shared Container (GH_TOKEN, token guidance, vault prompt)*). Researched 2026-09-25 against Copilot CLI 1.0.87/1.0.88, which were current then.

Each claim is tagged with how it is known:

- **Documented**: stated in GitHub Docs or the `github/copilot-cli` changelog.
- **Source**: read from the minified JS that `@github/copilot` shipped on npm. Versions up to 1.0.60 ship readable JS. Newer versions ship a single-executable binary whose JS I could not read.
- **Tested**: reproduced in a container built from this repo's pinned base image.
- **Inferred**: reasoned from the above and not checked directly.

## Answer in brief

1. **Library and backends.** Copilot CLI uses **`keytar`**, the archived `atom/node-keytar` addon. On Linux it links **`libsecret-1.so.0`** and talks to a **Secret Service** provider (GNOME Keyring or KWallet) over the **D-Bus session bus**. It tries no other backend: no `pass`, no file keyring. The service name is `copilot-cli` and the account is `<host>:<login>`. If keytar throws or takes longer than 5 s, the "System vault not available" prompt appears.
2. **Where the plain-text token goes.** If you answer yes, the token is written to **`~/.copilot/config.json`** (or `$COPILOT_HOME/config.json`) under `copilotTokens["<host>:<login>"]`. In this container `~` is the persisted `/home/vscode` volume, so the token survives rebuilds until the volume is deleted.
3. **Pre-accepting plain text.** There is **no CLI flag and no env var** for this. There is an **undocumented settings key, `storeTokenPlaintext: true`**, named in the changelog but missing from the settings reference. Put it in `~/.copilot/settings.json`; the legacy `config.json` location and the `store_token_plaintext` spelling are also read. With it set, the CLI never calls keytar and writes the token to `config.json` without asking.
4. **Env-var token auth.** Yes, it bypasses storage and the prompt completely. A token in `COPILOT_GITHUB_TOKEN`, `GH_TOKEN` or `GITHUB_TOKEN` is used from memory and never stored. The catch is that it only works if the token passes the `/copilot_internal/user` check. A token that fails (a classic `ghp_` PAT, or a fine-grained PAT owned by an **organization** or missing **Copilot Requests**) is **dropped without warning**. The CLI then falls through to the keychain, then `gh`, then interactive sign-in, and that is where the vault prompt comes from. The docs say org-owned fine-grained PATs are not supported. This matches the origin report.
5. **Smallest headless keyring that works (tested).** Three packages: `gnome-keyring`, `libsecret-1-0` and `dbus-user-session`. At every container start: one `dbus-daemon` on a fixed socket, `gnome-keyring-daemon --login` with a fixed password, then `--start --components=secrets`. `DBUS_SESSION_BUS_ADDRESS` must also be exported to every shell. That is **about 3 Dockerfile lines and about 8–10 lifecycle/env lines**. The package cost is far bigger: **146 new packages and about 350 MB** in the pinned image (Ubuntu 26.04), because `gnome-keyring` hard-depends on `pinentry-gnome3` and `gcr`, which pull in GTK 3/4, Mesa and systemd. The keyring password also has to be stored in the container to unlock headlessly, so the security gain over plain text is close to zero. This is well over the map's "a few lines" limit.

## 1. Credential library and backends

- **Documented** ([Authenticating GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli), fetched 2026-09-25): "stores OAuth tokens in the operating system's keychain … under the service name `copilot-cli`". On Linux that means "libsecret (GNOME Keyring, KWallet)".
- **Source** (`@github/copilot@0.0.354`, 2025-11-03, and `@github/copilot@1.0.60`): the package ships `prebuilds/<platform>/keytar.node` for every platform. `app.js` loads it lazily, uses service `"copilot-cli"`, keys entries by `` `${host}:${login}` `` and wraps every call in a 5000 ms timeout (`"Keytar operation timed out"`). The Linux `keytar.node` dynamically links `libsecret-1.so.0` (seen in the ELF strings).
- `atom/node-keytar` has been **archived** on GitHub since 2022-12-12. Its README says it "uses libsecret" on Linux. libsecret is a client of the freedesktop **Secret Service** D-Bus API, so a session bus and a provider are both required.
- **Inferred for ≥1.0.61**: the 1.0.87 binary has its JS packed in a form I could not read, so I could not confirm keytar in the current release. Evidence that nothing changed: [copilot-cli#3429](https://github.com/github/copilot-cli/issues/3429) (2026-05-20, v1.0.49) straces a "D-Bus/keytar" lookup at startup. The changelog has no entry for a credential-backend change up to 1.0.88.
- **No other backends.** [copilot-cli#2071](https://github.com/github/copilot-cli/issues/2071) (opened 2026-03-16, still open) asks for `pass` support and describes the current behaviour as keyring, else plaintext. The only choices in the code are keytar and the config file.
- **Tested**: in the pinned base image with `libsecret-1-0` installed but no session bus, keytar fails at once with `Cannot autolaunch D-Bus without X11 $DISPLAY`. That is the failure behind the prompt. The stock image has none of `libsecret-1-0`, `dbus` or `gnome-keyring`.

Changelog entries that matter ([changelog.md](https://github.com/github/copilot-cli/blob/main/changelog.md)):

- 1.0.3 (2026-03-09): "Login flow no longer hangs on Ubuntu when system keyring is unresponsive". This is the 5 s timeout.
- 1.0.51 (2026-05-20): "Login prompt more clearly warns when token storage falls back to insecure plain text config file". This is today's "System vault not available" wording.

## 2. The prompt and where the plain-text token lands

**Source** (1.0.60), prompt text: "⚠ System vault not available / The recommended secure storage (keychain, keyring, or credential manager) could not be found or accessed. You may need to install or configure one. / Storing the token in the config file saves it as plain text, which is insecure. If you decline, the token will be kept in memory only and you will need to log in each time you start Copilot. / Store token in plain text config file?"

- The prompt only appears inside the interactive login flow (`/login` or `copilot login`), after `storeToken()` returns false because keytar threw or timed out.
- Yes writes `copilotTokens["<host>:<login>"] = <token>` into `config.json` (older builds used `copilot_tokens`). No keeps the token in memory for that session only.
- **Documented**: "prompts you to store the token in a plaintext configuration file at `~/.copilot/config.json`" ([Authenticating](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli)). `config.json` "stores internal application state … including authentication data" and `COPILOT_HOME` "replaces the entire `~/.copilot` path" ([config dir reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference)).
- **Inferred**: the Shared Container mounts one volume over `/home/vscode`, so a yes persists across rebuilds. The prompt only returns when the volume is recreated, or when the stored token expires or is revoked.

## 3. Pre-accepting plain-text storage

- **No flag and no env var.** The documented `copilot login` options are `--host`, `--web-flow`, `--device-code` and `--with-token` ([CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)). None of them touches storage.
- **`storeTokenPlaintext` setting.** It is **documented only in the changelog**: 1.0.15 (2026-04-01) says "Config settings askUser, autoUpdate, storeTokenPlaintext, … now use camelCase names (snake_case still accepted)". It is **not listed** in the settings reference I read.
- **Source** (0.0.354 and 1.0.60): `storeTokenPlaintext` is a boolean in the user settings schema. When it is true, `storeToken`, `getToken` and `getAnyToken` read and write `config.json` directly and never load keytar, so the failure that triggers the prompt never happens.
  - 1.0.35 (2026-04-23) moved user settings to `~/.copilot/settings.json`. The 1.0.60 settings loader still merges user keys found in the legacy `config.json`.
  - Put `{"storeTokenPlaintext": true}` in `settings.json`.
  - As a side effect it also skips the 5 s keytar attempt when a stored token is read (see #3429 for startup stalls).
- **Uncertain**: I have not confirmed that 1.0.87/1.0.88 still honours the key, because the binary could not be read. Changelog 1.0.78 says unknown top-level keys in `settings.json` now produce a warning, and that would show if the key were dropped. Run one check in a real container before relying on it.

## 4. Env-var token auth and why sign-in happened with `GH_TOKEN` set

- **Documented** order: `COPILOT_GITHUB_TOKEN`, then `GH_TOKEN`, then `GITHUB_TOKEN`, then the OAuth token in the keychain, then the `gh` CLI. "An environment variable silently overrides a stored OAuth token" ([Authenticating](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli)).
- **Documented** token types: `gho_`, `ghu_` and `github_pat_` are supported. A fine-grained PAT must be owned by a personal account and have the **Copilot Requests** permission. Classic `ghp_` tokens are not supported. The [troubleshooting page](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/troubleshoot-copilot-cli-auth) says the token must be "a fine-grained personal access token owned by your personal account (not an organization)". That confirms the map's working hypothesis.
- **Source** (1.0.60, `tryGitHubTokenLogin`):
  - A `ghp_` token is rejected with a log line only.
  - Other tokens are checked with `GET /copilot_internal/user`. If that fails, the method logs `Failed to fetch PAT user login` and returns nothing.
  - The next sources in the chain are the keychain, then `gh auth token`, which with `GH_TOKEN` set just returns the same token (**inferred**).
  - After that comes interactive login, and so the vault prompt.
  - When the env token does validate, it is kept in memory (`onEnvAuthInfo → e.token`) and **never passed to `storeToken`**, so neither keytar nor the prompt runs.
- **Consequence for the Shared Container (inferred).** A personal-account fine-grained PAT with Copilot Requests, in `COPILOT_GITHUB_TOKEN`, avoids both sign-in and the vault prompt with no keyring and no plain-text file. `COPILOT_GITHUB_TOKEN` takes precedence, so the repo-scoped `GH_TOKEN` can stay as it is for `gh`/git. [copilot-cli#2071's workaround comment](https://github.com/github/copilot-cli/issues/2071) (2026-04-29) relies on the same env-var path.
- Changelog 1.0.82 (2026-08-29): "Show the specific authentication failure (such as 401 Bad credentials) instead of only the /login prompt". Current builds may therefore show why the env token was rejected, which is useful for the map's "surface a bad token early" question.
- Changelog 1.0.81 (2026-08-27): `copilot login --with-token` reads a token from stdin. **Inferred** to go through `storeToken` like any other login, so it would still hit the vault prompt without a keyring or `storeTokenPlaintext`.

## 5. Headless keyring: what is needed and what it costs

**Tested** on 2026-09-25 against `mcr.microsoft.com/devcontainers/base:ubuntu@sha256:edfb983a…` (resolves to Ubuntu 26.04.1 LTS), using Copilot 1.0.60's prebuilt `keytar.node` under Node as the `vscode` user.

Packages: `gnome-keyring libsecret-1-0 dbus-user-session`, with `--no-install-recommends`.

- Result: **146 new packages, and `/usr` grew by about 350 MB** (803 → 1153 MB).
- The bulk comes from hard `Depends` that `--no-install-recommends` cannot drop:
  - `gnome-keyring` → `pinentry-gnome3` and `gcr`/`gcr4`, which pull in `libgtk-3-0t64`, `libgtk-4-1`, Mesa/`libllvm21`, GStreamer and fonts.
  - `default-dbus-session-bus` → `dbus-user-session`, which pulls in `systemd`.
- `gnome-keyring` Depends list: [packages.ubuntu.com/noble/gnome-keyring](https://packages.ubuntu.com/noble/gnome-keyring). 26.04 was not browsable there, but the observed install matched it.

A per-start recipe that worked. This is an empty-state container with no PAM login and no GUI, so the keyring is never created interactively:

```bash
export XDG_RUNTIME_DIR=/tmp/xdg-$(id -u); mkdir -p -m 700 "$XDG_RUNTIME_DIR"
dbus-daemon --session --address="unix:path=$XDG_RUNTIME_DIR/bus" --fork --nopidfile
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
printf '%s' "$KEYRING_PASSWORD" | gnome-keyring-daemon --daemonize --login
gnome-keyring-daemon --start --components=secrets
```

- After this, keytar's `setPassword("copilot-cli", …)` and `getPassword` both succeeded.
- `~/.local/share/keyrings/login.keyring` was created, which would be on the persisted volume.
- A second shell sharing the bus address could read the secret.
- Two variants failed:
  - `--unlock --components=secrets --daemonize` with an empty password: `Object does not exist at path "/org/freedesktop/secrets/collection/login"`.
  - Running keytar with no bus at all: `Cannot autolaunch D-Bus without X11 $DISPLAY`.
- Option semantics: [`gnome-keyring-daemon(1)`](https://manpages.ubuntu.com/manpages/noble/man1/gnome-keyring-daemon.1.html). `--login` "reads all of stdin … as a login password and does not complete actual initialization". `--start` "connect[s] to an already running daemon and initialize[s] it".
- Community reports that match: [copilot-cli#49](https://github.com/github/copilot-cli/issues/49) (2025-09-26, closed) and [copilot-cli#2165](https://github.com/github/copilot-cli/issues/2165) (2026-03-19, open). Both show the docs' `apt install libsecret-1-0 gnome-keyring seahorse` advice failing headless until a default keyring is created, and one comment reports that `dbus-launch` in `.bashrc` broke other tools.

Where this would go in this repo's templates (**inferred** line counts):

| File | Change | Lines |
| --- | --- | --- |
| `skills/setup-devcontainer/templates/Dockerfile` | One `RUN apt-get install … gnome-keyring libsecret-1-0 dbus-user-session` in `base`. It changes the base image for every CLI, which conflicts with the rule that the Dockerfile never changes per CLI, unless it moves into the Copilot install block at `postCreate` time with `sudo`. | 3 |
| `post-start-base.sh`, or a new Copilot-owned post-start block | Start `dbus-daemon` and `gnome-keyring-daemon` idempotently (skip if the socket is live) on every start. | 6–8 |
| `bash-env.sh` (`BASH_ENV` plus `.bashrc`) | Export `DBUS_SESSION_BUS_ADDRESS` (and `XDG_RUNTIME_DIR`) so every shell and every `copilot` process finds the bus. | 2 |
| `.env` / `env.baseline.example` | A keyring password. It has to be stored somewhere readable for an unattended unlock, which undoes most of the security benefit. | 1–2 |

Total: about 12–15 lines across 3–4 files, plus 146 packages and about 350 MB of image. Egress firewall: no effect at runtime, since D-Bus is local, and `apt` runs at build time before the firewall is up.

## Implications for the map (inferred, for the decision session)

- The cheapest route that removes both the sign-in and the prompt is **a personal-account fine-grained PAT with Copilot Requests in `COPILOT_GITHUB_TOKEN`**. It needs no keyring and nothing written to disk by Copilot.
- For interactive sign-in when no such token exists, **pre-seeding `storeTokenPlaintext: true`** in `~/.copilot/settings.json` silences the prompt with a single line. Its behaviour matches what the user already accepted by answering yes. The caveat is that it is not in the settings docs, so verify it on the current release.
- A **real headless keyring fails the "few lines" test** on package weight, and it gives little protection when the unlock password has to live in the same container.

## Sources

- GitHub Docs: [Authenticating GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli), [Troubleshooting Copilot CLI authentication](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/troubleshoot-copilot-cli-auth), [CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference), [CLI config directory reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference). All fetched 2026-09-25; the pages show no last-updated date.
- [github/copilot-cli changelog.md](https://github.com/github/copilot-cli/blob/main/changelog.md) at 1.0.88 (2026-09-22). Entries cited: 0.0.354, 1.0.3, 1.0.15, 1.0.35, 1.0.51, 1.0.78, 1.0.81, 1.0.82.
- github/copilot-cli issues [#49](https://github.com/github/copilot-cli/issues/49), [#2071](https://github.com/github/copilot-cli/issues/2071), [#2165](https://github.com/github/copilot-cli/issues/2165), [#3429](https://github.com/github/copilot-cli/issues/3429).
- npm `@github/copilot` 0.0.354 and 1.0.60 (readable JS plus `prebuilds/*/keytar.node`); `@github/copilot-linux-x64` 1.0.87 (single-executable binary).
- [atom/node-keytar](https://github.com/atom/node-keytar), archived 2022-12-12.
- [gnome-keyring-daemon(1), Ubuntu noble](https://manpages.ubuntu.com/manpages/noble/man1/gnome-keyring-daemon.1.html); [gnome-keyring package, Ubuntu noble](https://packages.ubuntu.com/noble/gnome-keyring).
- [devcontainers/features common-utils `main.sh`](https://github.com/devcontainers/features/blob/main/src/common-utils/main.sh). Its package list has no libsecret or dbus, which the container test confirmed.
