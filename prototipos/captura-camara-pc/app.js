(() => {
  const camera = document.querySelector("#camera");
  const canvas = document.querySelector("#canvas");
  const preview = document.querySelector("#preview");
  const result = document.querySelector("#result");
  const startButton = document.querySelector("#start-camera");
  const takeButton = document.querySelector("#take-photo");
  const saveButton = document.querySelector("#save-photo");
  const retakeButton = document.querySelector("#retake");
  const status = document.querySelector("#status");
  const uploads = document.querySelector("#uploads");

  let stream = null;
  let photoBlob = null;
  let previewUrl = "";

  const formatSize = bytes => `${Math.max(1, Math.round(bytes / 1024))} KB`;

  function stopCamera() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    camera.srcObject = null;
    takeButton.hidden = true;
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = "Este navegador no permite utilizar la cámara.";
      return;
    }
    status.textContent = "Solicitando permiso para usar la cámara…";
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      camera.srcObject = stream;
      await camera.play();
      takeButton.hidden = false;
      startButton.textContent = "Reiniciar cámara";
      status.textContent = "Cámara encendida.";
    } catch (error) {
      status.textContent = "No se pudo encender la cámara. Permite el acceso desde el navegador y vuelve a intentarlo.";
    }
  }

  function takePhoto() {
    if (!stream || !camera.videoWidth || !camera.videoHeight) {
      status.textContent = "Primero enciende la cámara.";
      return;
    }
    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;
    canvas.getContext("2d").drawImage(camera, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        status.textContent = "No se pudo generar la fotografía.";
        return;
      }
      photoBlob = blob;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      preview.src = previewUrl;
      result.hidden = false;
      stopCamera();
      status.textContent = "Fotografía lista para guardar.";
    }, "image/jpeg", 0.92);
  }

  async function listPhotos() {
    try {
      const response = await fetch("/api/uploads", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const photos = await response.json();
      uploads.innerHTML = "";
      if (!photos.length) {
        uploads.innerHTML = "<li>Todavía no hay fotografías.</li>";
        return;
      }
      photos.forEach(photo => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = photo.url;
        link.textContent = `${photo.name} (${formatSize(photo.size)})`;
        item.append(link);
        uploads.append(item);
      });
    } catch {
      uploads.innerHTML = "<li>No se pudo consultar la lista.</li>";
    }
  }

  async function savePhoto() {
    if (!photoBlob) return;
    saveButton.disabled = true;
    status.textContent = "Guardando fotografía…";
    try {
      const data = new FormData();
      data.append("foto", photoBlob, `foto-${Date.now()}.jpg`);
      const response = await fetch("/api/uploads", { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar la fotografía.");
      result.hidden = true;
      photoBlob = null;
      status.textContent = "Fotografía guardada correctamente.";
      await listPhotos();
      await startCamera();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      saveButton.disabled = false;
    }
  }

  startButton.addEventListener("click", startCamera);
  takeButton.addEventListener("click", takePhoto);
  saveButton.addEventListener("click", savePhoto);
  retakeButton.addEventListener("click", async () => {
    result.hidden = true;
    photoBlob = null;
    await startCamera();
  });
  document.querySelector("#refresh").addEventListener("click", listPhotos);
  window.addEventListener("pagehide", stopCamera);

  async function initialize() {
    if (location.protocol === "file:") {
      status.textContent = "Inicia el servidor y abre http://127.0.0.1:8001 para usar y guardar fotografías.";
      uploads.innerHTML = "<li>El servidor no está iniciado.</li>";
      return;
    }
    await listPhotos();
    await startCamera();
  }

  initialize();
})();
