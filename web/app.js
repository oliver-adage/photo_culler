const folderInput = document.getElementById("folderInput");
const openCameraBtn = document.getElementById("openCameraBtn");
const openBtn = document.getElementById("openBtn");
const transferBtn = document.getElementById("transferBtn");
const exitBtn = document.getElementById("exitBtn");
const backBtn = document.getElementById("backBtn");
const undoBtn = document.getElementById("undoBtn");
const keepBtn = document.getElementById("keepBtn");
const skipBtn = document.getElementById("skipBtn");
const doneBtn = document.getElementById("doneBtn");
const imageStage = document.getElementById("imageStage");
const filmstrip = document.getElementById("filmstrip");
const photoCanvas = document.getElementById("photoCanvas");
const canvasCtx = photoCanvas.getContext("2d");
const emptyState = document.getElementById("emptyState");
const statusText = document.getElementById("statusText");
const metaText = document.getElementById("metaText");

const allowedExtensions = [".jpg", ".jpeg"];

let images = [];
let currentIndex = -1;
let currentImage = null;
let renderVersion = 0;
let nativeApiAvailable = false;
let nativeImportInProgress = false;
const kept = new Set();
const decisions = new Map();
const history = [];
const thumbButtons = new Map();

function ext(name) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function resetEmptyState(title, text) {
  emptyState.querySelector("h2").textContent = title;
  emptyState.querySelector("p").textContent = text;
}

function revokeThumbUrls() {
  for (const entry of images) {
    if (entry.thumbUrl && entry.thumbUrl.startsWith("blob:")) {
      URL.revokeObjectURL(entry.thumbUrl);
      entry.thumbUrl = null;
    }
  }
}

function reviewedCount() {
  return decisions.size;
}

function canNavigateBack() {
  return images.length > 0 && (currentIndex > 0 || currentIndex >= images.length);
}

function updateButtonStates() {
  const hasSession = images.length > 0;
  const inRange = currentIndex >= 0 && currentIndex < images.length;
  keepBtn.disabled = !inRange;
  skipBtn.disabled = !inRange;
  doneBtn.disabled = !hasSession;
  backBtn.disabled = !canNavigateBack();
  undoBtn.disabled = history.length === 0;
  if (nativeImportInProgress) {
    openCameraBtn.disabled = true;
  }
}

function clearCanvas() {
  canvasCtx.clearRect(0, 0, photoCanvas.width || 1, photoCanvas.height || 1);
}

function clearPreview() {
  currentImage = null;
  renderVersion += 1;
  photoCanvas.style.display = "none";
  clearCanvas();
  emptyState.style.display = "block";
}

function drawContained(imageLike) {
  const stageWidth = Math.max(1, imageStage.clientWidth);
  const stageHeight = Math.max(1, imageStage.clientHeight);
  const dpr = window.devicePixelRatio || 1;

  photoCanvas.width = Math.max(1, Math.floor(stageWidth * dpr));
  photoCanvas.height = Math.max(1, Math.floor(stageHeight * dpr));
  photoCanvas.style.width = `${stageWidth}px`;
  photoCanvas.style.height = `${stageHeight}px`;

  canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvasCtx.clearRect(0, 0, stageWidth, stageHeight);

  const srcWidth = imageLike.naturalWidth || imageLike.width || 1;
  const srcHeight = imageLike.naturalHeight || imageLike.height || 1;
  const scale = Math.min(stageWidth / srcWidth, stageHeight / srcHeight);
  const drawWidth = srcWidth * scale;
  const drawHeight = srcHeight * scale;
  const dx = (stageWidth - drawWidth) / 2;
  const dy = (stageHeight - drawHeight) / 2;

  canvasCtx.drawImage(imageLike, dx, dy, drawWidth, drawHeight);
}

function loadImageFromUrl(url, label) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = () => {
      reject(new Error(`Could not decode image: ${label}`));
    };
    img.src = url;
  });
}

