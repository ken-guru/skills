# CLI Skill security contract

Every CLI Skill installed into the Shared Container follows this contract.

## Base-owned primitives

The base `setup-devcontainer` skill owns the code-runner interface, protected
credential validation, runtime-policy evidence, Curated Skill Set refresh,
manifests, and shared verification. A CLI Skill consumes these primitives; it
does not recreate them.

Workspace-derived commands—tests, builds, package scripts, linters,
formatters, and repository hooks—must be launched through
`devcontainer-code-runner`. Direct commands run by an agent-operation process
are outside the generated-code boundary and must not be described as
protected by it.

## CLI-owned declarations

Each CLI Skill documents its own marker-keyed install/configuration blocks and
target directory, skill source selection and refresh target, any
evidence-backed Capability Seam requirement, and privileged GitHub or Git
operations requested from the agent-operation identity.

No CLI Skill may edit another CLI Skill's block, the base-owned container
definition, credential wiring, or shared security primitives. The only
container-definition exception is an idempotent, explicitly named Capability
Seam entry supported by evidence.

## Future CLI Skills

A future CLI Skill is incomplete until it adds a policy declaration and a
fixture proving runner use, explicit capability requests, Own-Block Contract
preservation, and idempotent installation in more than one order.
