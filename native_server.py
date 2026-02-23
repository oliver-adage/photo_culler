import argparse
import json
import mimetypes
import shutil
import subprocess
import tempfile
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
SESSIONS_DIR = Path(tempfile.gettempdir()) / "photo_culler_native_sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
CURRENT_SESSION_DIR: Path | None = None


POWERSHELL_IMPORT_SCRIPT = r"""param(
  [string]$TargetDir,
  [string]$DevicePath = '',
  [string]$FolderPath = ''
)
$ErrorActionPreference = 'Stop'

function Get-ChildFolderByName($folderItem, $name) {
  foreach ($child in $folderItem.GetFolder.Items()) {
    if ($child.IsFolder -and $child.Name -eq $name) { return $child }
  }
  return $null
}

function Get-DeviceCandidates($shell) {
  $pc = $shell.Namespace(17)
  if (-not $pc) { return @() }
  return @(
    $pc.Items() | Where-Object {
      $_.IsFolder -and -not $_.IsFileSystem -and $_.Path -match 'usb#'
    }
  )
}

function Get-JpegItemsInFolder($folderItem) {
  $items = @()
  foreach ($child in $folderItem.GetFolder.Items()) {
    if ($child.IsFolder) { continue }
    if ($child.Type -match 'JP(E)?G') { $items += $child }
  }
  return $items
}

function Get-DcimLeafFolders($cameraDevice) {
  $results = @()
  foreach ($top in $cameraDevice.GetFolder.Items()) {
    if (-not $top.IsFolder) { continue }
    foreach ($slot in $top.GetFolder.Items()) {
      if (-not $slot.IsFolder) { continue }
      $dcim = Get-ChildFolderByName $slot 'DCIM'
      if (-not $dcim) { continue }
      foreach ($leaf in $dcim.GetFolder.Items()) {
        if ($leaf.IsFolder) { $results += $leaf }
      }
    }
  }
  return $results
}

function Select-BestFolder($folders) {
  # Avoid expensive metadata reads across many MTP files; prefer folder-name sort.
  $sorted = @($folders | Sort-Object Name -Descending)
  foreach ($folder in $sorted) {
    $jpegItems = Get-JpegItemsInFolder $folder
    if ($jpegItems.Count -eq 0) { continue }
    return [pscustomobject]@{
      Folder = $folder
      JpegItems = $jpegItems
      FolderName = $folder.Name
    }
  }
  return $null
}

function Find-SelectedFolder($devices, $devicePath, $folderPath) {
  foreach ($dev in $devices) {
    if ($devicePath -and $dev.Path -ne $devicePath) { continue }
    $folders = Get-DcimLeafFolders $dev
    foreach ($folder in $folders) {
      if ($folderPath -and $folder.Path -ne $folderPath) { continue }
      $jpegItems = Get-JpegItemsInFolder $folder
      if ($jpegItems.Count -eq 0) { continue }
      return [pscustomobject]@{
        Device = $dev
        Folder = $folder
        JpegItems = $jpegItems
        FolderName = $folder.Name
      }
    }
  }
  return $null
}

function Wait-ForCopies($dirPath, $expectedCount) {
  $deadline = (Get-Date).AddMinutes(10)
  do {
    Start-Sleep -Milliseconds 400
    $count = (Get-ChildItem -LiteralPath $dirPath -File -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($count -ge $expectedCount) { return }
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for files to copy from camera."
}

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

$shell = New-Object -ComObject Shell.Application
$devices = Get-DeviceCandidates $shell
if ($devices.Count -eq 0) { throw 'No camera-like Windows Shell device found.' }

$selected = $null
$deviceName = $null

if ($DevicePath -or $FolderPath) {
  $selected = Find-SelectedFolder $devices $DevicePath $FolderPath
  if ($null -eq $selected) {
    throw 'Selected camera folder not found or contains no JPEG files.'
  }
  $deviceName = $selected.Device.Name
} else {
  foreach ($dev in $devices) {
    $folders = Get-DcimLeafFolders $dev
    $auto = Select-BestFolder $folders
    if ($null -ne $auto) {
      $selected = $auto
      $deviceName = $dev.Name
      break
    }
  }
}
if ($null -eq $selected) { throw 'No JPEG folder found under camera DCIM.' }

$destNs = $shell.Namespace($TargetDir)
if (-not $destNs) { throw "Could not open destination folder namespace: $TargetDir" }

$expected = 0
foreach ($item in $selected.JpegItems) {
  $destNs.CopyHere($item, 16)
  $expected += 1
}

Wait-ForCopies $TargetDir $expected

[pscustomobject]@{
  deviceName = $deviceName
  sourceFolder = $selected.FolderName
  copied = $expected
} | ConvertTo-Json -Compress
"""

