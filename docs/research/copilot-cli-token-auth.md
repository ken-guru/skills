# Copilot CLI: which tokens work non-interactively, and can an org-owned fine-grained PAT work?

Researched 2026-09-25 for the Wayfinder ticket "Research which tokens Copilot CLI accepts non-interactively, and whether an org-owned fine-grained PAT can ever work" (map: "Decide Copilot CLI's first-run auth story in the Shared Container").

Every claim is tagged **[documented]** (stated by a primary source, cited) or **[inferred]** (my reasoning from documented facts, not stated anywhere).

## Short answer

- Copilot CLI checks credentials in this order: `COPILOT_GITHUB_TOKEN`, then `GH_TOKEN`, then `GITHUB_TOKEN`, then the OAuth token in the system keychain (or the plaintext config), then `gh auth token`. **[documented, A]**
- It accepts OAuth tokens (`gho_`), fine-grained PATs (`github_pat_`) and GitHub App user-to-server tokens (`ghu_`). It does **not** accept classic PATs (`ghp_`). **[documented, A]**
- A fine-grained PAT needs the **Copilot Requests** *account* permission (`copilot_requests`, access level `write`). It must be **owned by your personal account, not an organization**. **[documented, A, C, D]**
- **An org-owned fine-grained PAT can never authorize Copilot CLI.** Account permissions only exist when the user is the resource owner, so GitHub never offers Copilot Requests on an org-owned token. **[documented, C, D]** "Copilot agent settings", which the repro token had, is a different permission and does not help. **[inferred]**
- **One personal-owned fine-grained PAT cannot also reach a private org repo.** A fine-grained PAT is limited to resources owned by a single user *or* organization. **[documented, C]** A personal-owned token can hold Copilot Requests plus access to your *own* repos, and it can read public resources anywhere. It cannot reach an org's private repos. **[inferred from C and E]**
- The practical route for the Shared Container is two secrets: `GH_TOKEN` (org-owned fine-grained PAT for the repo) and `COPILOT_GITHUB_TOKEN` (personal-owned fine-grained PAT with only Copilot Requests). `COPILOT_GITHUB_TOKEN` outranks `GH_TOKEN`, so Copilot uses the personal token and `gh`/git keep using the org token. **[inferred from A]**

## Sources

