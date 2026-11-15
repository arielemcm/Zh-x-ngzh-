(() => {
  const camera = document.querySelector("#camera");
  const canvas = document.querySelector("#canvas");
  const preview = document.querySelector("#preview");
  const result = document.querySelector("#result");
  const startButton = document.querySelector("#start-camera");
  const takeButton = document.querySelector("#take-photo");
  const uploadInput = document.querySelector("#upload-photo");
  const saveButton = document.querySelector("#save-photo");
  const retakeButton = document.querySelector("#retake");
  const status = document.querySelector("#status");
  const uploads = document.querySelector("#uploads");
  const cameraStage = document.querySelector("#camera-stage");
  const deviceState = document.querySelector("#device-state span:last-child");
  const startButtonLabel = startButton.querySelector(".button-label");
  const diagnosis = document.querySelector("#diagnosis");
  const diagnosisTitle = document.querySelector("#diagnosis-title");
  const diagnosisConfidence = document.querySelector("#diagnosis-confidence");
  const diagnosisLoading = document.querySelector("#diagnosis-loading");
  const diagnosisResult = document.querySelector("#diagnosis-result");
  const diagnosisDescription = document.querySelector("#diagnosis-description");
  const confidenceBar = document.querySelector("#confidence-bar");
  const diagnosisAlternatives = document.querySelector("#diagnosis-alternatives");
  const diagnosisDisclaimer = document.querySelector("#diagnosis-disclaimer");
  const diagnosisError = document.querySelector("#diagnosis-error");
  const diagnosisErrorMessage = document.querySelector("#diagnosis-error-message");
  const retryDiagnosisButton = document.querySelector("#retry-diagnosis");

  let stream = null;
  let photoBlob = null;
  let previewUrl = "";
  let analysisRequestId = 0;
  let modelPromise = null;
  let labelsPromise = null;

  const MODEL_SIZE = 224;
  const MODEL_URL = "modelo-web/model.json";
  const LABELS_URL = "model-labels.json";
  const DISCLAIMER = "Orientación automática. Ante dudas, consulta a un técnico.";

  const formatSize = bytes => `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const formatConfidence = value => `${Math.round(value * 100)}%`;

  function setDiagnosisState(state) {
    diagnosis.dataset.state = state;
    diagnosisLoading.hidden = state !== "loading";
    diagnosisResult.hidden = state !== "success";
    diagnosisError.hidden = state !== "error";
    diagnosisConfidence.hidden = state !== "success";
  }

  function decodeBase64Weights(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes.buffer;
  }

  function loadBrowserModel() {
    if (!window.tf) return Promise.reject(new Error("TensorFlow.js no se pudo cargar."));
    if (!modelPromise) {
      const bundle = globalThis.POTATO_MODEL_BUNDLE;
      const source = bundle
        ? tf.io.fromMemory({
            format: bundle.format,
            generatedBy: bundle.generatedBy,
            convertedBy: bundle.convertedBy,
            modelTopology: bundle.modelTopology,
            signature: bundle.signature,
            modelInitializer: bundle.modelInitializer,
            weightSpecs: bundle.weightSpecs,
            weightData: decodeBase64Weights(bundle.weightDataBase64),
          })
        : MODEL_URL;
      modelPromise = tf.loadGraphModel(source).catch(error => {
        modelPromise = null;
        throw error;
      });
    }
    return modelPromise;
  }

  function loadModelLabels() {
    if (!labelsPromise) {
      const embeddedLabels = globalThis.POTATO_MODEL_BUNDLE?.labels;
      labelsPromise = embeddedLabels
        ? Promise.resolve(embeddedLabels)
        : fetch(LABELS_URL)
        .then(response => {
          if (!response.ok) throw new Error("No se encontraron las etiquetas del modelo.");
          return response.json();
        })
        .then(data => {
          if (!Array.isArray(data.classes) || data.classes.length !== 3) {
            throw new Error("Las etiquetas del modelo no son válidas.");
          }
          return data.classes;
        })
        .catch(error => {
          labelsPromise = null;
          throw error;
        });
    }
    return labelsPromise;
  }

  async function prepareImage(blob) {
    const bitmap = await createImageBitmap(blob);
    try {
      const surface = document.createElement("canvas");
      surface.width = MODEL_SIZE;
      surface.height = MODEL_SIZE;
      const context = surface.getContext("2d", { willReadFrequently: true });
      const side = Math.min(bitmap.width, bitmap.height);
      const sourceX = (bitmap.width - side) / 2;
      const sourceY = (bitmap.height - side) / 2;
      context.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, MODEL_SIZE, MODEL_SIZE);
      return { surface, pixels: context.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data };
    } finally {
      bitmap.close();
    }
  }

  function checkLeafAppearance(pixels) {
    const count = MODEL_SIZE * MODEL_SIZE;
    let greenPixels = 0;
    let centerGreenPixels = 0;
    let graySum = 0;
    let graySquareSum = 0;
    let horizontalEdgeSum = 0;
    let verticalEdgeSum = 0;
    const grayscale = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const offset = index * 4;
      const red = pixels[offset];
      const green = pixels[offset + 1];
      const blue = pixels[offset + 2];
      const gray = 0.299 * red + 0.587 * green + 0.114 * blue;
      grayscale[index] = gray;
      graySum += gray;
      graySquareSum += gray * gray;
      const vegetation = 2 * green - red - blue > 18
        && green > 38 && green < 248
        && green > red * 1.02 && green > blue * 1.02;
      if (vegetation) {
        greenPixels += 1;
        const x = index % MODEL_SIZE;
        const y = Math.floor(index / MODEL_SIZE);
        if (x >= 40 && x < 184 && y >= 40 && y < 184) centerGreenPixels += 1;
      }
    }

    for (let y = 0; y < MODEL_SIZE; y += 1) {
      for (let x = 0; x < MODEL_SIZE; x += 1) {
        const index = y * MODEL_SIZE + x;
        if (x + 1 < MODEL_SIZE) {
          horizontalEdgeSum += Math.abs(grayscale[index + 1] - grayscale[index]);
        }
        if (y + 1 < MODEL_SIZE) {
          verticalEdgeSum += Math.abs(grayscale[index + MODEL_SIZE] - grayscale[index]);
        }
      }
    }

    const greenRatio = greenPixels / count;
    const centerGreenRatio = centerGreenPixels / (144 * 144);
    const mean = graySum / count;
    const texture = Math.sqrt(Math.max(0, graySquareSum / count - mean * mean));
    const edgeCount = MODEL_SIZE * (MODEL_SIZE - 1);
    const edgeLevel = ((horizontalEdgeSum / edgeCount) + (verticalEdgeSum / edgeCount)) / 2;
    return {
      detected: greenRatio >= 0.10 && centerGreenRatio >= 0.12 && texture >= 12 && edgeLevel >= 2.5,
      greenRatio,
      centerGreenRatio,
      texture,
      edgeLevel,
    };
  }

  async function classifyInBrowser(blob) {
    const [model, labels, prepared] = await Promise.all([
      loadBrowserModel(),
      loadModelLabels(),
      prepareImage(blob),
    ]);
    const leafCheck = checkLeafAppearance(prepared.pixels);

    const probabilities = tf.tidy(() => {
      const input = tf.browser.fromPixels(prepared.surface)
        .toFloat()
        .div(127.5)
        .sub(1)
        .expandDims(0);
      const result = model.execute(input);
      const output = Array.isArray(result)
        ? result[0]
        : result instanceof tf.Tensor
          ? result
          : Object.values(result)[0];
      return output.squeeze().dataSync();
    });
    const ranked = labels
      .map((label, index) => ({ ...label, confidence: Number(probabilities[index]) }))
      .sort((left, right) => right.confidence - left.confidence);
    return {
      ok: true,
      prediction: ranked[0],
      alternatives: ranked.slice(1),
      leafCheck,
      disclaimer: leafCheck.detected
        ? DISCLAIMER
        : `La hoja no se distinguió con claridad, pero el modelo realizó el análisis. ${DISCLAIMER}`,
    };
  }

  async function classifyOnServer(blob) {
    const data = new FormData();
    data.append("foto", blob, `analisis-${Date.now()}.jpg`);
    const response = await fetch("/api/predict", { method: "POST", body: data });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error || "El modelo no está disponible.");
      error.code = payload.code;
      error.suggestion = payload.suggestion;
      throw error;
    }
    return payload;
  }

  async function analyzePhoto(blob) {
    if (!blob) return;
    const requestId = ++analysisRequestId;
    setDiagnosisState("loading");
    diagnosisTitle.textContent = "Revisando la hoja…";
    status.textContent = "Fotografía tomada. Analizando la hoja…";

    try {
      let payload;
      try {
        payload = await classifyInBrowser(blob);
      } catch (browserError) {
        console.warn("El análisis local falló; se intentará el servidor.", browserError);
        payload = await classifyOnServer(blob);
      }
      if (requestId !== analysisRequestId) return;

      const prediction = payload.prediction;
      diagnosis.dataset.result = prediction.id;
      diagnosisTitle.textContent = prediction.name;
      diagnosisDescription.textContent = prediction.description;
      diagnosisConfidence.textContent = `Coincidencia ${formatConfidence(prediction.confidence)}`;
      confidenceBar.style.width = formatConfidence(prediction.confidence);
      diagnosisAlternatives.innerHTML = "";
      payload.alternatives.forEach(alternative => {
        const item = document.createElement("li");
        const name = document.createElement("span");
        const confidence = document.createElement("strong");
        name.textContent = alternative.name;
        confidence.textContent = formatConfidence(alternative.confidence);
        item.append(name, confidence);
        diagnosisAlternatives.append(item);
      });
      diagnosisDisclaimer.textContent = payload.disclaimer;
      setDiagnosisState("success");
      status.textContent = !payload.leafCheck?.detected
        ? "Análisis completado. Para mayor precisión, intenta centrar mejor la hoja."
        : prediction.confidence < 0.6
          ? "Análisis completado con confianza baja. Intenta otra foto más clara."
          : "Revisión de la hoja lista.";
    } catch (error) {
      if (requestId !== analysisRequestId) return;
      const networkFailure = error instanceof TypeError && /fetch/i.test(error.message);
      const leafNotDetected = error.code === "leaf_not_detected";
      diagnosisTitle.textContent = "Análisis no disponible";
      diagnosisErrorMessage.textContent = leafNotDetected
        ? `${error.message} ${error.suggestion}`
        : networkFailure
          ? "No hay conexión con el análisis. Abre el proyecto desde su dirección publicada."
          : error.message;
      setDiagnosisState("error");
      status.textContent = leafNotDetected
        ? "No se encontró una hoja clara en la imagen."
        : networkFailure
          ? "El servicio de análisis no está disponible."
          : "La fotografía está lista, pero no pudo analizarse.";
    }
  }

  function setCameraState(state, label) {
    document.body.dataset.cameraState = state;
    if (deviceState) deviceState.textContent = label;
  }

  function showCameraPermissionAlert() {
    window.alert(
      "No diste permiso para utilizar la cámara. Habilita el acceso a la cámara en la configuración del navegador y vuelve a intentarlo."
    );
  }

  function showCameraError(error) {
    const errorName = error?.name || "Error desconocido";
    console.error("No se pudo iniciar la cámara:", errorName, error);
    setCameraState("error", "Cámara no disponible");

    if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
      status.textContent = "El acceso a la cámara está bloqueado. Habilita el permiso en el navegador y vuelve a intentarlo.";
      showCameraPermissionAlert();
      return;
    }

    if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
      const message = "Windows no detecta una cámara conectada. En este equipo, la HP Wide Vision HD Camera figura como desconectada. Abre el obturador de privacidad o pulsa la tecla con el icono de cámara y vuelve a intentarlo.";
      status.textContent = message;
      window.alert(message);
      return;
    }

    if (errorName === "NotReadableError" || errorName === "TrackStartError") {
      const message = "La cámara está siendo utilizada o Windows no puede iniciarla. Cierra Cámara, Zoom, Teams y otras aplicaciones que puedan usarla; después vuelve a intentarlo.";
      status.textContent = message;
      window.alert(message);
      return;
    }

    if (errorName === "OverconstrainedError" || errorName === "ConstraintNotSatisfiedError") {
      status.textContent = "La cámara no admite la configuración solicitada. Reinicia el navegador y vuelve a intentarlo.";
      return;
    }

    if (errorName === "SecurityError") {
      status.textContent = "El navegador bloqueó la cámara por seguridad. Abre la aplicación desde http://127.0.0.1:8001.";
      return;
    }

    status.textContent = `No se pudo encender la cámara (${errorName}). Revisa el dispositivo en Windows y vuelve a intentarlo.`;
  }

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
    setCameraState("requesting", "Solicitando acceso");
    startButton.disabled = true;
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      camera.srcObject = stream;
      await camera.play();
      takeButton.hidden = false;
      startButtonLabel.textContent = "Reiniciar cámara";
      status.textContent = "Cámara encendida.";
      setCameraState("active", "Cámara activa");
    } catch (error) {
      showCameraError(error);
    } finally {
      startButton.disabled = false;
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
      cameraStage.classList.remove("is-flashing");
      void cameraStage.offsetWidth;
      cameraStage.classList.add("is-flashing");
      presentPhoto(blob, "Captura preparada");
    }, "image/jpeg", 0.92);
  }

  function presentPhoto(blob, sourceLabel) {
    analysisRequestId += 1;
    photoBlob = blob;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    preview.src = previewUrl;
    result.hidden = false;
    stopCamera();
    setCameraState("idle", sourceLabel);
    result.scrollIntoView({ behavior: "smooth", block: "start" });
    analyzePhoto(blob);
  }

  function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      status.textContent = "Selecciona una imagen JPG, PNG o WebP.";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      status.textContent = "La imagen supera el límite de 15 MB.";
      return;
    }
    presentPhoto(file, "Imagen seleccionada");
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
      setCameraState("idle", "Fotografía guardada");
      await listPhotos();
    } catch (error) {
      console.warn("El guardado en el servidor falló; se descargará la fotografía.", error);
      const localUrl = URL.createObjectURL(photoBlob);
      const link = document.createElement("a");
      link.href = localUrl;
      link.download = `foto-${Date.now()}.jpg`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(localUrl), 1000);
      status.textContent = "El servidor no está disponible. La fotografía se descargó en este equipo.";
    } finally {
      saveButton.disabled = false;
    }
  }

  startButton.addEventListener("click", startCamera);
  takeButton.addEventListener("click", takePhoto);
  uploadInput.addEventListener("change", uploadPhoto);
  saveButton.addEventListener("click", savePhoto);
  retakeButton.addEventListener("click", () => {
    analysisRequestId += 1;
    result.hidden = true;
    photoBlob = null;
    stopCamera();
    setCameraState("idle", "Cámara apagada");
    status.textContent = "Puedes subir otra imagen o encender la cámara cuando quieras.";
  });
  retryDiagnosisButton.addEventListener("click", () => analyzePhoto(photoBlob));
  document.querySelector("#refresh").addEventListener("click", listPhotos);
  window.addEventListener("pagehide", stopCamera);

  async function initialize() {
    if (location.protocol === "file:") {
      status.textContent = "El análisis local está listo. Puedes encender la cámara o subir una imagen.";
      uploads.innerHTML = "<li>Sin servidor, las fotografías se guardarán como descargas.</li>";
    }
    stopCamera();
    setCameraState("idle", "Cámara apagada");
    loadBrowserModel().catch(error => console.warn("El modelo local se cargará al analizar.", error));
    loadModelLabels().catch(error => console.warn("Las etiquetas se cargarán al analizar.", error));
    if (location.protocol !== "file:") await listPhotos();
  }

  initialize();
})();
