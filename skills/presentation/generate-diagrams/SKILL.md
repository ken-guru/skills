---
name: generate-diagrams
description: "Renderer. Use when rendering presentation diagrams, when DIAGRAM_SPEC.md exists, or after generate-slides has completed."
---

# Generate Diagrams

Phase skill that follows `generate-slides`. Reads `DIAGRAM_SPEC.md`, passes the D2 syntax to the local D2 binary, and saves the resulting SVG files to the project's `images/` folder.

## Startup

Before proceeding:

1. Resolve the project folder: check `DISCOVERY.json` for paths, or ask if ambiguous.
2. Check `DIAGRAM_SPEC.md` exists. If not:
   > ❌ `DIAGRAM_SPEC.md` not found. Run `generate-slides` first to create diagram specifications.
   Abort.
3. Check `d2` is available: `which d2`. If it is not found, explain that D2 is required to render these diagrams and offer:

   ```
   ❌ D2 is not installed. It is required to render SVG diagrams.

     1  Install D2 now       — I’ll use a suitable installation method after your confirmation
     2  I’ll install it      — install D2 yourself, then tell me when it is ready
     3  Cancel
   ```

   - For **1**, identify the operating system and available package manager. Ask for confirmation before executing the proposed command. Prefer `brew install d2` on macOS when Homebrew is available; on Linux, use D2’s [official installer](https://d2lang.com/tour/install/) or the distribution package manager; on Windows, use an available supported package manager or direct the user to the official installer.
   - For **2**, link the user to the [official D2 installation guide](https://d2lang.com/tour/install/) and wait until they say it is installed.
   - For **3**, stop without changing the project.
   - After **1** or **2**, run `which d2` again. Continue only when the binary is available; otherwise report that D2 is still unavailable and offer the same choices again.

## Procedure

### Step 1: Resolve scope

Parse all entries from `DIAGRAM_SPEC.md`. Check which filenames already exist in the project folder.

If **no diagrams exist yet**, scope = all entries — skip to Step 2.

If **at least one diagram already exists**, present:

```
⚠️  images/ — existing files detected (N of M diagrams already present)

  Already present:    • images/foo.svg  (Slide 1 — Title)  [...]
  Not yet generated:  • images/bar.svg  (Slide 3 — Title)  [...]

  A  Generate missing only   — skip the N that already exist
  B  Regenerate everything   — overwrite all M diagrams
  C  Choose specific slides  — I'll tell you which slide numbers
  D  Cancel
```

Wait for choice. For **C**, follow up: "Which slide numbers? (e.g. `1 3 5`)"

### Step 2: Select generation mode

```
💡 N diagram(s) will be generated locally.

  1  All at once   — render selected diagrams in sequence
  2  One at a time — pause after each diagram for your review
```

### Step 3: Generate

For each diagram in scope, extract its D2 source code from `DIAGRAM_SPEC.md` into a temporary file (e.g. `images/[filename].d2`).

Then run D2 to compile it to SVG with the ELK layout engine and a consistent theme (e.g. theme 200 for dark mode, depending on DISCOVERY.json):

```bash
d2 --layout=elk --theme=200 <path-to-temp-file.d2> <path-to-output.svg>
```

*(Note: Always use `--layout=elk` for robust layout routing. Adjust `--theme=` according to the user's Dark mode preference in `DISCOVERY.json` - use 200 for dark mode, 0 for light mode).*

**Batch (choice 1)**

Execute the extraction and D2 compilation for all diagrams in scope without pausing.

**Interactive (choice 2)**

Execute for one diagram at a time. After each, present:

```
✅ Saved: images/foo.svg  (Slide N — Title)
   Open to review, then choose:

     N  Next  — accept and continue to the next diagram
     R  Redo  — regenerate (after you edit DIAGRAM_SPEC.md or the D2 file)
     S  Stop  — exit and keep what has been generated so far
```

**R** re-runs the compilation. **S** exits the loop early.

### Step 4: Cleanup and report results

Remove the temporary `.d2` files.
Present a summary output. On failure, suggest editing the D2 syntax in `DIAGRAM_SPEC.md` and retrying.

After all selected entries succeed, set `PROJECT.json`
`phases.diagrams.status = "done"` and record its completion timestamp. On
cancellation or any failed entry, do not mark the phase done. Preserve every other
phase record.
