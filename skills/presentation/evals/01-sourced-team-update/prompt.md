---
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Skill, Read, Write, Edit, Glob, Grep, "Bash(node:*)"]
runs: 3
---
I need a slide deck for a 10-minute update to my engineering team, summarising the three research findings below. Put it in a folder called team-update, and give me something to present from and a PDF to share afterwards. I approve your brief and storyline as you propose them, so don't wait for me between steps; use the light theme.

Source 1: "Slide-rendering stacks", internal research note, October 2026. Marp is the best fit for decks an agent writes: one Markdown file, one CLI, and slide images for checking. Its PowerPoint export is pictures of slides, so it is not editable. Its browser-related failures come from Marp picking the wrong browser, which pinning the browser fixes.

Source 2: "Harness skill features", internal research note, October 2026. Claude Code, Copilot CLI, and Codex all ignore frontmatter fields they don't know, but strict validators reject them. No single install folder reaches all three harnesses.

Source 3: "Old suite lessons", internal research note, October 2026. Field runs proved the value of tested scripts for mechanical steps and of looking at rendered slides; saved phase state and restart guards only added cost.