| Key | Source | Last changed |
|---|---|---|
| A | GitHub Docs, [Authenticating GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli) ([source](https://github.com/github/docs/blob/main/content/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli.md)) | 2026-09-08 (github/docs `733a8a3`) |
| B | GitHub Docs, [Troubleshooting GitHub Copilot CLI authentication](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/troubleshoot-copilot-cli-auth) | 2026-09-08 (github/docs `733a8a3`) |
| C | GitHub Docs, [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) | 2026-07-30 (github/docs `3363b62`) |
| D | GitHub Docs reusable `data/reusables/copilot/copilot-cli-pat-steps.md` (rendered inside A) | 2026-06-24 (github/docs `f61df19`) |
| E | GitHub Docs, [Setting a personal access token policy for your organization](https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/setting-a-personal-access-token-policy-for-your-organization) | 2026-07-08 (github/docs `5819d99`) |
| F | [github/copilot-cli `changelog.md`](https://github.com/github/copilot-cli/blob/main/changelog.md) and README | read 2026-09-25 (latest entry 1.0.83, 2026-09-04) |
| G | GitHub Changelog, [Copilot CLI no longer needs a personal access token in GitHub Actions](https://github.blog/changelog/2026-07-02-copilot-cli-no-longer-needs-a-personal-access-token-in-github-actions/) | 2026-07-02 |

## Findings

### 1. Credential precedence

From A, "When you run a command, Copilot CLI checks for credentials in the following order":

1. `COPILOT_GITHUB_TOKEN` environment variable
2. `GH_TOKEN` environment variable
3. `GITHUB_TOKEN` environment variable
4. OAuth token from the system keychain
5. GitHub CLI (`gh auth token`) fallback

Supporting details:
- A notes that "an environment variable silently overrides a stored OAuth token". The one exception: in Codespaces, the automatically injected `GITHUB_TOKEN` does not take precedence over an account signed in with `/login`. **[documented, A]**
- The `gh` fallback "has the lowest priority and activates only when no environment variables are set and no stored token is found". **[documented, A]** So in the Shared Container, where `GH_TOKEN` is always set, the `gh` fallback never runs. **[inferred]**
- `COPILOT_GITHUB_TOKEN` was added in Copilot CLI 0.0.354 (2025-11-03) and "takes precedence over `GH_TOKEN`". **[documented, F]** The copilot-cli README still lists only `GH_TOKEN` and `GITHUB_TOKEN`, which makes it staler than the Docs. **[documented, F]**

### 2. Supported token types

The table in A:

| Token type | Prefix | Supported |
|---|---|---|
| OAuth token (browser or device flow) | `gho_` | Yes (default via `copilot login`) |
| Fine-grained PAT | `github_pat_` | Yes, "Must be owned by your personal account (not an organization) with the Copilot Requests account permission" |
| GitHub App user-to-server | `ghu_` | Yes, via environment variable |
| Classic PAT | `ghp_` | No |

How a classic PAT fails is documented in B. In an interactive session, a `ghp_` token is ignored with a warning ("Classic Personal Access Tokens (ghp_) are not supported. GITHUB_TOKEN contains a classic PAT and will be ignored…") and the CLI keeps running so you can `/login`. In non-interactive use (`copilot -p`) where it is the only credential, the CLI refuses to start. **[documented, B]** The error was added in 1.0.5 (2026-03-13) and reworded in 1.0.13/1.0.14. **[documented, F]**

Relevance: the base template's `.env` example seeds `GH_TOKEN=ghp_your_token_here`. A user who follows that format literally gets a token Copilot CLI ignores. **[inferred]**

### 3. The permission and the resource-owner rule

- The permission is **Copilot Requests**, parameter `copilot_requests`, access level `write`. It sits in the **Account permissions** table. **[documented, C]** C's note says it "enables making Copilot requests for the given user. These requests count towards the user's premium request allowance." **[documented, C]**
- C states, as an IMPORTANT callout on account permissions: "Account permissions can only be used when the current user is the resource owner." **[documented, C]**
- The creation steps in D say: "Under **Resource owner**, select your **personal account**. Do not select an organization. The **Copilot Requests** permission is only available on user-owned fine-grained personal access tokens." Then: Permissions → **Account** tab → Add permissions → Copilot Requests. **[documented, D]**
- B's fix for "Authentication failed" repeats the rule: the token "must be a fine-grained personal access token owned by your **personal account** (not an organization) with the **Copilot Requests** permission." **[documented, B]**

This confirms the map's working hypothesis. When the org owns the token, the permission list shows only repository and organization permissions, so Copilot Requests cannot be selected.

"Copilot agent settings", the permission the repro token had, does not appear in C's permission tables. It appears to be a repository-scoped setting for Copilot's cloud agent, not Copilot CLI request authorization. **[inferred; no primary source found for its exact semantics]**

### 4. Can an org-owned fine-grained PAT ever work?

No. It cannot carry Copilot Requests (section 3), and A's table requires personal ownership. **[documented, A, C, D]** No org policy or setting changes this; ownership is the gate. **[inferred: no source mentions an override]**

What the CLI does with such a token in `GH_TOKEN` is **not documented**. The repro showed an interactive sign-in prompt. A says the CLI "uses it automatically without prompting" for a *supported* token, and B's "Authentication failed" error mentions a missing Copilot Requests permission. So the observed prompt is consistent with the token being tried, rejected, and the CLI falling back to `/login`. Whether the CLI then also consults the keychain or `gh` is not stated. **[inferred, uncertain]**

### 5. Can one personal-owned PAT cover both Copilot and an org repo?

No, not for private org resources.

- "Each token is limited to access resources owned by a single user or organization." **[documented, C]**
- C lists "Using fine-grained personal access token to access multiple organizations at once" among the known gaps of fine-grained PATs. **[documented, C]**
- Under "Resource owner": "The token will only be able to access resources owned by the selected resource owner." **[documented, C]**
- Fine-grained PATs "will still be able to read public resources within the organization" whatever the policy. **[documented, E]**

So a personal-owned token with Copilot Requests reaches your own repos plus public org resources (read), not an org's private repo. **[inferred from C, E]**

Single-credential alternatives that do span both:
- An **OAuth token** from `copilot login` (`gho_`). It is user-scoped rather than resource-owner-scoped. During login you click **Authorize** per SAML SSO org. **[documented, A]** It is only used when no `COPILOT_GITHUB_TOKEN`/`GH_TOKEN`/`GITHUB_TOKEN` is set. **[documented, A]** In the container it would need the keychain, or the plaintext `~/.copilot/config.json` fallback. **[documented, A, B]**
- A `gh auth login` OAuth token used through the `gh` fallback. This also applies only when no env token is set. **[documented, A]** Whether the "GitHub CLI" OAuth app is allowed into a given org is governed by that org's OAuth app access policy. **[inferred; not checked in a primary source for this ticket]**

Both conflict with the container's design of a `GH_TOKEN` in `.env`: the env var always wins. That leaves the two-secret approach (`COPILOT_GITHUB_TOKEN` personal + `GH_TOKEN` org) as the only non-interactive option that keeps `GH_TOKEN`. **[inferred]**

### 6. Org and enterprise policy gates

For Copilot itself:
- The user needs an active Copilot license, and the organization policy must enable Copilot CLI. Otherwise you get "Error: Access denied by policy settings". **[documented, B]**
- For GitHub Actions, there is a separate policy, "Allow use of Copilot CLI billed to the organization", used with the workflow `GITHUB_TOKEN` plus `copilot-requests: write`. It is enabled by default if the "Copilot CLI" policy is on. **[documented, G]** This is Actions-only and out of the map's scope, but it shows GitHub has not extended Copilot Requests to org-owned *PATs*. **[inferred]**

For the org-owned `GH_TOKEN` used for the repo, the Copilot token doesn't need these:
- An org can **restrict access via fine-grained PATs** entirely. The org then doesn't appear as a resource owner. **[documented, C, E]**
- An org can **require administrator approval** (this is the default). Until approved, the token is `pending` and can read public resources only. Tokens created by org owners are auto-approved. **[documented, C, E]**
- An org can enforce a **maximum lifetime**, 366 days by default for fine-grained PATs. **[documented, E]**
- Enterprise policies can override all of these, and SAML SSO orgs may require SSO while creating the token. **[documented, C, E]**

### 7. Adjacent facts for the vault-prompt decision

- The CLI stores OAuth tokens in the OS keychain under service `copilot-cli` (libsecret on Linux). Without one, it prompts to store the token in plaintext at `~/.copilot/config.json`. **[documented, A]**
- The Linux fix B suggests is `sudo apt install libsecret-1-0 gnome-keyring seahorse`. **[documented, B]** A headless container also needs a running, unlocked keyring daemon for this to help. **[inferred]**
- A `storeTokenPlaintext` config setting exists (renamed to camelCase in 1.0.15, 2026-04-01). **[documented, F]** Its exact behaviour isn't documented in A or B. **[uncertain]**
- The login prompt's plaintext warning was sharpened in 1.0.51 (2026-05-20). **[documented, F]**
- A token supplied through `COPILOT_GITHUB_TOKEN`/`GH_TOKEN` involves no storage, so it never triggers the vault prompt. **[inferred from A: env tokens are used "automatically without prompting"]**

## Open or uncertain points

- Whether a rejected env token (e.g. org-owned PAT) makes the CLI fall through to keychain or `gh` credentials, or goes straight to the login prompt. This is undocumented. A cheap in-container test: run `copilot -p "hi"` with only the org token set and read the error.
- What "Copilot agent settings" controls. It is not in the fine-grained PAT permissions reference as read on 2026-09-25.
- Whether the "GitHub CLI" OAuth app is blocked by a given org's OAuth app restrictions. This is org-specific and not verified here.
