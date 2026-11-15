(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const onboarding = document.querySelector("#experience-form");
  const steps = [...document.querySelectorAll("[data-onboarding-step]")];
  const currentStepLabel = document.querySelector("#onboarding-current-step");
  const progressItems = [...document.querySelectorAll(".onboarding-progress span")];
  const seedChoice = document.querySelector("#onboarding-seed");
  const seedInputs = [...seedChoice.querySelectorAll('input[name="cultivo-anterior"]')];
  const nextCropButton = document.querySelector('[data-onboarding-step="2"] [data-onboarding-next]');
  const cropStatus = document.querySelector("#crop-step-status");
  const cropPreview = document.querySelector("#onboarding-crop-preview");
  const cropIllustration = document.querySelector("#onboarding-crop-illustration");
  const cropCaption = document.querySelector("#onboarding-crop-caption");
  const cropNote = document.querySelector("#onboarding-crop-note");
  const recommendationList = document.querySelector("#recommendation-list");
  const recommendationZone = document.querySelector("#recommendation-zone");
  const recommendationSourceStatus = document.querySelector("#recommendation-source-status");
  const recommendationEvidence = document.querySelector("#recommendation-evidence");
  const finishButton = document.querySelector("#finish-onboarding");
  const historyStatus = document.querySelector("#history-step-status");
  const summary = document.querySelector("#onboarding-summary");
  const rotationPreviousImage = document.querySelector("#rotation-previous-image");
  const rotationPreviousName = document.querySelector("#rotation-previous-name");
  const rotationNextImage = document.querySelector("#rotation-next-image");
  const rotationNextName = document.querySelector("#rotation-next-name");
  const rotationGuidance = document.querySelector("#rotation-guidance");

  const crops = [
    { id: "papa", name: "Papa (Huaycha Imilla)", short: "Papa", family: "tuberculo", image: "assets/semillas/semilla de papa huaycha imilla.webp", position: "50% 50%", aliases: ["papa"], note: "Tubérculo andino presente entre los principales cultivos de Achacachi.", zones: { ribera: 34, llanura: 40, puna: 38 } },
    { id: "haba", name: "Haba", short: "Haba", family: "leguminosa", image: "assets/semillas/semilla de haba.webp", position: "50% 58%", aliases: ["haba"], note: "Leguminosa útil para diversificar una secuencia dominada por tubérculos o cereales.", zones: { ribera: 40, llanura: 35, puna: 25 } },
    { id: "cebada", name: "Cebada", short: "Cebada", family: "cereal", image: "assets/semillas/semilla de cebada.webp", position: "58% 55%", aliases: ["cebada en grano", "cebada berza"], note: "Cereal que permite cambiar de familia después de un tubérculo.", zones: { ribera: 30, llanura: 38, puna: 40 } },
    { id: "avena", name: "Avena", short: "Avena", family: "cereal", image: "assets/semillas/semilla de avena.webp", position: "42% 50%", aliases: ["avena", "avena berza"], note: "Cereal registrado localmente y alternativa para grano, forraje o cobertura.", zones: { ribera: 32, llanura: 40, puna: 38 } },
    { id: "oca", name: "Oca (Ulluku / Hullikus)", short: "Oca", family: "tuberculo", image: "assets/semillas/semilla de oca hulluku.webp", position: "50% 52%", aliases: ["oca"], note: "Tubérculo andino registrado en la producción municipal.", zones: { ribera: 32, llanura: 35, puna: 34 } },
    { id: "papalisa", name: "Papalisa", short: "Papalisa", family: "tuberculo", image: "assets/semillas/semilla de papalisa.webp", position: "50% 45%", aliases: ["papaliza", "papalisa"], note: "Tubérculo andino presente en otras fichas municipales del departamento.", zones: { ribera: 28, llanura: 30, puna: 25 } },
    { id: "cebolla", name: "Cebolla", short: "Cebolla", family: "bulbo", image: "assets/semillas/semilla de cebolla.webp", position: "50% 48%", aliases: ["cebolla"], note: "Hortaliza local que exige revisar disponibilidad y manejo del agua.", zones: { ribera: 40, llanura: 34, puna: 18 } }
  ];

  const zoneNames = { ribera: "Ribera lacustre", llanura: "Llanura altiplánica", puna: "Puna alta" };
  const familyNames = { tuberculo: "tubérculo", leguminosa: "leguminosa", cereal: "cereal", bulbo: "bulbo" };
  const rotationPoints = {
    tuberculo: { cereal: 35, leguminosa: 31, bulbo: 24, tuberculo: 5 },
    cereal: { leguminosa: 35, tuberculo: 30, bulbo: 25, cereal: 8 },
    leguminosa: { tuberculo: 35, cereal: 30, bulbo: 24, leguminosa: 8 },
    bulbo: { leguminosa: 33, cereal: 30, tuberculo: 27, bulbo: 8 }
  };
  const fallbackProfile = {
    source: "respaldo local",
    local: {
      papa: { production: 9584, area: 2193, yield: 4.37 },
      avena: { production: 3023, area: 1793, yield: 1.686 },
      haba: { production: 989, area: 660, yield: 1.498 },
      oca: { production: 597, area: 199, yield: 3 },
      cebada: { production: 389, area: 329, yield: 1.182 },
      cebolla: { production: 351, area: 28, yield: 12.536 }
    },
    municipalityCount: { papa: 71, haba: 40, cebada: 50, avena: 34, oca: 34, papalisa: 5, cebolla: 17 }
  };
  let agriculturalProfile = fallbackProfile;
  let selectedRecommendation = null;
  let recommendationsLoaded = false;

  const normalize = text => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const knownCrop = value => crops.find(crop => normalize(crop.name) === normalize(value));
  const previousCrop = () => knownCrop(seedInputs.find(input => input.checked)?.value || "");
  const currentZone = () => document.querySelector('.territory-form [name="zone"]')?.value || sessionStorage.getItem("agricultural-zone") || "llanura";
  const formatNumber = value => new Intl.NumberFormat("es-BO", { maximumFractionDigits: 3 }).format(value);
  const matchesCrop = (record, crop) => crop.aliases.includes(normalize(record?.cultivo));

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

  async function loadAgriculturalProfile() {
    if (recommendationsLoaded) {
      recommendationSourceStatus.textContent = agriculturalProfile.source === "data/agricultura/informacion_agricola_la_paz.json"
        ? "Datos productivos 2021 cargados desde la ficha de Achacachi."
        : "Se usan los datos locales de respaldo de Achacachi.";
      return;
    }
    recommendationsLoaded = true;
    try {
      const response = await fetch("data/agricultura/informacion_agricola_la_paz.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const achacachi = data.fichas_municipales?.find(item => normalize(item.municipio) === "achacachi");
      if (!achacachi) throw new Error("No se encontró la ficha de Achacachi");

      const local = {};
      const municipalityCount = {};
      crops.forEach(crop => {
        const localRecord = achacachi.principales_cultivos_2021?.find(record => matchesCrop(record, crop));
        if (localRecord) {
          local[crop.id] = {
            production: localRecord.produccion_toneladas,
            area: localRecord.superficie_hectareas,
            yield: localRecord.rendimiento_calculado_t_ha
          };
        }
        municipalityCount[crop.id] = data.fichas_municipales.filter(ficha =>
          ficha.principales_cultivos_2021?.some(record => matchesCrop(record, crop))
        ).length;
      });
      agriculturalProfile = { source: "data/agricultura/informacion_agricola_la_paz.json", local, municipalityCount };
      recommendationSourceStatus.textContent = "Datos productivos 2021 cargados desde la ficha de Achacachi.";
    } catch (error) {
      agriculturalProfile = fallbackProfile;
      recommendationSourceStatus.textContent = "Se usan los datos locales de respaldo de Achacachi.";
      console.warn("No se pudo cargar el JSON agrícola; se usó el perfil de respaldo.", error);
    }
  }

  function affinityLabel(score) {
    if (score >= 85) return "Afinidad muy alta";
    if (score >= 72) return "Afinidad alta";
    if (score >= 60) return "Afinidad favorable";
    return "Alternativa exploratoria";
  }

  function rankRecommendations() {
    const previous = previousCrop();
    const zone = currentZone();
    if (!previous) return [];
    return crops
      .filter(crop => crop.id !== previous.id)
      .map(crop => {
        const rotation = rotationPoints[previous.family]?.[crop.family] ?? 18;
        const local = agriculturalProfile.local[crop.id] ? 15 : Math.min(12, 4 + (agriculturalProfile.municipalityCount[crop.id] || 0) / 8);
        const diversity = crop.family === previous.family ? 2 : 10;
        const score = Math.round(crop.zones[zone] + rotation + local + diversity);
        return { ...crop, score: Math.min(100, score), localRecord: agriculturalProfile.local[crop.id] || null };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "es"));
  }

  function recommendationReason(crop, previous, zone) {
    const changedFamily = crop.family !== previous.family;
    const localText = crop.localRecord
      ? "Además figura entre los principales cultivos de Achacachi en 2021."
      : `No figura en la lista principal de Achacachi, aunque aparece en ${agriculturalProfile.municipalityCount[crop.id] || 0} municipios del departamento.`;
    return `${changedFamily ? "Cambia" : "Mantiene"} la familia de ${familyNames[previous.family]} a ${familyNames[crop.family]} y su ajuste orientativo es ${affinityLabel(crop.score).toLowerCase()} para ${zoneNames[zone]}. ${localText}`;
  }

  function updateSelectedRecommendation(crop) {
    const previous = previousCrop();
    const zone = currentZone();
    selectedRecommendation = crop;
    finishButton.disabled = !crop;
    historyStatus.textContent = crop ? `${crop.short} seleccionada como alternativa.` : "Selecciona una alternativa recomendada.";
    recommendationList.querySelectorAll(".recommendation-card").forEach(card => {
      const selected = card.dataset.crop === crop?.id;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-checked", String(selected));
    });
    paintCrop(rotationPreviousImage, previous);
    paintCrop(rotationNextImage, crop);
    rotationPreviousName.textContent = previous?.name || "Cultivo anterior";
    rotationNextName.textContent = crop?.name || "Selecciona una opción";
    rotationGuidance.textContent = crop && previous ? recommendationReason(crop, previous, zone) : "Elige una recomendación para conocer por qué aparece.";
    recommendationEvidence.innerHTML = "";
    if (!crop) return;

    const evidence = [
      ["Zona", `${zoneNames[zone]} · ${crop.zones[zone]}/40`],
      ["Rotación", `${familyNames[previous.family]} → ${familyNames[crop.family]}`],
      ["Presencia", crop.localRecord ? "Principal en Achacachi" : `${agriculturalProfile.municipalityCount[crop.id] || 0} municipios`]
    ];
    if (crop.localRecord) evidence.push(["Dato 2021", `${formatNumber(crop.localRecord.production)} t · ${formatNumber(crop.localRecord.yield)} t/ha`]);
    evidence.forEach(([label, value]) => {
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      detail.textContent = value;
      recommendationEvidence.append(term, detail);
    });
  }

  function renderRecommendations() {
    const ranked = rankRecommendations();
    const saved = sessionStorage.getItem("agricultural-recommended-crop");
    recommendationList.innerHTML = "";
    ranked.forEach((crop, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "recommendation-card";
      button.dataset.crop = crop.id;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");
      button.innerHTML = `
        <span class="recommendation-card__rank">${index + 1}</span>
        <img src="${encodeURI(crop.image)}" alt="" style="object-position:${crop.position}" decoding="async">
        <span class="recommendation-card__copy">
          <small>${affinityLabel(crop.score)}</small>
          <strong>${crop.name}</strong>
          <em>${crop.score}/100 · afinidad orientativa</em>
        </span>
        <span class="recommendation-card__mark" aria-hidden="true">✓</span>`;
      button.addEventListener("click", () => updateSelectedRecommendation(crop));
      recommendationList.append(button);
    });
    updateSelectedRecommendation(ranked.find(crop => crop.name === saved) || null);
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

  function updatePreviousChoice() {
    const crop = previousCrop();
    const ready = Boolean(crop);
    nextCropButton.disabled = !ready;
    cropStatus.textContent = ready ? "Cultivo anterior guardado para calcular alternativas." : "Selecciona el cultivo anterior.";
    if (!crop) {
      cropPreview.classList.remove("is-selected");
      cropIllustration.style.removeProperty("background-image");
      cropIllustration.style.removeProperty("--crop-position");
      cropCaption.textContent = "Elige un cultivo";
      cropNote.textContent = "Indica qué sembraste para preparar la recomendación.";
      return;
    }
    cropIllustration.style.backgroundImage = `url("${encodeURI(crop.image)}")`;
    cropIllustration.style.setProperty("--crop-position", crop.position);
    cropCaption.textContent = crop.name;
    cropNote.textContent = crop.note;
    cropPreview.classList.add("is-selected");
    sessionStorage.setItem("agricultural-previous-crop", crop.name);
    selectedRecommendation = null;
  }

  seedChoice.addEventListener("change", updatePreviousChoice);
  nextCropButton.addEventListener("click", async () => {
    if (nextCropButton.disabled) return;
    goToStep(3);
    const zone = currentZone();
    recommendationZone.textContent = zoneNames[zone] || "Zona seleccionada";
    recommendationSourceStatus.textContent = "Consultando la ficha agrícola de Achacachi…";
    await loadAgriculturalProfile();
    renderRecommendations();
  });

  finishButton.addEventListener("click", () => {
    const previous = previousCrop();
    if (!previous || !selectedRecommendation) return;
    const zone = currentZone();
    sessionStorage.setItem("agricultural-previous-crop", previous.name);
    sessionStorage.setItem("agricultural-recommended-crop", selectedRecommendation.name);
    sessionStorage.setItem("agricultural-current-crop", selectedRecommendation.name);
    summary.innerHTML = "";
    [zoneNames[zone], `Antes: ${previous.name}`, `Sugerencia: ${selectedRecommendation.name}`, `${selectedRecommendation.score}/100 orientativo`].forEach(value => {
      const item = document.createElement("span");
      item.textContent = value;
      summary.append(item);
    });
    goToStep(4);
  });

  document.querySelector("[data-onboarding-restart]").addEventListener("click", () => goToStep(1));
  const savedPrevious = knownCrop(sessionStorage.getItem("agricultural-previous-crop") || "");
  if (savedPrevious) {
    const savedInput = seedInputs.find(input => input.value === savedPrevious.name);
    if (savedInput) savedInput.checked = true;
  }
  updatePreviousChoice();
  updateProgress(1);

  if (window.location.hash === "#experience-form" && !onboarding.hidden) {
    window.setTimeout(() => onboarding.scrollIntoView({ behavior: "auto", block: "start" }), 500);
  }
})();
