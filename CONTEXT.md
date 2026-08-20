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

## Output language

**Human-output guidance**:
A reusable editorial policy for making generated prose specific, natural, and
responsive to its audience while preserving meaning and technical contracts.
_Avoid_: universal rewrite, humanize everything

**Conversational prose**:
Explanations, summaries, questions, and reports written directly for the user.
It may use first person, opinion, and varied rhythm when the context supports
them.
_Avoid_: presentation copy

**Presentation content**:
User-facing text intended to appear in a presentation artifact, with tighter
constraints around brevity, hierarchy, accessibility, and visual capacity.
_Avoid_: conversational prose

**Human-voice pass**:
A lightweight final review for specificity, plain language, rhythm, and
remaining AI tells. It does not rewrite code, commands, schemas, machine-readable
reports, accessibility text without a clarity reason, or user-provided wording.
_Avoid_: mandatory full rewrite

**Editorial jargon**:
Abstract, fashionable, or metaphorical wording that can obscure a concrete
fact or instruction. Established project and technical terms remain valid when
they name a real concept the audience needs.
_Avoid_: all jargon, technical language

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
