# IMAGE_SPEC.md Diff Reporting

Generates user-facing feedback when the image specification changes during agenda or slide generation.

## When to invoke

- After generating a new `IMAGE_SPEC.md` file
- When `IMAGE_SPEC.md` previously existed and has been regenerated

## Diff Detection Procedure

### Step 1: Parse both versions

If an old `IMAGE_SPEC.md` does not exist:
- Treat all entries as "added"
- Skip to Step 4 (report all as additions)

If old `IMAGE_SPEC.md` exists:
- Parse both the old and new versions
- Extract all slide entries using the header pattern `## Slide [N] — [Title]`
- For each entry, extract:
  - Slide number (from pattern)
  - Slide title
  - Filename (from `**Filename:** images/[name].png` line)
  - Prompt suggestion (from `**Prompt suggestion:** "..."` line)

### Step 2: Compare entries

Create three lists:
- **Added**: entries in new version but not in old (by filename)
- **Removed**: entries in old version but not in new (by filename)
- **Modified**: entries that exist in both but have changed prompt/concept/style

If all three lists are empty:
- No changes detected → skip reporting
- Proceed normally without image spec feedback

### Step 3: Detect regeneration scenario

Check if this is a **regeneration** (old file existed):
- If regenerating after `structure-agenda` (agenda changed), user likely expects some image reordering
- Note: slides may have shifted position (e.g., old Slide 3 is now Slide 5)

### Step 4: Generate feedback

Format feedback message for each category:

#### Added images

```
🖼️  Added images: [count]

  Slide N — [Slide Title]
  ├─ Filename: images/[name].png
  ├─ Prompt: "[suggestion]"
  └─ 📋 Ready to generate with your AI tool

  Slide M — [Slide Title]
  ├─ Filename: images/[name].png
  ├─ Prompt: "[suggestion]"
  └─ 📋 Ready to generate with your AI tool

 💡 Tip: Copy the prompts directly to Midjourney, DALL-E, or your image generation tool.
    See IMAGE_SPEC.md for complete specifications.
```

#### Removed images

```
🗑️  Removed images: [count]

  - images/[old-name-1].png (was: Slide N — [old title])
  - images/[old-name-2].png (was: Slide M — [old title])

 💡 These files are no longer needed. You can delete them from the images/ folder if backed up.
    See IMAGE_SPEC.md for the current specification.
```

#### Modified images

```
✏️  Modified specifications: [count]

  images/[name].png
  ├─ Slide N — [Slide Title]
  ├─ Previous prompt: "[old suggestion]"
  └─ Updated prompt: "[new suggestion]"

 💡 These images need to be regenerated with the updated prompts.
    See IMAGE_SPEC.md for complete specifications.
```

### Step 5: Combine and present

Order feedback as: Added → Removed → Modified

Include at the end:

```
📄 Full specification: IMAGE_SPEC.md
```

## Integration Points

### In generate-slides Step 3

After writing `IMAGE_SPEC.md`:

```
### Step 3a: Detect IMAGE_SPEC changes

Before presenting approval prompt:
1. Check if old `IMAGE_SPEC.md` exists
2. If yes, run diff detection
3. If changes detected, show diff feedback before the approval message

IMAGE_SPEC.md has been generated with [X] image specifications.

[Diff feedback here, if any changes detected]

You can use these directly with Midjourney, DALL-E, or other image generation tools.
Would you like to review them before we generate the slides?
```

### In structure-agenda Step 4

If `IMAGE_SPEC.md` already exists before writing `AGENDA.md`:

```
✅ Agenda approved and written to [path]

[Diff feedback here, if IMAGE_SPEC has changed]

▶️  Next step: Run `generate-slides` to generate the presentation
    (Changes will be automatically propagated to your image specifications)
```

## Edge cases

1. **First run**: No old file exists → all entries are "added" → show full list
2. **Regeneration with fewer images**: Show both "added" and "removed" sections
3. **Slide renumbering**: During regeneration, slides may shift position — use filename as stable key
4. **Duplicate filenames**: If a filename appears in both old and new with different content, treat as "modified"
5. **No changes**: Skip feedback entirely, proceed as normal
