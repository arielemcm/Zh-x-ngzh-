(() => {
  "use strict";

  const STORAGE_KEY = "fieldShiftInterview.v1";
  const MODEL_ENDPOINT = window.FIELD_SHIFT_MODEL_ENDPOINT || "";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const section = document.querySelector(".field-interview");
  const historyElement = document.querySelector("#chat-history");
  const controlsElement = document.querySelector("#chat-controls");
  const helperElement = document.querySelector("#chat-helper");
  const statusElement = document.querySelector(".chat-status");

  if (!section || !historyElement || !controlsElement || !helperElement) return;

  const questions = {
    zone: "¿En qué zona de Achacachi está tu parcela?",
    previous: "¿Qué cultivo sembraste en esta parcela en la última campaña?",
    previousOther: "¿Cuál fue el cultivo que sembraste en la última campaña?",
    planned: "¿Qué cultivo te gustaría sembrar en la próxima campaña?",
    plannedOther: "¿Cuál es el cultivo que te gustaría sembrar?"
  };

  const optionSets = {
    zone: ["Ribera", "Llanura", "Puna"],
    previous: ["Papa", "Haba", "Quinua", "Otro", "Dejé la parcela en descanso"],
    planned: ["Papa", "Haba", "Quinua", "Otro", "Todavía no lo sé"]
  };

  const createInitialState = () => ({
    answers: { zona: null, cultivoAnterior: null, cultivoPrevisto: null },
    messages: [{ role: "assistant", text: questions.zone }],
    step: "zone",
    complete: false,
    editing: null
  });

  function restoreState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      if (!saved || !saved.answers || !Array.isArray(saved.messages) || typeof saved.step !== "string") {
        return createInitialState();
      }
      return {
        answers: {
          zona: saved.answers.zona || null,
          cultivoAnterior: saved.answers.cultivoAnterior || null,
          cultivoPrevisto: saved.answers.cultivoPrevisto || null
        },
        messages: saved.messages.filter(message => message && ["assistant", "user"].includes(message.role) && typeof message.text === "string"),
        step: saved.step,
        complete: Boolean(saved.complete),
        editing: saved.editing || null
      };
    } catch {
      return createInitialState();
    }
  }

  let interview = restoreState();

  function saveState() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(interview)); } catch { /* Storage is optional. */ }
  }

  function responsePayload() {
    return {
      zona: interview.answers.zona,
      cultivoAnterior: interview.answers.cultivoAnterior,
      cultivoPrevisto: interview.answers.cultivoPrevisto
    };
  }

  /* Integration point: define window.FIELD_SHIFT_MODEL_ENDPOINT when the backend is ready. */
  async function requestModelAnalysis(responses = responsePayload()) {
    if (!MODEL_ENDPOINT) return { status: "pending", responses };
    const result = await fetch(MODEL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responses)
    });
    if (!result.ok) throw new Error(`El modelo respondió con estado ${result.status}`);
    return result.json();
  }

  window.FieldShiftInterview = {
    getResponses: () => ({ ...responsePayload() }),
    requestModelAnalysis
  };

  function addMessage(role, text) {
    interview.messages.push({ role, text });
  }

  function messageNode(message, isLast) {
    const row = document.createElement("div");
    row.className = `chat-message ${message.role}${isLast ? " is-new" : ""}`;

    if (message.role === "assistant") {
      const avatar = document.createElement("span");
      avatar.className = "message-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = "FS";
      row.append(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = message.text;
    row.append(bubble);
    return row;
  }

  function summaryNode() {
    const summary = document.createElement("section");
    summary.className = "answer-summary";
    summary.setAttribute("aria-labelledby", "summary-title");

    const title = document.createElement("h3");
    title.id = "summary-title";
    title.textContent = "Resumen de tu parcela";
    summary.append(title);

    const list = document.createElement("dl");
    const rows = [
      ["Zona", interview.answers.zona, "zona"],
      ["Cultivo anterior", interview.answers.cultivoAnterior, "cultivoAnterior"],
      ["Próxima campaña", interview.answers.cultivoPrevisto, "cultivoPrevisto"]
    ];

    rows.forEach(([label, value, field]) => {
      const row = document.createElement("div");
      row.className = "summary-row";
      const content = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      const edit = document.createElement("button");
      term.textContent = label;
      description.textContent = value;
      edit.className = "edit-answer";
      edit.type = "button";
      edit.dataset.edit = field;
      edit.textContent = "Corregir";
      edit.setAttribute("aria-label", `Corregir ${label.toLowerCase()}`);
      content.append(term, description);
      row.append(content, edit);
      list.append(row);
    });

    summary.append(list);
    return summary;
  }

  function renderHistory() {
    historyElement.replaceChildren();
    interview.messages.forEach((message, index) => {
      historyElement.append(messageNode(message, index === interview.messages.length - 1));
    });
    if (interview.complete) historyElement.append(summaryNode());
    requestAnimationFrame(() => { historyElement.scrollTop = historyElement.scrollHeight; });
  }

  function choiceButton(label) {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.dataset.value = label;
    button.textContent = label;
    return button;
  }

  function renderTextInput() {
    const form = document.createElement("form");
    form.className = "text-response";
    const input = document.createElement("input");
    const button = document.createElement("button");
    input.type = "text";
    input.name = "crop";
    input.maxLength = 60;
    input.required = true;
    input.autocomplete = "off";
    input.placeholder = "Escribe el nombre del cultivo";
    input.setAttribute("aria-label", "Nombre del cultivo");
    button.type = "submit";
    button.textContent = "Guardar";
    form.append(input, button);
    controlsElement.append(form);
    helperElement.textContent = "Escribe un nombre breve para continuar.";
    requestAnimationFrame(() => input.focus({ preventScroll: true }));
  }

  function renderControls() {
    controlsElement.replaceChildren();
    statusElement?.classList.toggle("is-complete", interview.complete);
    const statusText = statusElement?.querySelector("span");
    if (statusText) statusText.textContent = interview.complete ? "Registrada" : "En curso";

    if (interview.complete) {
      helperElement.textContent = "Puedes corregir cualquier respuesta desde el resumen.";
      return;
    }

    const step = interview.step.replace(/^edit/, "");
    const normalizedStep = step.charAt(0).toLowerCase() + step.slice(1);
    if (["previousOther", "plannedOther"].includes(normalizedStep)) {
      renderTextInput();
      return;
    }

    const optionKey = normalizedStep === "cultivoAnterior" ? "previous" : normalizedStep === "cultivoPrevisto" ? "planned" : normalizedStep;
    (optionSets[optionKey] || []).forEach(label => controlsElement.append(choiceButton(label)));
    helperElement.textContent = "Elige una opción para continuar.";
  }

  function render() {
    renderHistory();
    renderControls();
    saveState();
  }

  function announceQuestion(question) {
    addMessage("assistant", question);
  }

  function finishInterview(isCorrection = false) {
    interview.step = "complete";
    interview.complete = true;
    interview.editing = null;
    addMessage("assistant", isCorrection
      ? "Listo, actualicé la respuesta. Respuestas registradas. El análisis de tu parcela estará disponible cuando se conecte el modelo."
      : "Respuestas registradas. El análisis de tu parcela estará disponible cuando se conecte el modelo.");
    render();
    const detail = responsePayload();
    window.dispatchEvent(new CustomEvent("fieldshift:responses-ready", { detail }));
    requestModelAnalysis(detail).catch(error => console.warn("Field Shift:", error.message));
  }

  function advanceStandard(value) {
    addMessage("user", value);

    if (interview.step === "zone") {
      interview.answers.zona = value;
      interview.step = "previous";
      announceQuestion(questions.previous);
    } else if (interview.step === "previous") {
      if (value === "Otro") {
        interview.step = "previousOther";
        announceQuestion(questions.previousOther);
      } else {
        interview.answers.cultivoAnterior = value;
        interview.step = "planned";
        announceQuestion(questions.planned);
      }
    } else if (interview.step === "planned") {
      if (value === "Otro") {
        interview.step = "plannedOther";
        announceQuestion(questions.plannedOther);
      } else {
        interview.answers.cultivoPrevisto = value;
        finishInterview();
        return;
      }
    }
    render();
  }

  function advanceCorrection(value) {
    addMessage("user", value);
    const field = interview.editing;

    if (field === "zona") {
      interview.answers.zona = value;
      finishInterview(true);
    } else if (field === "cultivoAnterior") {
      if (value === "Otro") {
        interview.step = "editPreviousOther";
        announceQuestion(questions.previousOther);
        render();
      } else {
        interview.answers.cultivoAnterior = value;
        finishInterview(true);
      }
    } else if (field === "cultivoPrevisto") {
      if (value === "Otro") {
        interview.step = "editPlannedOther";
        announceQuestion(questions.plannedOther);
        render();
      } else {
        interview.answers.cultivoPrevisto = value;
        finishInterview(true);
      }
    }
  }

  function handleText(value) {
    const crop = value.trim().replace(/\s+/g, " ");
    if (!crop) return;
    addMessage("user", crop);

    if (["previousOther", "editPreviousOther"].includes(interview.step)) {
      interview.answers.cultivoAnterior = crop;
      if (interview.step === "editPreviousOther") {
        finishInterview(true);
      } else {
        interview.step = "planned";
        announceQuestion(questions.planned);
        render();
      }
    } else if (["plannedOther", "editPlannedOther"].includes(interview.step)) {
      interview.answers.cultivoPrevisto = crop;
      finishInterview(Boolean(interview.editing));
    }
  }

  function beginCorrection(field) {
    const config = {
      zona: ["editZone", questions.zone],
      cultivoAnterior: ["editCultivoAnterior", questions.previous],
      cultivoPrevisto: ["editCultivoPrevisto", questions.planned]
    }[field];
    if (!config) return;
    interview.complete = false;
    interview.editing = field;
    interview.step = config[0];
    announceQuestion(`Vamos a corregirla. ${config[1]}`);
    render();
  }

  controlsElement.addEventListener("click", event => {
    const button = event.target.closest("[data-value]");
    if (!button) return;
    if (interview.editing) advanceCorrection(button.dataset.value);
    else advanceStandard(button.dataset.value);
  });

  controlsElement.addEventListener("submit", event => {
    if (!event.target.matches(".text-response")) return;
    event.preventDefault();
    handleText(new FormData(event.target).get("crop") || "");
  });

  historyElement.addEventListener("click", event => {
    const button = event.target.closest("[data-edit]");
    if (button) beginCorrection(button.dataset.edit);
  });

  function revealInterview() {
    section.classList.add("is-visible");
  }

  function revealIfInView() {
    const bounds = section.getBoundingClientRect();
    if (bounds.top < innerHeight * .92 && bounds.bottom > 0) revealInterview();
  }

  section.dataset.enhanced = "true";
  if (reducedMotion) {
    revealInterview();
  } else {
    if (window.ScrollTrigger) {
      ScrollTrigger.create({
        id: "field-shift-interview",
        trigger: section,
        start: "top 78%",
        once: true,
        onEnter: revealInterview
      });
    }

    if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        revealInterview();
        observer.disconnect();
      }
    }, { rootMargin: "0px 0px -15%" });
    observer.observe(section);
    }

    requestAnimationFrame(revealIfInView);
    window.addEventListener("load", revealIfInView, { once: true });
  }

  render();
  window.addEventListener("load", () => window.ScrollTrigger?.refresh(), { once: true });
})();