function loadImage(entry) {
  if (entry.url) {
    return loadImageFromUrl(entry.url, entry.path);
  }
  const objectUrl = URL.createObjectURL(entry.file);
  return loadImageFromUrl(objectUrl, entry.file.name).finally(() => URL.revokeObjectURL(objectUrl));
}

function applyDecisionAtIndex(index, nextDecision, { recordHistory = true } = {}) {
  if (index < 0 || index >= images.length) {
    return;
  }

  const path = images[index].path;
  const previousDecision = decisions.get(path) || null;
  if (previousDecision === nextDecision) {
    return;
  }

  if (recordHistory) {
    history.push({ index, previousDecision, nextDecision });
  }

  if (nextDecision === null) {
    decisions.delete(path);
    kept.delete(path);
  } else {
    decisions.set(path, nextDecision);
    if (nextDecision === "keep") {
      kept.add(path);
    } else {
      kept.delete(path);
    }
  }

  updateFilmstripStates();
  updateButtonStates();
}

function updateFilmstripStates() {
  for (let i = 0; i < images.length; i += 1) {
    const entry = images[i];
    const btn = thumbButtons.get(entry.path);
    if (!btn) {
      continue;
    }
    btn.classList.toggle("is-current", i === currentIndex);
    btn.classList.toggle("is-keep", decisions.get(entry.path) === "keep");
    btn.classList.toggle("is-skip", decisions.get(entry.path) === "skip");
  }
}