POWERSHELL_ENUM_SCRIPT = r"""param()
$ErrorActionPreference = 'Stop'

function Get-ChildFolderByName($folderItem, $name) {
  foreach ($child in $folderItem.GetFolder.Items()) {
    if ($child.IsFolder -and $child.Name -eq $name) { return $child }
  }
  return $null
}

function Get-DeviceCandidates($shell) {
  $pc = $shell.Namespace(17)
  if (-not $pc) { return @() }
  return @(
    $pc.Items() | Where-Object {
      $_.IsFolder -and -not $_.IsFileSystem -and $_.Path -match 'usb#'
    }
  )
}

function Get-DcimLeafFolders($cameraDevice) {
  $results = @()
  foreach ($top in $cameraDevice.GetFolder.Items()) {
    if (-not $top.IsFolder) { continue }
    foreach ($slot in $top.GetFolder.Items()) {
      if (-not $slot.IsFolder) { continue }
      $dcim = Get-ChildFolderByName $slot 'DCIM'
      if (-not $dcim) { continue }
      foreach ($leaf in $dcim.GetFolder.Items()) {
        if ($leaf.IsFolder) { $results += $leaf }
      }
    }
  }
  return $results
}

function Get-JpegCount($folderItem) {
  $count = 0
  foreach ($child in $folderItem.GetFolder.Items()) {
    if ($child.IsFolder) { continue }
    if ($child.Type -match 'JP(E)?G') { $count += 1 }
  }
  return $count
}

$shell = New-Object -ComObject Shell.Application
$devices = Get-DeviceCandidates $shell

$payload = @()
foreach ($dev in $devices) {
  $folders = @()
  foreach ($folder in (Get-DcimLeafFolders $dev | Sort-Object Name -Descending)) {
    $jpegCount = Get-JpegCount $folder
    if ($jpegCount -le 0) { continue }
    $folders += [pscustomobject]@{
      name = $folder.Name
      path = $folder.Path
      jpegCount = $jpegCount
    }
  }

  if ($folders.Count -gt 0) {
    $payload += [pscustomobject]@{
      name = $dev.Name
      path = $dev.Path
      folders = $folders
    }
  }
}

$payload | ConvertTo-Json -Depth 5 -Compress
"""


class PhotoCullerNativeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/native/status":
            return self._json_response(
                {
                    "ok": True,
                    "mode": "native",
                    "cameraBridge": True,
                }
            )
        if parsed.path == "/api/native/cameras":
            return self._list_cameras()
        if parsed.path.startswith("/api/native/session-file/"):
            return self._serve_session_file(parsed.path)
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/native/import-camera":
            return self._import_camera_folder(self._read_json_body())
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")

    def translate_path(self, path):
        translated = super().translate_path(path)
        p = Path(translated)
        if p == ROOT:
            return str(ROOT / "index.html")
        return translated

    def _run_powershell_json_script(self, script_text: str, args: list[str], timeout_sec: int = 120):
        work_dir = SESSIONS_DIR / next(tempfile._get_candidate_names())  # noqa: SLF001
        work_dir.mkdir(parents=True, exist_ok=True)
        script_path = work_dir / "_script.ps1"
        script_path.write_text(script_text, encoding="utf-8")
        try:
            result = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    str(script_path),
                    *args,
                ],
                capture_output=True,
                text=True,
                timeout=timeout_sec,
                check=False,
            )
            if result.returncode != 0:
                stderr = (result.stderr or "").strip()
                stdout = (result.stdout or "").strip()
                raise RuntimeError(stderr or stdout or "PowerShell command failed.")
            text = (result.stdout or "").strip()
            if not text:
                return None
            return json.loads(text.splitlines()[-1])
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    def _list_cameras(self):
        try:
            payload = self._run_powershell_json_script(POWERSHELL_ENUM_SCRIPT, [], timeout_sec=180)
        except subprocess.TimeoutExpired:
            return self._json_response({"ok": False, "error": "Camera enumeration timed out."}, status=500)
        except Exception as exc:
            return self._json_response({"ok": False, "error": str(exc)}, status=500)
        return self._json_response({"ok": True, "cameras": payload or []})

    def _import_camera_folder(self, request_body=None):
        request_body = request_body or {}
        selected_device_path = request_body.get("devicePath", "")
        selected_folder_path = request_body.get("folderPath", "")
        result = None
        session_dir = None
        last_error = "Camera import failed."

        # MTP devices often return transient "resource in use" errors if Explorer/Photos
        # touched the device recently. Retry a few times with backoff.
        for attempt in range(1, 5):
            session_dir = SESSIONS_DIR / next(tempfile._get_candidate_names())  # noqa: SLF001
            session_dir.mkdir(parents=True, exist_ok=True)
            script_path = session_dir / "_import_camera.ps1"
            script_path.write_text(POWERSHELL_IMPORT_SCRIPT, encoding="utf-8")

            try:
                result = subprocess.run(
                    [
                        "powershell",
                        "-NoProfile",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-File",
                        str(script_path),
                        "-TargetDir",
                        str(session_dir),
                        "-DevicePath",
                        selected_device_path,
                        "-FolderPath",
                        selected_folder_path,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=60 * 15,
                    check=False,
                )
            except subprocess.TimeoutExpired:
                shutil.rmtree(session_dir, ignore_errors=True)
                return self._json_response({"ok": False, "error": "Camera import timed out."}, status=500)

            if result.returncode == 0:
                break

            stderr = (result.stderr or "").strip()
            stdout = (result.stdout or "").strip()
            last_error = stderr or stdout or "Camera import failed."
            is_resource_lock = "resource is in use" in last_error.lower()

            shutil.rmtree(session_dir, ignore_errors=True)
            session_dir = None

            if not is_resource_lock or attempt == 4:
                return self._json_response({"ok": False, "error": last_error}, status=500)

            time.sleep(1.5 * attempt)

        if not result or result.returncode != 0 or not session_dir:
            return self._json_response({"ok": False, "error": last_error}, status=500)

        try:
            meta = json.loads((result.stdout or "{}").strip().splitlines()[-1])
        except Exception:
            meta = {}

        jpgs = sorted(
            [
                path
                for path in session_dir.iterdir()
                if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg"}
            ],
            key=lambda p: p.name.lower(),
        )
        if not jpgs:
            shutil.rmtree(session_dir, ignore_errors=True)
            return self._json_response({"ok": False, "error": "No JPEG files were copied from camera."}, status=500)

        # Clean previous session once a new one is ready.
        global CURRENT_SESSION_DIR
        if CURRENT_SESSION_DIR and CURRENT_SESSION_DIR.exists():
            shutil.rmtree(CURRENT_SESSION_DIR, ignore_errors=True)
        CURRENT_SESSION_DIR = session_dir

        images = [
            {
                "path": p.name,
                "name": p.name,
                "url": f"/api/native/session-file/{p.name}",
            }
            for p in jpgs
        ]

        payload = {
            "ok": True,
            "source": "camera",
            "deviceName": meta.get("deviceName"),
            "sourceFolder": meta.get("sourceFolder"),
            "count": len(images),
            "images": images,
        }
        return self._json_response(payload)

    def _serve_session_file(self, api_path: str):
        if not CURRENT_SESSION_DIR or not CURRENT_SESSION_DIR.exists():
            return self._json_response({"ok": False, "error": "No active camera session."}, status=404)

        filename = unquote(api_path.removeprefix("/api/native/session-file/"))
        target = (CURRENT_SESSION_DIR / filename).resolve()
        session_root = CURRENT_SESSION_DIR.resolve()
        try:
            target.relative_to(session_root)
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN, "Invalid path")
            return
        if not target.exists() or not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(target.stat().st_size))
        self.end_headers()
        with target.open("rb") as f:
            shutil.copyfileobj(f, self.wfile)

    def _json_response(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}


def main():
    parser = argparse.ArgumentParser(description="Photo Culler native server (Windows camera bridge)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    args = parser.parse_args()

    server = ThreadingHTTPServer(("127.0.0.1", args.port), PhotoCullerNativeHandler)
    print(f"Photo Culler native server running on http://127.0.0.1:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
