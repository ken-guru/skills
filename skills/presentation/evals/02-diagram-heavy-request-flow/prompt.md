---
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Skill, Read, Write, Edit, Glob, Grep, "Bash(node:*)"]
runs: 3
---
Make me a short, diagram-heavy slide deck, in a folder called request-flow, explaining how a web request flows through our system: browser, CDN, load balancer, API service, a job queue, background workers, and Postgres. Include what happens when a worker fails. The audience is new engineers in their first week. I approve your plan and visuals as you propose them, so don't wait for me; use the light theme and render it.
