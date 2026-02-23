# Photo Culler - How To

## Install (for friends / non-developers)

1. Open the GitHub repository Releases page
2. Download the latest `PhotoCuller-windows-portable.zip`
3. Extract the zip to a folder
4. Run `PhotoCuller.exe`

The app opens in your browser automatically.

## 1. Start the app (developer mode)

From the project folder, run:

```powershell
python native_server.py
```

Open:

- `http://localhost:8000`

Why this server:

- `native_server.py` enables direct Windows camera import (MTP / Explorer-visible devices) via a native bridge.
- `python -m http.server` is still available for local-folder-only use, but cannot directly browse many cameras in the browser picker.
- If port `8000` is busy, `native_server.py` can auto-select another port and will print/open the correct URL.

## 2. Review photos

1. Click **Open Folder** for a local folder, or **Open Camera** for direct camera import.
2. Review one image at a time.
3. Click:
   - **Keep** to mark for transfer
   - **Skip** to ignore
4. The app auto-advances after each choice.
5. Optional review helpers:
   - **Back** to go to previous image
   - **Undo** to reverse the last keep/skip action and return to that image
   - Click a thumbnail in the filmstrip to jump directly to an image

### Direct camera import (Windows, recommended for camera connection)

1. Start with `python native_server.py` (or run `PhotoCuller.exe`)
2. Click **Open Camera**
3. Select your camera
4. Select the camera folder (for example `110_FUJI`)
5. The app imports JPEGs from that folder for review

Notes:

- First import can take time (camera speed + number of images)
- This avoids the browser file picker limitation that may hide cameras even when Explorer can see them
- If you see `resource is in use`, close Explorer/Photos/Lightroom windows using the camera and retry

Keyboard shortcuts:

- `K` = Keep
- `S` = Skip
- `Left Arrow` = Back
- `Z` = Undo last action
- `Esc` = Exit/Clear session

## 3. Transfer kept files

1. Click **Transfer**.
2. Choose destination folder.
3. Files marked Keep are copied.

Notes:

- On Chrome/Edge: writes directly to selected destination folder.
- On browsers without folder-write support: falls back to downloads.
- If destination contains a same-name file, app creates a unique name (`_1`, `_2`, ...).

## 4. Exit

- Click **Exit** (or press `Esc`) to clear the current session.

## Troubleshooting

- If the app does not refresh after changes, do a hard refresh: `Ctrl+F5`.
- If `localhost:8000` is busy, run on another port:

```powershell
python native_server.py --port 8080
```

Then open `http://localhost:8080`.

## Build a portable version (developer)

```powershell
.\build_portable.ps1
```

Output:

- `dist\PhotoCuller\PhotoCuller.exe`
- CI also builds a portable zip artifact on every push
