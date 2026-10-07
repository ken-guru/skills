# Media Renderer protocol

This is the authoring source of truth for the common protocol shared by the Image
and Diagram Media Renderers. Each renderer embeds the small interface it needs so
installed Skills remain operationally self-contained.

## Common interface

1. Resolve the Project Folder and the approved Media Spec.
2. Determine Media Scope:
   - **Named:** the request or the Decision Prompt the user just answered
     resolves to entries unambiguously (slide numbers, filenames, "all",
     "missing", or a description matching exactly one entry). Skip the menu and
     print one `Overwriting <file> (Slide N)` line per existing asset in scope.
     A named slide or filename without a Media Spec entry renders nothing:
     report it and show the menu.
   - **Unknown, no assets exist:** every entry.
   - **Unknown, assets exist:** one menu offering missing-only, regenerate-all,
     selected entries, or cancel. Selected entries take their slide numbers in
     the same reply (`C 1 3`); ask for them only after a bare `C`.
3. Use Batch Generation Mode by default; use Interactive only when the user asks.
4. In interactive mode, offer Next, Redo, and Stop after each selected entry.
5. Report every success and failure with its slide and output asset.
6. Mark only the owned media phase `done` after every selected entry succeeds.
7. Leave the owned media phase pending on cancellation or any failure.
8. Preserve every unrelated Project Folder phase record.

## Provider adapters

The Image Media Renderer owns Image Provider credential, model, bundle, and API
behavior across both supported providers (Gemini, OpenAI). The Diagram Media
Renderer owns D2 availability, installation choice, layout, theme, and syntax
behavior. Provider-specific setup, retries, security guidance, and failure
handling stay with the owning renderer.
