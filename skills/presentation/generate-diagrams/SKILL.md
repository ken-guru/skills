---
name: generate-diagrams
description: "Media Renderer. Load when DIAGRAM_SPEC.md exists or the user explicitly requests presentation diagram rendering."
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/generate-diagrams *)
---

# Generate Diagrams (Media Renderer)

Renders the approved `DIAGRAM_SPEC.md` to SVG files in the project's `images/`
folder with one bundled Skill Executable. It owns D2 extraction, validation,
flags, theme styling, output checks, and temp-file cleanup; this Skill owns
scope, layout choices, Interactive review, reporting, and phase state.

## Output voice

Apply a lightweight human-voice pass to scope questions, review prompts, and
result reports. Preserve user-provided Media Intent and D2 source when
transporting them, and keep filenames, paths, commands, and state values exact.
Before approving diagram labels or explanatory text, invoke the standalone
`unslop` Skill as a required full editorial pass using
`DISCOVERY.json.editorialPreferences`; preserve D2 syntax and semantic labels.

Protocol: resolve Media Scope, Batch by default (Interactive on request), review and report results,
update only the owned media phase, leave it pending on cancellation or failure,
and preserve unrelated phase records. D2 setup remains local.

## Startup

1. Resolve the Project Folder from `DISCOVERY.json` (`paths.diagramSpec`,
   falling back to `DIAGRAM_SPEC.md`), or ask if ambiguous.
2. Require `DIAGRAM_SPEC.md`. If it is missing:
   > ❌ `DIAGRAM_SPEC.md` not found. Create and approve a diagram specification before rendering diagrams.
   Abort.
3. Run `which d2`. If missing, explain that D2 is required and offer:

   ```
   ❌ D2 is not installed. It is required to render SVG diagrams.

     1  Install D2 now       — I’ll use a suitable installation method after your confirmation
     2  I’ll install it      — install D2 yourself, then tell me when it is ready
     3  Cancel
   ```

   - **1**: identify the operating system and package manager, and ask for confirmation before running the install. Prefer `brew install d2` on macOS with Homebrew; on Linux use D2’s [official installer](https://d2lang.com/tour/install/) or the distribution package manager.
   - **2**: link the [official D2 installation guide](https://d2lang.com/tour/install/) and wait until the user says it is installed.
   - **3**: stop without changing the project.
   - After **1** or **2**, run `which d2` again; continue only when it resolves, otherwise offer the same choices again.
4. Resolve the absolute directory containing this invoked `SKILL.md`. The Skill
   Executable is `<skill-directory>/scripts/generate-diagrams`; require it to
   exist. Call it by its unquoted absolute path, one command per call; quote
   the path only when it contains whitespace. Never infer it from cwd. It
   checks for Node.js itself and exits `2` with the fix when Node.js is missing.

## Procedure

### Step 1: Resolve Media Scope

Read the `**Filename:**` of every `DIAGRAM_SPEC.md` entry and check which files exist.

- **Named:** the request, the Decision Prompt the user just answered, or an
  approved Repair Plan resolves unambiguously to entries: slide numbers,
  filenames, "all", "missing", or a description matching exactly one entry
  ("the title diagram"). Ask nothing. Print one `Overwriting images/foo.svg (Slide N)`
  line per existing file in scope, then go to Step 2. If a named slide or
  filename has no entry, render nothing: say so and use the menu below.
- **Unknown and none exist:** scope is every entry. Ask nothing; go to Step 2.
- **Unknown and at least one exists:** present:

  ```
  ⚠️  images/ — existing files detected (N of M diagrams already present)

    Already present:    • images/foo.svg  (Slide 1 — Title)  [...]
    Not yet generated:  • images/bar.svg  (Slide 3 — Title)  [...]

    A  Generate missing only   — skip the N that already exist
    B  Regenerate everything   — overwrite all M diagrams
    C  Choose slides           — e.g. "C 1 3"
    D  Cancel
  ```

  Wait for a choice. **C** takes its slide numbers from the same reply; ask
  "Which slide numbers? (e.g. `1 3 5`)" only after a bare `C`. **D** stops without changes.

### Step 2: Render

Render in **Batch** unless the user asked to review diagrams one at a time.

**Batch** — one call for the whole scope:

```bash
<skill-directory>/scripts/generate-diagrams render <DIAGRAM_SPEC.md path> [--force] [--slides=N,M,...]
```

- Every entry, or missing only → no flags (the command skips existing files).
- Regenerate everything → `--force`.
- Selected slides → `--slides=N,M,...`, plus `--force` to overwrite any that exist.

**Interactive** — only when the user asks. For each slide in scope, call:

```bash
<skill-directory>/scripts/generate-diagrams render <DIAGRAM_SPEC.md path> --slide=N --force
```

After each call, present:

```
✅ Saved: images/foo.svg  (Slide N — Title)
   Open to review, then choose:

     N  Next  — accept and continue to the next diagram
     R  Redo  — render again (after you edit DIAGRAM_SPEC.md)
     S  Stop  — exit and keep what has been rendered so far
```

**R** repeats the same call. **S** ends the loop; the phase stays pending.

The command is the whole render step: it parses entries, runs `d2 validate`,
applies the locked Presentation Theme through Diagram Roles, checks each SVG's
structure and 20 px Effective Text Size, and cleans up. Run D2 only through it.

### Step 3: Offer only layouts that fit

This Skill is the only place diagram layout options are offered. Whenever a
diagram's layout must change, after an Effective Text Size failure or on request,
write each candidate's D2 to a file in the OS temp directory and check it
without editing `DIAGRAM_SPEC.md`:

```bash
<skill-directory>/scripts/generate-diagrams check <DIAGRAM_SPEC.md path> --slide=N --candidate=<temp file>
```

Offer only candidates that exit `0`, in one Decision Prompt that states the
media box from the check output: for example, "the diagram slot is 1152×347,
about 3.3:1, so vertical layouts cannot reach 20 px." When none passes, say so
and offer the remaining routes: split the diagram, shorten labels, or a larger
role font size in the Theme Package. The user chooses; then edit
`DIAGRAM_SPEC.md` and render the slide again. `check` writes nothing to the
Project Folder and exits `0` all pass, `1` any fail, `2` usage or prerequisite.

### Step 4: Report and update state

Relay the command's summary. Its messages name the slide, the problem, and the fix.

| Exit | Meaning | Action |
|------|---------|--------|
| `0` | Every selected diagram rendered or already present | In Batch, or after the last Interactive **N**, set `PROJECT.json` `phases.diagrams.status = "done"` and its completion timestamp |
| `1` | At least one entry failed; rendered diagrams were kept | Report each failure; for an Effective Text Size failure, go to Step 3; leave the phase pending |
| `2` | Usage or prerequisite error | Report the message and follow its instruction (for example, refresh the theme in `generate-slides`); leave the phase pending |
| `130` | Interrupted | Leave the phase pending |

The command never writes `PROJECT.json`; this Skill makes the only state change.
Mark the phase done only on exit `0` for the full scope, and preserve every
other phase record.

When an approved Repair Plan named this Skill and the run deviates from it (a
render fails, a check rejects the planned D2, or a new design choice comes up),
report `Repair Plan exceeded: <reason>` and handle that step as usual.
