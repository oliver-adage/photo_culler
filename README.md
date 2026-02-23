# Photo Culler

Fast browser-based photo culling for JPEG folders.

## Quick start

```powershell
python native_server.py
```

Open `http://localhost:8000`.

If you only need local folder browsing (no direct camera support), `python -m http.server 8000` still works.

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
- `HOW_TO.md` - step-by-step usage guide
- `PROJECT_BRIEF.md` - brief and slices

## Legacy

- `app.py` is the older desktop prototype and is not required for browser mode.
