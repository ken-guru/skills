# devcontainer-setup verification

This directory owns suite-level verification. The Feature tests under each
member remain responsible for narrow installation checks; this harness owns
cross-Skill contracts and evidence.

## Deterministic source contract

Run the Docker-free checks from the repository root:

```bash
bash skills/devcontainer-setup/verification/verify.sh --static
```

The command validates shell and JSON syntax plus the high-risk contracts from
the implementation handoff: non-root volume paths, firewall DNS preservation
and `iproute2`, runtime-user npm/MCP installation, and a persistent DX
statusline. It writes `results.jsonl`, `summary.txt`, and `metadata.json` to a
disposable evidence directory unless `--evidence-dir` is supplied.

## Container and live lanes

`--runtime` is intentionally strict about prerequisites and requires a
prepared Target Devcontainer workspace:

```bash
bash skills/devcontainer-setup/verification/verify.sh --runtime \
  --evidence-dir /tmp/devcontainer-setup-runtime-evidence
```

It requires both Docker and the `devcontainer` CLI. Set
`DEVCONTAINER_VERIFICATION_WORKSPACE` and optionally
`DEVCONTAINER_VERIFICATION_LANE` (`clean`, `focused`, `combined`, or
`reattach`) to run the container-side assertions through
`run-container-lane.sh`:

```bash
DEVCONTAINER_VERIFICATION_WORKSPACE=/path/to/target \
DEVCONTAINER_VERIFICATION_LANE=reattach \
bash skills/devcontainer-setup/verification/verify.sh --runtime
```

If either prerequisite or the workspace is missing, the command reports
`BLOCKED` rather than claiming a false pass. The fixture matrix is:

- clean scaffold plus all six Skills;
- each Add-on Skill alone against a separately authored non-root target;
- supported firewall/agentic-CLI/lifecycle combinations;
- restart and re-attach with empty and pre-populated named volumes.

Real GitHub registration, real allowlisted/blocked network checks, and the
host `caffeinate` check remain opt-in live/manual checks. They must use named
resources and explicit cleanup; deterministic runs must never mutate a real
repository or silently register credentials.

## Evidence contract

Every run retains fixture and environment identity, commands and logs,
ownership/capability/process snapshots, network outcomes, timing/resource
samples, and a failure classification. `PASS`, `FAIL`, and `BLOCKED` are
distinct outcomes; `BLOCKED` is not a successful verification.
