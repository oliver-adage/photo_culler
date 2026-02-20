const folderInput = document.getElementById("folderInput");
const openBtn = document.getElementById("openBtn");
const transferBtn = document.getElementById("transferBtn");
const exitBtn = document.getElementById("exitBtn");
const keepBtn = document.getElementById("keepBtn");
const skipBtn = document.getElementById("skipBtn");
const doneBtn = document.getElementById("doneBtn");
const imageStage = document.getElementById("imageStage");
const photoCanvas = document.getElementById("photoCanvas");
const canvasCtx = photoCanvas.getContext("2d");
const emptyState = document.getElementById("emptyState");
const statusText = document.getElementById("statusText");
const metaText = document.getElementById("metaText");

const allowedExtensions = [".jpg", ".jpeg"];

let images = [];
let currentIndex = -1;
const kept = new Set();
let currentImage = null;
let renderVersion = 0;

function setNavigationEnabled(enabled) {
  keepBtn.disabled = !enabled;
  skipBtn.disabled = !enabled;
  doneBtn.disabled = !enabled;
}

function ext(name) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function clearPreview() {
  currentImage = null;
  renderVersion += 1;
  photoCanvas.style.display = "none";
  canvasCtx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
  emptyState.style.display = "block";
}

function drawContained(imageLike) {
  const stageWidth = Math.max(1, imageStage.clientWidth);
  const stageHeight = Math.max(1, imageStage.clientHeight);
  const dpr = window.devicePixelRatio || 1;

  photoCanvas.width = Math.floor(stageWidth * dpr);
  photoCanvas.height = Math.floor(stageHeight * dpr);
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

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not decode image: ${file.name}`));
    };
    img.src = url;
  });
}

async function showImage(index) {
  if (index < 0 || index >= images.length) {
    renderDoneState();
    return;
  }

  const version = ++renderVersion;
  const entry = images[index];
  const file = entry.file;
  try {
    const img = await loadImage(file);
    if (version !== renderVersion) {
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
    emptyState.querySelector("h2").textContent = "Could not display image";
    emptyState.querySelector("p").textContent = err.message;
  }

  statusText.textContent = `Image ${index + 1}/${images.length} | Kept: ${kept.size}`;
  metaText.textContent = entry.path;
}

function renderDoneState() {
  setNavigationEnabled(false);
  clearPreview();
  statusText.textContent = `Done | Kept: ${kept.size}`;
  metaText.textContent = "";
  emptyState.querySelector("h2").textContent = "Review complete";
  emptyState.querySelector("p").textContent = "Click Transfer to copy kept images.";
}

function resetWithFiles(fileList) {
  images = Array.from(fileList)
    .filter((f) => allowedExtensions.includes(ext(f.name)))
    .map((f) => ({
      file: f,
      path: f.webkitRelativePath || f.name,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  kept.clear();
  currentIndex = images.length ? 0 : -1;

  if (!images.length) {
    clearPreview();
    statusText.textContent = "No JPEG files found in selected folder";
    metaText.textContent = "";
    setNavigationEnabled(false);
    return;
  }

  setNavigationEnabled(true);
  showImage(currentIndex).catch((err) => {
    window.alert(`Could not render image: ${err.message}`);
  });
}

function stepForward() {
  currentIndex += 1;
  if (currentIndex >= images.length) {
    renderDoneState();
    if (kept.size > 0) {
      const wantsTransfer = window.confirm(`Review complete. ${kept.size} image(s) marked keep.\nTransfer now?`);
      if (wantsTransfer) {
        transferKept().catch((err) => {
          window.alert(`Transfer failed: ${err.message}`);
        });
      }
    }
    return;
  }
  showImage(currentIndex).catch((err) => {
    window.alert(`Could not render image: ${err.message}`);
  });
}

function keepCurrent() {
  if (currentIndex < 0 || currentIndex >= images.length) {
    return;
  }
  const entry = images[currentIndex];
  kept.add(entry.path);
  stepForward();
}

function skipCurrent() {
  if (currentIndex < 0 || currentIndex >= images.length) {
    return;
  }
  const entry = images[currentIndex];
  kept.delete(entry.path);
  stepForward();
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
  statusText.textContent = `Transfer complete | Copied: ${copied}`;
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
  statusText.textContent = `Transfer fallback complete | Downloaded: ${files.length}`;
}

async function transferKept() {
  if (kept.size === 0) {
    window.alert("No files are marked as keep.");
    return;
  }

  const files = images.filter((e) => kept.has(e.path)).map((e) => e.file);
  if ("showDirectoryPicker" in window) {
    await transferWithDirectoryPicker(files);
    window.alert(`Transfer complete: ${files.length} file(s).`);
    return;
  }

  await transferWithDownloads(files);
  window.alert("Your browser does not support direct folder write. Kept files were downloaded instead.");
}

function exitApp() {
  images = [];
  kept.clear();
  currentIndex = -1;
  clearPreview();
  setNavigationEnabled(false);
  statusText.textContent = "Session cleared";
  metaText.textContent = "";
  emptyState.querySelector("h2").textContent = "Session closed";
  emptyState.querySelector("p").textContent = "You can close this tab or open another folder.";
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
    results.push({ file, path: relPath });
  }
  return results;
}

async function openSourceFolder() {
  if ("showDirectoryPicker" in window) {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "read" });
      const picked = await readDirectoryHandle(dirHandle);
      images = picked.sort((a, b) => a.path.localeCompare(b.path));
      kept.clear();
      currentIndex = images.length ? 0 : -1;

      if (!images.length) {
        clearPreview();
        statusText.textContent = "No JPEG files found in selected folder";
        metaText.textContent = "";
        setNavigationEnabled(false);
        return;
      }

      setNavigationEnabled(true);
      showImage(currentIndex).catch((err) => {
        window.alert(`Could not render image: ${err.message}`);
      });
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

openBtn.addEventListener("click", () => {
  openSourceFolder().catch((err) => {
    window.alert(`Could not open folder: ${err.message}`);
  });
});
folderInput.addEventListener("change", (e) => resetWithFiles(e.target.files || []));
keepBtn.addEventListener("click", keepCurrent);
skipBtn.addEventListener("click", skipCurrent);
doneBtn.addEventListener("click", () => {
  currentIndex = images.length;
  renderDoneState();
});
transferBtn.addEventListener("click", () => {
  transferKept().catch((err) => window.alert(`Transfer failed: ${err.message}`));
});
exitBtn.addEventListener("click", exitApp);

window.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName?.toLowerCase() || "";
  if (tag === "input" || tag === "textarea") {
    return;
  }
  if (e.key === "k" || e.key === "K") {
    keepCurrent();
  } else if (e.key === "s" || e.key === "S") {
    skipCurrent();
  } else if (e.key === "Escape") {
    exitApp();
  }
});

window.addEventListener("resize", () => {
  if (currentImage) {
    drawContained(currentImage);
  }
});