function scrollCurrentThumbIntoView() {
  if (currentIndex < 0 || currentIndex >= images.length) {
    return;
  }
  const entry = images[currentIndex];
  const btn = thumbButtons.get(entry.path);
  if (btn) {
    btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

function buildFilmstrip() {
  filmstrip.innerHTML = "";
  thumbButtons.clear();

    for (let i = 0; i < images.length; i += 1) {
      const entry = images[i];
      entry.thumbUrl = entry.url || URL.createObjectURL(entry.file);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "thumb";
    btn.dataset.index = String(i + 1);
    btn.title = entry.path;

    const img = document.createElement("img");
    img.src = entry.thumbUrl;
    img.alt = entry.path;
    img.loading = "lazy";
    btn.appendChild(img);

    filmstrip.appendChild(btn);
    thumbButtons.set(entry.path, btn);
  }

  updateFilmstripStates();
}

function updateStatusAndMeta() {
  const total = images.length;
  if (!total) {
    statusText.textContent = "No folder selected";
    metaText.textContent = "";
    return;
  }

  if (currentIndex >= 0 && currentIndex < total) {
    const entry = images[currentIndex];
    const decision = decisions.get(entry.path);
    const marker = decision ? ` | Current: ${decision}` : "";
    statusText.textContent = `Image ${currentIndex + 1}/${total} | Reviewed: ${reviewedCount()} | Kept: ${kept.size}${marker}`;
    metaText.textContent = entry.path;
    return;
  }

  statusText.textContent = `Done | Reviewed: ${reviewedCount()}/${total} | Kept: ${kept.size}`;
  metaText.textContent = "";
}

async function showImage(index) {
  if (index < 0 || index >= images.length) {
    renderDoneState();
    return;
  }

  currentIndex = index;
  updateButtonStates();
  updateFilmstripStates();
  scrollCurrentThumbIntoView();
  updateStatusAndMeta();

  const version = ++renderVersion;
  const entry = images[index];

  try {
    const img = await loadImage(entry);
    if (version !== renderVersion || index !== currentIndex) {
      return;
    }
    currentImage = img;
    drawContained(img);
    photoCanvas.style.display = "block";
    emptyState.style.display = "none";
  } catch (err) {
    if (version !== renderVersion) {
      return;
    }
    clearPreview();
    resetEmptyState("Could not display image", err.message);
    updateStatusAndMeta();
  }
}

function renderDoneState() {
  currentIndex = images.length;
  clearPreview();
  resetEmptyState("Review complete", "Click Transfer to copy kept images, or use Back/Undo to continue editing.");
  updateFilmstripStates();
  updateButtonStates();
  updateStatusAndMeta();
}

function gotoIndex(index) {
  showImage(index).catch((err) => {
    window.alert(`Could not render image: ${err.message}`);
  });
}

function resetSession(entries) {
  revokeThumbUrls();
  clearPreview();

  images = entries;
  decisions.clear();
  kept.clear();
  history.length = 0;
  currentIndex = images.length ? 0 : -1;

  resetEmptyState("Open a camera folder to start", "JPEG files are loaded locally in your browser.");

  if (!images.length) {
    filmstrip.innerHTML = "";
    statusText.textContent = "No JPEG files found in selected folder";
    metaText.textContent = "";
    updateButtonStates();
    return;
  }

  buildFilmstrip();
  updateButtonStates();
  gotoIndex(0);
}

function resetWithFiles(fileList) {
  const entries = Array.from(fileList)
    .filter((file) => allowedExtensions.includes(ext(file.name)))
    .map((file) => ({
      file,
      path: file.webkitRelativePath || file.name,
      thumbUrl: null,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  resetSession(entries);
}

function promptTransferAfterCompletion() {
  if (kept.size === 0) {
    return;
  }
  const wantsTransfer = window.confirm(`Review complete. ${kept.size} image(s) marked keep.\nTransfer now?`);
  if (wantsTransfer) {
    transferKept().catch((err) => {
      window.alert(`Transfer failed: ${err.message}`);
    });
  }
}

function advanceToNextImage() {
  if (currentIndex + 1 >= images.length) {
    renderDoneState();
    promptTransferAfterCompletion();
    return;
  }
  gotoIndex(currentIndex + 1);
}

function keepCurrent() {
  if (currentIndex < 0 || currentIndex >= images.length) {
    return;
  }
  applyDecisionAtIndex(currentIndex, "keep");
  advanceToNextImage();
}

function skipCurrent() {
  if (currentIndex < 0 || currentIndex >= images.length) {
    return;
  }
  applyDecisionAtIndex(currentIndex, "skip");
  advanceToNextImage();
}

function goBack() {
  if (!images.length) {
    return;
  }
  if (currentIndex >= images.length) {
    gotoIndex(images.length - 1);
    return;
  }
  if (currentIndex > 0) {
    gotoIndex(currentIndex - 1);
  }
}

function undoLastAction() {
  const action = history.pop();
  if (!action) {
    updateButtonStates();
    return;
  }
  applyDecisionAtIndex(action.index, action.previousDecision, { recordHistory: false });
  gotoIndex(action.index);
}

async function uniqueHandleFor(dirHandle, desiredName) {
  const dot = desiredName.lastIndexOf(".");
  const stem = dot >= 0 ? desiredName.slice(0, dot) : desiredName;
  const suffix = dot >= 0 ? desiredName.slice(dot) : "";

  for (let i = 0; i < 2000; i += 1) {
    const candidate = i === 0 ? desiredName : `${stem}_${i}${suffix}`;
    try {
      await dirHandle.getFileHandle(candidate, { create: false });
    } catch {
      return dirHandle.getFileHandle(candidate, { create: true });
    }
  }
  throw new Error("Could not find a unique destination filename.");
}

async function transferWithDirectoryPicker(files) {
  const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  let copied = 0;
  for (const file of files) {
    const handle = await uniqueHandleFor(dirHandle, file.name);
    const writable = await handle.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
    copied += 1;
    statusText.textContent = `Transferring ${copied}/${files.length}...`;
  }
  updateStatusAndMeta();
}

async function transferWithDownloads(files) {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    await new Promise((resolve) => setTimeout(resolve, 70));
  }
  updateStatusAndMeta();
}

async function transferKept() {
  if (kept.size === 0) {
    window.alert("No files are marked as keep.");
    return;
  }

  const selectedEntries = images.filter((entry) => kept.has(entry.path));
  const files = await Promise.all(selectedEntries.map(resolveTransferFile));

  if ("showDirectoryPicker" in window) {
    await transferWithDirectoryPicker(files);
    window.alert(`Transfer complete: ${files.length} file(s).`);
    return;
  }

  await transferWithDownloads(files);
  window.alert("Your browser does not support direct folder write. Kept files were downloaded instead.");
}

async function resolveTransferFile(entry) {
  if (entry.file) {
    return entry.file;
  }
  if (!entry.url) {
    throw new Error(`No file source available for ${entry.path}`);
  }
  const response = await fetch(entry.url);
  if (!response.ok) {
    throw new Error(`Failed to load ${entry.path} for transfer`);
  }
  const blob = await response.blob();
  return new File([blob], entry.name || entry.path, { type: blob.type || "image/jpeg" });
}

function exitApp() {
  revokeThumbUrls();
  images = [];
  kept.clear();
  decisions.clear();
  history.length = 0;
  thumbButtons.clear();
  filmstrip.innerHTML = "";
  currentIndex = -1;
  clearPreview();
  resetEmptyState("Session closed", "You can close this tab or open another folder.");
  statusText.textContent = "Session cleared";
  metaText.textContent = "";
  updateButtonStates();
}

async function readDirectoryHandle(dirHandle, prefix = "") {
  const results = [];
  for await (const [name, handle] of dirHandle.entries()) {
    const relPath = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") {
      const nested = await readDirectoryHandle(handle, relPath);
      results.push(...nested);
      continue;
    }
    if (!allowedExtensions.includes(ext(name))) {
      continue;
    }
    const file = await handle.getFile();
    results.push({ file, path: relPath, thumbUrl: null });
  }
  return results;
}

async function openSourceFolder() {
  if ("showDirectoryPicker" in window) {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "read" });
      const picked = await readDirectoryHandle(dirHandle);
      picked.sort((a, b) => a.path.localeCompare(b.path));
      resetSession(picked);
      return;
    } catch (err) {
      if (err && err.name === "AbortError") {
        return;
      }
      folderInput.click();
      return;
    }
  }
  folderInput.click();
}

