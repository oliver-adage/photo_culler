# Photo Culler - How To

## 1. Start the app

From the project folder, run:

```powershell
python -m http.server 8000
```

Open:

- `http://localhost:8000`

## 2. Review photos

1. Click **Open Folder**.
2. Select the camera/card folder containing `.jpg`/`.jpeg` files.
3. Review one image at a time.
4. Click:
   - **Keep** to mark for transfer
   - **Skip** to ignore
5. The app auto-advances after each choice.

Keyboard shortcuts:

- `K` = Keep
- `S` = Skip
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
python -m http.server 8080
```

Then open `http://localhost:8080`.
