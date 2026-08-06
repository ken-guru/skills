# Collection Domain Glossary

## Skill

A reusable, invokable unit of work with a stable name and an owner-local
`SKILL.md`. A Skill may be standalone or a member of one Skill Suite.
_Avoid_: tool, helper

## Standalone Skill

A Skill owned directly by the Collection and placed at
`skills/<name>/SKILL.md`.
_Avoid_: root skill, ungrouped skill

## Skill Suite

A cohesive group of Skills that share a domain, workflow, documentation, tests, and
supporting assets. A Skill Suite defines how its members are distributed; it is not
itself invokable.
_Avoid_: skillset, skill collection, plugin

## Collection

The repository-level catalog of Standalone Skills and Skill Suites together with
their discovery, distribution, and contribution surfaces. A Collection is not a
Skill Suite.
_Avoid_: bundle, package

## Artifact Owner

The narrowest stable Collection, Skill Suite, or Skill scope whose responsibility
fully explains why an artifact exists. Consumers and physical location do not by
themselves determine ownership.
_Avoid_: parent folder, primary consumer

## Ownership Transfer

The explicit handoff in which a new Artifact Owner accepts an artifact's files,
instructions, links, tests, and distribution responsibility before the old authority
is removed.
_Avoid_: move, extraction
