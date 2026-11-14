(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const onboarding = document.querySelector("#experience-form");
  const steps = [...document.querySelectorAll("[data-onboarding-step]")];
  const currentStepLabel = document.querySelector("#onboarding-current-step");
  const progressItems = [...document.querySelectorAll(".onboarding-progress span")];
  const seedSelect = document.querySelector("#onboarding-seed");
  const nextCropButton = document.querySelector('[data-onboarding-step="2"] [data-onboarding-next]');
  const cropStatus = document.querySelector("#crop-step-status");
  const cropPreview = document.querySelector("#onboarding-crop-preview");
  const cropIllustration = document.querySelector("#onboarding-crop-illustration");
  const cropCaption = document.querySelector("#onboarding-crop-caption");
  const cropNote = document.querySelector("#onboarding-crop-note");
  const previousSeed = document.querySelector("#onboarding-previous-seed");
  const suggestions = document.querySelector("#onboarding-suggestions");
  const finishButton = document.querySelector("#finish-onboarding");
  const historyStatus = document.querySelector("#history-step-status");
  const summary = document.querySelector("#onboarding-summary");

  const crops = [
    { name: "Papa (Huaycha Imilla)", color: "#71845f", accent: "#b79767", note: "Tubérculo andino adaptado al frío del altiplano." },
    { name: "Haba", color: "#66835c", accent: "#afc58b", note: "Leguminosa que puede aportar nitrógeno a la rotación." },
    { name: "Cebada", color: "#9a8a54", accent: "#d5bd72", note: "Cereal resistente a condiciones frías y secas." },
    { name: "Avena", color: "#7c8d59", accent: "#d2c98d", note: "Cereal útil para grano, forraje y cobertura." },
    { name: "Oca (Ulluku / Hullikus)", color: "#8a6a55", accent: "#d69b61", note: "Tubérculo andino de ciclo largo y buena adaptación." },
    { name: "Papalisa", color: "#766451", accent: "#c68a71", note: "Tubérculo andino que prefiere suelos con buen drenaje." },
    { name: "Cebolla", color: "#6f855c", accent: "#d7c9a0", note: "Hortaliza que requiere un manejo cuidadoso de humedad." }
  ];

  const zoneNames = {
    ribera: "Ribera lacustre",
    llanura: "Llanura altiplánica",
    puna: "Puna alta"
  };

  const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const knownCrop = value => crops.find(crop => normalize(crop.name) === normalize(value.trim()));

  function updateProgress(stepNumber) {
    const visibleStep = Math.min(stepNumber, 3);
    currentStepLabel.textContent = String(visibleStep);
    progressItems.forEach((item, index) => {
      item.classList.toggle("is-current", index === visibleStep - 1 && stepNumber <= 3);
      item.classList.toggle("is-complete", index < visibleStep - 1 || stepNumber > 3);
    });
  }

  function goToStep(stepNumber) {
    const next = steps.find(step => Number(step.dataset.onboardingStep) === stepNumber);
    if (!next) return;

    steps.forEach(step => {
      step.classList.remove("is-active");
      step.hidden = step !== next;
    });

    next.hidden = false;
    if (reducedMotion) next.classList.add("is-active");
    else requestAnimationFrame(() => next.classList.add("is-active"));
    updateProgress(stepNumber);
    onboarding.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  window.goToOnboardingStep = goToStep;

  document.querySelectorAll("[data-onboarding-back]").forEach(button => {
    button.addEventListener("click", () => {
      const step = Number(button.closest("[data-onboarding-step]").dataset.onboardingStep);
      goToStep(Math.max(1, step - 1));
    });
  });

  seedSelect.addEventListener("change", () => {
    const crop = knownCrop(seedSelect.value);
    const ready = Boolean(crop);
    nextCropButton.disabled = !ready;
    cropStatus.textContent = ready ? "Elección guardada para esta temporada." : "Selecciona una semilla para continuar.";

    if (!crop) {
      cropPreview.classList.remove("is-selected");
      cropCaption.textContent = "Elige una semilla";
      cropNote.textContent = "Aquí aparecerá una referencia breve de tu elección.";
      return;
    }

    cropIllustration.style.setProperty("--crop-color", crop.color);
    cropIllustration.style.setProperty("--crop-accent", crop.accent);
    cropCaption.textContent = crop.name;
    cropNote.textContent = crop.note;
    cropPreview.classList.add("is-selected");
    sessionStorage.setItem("agricultural-current-crop", crop.name);
  });

  nextCropButton.addEventListener("click", () => {
    if (!nextCropButton.disabled) goToStep(3);
  });

  function closeSuggestions() {
    suggestions.innerHTML = "";
    previousSeed.setAttribute("aria-expanded", "false");
  }

  function updatePreviousCropState() {
    const crop = knownCrop(previousSeed.value);
    finishButton.disabled = !crop;
    historyStatus.textContent = crop ? "Cultivo anterior reconocido." : "Selecciona una semilla anterior.";
    return crop;
  }

  function choosePreviousCrop(name) {
    previousSeed.value = name;
    closeSuggestions();
    updatePreviousCropState();
    previousSeed.focus();
  }

  function showSuggestions() {
    const search = normalize(previousSeed.value.trim());
    const matches = crops.filter(crop => normalize(crop.name).includes(search));
    suggestions.innerHTML = "";

    matches.forEach(crop => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.textContent = crop.name;
      button.addEventListener("click", () => choosePreviousCrop(crop.name));
      item.append(button);
      suggestions.append(item);
    });

    previousSeed.setAttribute("aria-expanded", String(Boolean(matches.length)));
  }

  previousSeed.addEventListener("focus", showSuggestions);
  previousSeed.addEventListener("input", () => {
    showSuggestions();
    updatePreviousCropState();
  });

  document.addEventListener("click", event => {
    if (!event.target.closest("#onboarding-autocomplete")) closeSuggestions();
  });

  finishButton.addEventListener("click", () => {
    const previousCrop = updatePreviousCropState();
    if (!previousCrop || !seedSelect.value) return;

    const zone = document.querySelector('.territory-form [name="zone"]')?.value || sessionStorage.getItem("agricultural-zone") || "";
    sessionStorage.setItem("agricultural-previous-crop", previousCrop.name);
    summary.innerHTML = "";
    [zoneNames[zone], seedSelect.value, previousCrop.name].filter(Boolean).forEach(value => {
      const item = document.createElement("span");
      item.textContent = value;
      summary.append(item);
    });
    goToStep(4);
  });

  document.querySelector("[data-onboarding-restart]").addEventListener("click", () => goToStep(1));
  updateProgress(1);

  if (window.location.hash === "#experience-form") {
    window.setTimeout(() => onboarding.scrollIntoView({ behavior: "auto", block: "start" }), 500);
  }
})();
