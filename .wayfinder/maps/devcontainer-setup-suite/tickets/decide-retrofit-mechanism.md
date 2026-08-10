---
id: decide-retrofit-mechanism
title: "Decide the Add-on Skill retrofit mechanism: Dockerfile/compose edits vs. devcontainer.json lifecycle hooks vs. hybrid"
status: open
type: grilling
assignee: null
blocked_by: []
created: 2026-08-10
---

## Question

[cross-cutting-conventions](cross-cutting-conventions.md) settled the
*contract* every Add-on Skill follows ("detect what you need, add only
what's missing, never touch what you don't own") but not the *mechanism*
— and five of the six member Skills can't be scoped precisely without it.

A Target Devcontainer an Add-on Skill retrofits onto might be:
- one this suite's own Scaffolding Skill created (full Dockerfile/compose
  access, rebuilding is cheap and expected), or
- a genuinely pre-existing one this suite had no hand in (rebuilding the
  image may be disruptive, slow, or outside what the user wants touched
  at all).

Concretely: does `devcontainer-firewall` add `NET_ADMIN`/`NET_RAW` and a
non-root user by editing the Target Devcontainer's Dockerfile/compose
files directly (requires an image rebuild to take effect)? Or does it
work only through `devcontainer.json` lifecycle hooks
(`postCreateCommand`/`postStartCommand`, no rebuild needed, but can't add
build-time layer content like installing an apt package or creating a
non-root user if none exists at the image level)? Or does each Add-on
Skill detect which is possible/appropriate and pick per situation?

This also needs to state how detection itself works — filesystem
inspection of the actual Dockerfile/compose/devcontainer.json, a
suite-authored state file recording what earlier invocations did (the
Presentation PROJECT.json/DISCOVERY.json pattern doesn't obviously
transfer, since Add-on Skills may run standalone, out of order, against a
container the suite never touched before), or a hybrid — this was flagged
as fog during charting precisely because it hangs on this same mechanism
question.

## Resolution

(pending)
