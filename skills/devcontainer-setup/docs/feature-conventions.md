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

## `dependsOn` vs. `installsAfter` — for build-time install.sh ordering only

Where one Add-on Skill's `install.sh` genuinely needs another's to have run
first at *build* time (a shared package-manager step, for instance), use
`installsAfter`, never `dependsOn`:

- **`dependsOn` is a hard requirement** — it force-installs the named
  Feature even if the user never asked for it. Using it for a soft
  preference would mean installing one Skill alone silently drags another
  in with it, contradicting this suite's entire reason for existing as
  independently-installable Skills (see
  [ADR-0001](adr/0001-focused-installation.md)).
- **`installsAfter` is a soft ordering hint** — it only affects ordering
  among Features *already* queued to install, and only at build time. If
  the other Feature isn't installed, `installsAfter` is simply inert.

**This does not cover a runtime hand-off between two Features' data** (the
allowed-domains manifest patch, `devcontainer-agentic-clis` into
`devcontainer-firewall`'s manifest) — `installsAfter` only orders
`install.sh` execution during `docker build`, and every local-path
Feature's bundled files are ordinary project source under `.devcontainer/`,
reachable at runtime through the workspace bind mount regardless of
`install.sh` order. For a hand-off like that, rely on the devcontainer
lifecycle's own phase guarantee instead: **every Feature's
`postCreateCommand` completes, across the whole container, before any
Feature's `postStartCommand` runs.** Put the "produce/patch data" side of a
hand-off in the earlier Feature's `postCreateCommand` and the "consume it"
side in the later Feature's `postStartCommand`; the ordering is then
correct by construction, without either Feature needing to know whether
the other is even installed at build time. The consuming side must still
detect whether the data it wants is actually present (does the manifest
file exist? does it have the section this Feature expects?) and skip
cleanly if not — the Retrofit Contract from [CONTEXT.md](../CONTEXT.md)
applied to a sibling Feature's runtime output the same way it applies to
anything else pre-existing in the Target Devcontainer: detect, don't
assume.

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
