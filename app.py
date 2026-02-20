import shutil
import subprocess
import tempfile
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg"}


class PhotoCullerApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Photo Culler - Slice 1")
        self.root.geometry("1200x800")

        self.image_paths: list[Path] = []
        self.kept_paths: set[Path] = set()
        self.converted_cache: dict[Path, Path] = {}
        self.temp_dir = Path(tempfile.mkdtemp(prefix="photo_culler_"))
        self.current_index = -1
        self.current_photo: tk.PhotoImage | None = None

        self._build_ui()
        self._bind_shortcuts()
        self.root.protocol("WM_DELETE_WINDOW", self.exit_app)

    def _build_ui(self) -> None:
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(1, weight=1)

        controls = ttk.Frame(self.root, padding=12)
        controls.grid(row=0, column=0, sticky="ew")
        controls.columnconfigure(1, weight=1)

        self.open_button = ttk.Button(
            controls, text="Open Folder", command=self.open_folder
        )
        self.open_button.grid(row=0, column=0, padx=(0, 8))

        self.status_var = tk.StringVar(value="No folder selected")
        status_label = ttk.Label(controls, textvariable=self.status_var)
        status_label.grid(row=0, column=1, sticky="w")

        self.keep_button = ttk.Button(
            controls, text="Keep (K)", command=self.keep_current, state="disabled"
        )
        self.keep_button.grid(row=0, column=2, padx=4)

        self.skip_button = ttk.Button(
            controls, text="Skip (S)", command=self.skip_current, state="disabled"
        )
        self.skip_button.grid(row=0, column=3, padx=4)

        self.transfer_button = ttk.Button(
            controls, text="Transfer", command=self.transfer_kept_files
        )
        self.transfer_button.grid(row=0, column=4, padx=4)

        self.exit_button = ttk.Button(controls, text="Exit", command=self.exit_app)
        self.exit_button.grid(row=0, column=5, padx=(4, 0))

        self.image_frame = ttk.Frame(self.root, padding=(12, 0, 12, 12))
        self.image_frame.grid(row=1, column=0, sticky="nsew")
        self.image_frame.columnconfigure(0, weight=1)
        self.image_frame.rowconfigure(0, weight=1)

        self.image_label = ttk.Label(
            self.image_frame, text="Open a folder with JPEG files to start.", anchor="center"
        )
        self.image_label.grid(row=0, column=0, sticky="nsew")

        self.meta_var = tk.StringVar(value="")
        self.meta_label = ttk.Label(self.image_frame, textvariable=self.meta_var)
        self.meta_label.grid(row=1, column=0, sticky="w", pady=(8, 0))

    def _bind_shortcuts(self) -> None:
        self.root.bind("<Key-k>", lambda _: self.keep_current())
        self.root.bind("<Key-K>", lambda _: self.keep_current())
        self.root.bind("<Key-s>", lambda _: self.skip_current())
        self.root.bind("<Key-S>", lambda _: self.skip_current())
        self.root.bind("<Escape>", lambda _: self.exit_app())

    def open_folder(self) -> None:
        selected = filedialog.askdirectory(title="Select source folder (camera/card)")
        if not selected:
            return

        folder = Path(selected)
        self.image_paths = sorted(
            [
                path
                for path in folder.iterdir()
                if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
            ]
        )
        self.kept_paths.clear()
        self.converted_cache.clear()
        self.current_index = 0 if self.image_paths else -1

        if not self.image_paths:
            self._set_navigation_enabled(False)
            self.image_label.configure(text="No JPG/JPEG files found in selected folder.", image="")
            self.current_photo = None
            self.status_var.set(f"{folder} - 0 images")
            self.meta_var.set("")
            return

        self._set_navigation_enabled(True)
        self._show_current_image()

    def keep_current(self) -> None:
        current = self._current_path()
        if current is None:
            return
        self.kept_paths.add(current)
        self._advance()

    def skip_current(self) -> None:
        current = self._current_path()
        if current is None:
            return
        self.kept_paths.discard(current)
        self._advance()

    def transfer_kept_files(self) -> None:
        if not self.kept_paths:
            messagebox.showinfo("Nothing to transfer", "No files are marked as keep.")
            return

        destination = filedialog.askdirectory(title="Select destination folder")
        if not destination:
            return

        destination_dir = Path(destination)
        copied = 0
        for src in sorted(self.kept_paths):
            target = destination_dir / src.name
            target = self._resolve_unique_target(target)
            shutil.copy2(src, target)
            copied += 1

        messagebox.showinfo("Transfer complete", f"Copied {copied} file(s) to:\n{destination_dir}")

    def _show_current_image(self) -> None:
        current = self._current_path()
        if current is None:
            self._render_done_state()
            return

        try:
            raw = self._load_photo_image(current)
            frame_width = max(self.image_label.winfo_width(), 600)
            frame_height = max(self.image_label.winfo_height(), 450)
            width = max(raw.width(), 1)
            height = max(raw.height(), 1)
            scale = max((width + frame_width - 1) // frame_width, (height + frame_height - 1) // frame_height, 1)
            self.current_photo = raw.subsample(scale, scale) if scale > 1 else raw
            self.image_label.configure(image=self.current_photo, text="")
        except Exception as exc:
            self.image_label.configure(
                image="",
                text=(
                    "Could not open image:\n"
                    f"{current.name}\n"
                    f"{exc}"
                ),
            )
            self.current_photo = None

        total = len(self.image_paths)
        self.status_var.set(f"Image {self.current_index + 1}/{total} | Kept: {len(self.kept_paths)}")
        self.meta_var.set(current.name)

    def _advance(self) -> None:
        self.current_index += 1
        if self.current_index >= len(self.image_paths):
            self._render_done_state()
            if self.kept_paths:
                wants_transfer = messagebox.askyesno(
                    "Review complete",
                    f"Review complete. {len(self.kept_paths)} file(s) marked as keep.\nTransfer now?",
                )
                if wants_transfer:
                    self.transfer_kept_files()
            return
        self._show_current_image()

    def _render_done_state(self) -> None:
        self._set_navigation_enabled(False)
        self.image_label.configure(image="", text="No more images. Click Transfer or Exit.")
        self.current_photo = None
        self.status_var.set(f"Done | Kept: {len(self.kept_paths)}")
        self.meta_var.set("")

    def _set_navigation_enabled(self, enabled: bool) -> None:
        state = "normal" if enabled else "disabled"
        self.keep_button.configure(state=state)
        self.skip_button.configure(state=state)

    def _current_path(self) -> Path | None:
        if 0 <= self.current_index < len(self.image_paths):
            return self.image_paths[self.current_index]
        return None

    def _resolve_unique_target(self, target: Path) -> Path:
        if not target.exists():
            return target
        stem = target.stem
        suffix = target.suffix
        counter = 1
        while True:
            candidate = target.with_name(f"{stem}_{counter}{suffix}")
            if not candidate.exists():
                return candidate
            counter += 1

    def _load_photo_image(self, source: Path) -> tk.PhotoImage:
        try:
            return tk.PhotoImage(file=str(source))
        except tk.TclError as original_error:
            if source.suffix.lower() not in SUPPORTED_EXTENSIONS:
                raise original_error
            converted = self._convert_jpeg_to_png(source)
            try:
                return tk.PhotoImage(file=str(converted))
            except tk.TclError:
                raise original_error

    def _convert_jpeg_to_png(self, source: Path) -> Path:
        cached = self.converted_cache.get(source)
        if cached and cached.exists():
            return cached

        output = self.temp_dir / f"{source.stem}_{abs(hash(source))}.png"
        src_ps = str(source).replace("'", "''")
        dst_ps = str(output).replace("'", "''")
        script = (
            "Add-Type -AssemblyName System.Drawing; "
            f"$img=[System.Drawing.Image]::FromFile('{src_ps}'); "
            f"try{{$img.Save('{dst_ps}', [System.Drawing.Imaging.ImageFormat]::Png)}} "
            "finally{$img.Dispose()}"
        )
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            check=True,
            capture_output=True,
            text=True,
        )
        self.converted_cache[source] = output
        return output

    def exit_app(self) -> None:
        try:
            shutil.rmtree(self.temp_dir, ignore_errors=True)
        finally:
            self.root.destroy()


def main() -> None:
    root = tk.Tk()
    app = PhotoCullerApp(root)

    def on_resize(_: tk.Event) -> None:
        if app.current_index >= 0 and app.current_index < len(app.image_paths):
            app._show_current_image()

    root.bind("<Configure>", on_resize)
    root.mainloop()


if __name__ == "__main__":
    main()
