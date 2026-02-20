# Photo Culler

Fast browser-based photo culling for JPEG folders.

## Quick start

```powershell
python -m http.server 8000
```

Open `http://localhost:8000`.

## What it does (Slice 1)

- Open folder with JPEG files (`.jpg`, `.jpeg`)
- Show one image at a time
- Keep/Skip with auto-advance
- Transfer kept files to destination
- Exit/clear session

## Files

- `web/index.html` - app shell
- `web/styles.css` - UI styling
- `web/app.js` - app logic
- `HOW_TO.md` - step-by-step usage guide
- `PROJECT_BRIEF.md` - brief and slices

## Legacy

- `app.py` is the older desktop prototype and is not required for browser mode.
