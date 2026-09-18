# Decline skill-scan CI adoption for now

Investigated reproducing skills.sh's Socket/Snyk audit signal in this repo's own PR CI
(Wayfinder map, [issue #333](https://github.com/ken-guru/skills/issues/333)). Decided
not to adopt either tool. Socket's skill-scanning product isn't self-serve reachable
outside skills.sh's own publishing pipeline. Snyk Agent Scan / Skill Inspector
correctly discovers and classifies this repo's skills with no manifest needed, but its
own README states that automated "large scale scanning" of its standard/public API is
treated as grounds for account blocking, with no stated threshold — and a real
authenticated scan attempt exhausted its daily quota on the very first call, returning
zero risk findings. The undefined account-blocking risk is the deciding factor, not the
quota alone: this repo isn't mission-critical infrastructure, and that risk isn't worth
taking for an unproven, rate-limited signal.

## Considered options

- **Socket's skill-scan product** — ruled out: an internal capability of skills.sh's
  own publishing pipeline, not a self-serve CLI/Action/API a third-party repo can call.
- **Snyk Agent Scan on a low-frequency schedule** (mirroring the existing Trivy
  image-scan job, `.github/workflows/setup-devcontainer-image-scan.yml`) — rejected:
  still counts as "automated use of the standard API" per the tool's own README, with
  no stated abuse threshold to plan a safe cadence around.

## False-positive tuning

Agent Scan exposes `--ignore-risks` and `--ignore-failure-codes` flags for tuning false
positives. No specific exclusions or thresholds are recorded here: no scan in this
investigation ever returned real findings to tune against — every authenticated
attempt hit the daily quota first.
