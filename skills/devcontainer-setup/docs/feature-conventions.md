# Conventions for Add-on Skills authored as devcontainer Features

Every Add-on Skill in this suite (everything except `devcontainer-scaffold`,
which owns the Target Devcontainer's build definition from scratch and
isn't itself a Feature — see
[ADR-0001](adr/0001-focused-installation.md)) is authored as a local-path
[devcontainer Feature](https://containers.dev/implementors/features/).
These conventions are shared across all five so they don't drift
independently; a specific Add-on Skill's own SKILL.md documents its
Feature's actual options and behavior, not these mechanics.

## Directory layout and id

Each Add-on Skill's Feature source lives at
`skills/devcontainer-setup/<skill-name>/feature/<skill-name>/`, containing
at minimum `devcontainer-feature.json` and `install.sh`. The inner
directory — `feature/<skill-name>/` — is exactly what gets copied verbatim
into the target's `.devcontainer/<skill-name>/` at install time, and its
name is the Feature's `id`. The devcontainer Features spec requires a
Feature's directory name to exactly match its `id` field, lowercase and
unique within the repository it's referenced from; using the Skill name for
both keeps one unambiguous identifier from the Skill catalog through to the
installed `devcontainer.json`'s `"features"` block:

```jsonc
"features": {
  "./devcontainer-firewall": {}
}
```

## Versioning

Every Feature manifest's `version` field is required by spec even for a
local-path-only Feature with no registry to pull updates from. Bump it
manually with normal semver discipline (patch for a fix, minor for a new
option, major for a breaking change to the Feature's own interface)
whenever that Skill's `install.sh` or manifest changes — whoever edits the
Feature bumps the version as part of that edit, documented in the owning
Skill's own SKILL.md.

This is unrelated to `devcontainer-cli-lifecycle`'s age-gating: that
machinery gates auto-updates of *external* tools the container installs
and updates at runtime (an agentic CLI binary, an MCP server). A
suite-authored Feature is copied into the target once, at install time,
with no auto-update path of its own — there's nothing for age-gating to
apply to. Don't route Feature version bumps through that machinery.

## `dependsOn` vs. `installsAfter` for cross-Skill hand-offs

Where one Add-on Skill's Feature needs another to have run first (the
running example: `devcontainer-agentic-clis` patching vendor-API domains
into the allowed-domains manifest `devcontainer-firewall` owns), use
`installsAfter`, never `dependsOn`:

- **`dependsOn` is a hard requirement** — it force-installs the named
  Feature even if the user never asked for it. Using it here would mean
  installing `devcontainer-agentic-clis` alone always drags
  `devcontainer-firewall` in with it, silently contradicting this suite's
  entire reason for existing as independently-installable Skills (see
  [ADR-0001](adr/0001-focused-installation.md)).
- **`installsAfter` is a soft ordering hint** — it only affects ordering
  among Features *already* queued to install. Declare it, and if
  `devcontainer-firewall` happens to also be installed, your Feature runs
  after it; if not, `installsAfter` is simply inert.

Because `installsAfter` never guarantees the other Feature is present,
every dependent Feature's `install.sh` must still detect whether what it
depends on is actually there (does the allowed-domains manifest file
exist?) and skip that part of its own work cleanly if not — this is the
Retrofit Contract from [CONTEXT.md](../CONTEXT.md) applied to a sibling
Feature's output the same way it applies to anything else pre-existing in
the Target Devcontainer: detect, don't assume.

## Testing: `devcontainer features test`, as a fast first stage

Each Feature gets a `test/<skill-name>/test.sh` (mirroring the official
[Features test framework](https://github.com/devcontainers/cli/blob/main/docs/features/test.md)'s
convention: `src/<id>/` paired with `test/<id>/test.sh`, run via
`devcontainer features test -f <skill-name> --base-image <image>`),
verifying that Feature in isolation against a bare base image. Add a
`scenarios.json` alongside it when a Feature's behavior meaningfully
depends on install-time options.

This composes with, and does not replace, this suite's existing
build-it/boot-it/actually-exercise-it verification bar: the Feature test
framework catches a broken `install.sh` or a bad `capAdd` cheaply, against
a minimal image, before the slower full-container build; it can't reach
regressions that only show up once multiple Features are actually composed
together in one Target Devcontainer, which is what the full verification
pass is for.
