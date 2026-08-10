# devcontainer-setup Domain Glossary

## Scaffolding Skill

The Skill Suite member that assumes it owns the Target Devcontainer's build
definition from scratch. There is exactly one: `devcontainer-scaffold`. It
does not need to detect and retrofit, since it is always building fresh.
_Avoid_: base skill, root skill

## Add-on Skill

Any Skill Suite member whose contract requires operating against a Target
Devcontainer it doesn't assume it created. Every member except the
Scaffolding Skill is an Add-on Skill.
_Avoid_: module, plugin skill

## Target Devcontainer

The devcontainer.json/Dockerfile/compose configuration a given Skill
invocation acts on, whether the Scaffolding Skill created it or it
pre-existed and this suite had no hand in it.
_Avoid_: the devcontainer, the project

## Retrofit Contract

The rule every Add-on Skill follows when acting on a Target Devcontainer:
detect what it specifically needs, add or create only what's missing, and
never modify or remove something already present that it doesn't own.
_Avoid_: idempotency (broader than this — idempotency is about repeat runs
of the same Skill; the Retrofit Contract also governs how one Skill behaves
around state a *different* Skill, or something outside this suite entirely,
put there)
