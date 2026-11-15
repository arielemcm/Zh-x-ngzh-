(() => {
  "use strict";

  const form = document.querySelector("#chatForm");
  const input = document.querySelector("#chatInput");
  const submitButton = form?.querySelector("button[type='submit']");
  const history = document.querySelector("#chatHistory");
  const hint = document.querySelector("#composerHint");
  const lane = document.querySelector("#mascotLane");
  const toggle = document.querySelector("#mascotToggle");
  const toggleLabel = toggle?.querySelector(".mascot-toggle__label");
  const track = document.querySelector("#toadTrack");
  const toad = document.querySelector("#toad");
  const compactToad = document.querySelector("#compactToad");
  const compactToadImage = document.querySelector("#compactToadImage");
  const quickPrompts = document.querySelector("#quickPrompts");
  const knowledgeStatus = document.querySelector("#knowledgeStatus");

  if (!form || !input || !submitButton || !history || !hint || !lane || !toggle || !toggleLabel || !track || !toad || !compactToad || !compactToadImage) return;

  // 1. ARREGLADO: Ruta de las imágenes para Flask
  const imageRoot = "/static/imagenes_sapo/";
  const numberedFrames = (name, count) =>
    Array.from({ length: count }, (_, index) => `${imageRoot}${name}${index + 1}.png`);

  const sprites = {
    derechaQuieto: `${imageRoot}sapo1.jfif`,
    derechaHablando: `${imageRoot}sapo2.png`,
    izquierdaQuieto: `${imageRoot}sapo3.png`,
    izquierdaHablando: `${imageRoot}sapo4.png`,
  };

  const jumpFrames = numberedFrames("salto", 8);
  const breatheSequence = {
    name: "respirar",
    frames: numberedFrames("respirar", 3),
    frameTime: 260,
    loops: 1,
  };
  const idleSequences = [
    { name: "dormido", frames: numberedFrames("dormido", 2), frameTime: 720, loops: 2 },
    { name: "fumando", frames: numberedFrames("fumando", 3), frameTime: 440, loops: 2 },
    { name: "rascandose", frames: numberedFrames("rascandose", 3), frameTime: 360, loops: 2 },
    { name: "muerto", frames: numberedFrames("muerto", 4), frameTime: 430, loops: 1 },
  ];
  const romanticSequence = {
    name: "enamorado",
    frames: [`${imageRoot}enamorado1.png`],
    frameTime: 1200,
    loops: 1,
  };

  let knowledge = null;
  let knowledgeReady = false;

  function normalize(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function generateAnswer(question) {
    // Esta función queda como respaldo local si el servidor falla.
    return "Estoy teniendo problemas para conectar con mi cerebro de IA. Pero puedo decirte que la rotación de Papa a Haba es buena para el suelo.";
  }

  async function loadKnowledge() {
    setComposerEnabled(false);
    try {
        // 2. ARREGLADO: Ruta del JSON movida a static
      const response = await fetch("/static/informacion_agricola_la_paz.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      knowledge = await response.json();
      knowledgeReady = true;
      knowledgeStatus.classList.add("is-ready");
      knowledgeStatus.lastChild.textContent = " Base lista";
      hint.textContent = "Base de datos conectada a la IA de Mistral.";
      setComposerEnabled(true);
      input.focus();
    } catch (error) {
      knowledgeStatus.classList.add("is-error");
      knowledgeStatus.lastChild.textContent = " Sin conexión a datos";
      hint.textContent = "No se pudo cargar el JSON. Abre el proyecto mediante un servidor local.";
      console.error("No se pudo cargar la base agrícola:", error);
    }
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let step = 0;
  let direction = toad.dataset.direction === "izquierda" ? "izquierda" : "derecha";
  let speaking = false;
  let jumping = false;
  let jumpFrameIndex = 0;
  let sequencePlaying = false;
  let sequenceFrame = null;
  let sequenceToken = 0;
  let idleTimer = 0;
  let breathingTimer = 0;
  let lastIdleSequence = -1;
  let x = 0;

  const allSpriteSources = [
    ...Object.values(sprites), ...jumpFrames, ...breatheSequence.frames,
    ...idleSequences.flatMap((sequence) => sequence.frames), ...romanticSequence.frames,
  ];

  allSpriteSources.forEach((source) => { const image = new Image(); image.src = source; });

  function currentSprite() {
    if (jumping) return jumpFrames[jumpFrameIndex];
    if (sequencePlaying && sequenceFrame) return sequenceFrame;
    if (direction === "derecha") return speaking ? sprites.derechaHablando : sprites.derechaQuieto;
    return speaking ? sprites.izquierdaHablando : sprites.izquierdaQuieto;
  }

  function updateSprite() {
    const source = currentSprite();
    toad.dataset.direction = direction;
    if (toad.getAttribute("src") !== source) toad.src = source;
  }

  function movementLimit() { return Math.max(0, track.clientWidth - toad.offsetWidth); }

  function addUserMessage(text) {
    const row = document.createElement("div");
    const paragraph = document.createElement("p");
    row.className = "message message--user message--new";
    paragraph.textContent = text;
    row.append(paragraph);
    history.append(row);
    history.scrollTop = history.scrollHeight;
  }

  function wait(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }

  async function typeBotMessage(text) {
    const row = document.createElement("div");
    const paragraph = document.createElement("p");
    const visibleText = document.createElement("span");
    const accessibleText = document.createElement("span");

    row.className = "message message--bot message--new message--typing";
    visibleText.className = "typing-text";
    visibleText.setAttribute("aria-hidden", "true");
    accessibleText.className = "sr-only";
    accessibleText.textContent = text;
    paragraph.append(visibleText, accessibleText);
    row.append(paragraph);
    history.append(row);

    if (reducedMotion.matches) {
      visibleText.textContent = text;
    } else {
      for (let index = 0; index < text.length; index += 1) {
        visibleText.textContent += text[index];
        if (index % 3 === 0) history.scrollTop = history.scrollHeight;
        const pause = /[.,?¡!]/.test(text[index]) ? 55 : 22;
        await wait(pause);
      }
    }
    row.classList.remove("message--typing");
    history.scrollTop = history.scrollHeight;
  }

  function setComposerEnabled(enabled) {
    input.disabled = !enabled;
    submitButton.disabled = !enabled;
  }

  function setJumpFrame(index) { jumpFrameIndex = index; updateSprite(); }

  function stopIdleSequence() {
    sequenceToken += 1; sequencePlaying = false; sequenceFrame = null;
    toad.classList.remove("is-sequencing"); compactToadImage.classList.remove("is-sequencing");
    compactToadImage.src = sprites.derechaQuieto; updateSprite();
  }

  function clearAnimationTimers() {
    window.clearTimeout(idleTimer); window.clearTimeout(breathingTimer);
    idleTimer = 0; breathingTimer = 0;
  }

  function chooseIdleSequence() {
    const choices = lane.classList.contains("is-collapsed") ? [...idleSequences, romanticSequence] : idleSequences;
    if (choices.length === 1) return choices[0];
    let nextIndex = lastIdleSequence;
    while (nextIndex === lastIdleSequence) { nextIndex = Math.floor(Math.random() * choices.length); }
    lastIdleSequence = nextIndex;
    return choices[nextIndex];
  }

  function activeToadImage() { return lane.classList.contains("is-collapsed") ? compactToadImage : toad; }

  async function playIdleSequence(sequence, target = activeToadImage()) {
    const token = ++sequenceToken;
    const isCompact = target === compactToadImage;
    sequencePlaying = true;
    target.classList.add("is-sequencing");
    const frames = Array.from({ length: sequence.loops }, () => sequence.frames).flat();
    for (const frame of frames) {
      if (token !== sequenceToken) return;
      if (isCompact) { compactToadImage.src = frame; } 
      else { sequenceFrame = frame; updateSprite(); }
      await wait(reducedMotion.matches ? 900 : sequence.frameTime);
    }
    if (token !== sequenceToken) return;
    sequencePlaying = false; sequenceFrame = null;
    target.classList.remove("is-sequencing");
    if (isCompact) compactToadImage.src = sprites.derechaQuieto;
    updateSprite();
  }

  function scheduleIdleGesture() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(async () => {
      if (speaking || jumping || sequencePlaying || document.hidden) { scheduleIdleGesture(); return; }
      await playIdleSequence(chooseIdleSequence());
      scheduleIdleGesture();
    }, 15000);
  }

  function scheduleBreathing() {
    window.clearTimeout(breathingTimer);
    breathingTimer = window.setTimeout(async () => {
      if (!speaking && !jumping && !sequencePlaying && !document.hidden) { await playIdleSequence(breatheSequence); }
      scheduleBreathing();
    }, 3000);
  }

  function resetAnimationTimers() { clearAnimationTimers(); scheduleBreathing(); scheduleIdleGesture(); }

  async function playClickGesture(target, includeRomantic) {
    if (speaking || jumping) return;
    clearAnimationTimers();
    if (sequencePlaying) stopIdleSequence();
    const choices = includeRomantic ? [breatheSequence, ...idleSequences, romanticSequence] : [breatheSequence, ...idleSequences];
    const gesture = choices[Math.floor(Math.random() * choices.length)];
    await playIdleSequence(gesture, target);
    resetAnimationTimers();
  }

  function triggerJump() {
    if (lane.classList.contains("is-collapsed")) { compactToadImage.src = sprites.derechaQuieto; return Promise.resolve(); }
    const limit = movementLimit();
    const distance = Math.min(82, Math.max(52, track.clientWidth * 0.12));
    const target = direction === "derecha" ? Math.min(limit, x + distance) : Math.max(0, x - distance);
    const reachedEdge = direction === "derecha" ? target >= limit - 0.5 : target <= 0.5;
    const middle = x + (target - x) * 0.52;

    if (reducedMotion.matches) {
      x = target; toad.style.setProperty("--toad-x", `${x}px`);
      if (reachedEdge) direction = direction === "derecha" ? "izquierda" : "derecha";
      updateSprite(); return Promise.resolve();
    }

    jumping = true; setJumpFrame(0);
    toad.style.setProperty("--jump-start", `${x}px`);
    toad.style.setProperty("--jump-middle", `${middle}px`);
    toad.style.setProperty("--jump-end", `${target}px`);
    toad.classList.remove("is-jumping"); void toad.offsetWidth; toad.classList.add("is-jumping");

    return new Promise((resolve) => {
      let settled = false;
      const frameTimes = [95, 190, 300, 420, 545, 680, 825];
      const frameTimers = frameTimes.map((time, index) => window.setTimeout(() => setJumpFrame(index + 1), time));
      const finish = () => {
        if (settled) return;
        settled = true;
        frameTimers.forEach((timer) => window.clearTimeout(timer));
        window.clearTimeout(fallbackTimer);
        toad.removeEventListener("animationend", finish);
        toad.classList.remove("is-jumping");
        x = target; toad.style.setProperty("--toad-x", `${x}px`);
        jumping = false;
        if (reachedEdge) direction = direction === "derecha" ? "izquierda" : "derecha";
        updateSprite(); resolve();
      };
      const fallbackTimer = window.setTimeout(finish, 1150);
      toad.addEventListener("animationend", finish, { once: true });
    });
  }

  async function botReply(text) {
    speaking = true; updateSprite();
    hint.textContent = "El sapito está escribiendo…";
    await wait(160);
    await typeBotMessage(text);
    speaking = false; updateSprite();
    hint.textContent = `Consulta ${step} respondida.`;
    setComposerEnabled(knowledgeReady);
    input.focus(); resetAnimationTimers();
  }

  // 3. ARREGLADO: Conexión a Flask /api/chat
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const answer = input.value.trim().replace(/\s+/g, " ");
    if (!answer || speaking || jumping || !knowledgeReady) return;

    clearAnimationTimers();
    if (sequencePlaying) stopIdleSequence();

    addUserMessage(answer);
    quickPrompts?.classList.add("is-used");
    input.value = "";
    setComposerEnabled(false);
    hint.textContent = "El sapito prepara su respuesta…";

    let reply = "";
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: answer })
        });
        const data = await response.json();
        reply = data.respuesta;
    } catch (error) {
        console.error("Error conectando con la IA, usando respuesta local:", error);
        reply = generateAnswer(answer); 
    }

    step += 1;
    await triggerJump();
    await botReply(reply);
  });

  quickPrompts?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-question]");
    if (!button || !knowledgeReady || speaking) return;
    input.value = button.dataset.question;
    form.requestSubmit();
  });

  toggle.addEventListener("click", () => {
    clearAnimationTimers();
    if (sequencePlaying) stopIdleSequence();
    const collapsed = lane.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggleLabel.textContent = collapsed ? "Mostrar sapito" : "Ocultar sapito";
    compactToadImage.src = sprites.derechaQuieto;
    updateSprite(); resetAnimationTimers();
  });

  toad.addEventListener("click", () => playClickGesture(toad, false));
  toad.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playClickGesture(toad, false); }
  });
  compactToad.addEventListener("click", () => playClickGesture(compactToadImage, true));

  window.addEventListener("resize", () => {
    const limit = movementLimit();
    x = Math.min(x, limit);
    toad.style.setProperty("--toad-x", `${x}px`);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { clearAnimationTimers(); if (sequencePlaying) stopIdleSequence(); } 
    else { resetAnimationTimers(); }
  });

  updateSprite(); compactToadImage.src = sprites.derechaQuieto;
  resetAnimationTimers();
  loadKnowledge();
})();