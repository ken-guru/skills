# Presentation suite verification

Maintainer tools for checking the presentation skills before a release. Nothing here ships as part of a skill's runtime.

## What runs where

| Check | Where | When |
|---|---|---|
| Script tests for every skill, frontmatter (`skills-ref`), command shape, shared-file copies, theme contrast, and the fixture deck rendered in both themes | `presentation-skills` CI workflow | every PR |
| Behavioural evals: the four baseline scenarios and a should-not-fire case, with and without the plugin | `claude plugin eval` (Claude Code) | by hand, before each release |
| The same scenarios in Copilot CLI and Codex | `smoke/run.sh` | by hand, before each major or minor release |
| The fixture's rendered slides | CI artifact `fixture-slides` | by a person, when themes or tool pins change |

## Behavioural evals

From the repository root, after running each skill's `setup` once:

```bash
claude plugin eval . --ablation with-without --model haiku --max-cost-usd 20
claude plugin eval . --ablation with-without --model sonnet --max-cost-usd 40
claude plugin eval . --ablation with-without --model opus --max-cost-usd 80
```

The cases live in [`../evals/`](../evals/) (registered as `experimental.evals` in `.claude-plugin/plugin.json`). The headline number is the score difference with and without the plugin. Attach the reports to the release PR; scores and the difference must not fall below the previous release's.

## Copilot CLI and Codex smoke runs

```bash
skills/presentation/verification/smoke/run.sh copilot 01-sourced-team-update
skills/presentation/verification/smoke/run.sh codex 02-diagram-heavy-request-flow
```

Install the eight skills in that harness first (`npx skills@latest add ken-guru/skills#<branch or tag> --skill …`), and run each skill's `setup` once; the script uses whatever the harness has installed. Each run happens in a fresh folder; grade its log and Deck Folder against the scenario's `graders/` by hand and record the results in the release PR.
