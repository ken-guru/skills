# Adding another Tool Container later

For a repo that already has `.devcontainer/base.Dockerfile` and at least one
`.devcontainer/<tool>/devcontainer.json` from a prior run of this skill, and
now wants an additional tool:

1. Resolve `{{REPO_SLUG}}`, `{{REPO_NAME}}` as in the main flow's step 1.
2. Ask which new tool(s) to add, plus their independent SSH/yolo answers, as
   in step 3.
3. Resolve placeholders as in step 4.
4. Run step 5 (build or reuse the shared base image) exactly as written —
   this is almost always a no-op reuse, since adding a tool doesn't change
   `base.Dockerfile`'s content.
5. Run step 6 for the newly-added tool(s) only. The `docker-compose.yml`
   rebuild in step 6 already regenerates the file from the full current set
   of tools (old and new together), so every already-existing tool's service
   definition is preserved automatically — nothing about an existing tool's
   files is touched by this flow.
6. If **Claude Code**, **Codex**, or **Copilot** was newly added and `.devcontainer/.env` already
   exists (it must, for the already-existing tool(s) to have worked at all): step 6's env-block
   append only reaches `.env.example`, not the live, gitignored `.env` — the same gap
   `DEVCONTAINER_HOST` has when SSH is added later. Tell the user the exact
   `CLAUDE_CODE_VERSION`/`CODEX_VERSION`/`COPILOT_VERSION` line to add to their existing `.env`
   (whichever tool(s) were added), matching whatever this run's CLI version question answered
   (default: `latest`), rather than leaving it to only take effect on some future fresh `.env`.
7. Run step 7, scoped to the newly-added tool(s)' next steps only.

Done when the new tool's files exist and pass the same step-6 checks, the
existing tools' files are byte-for-byte unchanged (aside from
`docker-compose.yml`, which legitimately gains a new service block), and
`docker-compose.yml` still has exactly one service per tool that now has a
Tool Container.
