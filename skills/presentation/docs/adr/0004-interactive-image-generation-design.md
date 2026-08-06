# ADR-0004: Interactive Image Generation Uses In-Session Prompts and Silent Redo

The `generate-images` skill asks the user to select Image Scope and Generation Mode via in-session prompts rather than CLI flags. When the user chooses to redo an image in Interactive mode, the same prompt is re-submitted silently rather than offering inline editing.

**Prompts over flags:** Scope selection and mode selection are conversational choices that depend on runtime state (which images exist on disk, what the user wants to do *this* run). Flags must be decided before the skill loads, before the user has seen the current state. An in-session prompt can show exactly which images exist and present the options in context, which is materially better for a non-technical user. The cost — users cannot fully script a run without `--force` / `--slides=` shortcuts — is acceptable because the shortcuts exist for that case.

**Silent redo over edit-and-redo:** `IMAGE_SPEC.md` is the single source of truth for image prompts. An inline edit during a generation run would produce a result not reflected in the spec, diverging the two. If the user wants a different prompt, the right path is to edit `IMAGE_SPEC.md` first, then redo — keeping the spec authoritative. The Interactive mode note ("to change the prompt, edit IMAGE_SPEC.md") makes this explicit.
