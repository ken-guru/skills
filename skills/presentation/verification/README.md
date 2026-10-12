# Presentation suite verification

Maintainer tools for checking the presentation skills before a release. Nothing here ships as part of a skill's runtime.

## What runs where

| Check | Where | When |
|---|---|---|
| Script tests for every skill, frontmatter (`skills-ref`), command shape, shared-file copies, theme contrast, and the fixture deck rendered in both themes | `presentation-skills` CI workflow | every PR |
| Behavioural evals: the suite's scenarios and the cases of `planning-presentation` and `researching-sources`, with and without the plugin | `claude plugin eval` (Claude Code) | by hand, before each release |
| The same scenarios in Copilot CLI and Codex | `smoke/run.sh` | by hand, before each major or minor release |
| The fixture's rendered slides | CI artifact `fixture-slides` | by a person, when themes or tool pins change |

## Behavioural evals

From the repository root:

```bash
claude plugin eval . --ablation with-without --model haiku --max-cost-usd 20 --allow-tools Write Edit "Bash(node:*)" WebSearch WebFetch
claude plugin eval . --ablation with-without --model sonnet --max-cost-usd 40 --allow-tools Write Edit "Bash(node:*)" WebSearch WebFetch
claude plugin eval . --ablation with-without --model opus --max-cost-usd 80 --allow-tools Write Edit "Bash(node:*)" WebSearch WebFetch
```

The runner finds the cases in each skill's own `evals/` folder: the suite's scenarios in [`../evals/`](../evals/), and the cases of `planning-presentation` and `researching-sources`. Keep `--allow-tools` last, since it takes a list. Without it, no run can write a file, and every file grader fails in both arms. Reports go to `evals/results/` at the repository root, which is ignored.

The evals measure behaviour: whether a skill starts, interviews, keeps its approval gates, cites its sources, and drafts read-aloud notes. They do not grade rendering. Each run works in a sandbox with its own home folder, so it cannot reach the tool cache, and the cases grant only `node` for the shell. Rendering is proven by the CI fixture in both themes and by the smoke runs below. [Issue 528](https://github.com/ken-guru/skills/issues/528) tracks letting the evals grade rendering.

The headline number is the score difference with and without the plugin. Attach the reports to the release PR; scores and the difference must not fall below the previous release's.

## Copilot CLI and Codex smoke runs

```bash
skills/presentation/verification/smoke/run.sh copilot 01-sourced-team-update
skills/presentation/verification/smoke/run.sh codex 02-diagram-heavy-request-flow
```

Both harnesses run with every tool, every path, and the network allowed (`--allow-all-tools --allow-all-paths` in Copilot, `--approve-for-me` with network access in Codex 0.154 and later), since the runs show what the skills do without anyone approving each step. So run them in this repo's devcontainer, where the firewall limits what they reach. The script checks only that it runs in a container, not which one: outside any container it stops; pass `--i-accept-host-risk` as its first argument only if you accept the harness acting on your own machine.

Install the eight skills in that harness first (`npx skills@latest add ken-guru/skills#<branch or tag> --skill …`), and run each skill's `setup` once; the script uses whatever the harness has installed. Each run happens in a fresh folder; grade its log and Deck Folder against the scenario's `graders/` by hand. Also check that it rendered, since the evals don't grade that:
- `dist/deck.pdf` and `dist/deck-notes.md` exist, and every slide has notes.
- The log shows "Accessibility Bar: all scripted checks pass".

Record the results in the release PR.
