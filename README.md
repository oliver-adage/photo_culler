# Photo Culler

Fast browser-based photo culling for JPEG folders.

## Install (Portable Windows Build)

For non-developers / friends:

1. Go to the GitHub repo releases page
2. Download `PhotoCuller-windows-portable.zip`
3. Extract it
4. Run `PhotoCuller.exe`

Notes:

- Windows 10/11 is the supported platform for direct camera import (MTP via Windows shell bridge).
- The app starts a local server and opens in your browser automatically.

## Quick start

```powershell
python native_server.py
```

Open `http://localhost:8000` (browser auto-open is enabled by default).

If you only need local folder browsing (no direct camera support), `python -m http.server 8000` still works.

If port `8000` is busy, `native_server.py` will automatically choose another port and print the URL.

## Build A Portable Version (Developer)

```powershell
.\build_portable.ps1
```

Output:

- `dist\PhotoCuller\PhotoCuller.exe`

## CI / Release

- Every push triggers a GitHub Actions Windows portable build and uploads an artifact
- Pushing a version tag like `v0.1.0` also publishes a GitHub Release with the portable zip attached

## What it does (Slice 1)

- Open folder with JPEG files (`.jpg`, `.jpeg`)
- Show one image at a time
- Keep/Skip with auto-advance
- Back + Undo during review
- Clickable thumbnail filmstrip with keep/skip status
- Transfer kept files to destination
- Exit/clear session

## Files

- `web/index.html` - app shell
- `web/styles.css` - UI styling
- `web/app.js` - app logic
- `native_server.py` - Windows native camera bridge + static server
- `build_portable.ps1` - local Windows portable build script (PyInstaller)
- `requirements-build.txt` - build-time dependency list (PyInstaller)
- `.github/workflows/build-portable-windows.yml` - builds portable artifact on every push; publishes release asset on `v*` tags
- `CONTRIBUTING.md` - workflow, branching, CI build notes
- `scripts/install-hooks.ps1` - installs local pre-push hook to block direct pushes to `main`
- `HOW_TO.md` - step-by-step usage guide
- `PROJECT_BRIEF.md` - brief and slices

## Legacy

- `app.py` is the older desktop prototype and is not required for browser mode.
