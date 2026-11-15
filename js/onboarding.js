(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const onboarding = document.querySelector("#experience-form");
  const steps = [...document.querySelectorAll("[data-onboarding-step]")];
  const currentStepLabel = document.querySelector("#onboarding-current-step");
  const progressItems = [...document.querySelectorAll(".onboarding-progress span")];
  const seedChoice = document.querySelector("#onboarding-seed");
  const seedInputs = [...seedChoice.querySelectorAll('input[name="semilla-actual"]')];
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
  const rotationPreviousImage = document.querySelector("#rotation-previous-image");
  const rotationPreviousName = document.querySelector("#rotation-previous-name");
  const rotationNextImage = document.querySelector("#rotation-next-image");
  const rotationNextName = document.querySelector("#rotation-next-name");
  const rotationGuidance = document.querySelector("#rotation-guidance");
  let activeSuggestion = -1;

  const crops = [
    { name: "Papa (Huaycha Imilla)", image: "assets/semillas/semilla de papa huaycha imilla.webp", position: "50% 50%", note: "Tubérculo andino adaptado al frío del altiplano." },
    { name: "Haba", image: "assets/semillas/semilla de haba.webp", position: "50% 58%", note: "Leguminosa que puede aportar nitrógeno a la rotación." },
    { name: "Cebada", image: "assets/semillas/semilla de cebada.webp", position: "58% 55%", note: "Cereal resistente a condiciones frías y secas." },
    { name: "Avena", image: "assets/semillas/semilla de avena.webp", position: "42% 50%", note: "Cereal útil para grano, forraje y cobertura." },
    { name: "Oca (Ulluku / Hullikus)", image: "assets/semillas/semilla de oca hulluku.webp", position: "50% 52%", note: "Tubérculo andino de ciclo largo y buena adaptación." },
    { name: "Papalisa", image: "assets/semillas/semilla de papalisa.webp", position: "50% 45%", note: "Tubérculo andino que prefiere suelos con buen drenaje." },
    { name: "Cebolla", image: "assets/semillas/semilla de cebolla.webp", position: "50% 48%", note: "Hortaliza que requiere un manejo cuidadoso de humedad." }
  ];

  const zoneNames = {
    ribera: "Ribera lacustre",
    llanura: "Llanura altiplánica",
    puna: "Puna alta"
  };

  const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const knownCrop = value => crops.find(crop => normalize(crop.name) === normalize(value.trim()));
  const currentCrop = () => knownCrop(seedInputs.find(input => input.checked)?.value || "");

  function paintCrop(element, crop) {
    if (!element) return;
    if (!crop) {
      element.style.removeProperty("background-image");
      element.style.removeProperty("--rotation-position");
      element.classList.remove("has-crop");
      return;
    }
    element.style.backgroundImage = `url("${encodeURI(crop.image)}")`;
    element.style.setProperty("--rotation-position", crop.position);
    element.classList.add("has-crop");
  }

  function updateRotationPath(previousCrop = knownCrop(previousSeed.value)) {
    const nextCrop = currentCrop();
    paintCrop(rotationPreviousImage, previousCrop);
    paintCrop(rotationNextImage, nextCrop);
    rotationPreviousName.textContent = previousCrop?.name || "Cultivo anterior";
    rotationNextName.textContent = nextCrop?.name || "Tu elección";
    rotationGuidance.textContent = previousCrop && nextCrop
      ? previousCrop.name === nextCrop.name
        ? "Repetir el mismo cultivo puede agotar los mismos nutrientes; considera alternarlo."
        : "La pausa entre cultivos ayuda a observar el suelo antes de la próxima siembra."
      : "Elige el cultivo anterior para ver la secuencia completa.";
  }

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
    onboarding.dataset.currentStep = String(stepNumber);
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

  function updateSeedChoice() {
    const crop = currentCrop();
    const ready = Boolean(crop);
    nextCropButton.disabled = !ready;
    cropStatus.textContent = ready ? "Elección guardada para esta temporada." : "Selecciona una semilla para continuar.";

    if (!crop) {
      cropPreview.classList.remove("is-selected");
      cropIllustration.style.removeProperty("background-image");
      cropIllustration.style.removeProperty("--crop-position");
      cropCaption.textContent = "Elige una semilla";
      cropNote.textContent = "Compara las semillas y elige la próxima siembra.";
      updateRotationPath();
      return;
    }

    cropIllustration.style.backgroundImage = `url("${crop.image}")`;
    cropIllustration.style.setProperty("--crop-position", crop.position);
    cropCaption.textContent = crop.name;
    cropNote.textContent = crop.note;
    cropPreview.classList.add("is-selected");
    sessionStorage.setItem("agricultural-current-crop", crop.name);
    updateRotationPath();
  }

  seedChoice.addEventListener("change", updateSeedChoice);

  nextCropButton.addEventListener("click", () => {
    if (!nextCropButton.disabled) goToStep(3);
  });

  function closeSuggestions() {
    suggestions.innerHTML = "";
    previousSeed.setAttribute("aria-expanded", "false");
    previousSeed.removeAttribute("aria-activedescendant");
    activeSuggestion = -1;
  }

  function updatePreviousCropState() {
    const crop = knownCrop(previousSeed.value);
    finishButton.disabled = !crop;
    historyStatus.textContent = crop ? "Cultivo anterior reconocido." : "Selecciona una semilla anterior.";
    updateRotationPath(crop);
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

    matches.forEach((crop, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.id = `crop-suggestion-${index}`;
      button.textContent = crop.name;
      button.addEventListener("click", () => choosePreviousCrop(crop.name));
      item.append(button);
      suggestions.append(item);
    });

    previousSeed.setAttribute("aria-expanded", String(Boolean(matches.length)));
  }

  function moveSuggestion(direction) {
    const options = [...suggestions.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    activeSuggestion = (activeSuggestion + direction + options.length) % options.length;
    options.forEach((option, index) => option.setAttribute("aria-selected", String(index === activeSuggestion)));
    previousSeed.setAttribute("aria-activedescendant", options[activeSuggestion].id);
    options[activeSuggestion].scrollIntoView({ block: "nearest" });
  }

  previousSeed.addEventListener("focus", showSuggestions);
  previousSeed.addEventListener("input", () => {
    showSuggestions();
    updatePreviousCropState();
  });
  previousSeed.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSuggestion(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      suggestions.querySelectorAll('[role="option"]')[activeSuggestion]?.click();
    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  });

  document.addEventListener("click", event => {
    if (!event.target.closest("#onboarding-autocomplete")) closeSuggestions();
  });

  finishButton.addEventListener("click", () => {
    const previousCrop = updatePreviousCropState();
    const nextCrop = currentCrop();
    if (!previousCrop || !nextCrop) return;

    const zone = document.querySelector('.territory-form [name="zone"]')?.value || sessionStorage.getItem("agricultural-zone") || "";
    sessionStorage.setItem("agricultural-previous-crop", previousCrop.name);
    summary.innerHTML = "";
    [zoneNames[zone], nextCrop.name, previousCrop.name].filter(Boolean).forEach(value => {
      const item = document.createElement("span");
      item.textContent = value;
      summary.append(item);
    });
    goToStep(4);
  });

  document.querySelector("[data-onboarding-restart]").addEventListener("click", () => goToStep(1));
  const savedCurrentCrop = knownCrop(sessionStorage.getItem("agricultural-current-crop") || "");
  if (savedCurrentCrop) {
    const savedInput = seedInputs.find(input => input.value === savedCurrentCrop.name);
    if (savedInput) savedInput.checked = true;
  }
  const savedPreviousCrop = knownCrop(sessionStorage.getItem("agricultural-previous-crop") || "");
  if (savedPreviousCrop) previousSeed.value = savedPreviousCrop.name;
  updateSeedChoice();
  updatePreviousCropState();
  updateProgress(1);

  if (window.location.hash === "#experience-form" && !onboarding.hidden) {
    window.setTimeout(() => onboarding.scrollIntoView({ behavior: "auto", block: "start" }), 500);
  }
})();
