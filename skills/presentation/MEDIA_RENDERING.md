# Media Renderer protocol

This is the authoring source of truth for the common protocol shared by the Image
and Diagram Media Renderers. Each renderer embeds the small interface it needs so
installed Skills remain operationally self-contained.

## Common interface

1. Resolve the Project Folder and the approved Media Spec.
2. Determine Media Scope from existing assets: all entries when none exist;
   missing-only, regenerate-all, selected entries, or cancel when assets exist.
3. Let the user choose batch or interactive Generation Mode.
4. In interactive mode, offer Next, Redo, and Stop after each selected entry.
5. Report every success and failure with its slide and output asset.
6. Mark only the owned media phase `done` after every selected entry succeeds.
7. Leave the owned media phase pending on cancellation or any failure.
8. Preserve every unrelated Project Folder phase record.

## Provider adapters

The Image Media Renderer owns its selected provider credential, model, bundle, and API behavior.
The Diagram Media Renderer owns D2 availability, installation choice, layout,
theme, and syntax behavior. Provider-specific setup, retries, security guidance,
and failure handling stay with the owning renderer.
