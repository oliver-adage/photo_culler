
# MVP Goal
An app that lets me review images from a camera connected as a card reader, highlight the ones to keep and in the end transfer all of them into a target folder.

# User flow
1. Connect camera and open folder with jpegs
2. Display first picture large. 
3. Select "keep" or "skip"
4. Automatically continue to next picture.
5. After all pictures are displayed (or "Done" is clicked) ask for a target destination to save the pictures that are marked as "keep"

# Slices
## Slice 1.
User can perform core functionality such as
- Open folder on connected camera
- "Keep" or "skip" images
- "Transfer" to destination folder
- "Exit"

## Slice 2.
Stability
- Save a file that keeps track of all selected images to pick up where I left off if app is closed

## Slice 3.
Convenience
- Auto detect connected camera and open latest folder after first connection

## Nice to haves.
Extra functionality
- Extract the core file name such that I can apply the selection of the jpeg files also in the folder for raw files
- Add function to transfer Raw files from a separate folder on the camera to a separate folder (not same as jpeg.)

# Current implementation notes (Feb 20, 2026)
- Slice 1 is currently implemented as a browser-based app in `web/`
- Start locally with `python -m http.server 8000` and open `http://localhost:8000`
- Legacy desktop prototype remains in `app.py` (not primary path)

# Development workflow (Git)
## Branching
- `main` = always runnable / latest stable version
- Create one branch per task or slice improvement
- Branch naming suggestion:
  - `feature/slice-2-resume-state`
  - `feature/slice-3-camera-detect`
  - `fix/image-orientation`
  - `docs/project-brief-update`

## Daily workflow
1. Pull latest `main`
2. Create a feature branch
3. Implement one small, testable change
4. Run app locally and test the affected flow
5. Commit with a clear message
6. Push branch and merge into `main`

## Commit message style (simple)
- `feat: add resume state file for selections`
- `fix: preserve full image in canvas renderer`
- `docs: expand project brief workflow section`
- `refactor: split transfer logic from review UI`

## Merge guidelines
- Prefer small merges over large batches
- Merge only when the app still supports the full Slice 1 flow
- If a feature is partial, hide it behind UI text/disabled button rather than breaking the current flow

# Definition of done (per slice)
## Slice 1 done when
- Open folder works in browser
- Keep/Skip advances correctly through all images
- Transfer copies kept files (or browser fallback download works)
- Exit clears session
- Basic manual test completed on at least one real camera/card folder

## Slice 2 done when
- Selection state is saved and restored after closing/reopening app
- State file format is documented
- Corrupted/missing state file is handled gracefully

## Slice 3 done when
- Camera/card folder can be detected automatically (when supported by chosen approach)
- Auto-open behavior is reliable and optional (user can still choose folder manually)
- Fallback path remains available when auto-detect fails

# Testing checklist (manual)
- Mixed landscape + portrait JPEGs display fully
- Large folders (100+ images) remain responsive enough
- Duplicate filenames in destination are handled safely
- Transfer to destination folder succeeds in Chrome/Edge
- Browser fallback download path works when folder write is unavailable

# Recommended roadmap (next steps)
## Priority order
1. Slice 2 (resume state)
2. Reliability hardening for Slice 1 transfer flow
3. Slice 3 (camera detection / convenience)
4. RAW pairing + transfer features
5. Review speed improvements (thumbnails, undo, filters)

## Suggested implementation plan
### Phase A: Slice 2 (resume state)
- Save session state in browser storage (fastest path) and/or sidecar JSON file
- Track:
  - source folder identifier/path hint
  - image order
  - keep/skip decisions
  - current index
  - timestamp
- Add "Resume previous session?" prompt on startup when matching data exists
- Add "Reset session" action

### Phase B: Transfer reliability improvements
- Preview transfer summary before copy (kept count, destination path)
- Add progress UI with cancel option (if possible)
- Add transfer report (copied / skipped / failed)
- Preserve folder structure optionally when source has subfolders

### Phase C: Slice 3 (auto-detect camera/card)
- Define platform approach first (Windows-focused is simplest initially)
- Detect newly mounted drives / likely DCIM folder
- Suggest latest image folder automatically, but require user confirmation
- Keep manual "Open Folder" flow as fallback

### Phase D: RAW support (nice-to-have -> likely core for photographer workflow)
- Pair JPEG + RAW by base filename (e.g. `IMG_1234.JPG` + `IMG_1234.CR3`)
- Option to apply keep decisions to RAW files automatically
- Transfer JPEG and RAW to separate destinations
- Generate a transfer summary showing matched / unmatched RAW files

# Additional feature ideas (proposed)
## High-value UX improvements
- `Undo last action` (very useful while culling quickly)
- `Back` navigation to revisit previous image
- Filmstrip thumbnail rail for orientation and position awareness
- "Keep only" review mode after first pass
- Jump to image number / filename search

## Workflow and safety
- Autosave after every decision
- Export/import selection list as JSON/CSV
- Dry-run transfer mode (preview without copying)
- Duplicate detection warning in destination (same name + size/date)
- Optional checksum verification after transfer (slower, safer)

## Performance and scale
- Image preloading for next/previous file to reduce latency
- Background thumbnail generation cache
- Virtualized thumbnail list for very large folders
- Memory budget limits for huge sessions

## File handling / photography-specific
- Support additional image formats (`.png`, `.heic`, `.webp`) if needed
- RAW formats list configurable (`.CR3`, `.NEF`, `.ARW`, `.RAF`, etc.)
- Custom file naming templates on transfer
- Date-based destination folders (e.g. `YYYY-MM-DD Shoot Name`)
- Sidecar metadata export (kept/skipped decisions)

## Review experience
- Fullscreen mode
- Zoom + pan for focus checks
- Rotate view (non-destructive) for images with bad orientation metadata
- Keyboard customization (e.g. arrows, space, X)
- Color labels / star ratings (future beyond binary keep/skip)

# Open decisions (to clarify before Slice 2/3)
- Should resume state be stored only in browser (per device/browser) or also in a portable file next to images?
- Is the app intended to be browser-only long term, or should a packaged desktop app return later?
- Is Windows the primary target platform for camera auto-detection?
- Should transfer preserve original folder structure or flatten into one destination folder by default?
