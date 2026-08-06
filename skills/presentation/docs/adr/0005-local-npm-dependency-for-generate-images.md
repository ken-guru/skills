# ADR-0005: Bundle `@google/genai` in Generate Images

The `generate-images` Skill ships a committed self-contained runtime bundle containing
the pinned `@google/genai` dependency. Authored source and its lockfile remain beside
the bundle for maintainers, and repository verification requires a byte-identical
rebuild. Installed execution performs no `npm install`.

**Why:** A global install pollutes the user's npm namespace and carries no reliable
version pin. A first-use local install writes into the installed Skill, depends on
network access, and breaks read-only or copied installations. The committed bundle
keeps execution portable while the lockfile and reproducibility check retain supply
chain visibility.

**Considered alternatives:**

- `npx --package @google/genai node generate-images.js` — avoids any install, but version drift remains unless a version is hardcoded in the npx call, and npx adds latency on every run.
- Installing into the presentation project folder — clutters a content directory with `package.json` and `node_modules`, and requires NODE_PATH tricks since Node resolves packages from the script's location, not the project folder.
- Installing into the Skill directory on first use — keeps dependencies local but
  mutates the installation and requires network access at runtime.
