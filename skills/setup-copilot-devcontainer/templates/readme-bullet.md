- Copilot
  - Authenticates from `COPILOT_GITHUB_TOKEN` in `.devcontainer/.env`: a
    personal-owned fine-grained PAT with only the Copilot Requests
    permission (see `.env.example`). `GH_TOKEN` is only a fallback, and it
    can't authorize Copilot when it's org-owned.
  - If you skip the token and sign in with `/login` instead, Copilot will ask
    "System vault not available … Store token in plain text config file?"
    The container has no keyring, so that prompt is expected. Answering yes
    stores the token in `~/.copilot/config.json` on the `-config` volume, not
    in the repo; anything in the container can read it, just like `.env`.
  - If `copilot` asks you to sign in even though `COPILOT_GITHUB_TOKEN` is
    set, the token was rejected. Run `copilot -p hi` to see why (usually: not
    owned by your personal account, or missing Copilot Requests).