async function openCameraNative() {
  if (!nativeApiAvailable) {
    window.alert("Native camera bridge is not available. Start the app with native_server.py.");
    return;
  }
  if (nativeImportInProgress) {
    return;
  }

  const selection = await chooseNativeCameraFolder();
  if (!selection) {
    updateStatusAndMeta();
    return;
  }

  nativeImportInProgress = true;
  openCameraBtn.disabled = true;
  statusText.textContent = "Importing JPEGs from camera...";
  metaText.textContent = `Importing ${selection.device.name} / ${selection.folder.name} (${selection.folder.jpegCount} JPEGs)...`;

  try {
    const response = await fetch("/api/native/import-camera", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        devicePath: selection.device.path,
        folderPath: selection.folder.path,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Failed to import from camera.");
    }

    const entries = (payload.images || []).map((img) => ({
      file: null,
      url: img.url,
      path: img.path,
      name: img.name || img.path,
      thumbUrl: null,
    }));
    resetSession(entries);
    statusText.textContent = `Camera: ${payload.deviceName || selection.device.name} | Folder: ${payload.sourceFolder || selection.folder.name} | ${entries.length} JPEGs loaded`;
  } finally {
    nativeImportInProgress = false;
    updateButtonStates();
    openCameraBtn.disabled = !nativeApiAvailable;
  }
}

async function fetchNativeCameras() {
  const response = await fetch("/api/native/cameras");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Failed to list cameras.");
  }
  if (Array.isArray(payload.cameras)) {
    return payload.cameras;
  }
  if (payload.cameras && typeof payload.cameras === "object") {
    return [payload.cameras];
  }
  return [];
}

