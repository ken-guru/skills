# Restart Guard Protocol

Invoked at the **Startup** of any phase skill when previously generated files may be made stale by re-running that phase. Gives the user an explicit, informed choice before any work begins.

## When to invoke

| Phase | Invoke guard if… |
|-------|-----------------|
| `discover-presentation` | `AGENDA.md` already exists in the project folder |
| `structure-agenda` | `IMAGE_SPEC.md` or `PRESENTASJON.md` already exists |
| `generate-slides` | `PRESENTASJON.md`, `PRESENTASJON.html`, or `PRESENTASJON.pdf` already exists, **or** media files exist in `images/` or `videos/` |

## Stale file map

Re-running a phase makes the outputs of that phase and all subsequent phases potentially stale.

| Phase re-run | Stale text files | Stale media |
|-------------|-----------------|-------------|
| `discover-presentation` | `AGENDA.md`, `IMAGE_SPEC.md`, `DIAGRAM_SPEC.md`, `docs/sources/` (contents), `PRESENTASJON.md`, `PRESENTASJON.html`, `PRESENTASJON.pdf` | `images/`, `videos/` |
| `structure-agenda` | `IMAGE_SPEC.md`, `DIAGRAM_SPEC.md`, `docs/sources/` (contents), `PRESENTASJON.md`, `PRESENTASJON.html`, `PRESENTASJON.pdf` | `images/`, `videos/` |
| `generate-slides` | *(files are overwritten in place — no separate stale text)* | `images/`, `videos/` |

## Procedure

### Step 1: Inventory

Scan the project folder using the paths in `DISCOVERY.json`. Collect:
- `staleText`: every text/markdown/html file from the stale map that actually exists on disk. For `docs/sources/`, count the files inside and record the count.
- `staleMedia`: every file found inside `images/` and `videos/` that actually exists on disk.

If both lists are empty → skip the guard entirely. No cleanup needed.

### Step 2: Present choices

Show the user a prompt using this template:

```
⚠️ [Phase name] — existing outputs detected

Proceeding will overwrite or make the following files obsolete:

  📄 AGENDA.md
  📄 IMAGE_SPEC.md
  📁 docs/sources/  (N file(s))
  📄 PRESENTASJON.md
  📄 PRESENTASJON.html

(Omit any entries that do not exist on disk.)
```

If `staleMedia` is non-empty, append a separate media section:

```
  ── Media files ─────────────────────────────────────────────
  🖼️  images/  (N file(s))
  🎬 videos/  (N file(s))
  ⚠️  Media files cannot be regenerated automatically.
     Back up anything you want to keep before choosing option B.
```

Then present the options:

```
How would you like to proceed?

  A  Delete obsolete text files (recommended)
     Stale text files are removed; media files are kept intact.

  B  Delete everything, including media
     ⚠️  Permanent — confirm you have backed up any images or
         videos you need before choosing this option.

  C  Keep all existing files
     Not recommended — stale content may pollute the context window
     and cause the agent to produce inconsistent output.
```

Wait for the user's selection.

### Step 3: Execute the choice

#### Option A — Delete text files only

1. Delete each file listed in `staleText`.
2. For `docs/sources/`: delete all files inside the folder but keep the folder itself.
3. Leave `images/` and `videos/` untouched.
4. Proceed to Step 4 to reset `PROJECT.json`.
5. Confirm to the user:
   > `✅ Obsolete text files removed. Media files preserved.`

#### Option B — Delete everything

1. Before touching any media files, show a final explicit confirmation listing every individual filename inside `images/` and `videos/`:
   > "About to permanently delete: `images/hero.png`, `images/diagram.png`, … This cannot be undone. Type **yes** to confirm."
2. Wait for the user to type **yes**.
   - If the user does not confirm → fall back to Option A automatically and inform the user.
3. Delete text files (same as Option A).
4. Delete all files inside `images/` and `videos/` (keep the folders themselves).
5. Proceed to Step 4 to reset `PROJECT.json`.
6. Confirm to the user:
   > `✅ All obsolete files removed.`

#### Option C — Keep all files

1. Do not delete anything.
2. Warn once:
   > `⚠️ Stale files kept. Downstream phases may produce inconsistent output and context-window usage will be higher.`
3. Continue without modifying `PROJECT.json`.

### Step 4: Reset PROJECT.json

After any deletion (Options A or B), update `PROJECT.json` to mark the affected phases as needing to be re-done:

| Phase re-run | Set these phase statuses to `"pending"` |
|-------------|----------------------------------------|
| `discover-presentation` | `structure`, `generation`, `proofread` (if present) |
| `structure-agenda` | `generation`, `proofread` (if present) |
| `generate-slides` | `generation`, `proofread` (if present) |

`discovery` is never reset by the guard — the discovery phase itself will update it when it runs.

## Focused Presentation Theme changes

After the user confirms updated Discovery values, compare them with the existing `DISCOVERY.json` before writing anything.

Use `presentation-theme-invalidation.mjs` as the executable source of truth for the focused stale, preserved, and pending sets below. Inventory and user confirmation still happen in this guard; the helper never deletes or mutates project files.

### Theme identifier only

Preserve `AGENDA.md`, source summaries, and generated media. Inventory `IMAGE_SPEC.md`, `DIAGRAM_SPEC.md`, `PRESENTASJON.md`, `PRESENTASJON.html`, `PRESENTASJON.pdf`, Marp configuration, and the locked Theme Package as stale. Warn that preserved media may no longer match Theme Treatment. After confirmation, remove stale text/configuration, set Generation, Images, Diagrams, and Proofread to `pending`, then write Discovery. Do not offer the media-deletion option for this focused path.

### External Font Override only

Preserve the Agenda, both Media Specs, source summaries, generated media, and the locked Theme Package. Inventory only `PRESENTASJON.md`, `PRESENTASJON.html`, and `PRESENTASJON.pdf` as stale. After confirmation, remove them and set Generation and Proofread to `pending`; leave Images and Diagrams unchanged.

### Any broader Discovery change

Use the general protocol and stale-file map above.
