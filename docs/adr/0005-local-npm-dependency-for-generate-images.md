# ADR-0005: `@google/genai` Installed Locally in the Skill Folder

The `generate-images` skill installs its `@google/genai` dependency locally into `skills/generate-images/scripts/` via a committed `package.json` and `package-lock.json`, rather than requiring a global `npm install -g`. The startup check auto-runs `npm install` in that directory if `node_modules` is missing.

**Why not global install:** A global install pollutes the user's npm namespace, carries no version pin (breaking changes in a new major can silently break the skill), and requires a manual setup step the user must know to perform before the skill works. Local installation eliminates all three: the dependency is self-contained, the lockfile pins an exact version, and first-use setup is automatic.

**Considered alternatives:**

- `npx --package @google/genai node generate-images.js` — avoids any install, but version drift remains unless a version is hardcoded in the npx call, and npx adds latency on every run.
- Installing into the presentation project folder — clutters a content directory with `package.json` and `node_modules`, and requires NODE_PATH tricks since Node resolves packages from the script's location, not the project folder.