function promptSelectIndex(title, items, formatLine) {
  if (!items.length) {
    return null;
  }
  const lines = items.map((item, i) => `${i + 1}. ${formatLine(item, i)}`);
  const answer = window.prompt(`${title}\n\n${lines.join("\n")}\n\nEnter number (or Cancel):`);
  if (answer === null) {
    return null;
  }
  const idx = Number.parseInt(answer, 10) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) {
    window.alert("Invalid selection.");
    return promptSelectIndex(title, items, formatLine);
  }
  return idx;
}

async function chooseNativeCameraFolder() {
  const cameras = await fetchNativeCameras();
  if (!cameras.length) {
    window.alert("No camera with JPEG folders found. Close Explorer/Photos and reconnect camera.");
    return null;
  }
  const cameraIndex = promptSelectIndex("Select camera", cameras, (cam) => `${cam.name} (${cam.folders.length} folder(s))`);
  if (cameraIndex === null) {
    return null;
  }
  const device = cameras[cameraIndex];
  const folderIndex = promptSelectIndex(
    `Select folder on ${device.name}`,
    device.folders,
    (folder) => `${folder.name} (${folder.jpegCount} JPEGs)`
  );
  if (folderIndex === null) {
    return null;
  }
  return { device, folder: device.folders[folderIndex] };
}

async function detectNativeApi() {
  try {
    const response = await fetch("/api/native/status");
    if (!response.ok) {
      nativeApiAvailable = false;
    } else {
      const payload = await response.json();
      nativeApiAvailable = Boolean(payload && payload.ok);
    }
  } catch {
    nativeApiAvailable = false;
  }

  openCameraBtn.disabled = !nativeApiAvailable;
  openCameraBtn.title = nativeApiAvailable
    ? "Import JPEGs directly from Windows camera shell device"
    : "Start app with native_server.py for direct camera support";
}

openBtn.addEventListener("click", () => {
  openSourceFolder().catch((err) => {
    window.alert(`Could not open folder: ${err.message}`);
  });
});

openCameraBtn.addEventListener("click", () => {
  openCameraNative().catch((err) => {
    window.alert(`Could not open camera: ${err.message}`);
    nativeImportInProgress = false;
    updateButtonStates();
    openCameraBtn.disabled = !nativeApiAvailable;
    updateStatusAndMeta();
  });
});

folderInput.addEventListener("change", (e) => {
  resetWithFiles(e.target.files || []);
  folderInput.value = "";
});

backBtn.addEventListener("click", goBack);
undoBtn.addEventListener("click", undoLastAction);
keepBtn.addEventListener("click", keepCurrent);
skipBtn.addEventListener("click", skipCurrent);
doneBtn.addEventListener("click", renderDoneState);
transferBtn.addEventListener("click", () => {
  transferKept().catch((err) => window.alert(`Transfer failed: ${err.message}`));
});
exitBtn.addEventListener("click", exitApp);

filmstrip.addEventListener("click", (e) => {
  const btn = e.target.closest(".thumb");
  if (!btn) {
    return;
  }
  const index = Number(btn.dataset.index) - 1;
  if (Number.isFinite(index)) {
    gotoIndex(index);
  }
});

window.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName?.toLowerCase() || "";
  if (tag === "input" || tag === "textarea") {
    return;
  }

  if ((e.key === "z" || e.key === "Z") && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    undoLastAction();
    return;
  }

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    goBack();
    return;
  }

  if (e.key === "k" || e.key === "K") {
    e.preventDefault();
    keepCurrent();
  } else if (e.key === "s" || e.key === "S") {
    e.preventDefault();
    skipCurrent();
  } else if (e.key === "Escape") {
    e.preventDefault();
    exitApp();
  }
});

window.addEventListener("resize", () => {
  if (currentImage) {
    drawContained(currentImage);
  }
});

updateButtonStates();
resetEmptyState("Open a camera folder to start", "JPEG files are loaded locally in your browser.");
openCameraBtn.disabled = true;
detectNativeApi();
