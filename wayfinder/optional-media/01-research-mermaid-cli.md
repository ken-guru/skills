## Question

Research the most reliable way to run `@mermaid-js/mermaid-cli` (or an alternative) locally in this project's environment to render Mermaid diagrams to SVG/PNG.
Specifically, does it require Puppeteer, and if so, how can we ensure it installs and runs smoothly when invoked from an automated script? Are there lightweight alternatives that don't require a full browser download?

Labels: `wayfinder:research`
Status: Closed

### Research Findings Context Pointer

[Research Findings Artifact](file:///Users/ken/.gemini/antigravity-cli/brain/5c91a4a6-5229-46c6-b099-621c0919fbd5/research-mermaid-cli-findings.md)

## Resolution

- `mermaid-cli` heavily relies on Puppeteer and Chromium for its layout engine.
- For automated scripts, the most reliable approach is the official Docker image (`ghcr.io/mermaid-js/mermaid-cli`), or using a pre-installed system Chromium (`PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`).
- There is no direct lightweight alternative for Mermaid syntax without a browser. If changing syntax is acceptable, native binaries like **D2** or **Graphviz** are excellent lightweight alternatives.
