(() => {
  const body = document.body;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const completion = document.querySelector(".journey-complete");
  const journeyCta = document.querySelector(".journey-cta");
  const experiencePanel = document.querySelector("#experience-form");
  const dirtParticles = [...document.querySelectorAll(".dirt-burst i")];
  const dirtDust = [...document.querySelectorAll(".dirt-dust")];
  const dirtWall = document.querySelector(".dirt-wall");
  const dirtImpact = document.querySelector(".dirt-impact");
  const territoryForm = document.querySelector(".territory-form");
  const choices = [...document.querySelectorAll("[data-weather-choice]")];
  const canvases = [...document.querySelectorAll(".rain")];
  const rain = { back: [], front: [], speed: 1, density: 1 };
  let lastRainFrame = 0;
  let completionVisible = false;
  let digging = false;

  const territoryNames = {
    ribera: "Ribera lacustre",
    llanura: "Llanura altiplánica",
    puna: "Puna alta"
  };

  function syncTerritorySelection() {
    const selected = document.querySelector('.territory-question .zone-button[aria-pressed="true"]')?.dataset.zone || "";
    const selection = document.querySelector("#territory-selection");
    const input = territoryForm?.querySelector('[name="zone"]');
    const submit = territoryForm?.querySelector('button[type="submit"]');
    const status = territoryForm?.querySelector(".territory-status");
    if (selection) selection.textContent = selected ? territoryNames[selected] : "Elige una zona en el mapa";
    if (input) input.value = selected;
    if (submit) submit.disabled = !selected;
    if (status && !selected) status.textContent = "";
  }

  document.querySelectorAll(".territory-question .zone-button, .territory-question .zone").forEach(control => {
    control.addEventListener("click", () => queueMicrotask(syncTerritorySelection));
    control.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") queueMicrotask(syncTerritorySelection);
    });
  });

  territoryForm?.addEventListener("submit", event => {
    event.preventDefault();
    const zone = territoryForm.elements.zone.value;
    if (!zone) return;
    sessionStorage.setItem("agricultural-zone", zone);
    territoryForm.querySelector(".territory-status").textContent = `${territoryNames[zone]} guardada.`;
    window.setTimeout(() => {
      window.goToOnboardingStep?.(2);
    }, reducedMotion ? 0 : 220);
  });

  function scrollToExperience() {
    experiencePanel?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  journeyCta?.addEventListener("click", event => {
    event.preventDefault();
    if (digging) return;
    if (reducedMotion || !window.gsap) {
      scrollToExperience();
      return;
    }

    digging = true;
    journeyCta.setAttribute("aria-busy", "true");
    const trajectories = [
      [-118, -64, -72], [-94, -106, -58], [-72, -148, -42], [-48, -178, -28],
      [-22, -194, -12], [4, -204, 4], [30, -190, 18], [58, -166, 32],
      [86, -134, 48], [112, -96, 62], [132, -58, 76], [76, -82, 54],
      [48, -108, 34], [20, -126, 14], [-12, -116, -8], [-42, -98, -28],
      [-70, -74, -48], [-92, -42, -64], [52, -54, 38], [12, -66, 10], [-34, -48, -32],
      [-154, -92, -82], [-132, -142, -66], [-102, -190, -48], [-64, -230, -30],
      [-20, -252, -10], [28, -244, 14], [72, -216, 34], [112, -174, 52],
      [148, -122, 70], [168, -70, 86], [94, -62, 48], [-116, -58, -72], [42, -92, 24], [-58, -112, -38]
    ];
    const dig = gsap.timeline({
      onComplete() {
        gsap.set(dirtParticles, { clearProps: "all" });
        gsap.set(dirtDust, { clearProps: "all" });
        gsap.set(dirtWall, { clearProps: "all" });
        gsap.set(dirtImpact, { clearProps: "all" });
        gsap.set(".farmer-pose--dig", { opacity: 0 });
        gsap.set(".farmer-pose--ready", { opacity: 1 });
        journeyCta.removeAttribute("aria-busy");
        digging = false;
      }
    });

    dig
      .to(".farmer-pose--ready", { opacity: 0, duration: .18, ease: "power2.in" }, 0)
      .to(".farmer-pose--dig", { opacity: 1, duration: .2, ease: "power2.in" }, 0)
      .to(".farmer-wrap", { yPercent: 3.8, xPercent: -1.2, rotation: -.7, duration: .16, yoyo: true, repeat: 1, ease: "power3.inOut" }, 0)
      .set(dirtParticles, { opacity: 1, x: 0, y: 0, scale: 1.35 }, .11)
      .set(dirtDust, { opacity: .95, x: 0, y: 0, scale: .25 }, .11)
      .set(dirtWall, { opacity: .9, x: 0, y: 0, scale: .28, rotation: -6 }, .11)
      .set(dirtImpact, { opacity: 1, scaleX: .25, scaleY: .65 }, .11)
      .to(dirtImpact, { opacity: 0, scaleX: 2.15, scaleY: 1.45, duration: .78, ease: "power3.out" }, .11)
      .to(dirtWall, { opacity: 0, x: -22, y: -118, scale: 1.9, rotation: 8, duration: 1.48, ease: "power2.out" }, .11);

    const dustMotions = [
      [-78, -108, 2.9], [74, -148, 2.65], [-132, -72, 2.45],
      [118, -92, 2.35], [-46, -178, 2.6]
    ];
    dirtDust.forEach((cloud, index) => {
      const [x, y, scale] = dustMotions[index];
      dig.to(cloud, { opacity: 0, x, y, scale, duration: 1.32 + index * .06, ease: "power2.out" }, .11 + index * .035);
    });

    dirtParticles.forEach((particle, index) => {
      const [x, y, rotation] = trajectories[index];
      dig.to(particle, { x, y, rotation, scale: .15, opacity: 0, duration: 1.18, ease: "power2.out" }, .11 + index * .006);
    });

    dig.call(scrollToExperience, null, 1.22);
  });

  function setCompletionAccessible(visible) {
    if (visible === completionVisible) return;
    completionVisible = visible;
    completion.setAttribute("aria-hidden", String(!visible));
  }

  function setWeather(weather) {
    body.dataset.weather = weather;
    choices.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.weatherChoice === weather)));
    rain.speed = weather === "storm" ? 2.2 : weather === "sun" ? 0 : 1;
    rain.density = weather === "storm" ? 1.8 : weather === "sun" ? 0 : 1;
  }

  choices.forEach(button => button.addEventListener("click", () => setWeather(button.dataset.weatherChoice)));

  function seedDrops(width, height, count, front) {
    return Array.from({ length: count }, () => ({ x: Math.random() * width, y: Math.random() * height, length: (front ? 17 : 9) + Math.random() * (front ? 20 : 12), velocity: (front ? 8 : 4) + Math.random() * (front ? 7 : 4), alpha: (front ? .2 : .11) + Math.random() * .22 }));
  }

  function resizeRain() {
    canvases.forEach((canvas, index) => {
      const ratio = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1 : 1.35);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const key = index ? "front" : "back";
      rain[key] = seedDrops(rect.width, rect.height, Math.round(rect.width / (index ? 20 : 27)), !!index);
      canvas.dataset.ratio = ratio;
    });
  }

  function drawRain(time = 0) {
    requestAnimationFrame(drawRain);
    if (time - lastRainFrame < 32) return;
    lastRainFrame = time;
    canvases.forEach((canvas, index) => {
      const ctx = canvas.getContext("2d");
      const ratio = Number(canvas.dataset.ratio) || 1;
      const width = canvas.width / ratio;
      const height = canvas.height / ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (!rain.speed) return;
      ctx.lineWidth = index ? 1.15 : .75;
      ctx.lineCap = "round";
      const drops = rain[index ? "front" : "back"];
      const visible = Math.floor(drops.length * Math.min(rain.density, 1));
      for (let i = 0; i < visible; i += 1) {
        const drop = drops[i];
        ctx.beginPath(); ctx.moveTo(drop.x, drop.y); ctx.lineTo(drop.x - drop.length * .38, drop.y + drop.length);
        ctx.strokeStyle = `rgba(59,78,91,${drop.alpha})`; ctx.stroke();
        drop.x -= drop.velocity * .32 * rain.speed; drop.y += drop.velocity * rain.speed;
        if (drop.y > height + 30 || drop.x < -30) { drop.x = Math.random() * width + width * .15; drop.y = -30; }
      }
      if (rain.density > 1) {
        const extra = Math.floor(drops.length * (rain.density - 1));
        for (let i = 0; i < extra; i += 1) {
          const drop = drops[i];
          const y = (drop.y + height * .33) % height;
          ctx.beginPath(); ctx.moveTo(width - drop.x, y); ctx.lineTo(width - drop.x - drop.length * .38, y + drop.length);
          ctx.strokeStyle = `rgba(45,67,83,${drop.alpha * .9})`; ctx.stroke();
        }
      }
    });
  }

  resizeRain();
  addEventListener("resize", resizeRain, { passive: true });
  requestAnimationFrame(drawRain);
  setWeather("drizzle");

  if (reducedMotion) {
    setCompletionAccessible(true);
    return;
  }

  if (!window.gsap || !window.ScrollTrigger) {
    const world = document.querySelector(".world");
    const farmer = document.querySelector(".farmer-wrap");
    const intro = document.querySelector(".intro-copy");
    const cue = document.querySelector(".scroll-cue");
    const labels = [...document.querySelectorAll(".crop-label")];
    const progressBar = document.querySelector(".progress span");
    const completionLine = completion.querySelector("span");
    const clamp = value => Math.max(0, Math.min(1, value));
    const updateFallback = () => {
      const journey = document.querySelector(".journey");
      const p = clamp(-journey.getBoundingClientRect().top / (journey.offsetHeight - innerHeight));
      const mobile = innerWidth < 700;
      const initialScale = mobile ? 2.12 : 2.55;
      const scale = initialScale + (1 - initialScale) * Math.min(1, p / .82);
      const x = (mobile ? -2 : -4) * (1 - p);
      const y = (mobile ? 8 : 1) * (1 - p);
      world.style.transform = `translate(${x}%, ${y}%) scale(${scale})`;
      farmer.style.transform = `translate(${(mobile ? -25 : 0) * (1 - p)}%, ${(mobile ? -62 : 0) * (1 - p)}%)`;
      intro.style.opacity = String(clamp(1 - p * 7));
      cue.style.opacity = String(clamp(1 - p * 8));
      progressBar.style.transform = `scaleY(${p})`;
      labels.forEach((label, index) => { label.style.opacity = String(clamp((p - .51 - index * .035) * 12)); });
      document.querySelector(".farmer-pose--phone").style.opacity = String(clamp((.29 - p) * 10));
      document.querySelector(".farmer-pose--phone-mid").style.opacity = String(clamp((p - .15) * 12) * clamp((.4 - p) * 12));
      document.querySelector(".farmer-pose--pocket").style.opacity = String(clamp((p - .28) * 12) * clamp((.58 - p) * 12));
      document.querySelector(".farmer-pose--lean").style.opacity = String(clamp((p - .47) * 12) * clamp((.72 - p) * 12));
      document.querySelector(".farmer-pose--ready").style.opacity = String(clamp((p - .62) * 10));
      const ending = clamp((p - .91) * 12);
      completion.style.opacity = String(ending);
      completion.style.transform = `translateY(${12 * (1 - ending)}px)`;
      completionLine.style.transform = `scaleX(${ending})`;
      setCompletionAccessible(p >= .92);
    };
    addEventListener("scroll", updateFallback, { passive: true });
    addEventListener("resize", updateFallback, { passive: true });
    updateFallback();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.set(".world", { scale: () => innerWidth < 700 ? 2.12 : 2.55, xPercent: () => innerWidth < 700 ? -2 : -4, yPercent: () => innerWidth < 700 ? 8 : 1 });
  gsap.set(".farmer-wrap", { scale: 1.05, yPercent: () => innerWidth < 700 ? -62 : 0, xPercent: () => innerWidth < 700 ? -25 : 0 });

  const chapters = ["El rostro", "Los pasos", "Los surcos", "El territorio", "El clima"];
  const story = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: {
    trigger: ".journey", start: "top top", end: "bottom bottom", scrub: true, invalidateOnRefresh: true,
    onUpdate(self) {
      document.querySelector(".chapter").textContent = chapters[Math.min(chapters.length - 1, Math.floor(self.progress * chapters.length))];
      setCompletionAccessible(self.progress >= .92);
    }
  }});

  story
    .to(".progress span", { scaleY: 1, duration: 10 }, 0)
    .to(".world", { scale: 1, xPercent: 0, yPercent: 0, duration: 8.2 }, 0)
    .to(".landscape", { scale: 1, duration: 8.2 }, 0)
    .to(".farmer-wrap", { scale: 1, xPercent: 0, yPercent: 0, duration: 8.2 }, 0)
    .to(".intro-copy", { opacity: 0, y: -40, duration: 1.6 }, .4)
    .to(".scroll-cue", { opacity: 0, duration: 1 }, .5)
    .to(".mist-one", { xPercent: 32, opacity: .16, duration: 5.5 }, 1)
    .to(".mist-two", { xPercent: -25, opacity: .12, duration: 5.4 }, 1.2)
    .fromTo(".reveal-feet", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.1 }, 2.2)
    .to(".reveal-feet", { opacity: 0, duration: .8 }, 3.7)
    .fromTo(".reveal-fields", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2 }, 4.2)
    .to(".reveal-fields", { opacity: 0, duration: .8 }, 6)
    .to(".near-growth", { yPercent: -2.5, duration: 7 }, 1)
    .to(".phone-glint", { opacity: .72, duration: .35 }, 1.05)
    .to(".farmer-pose--phone", { opacity: 0, duration: .9, ease: "sine.inOut" }, 1.95)
    .to(".farmer-pose--phone-mid", { opacity: 1, duration: .85, ease: "sine.inOut" }, 1.9)
    .to(".phone-glint", { opacity: 0, duration: .45 }, 2.2)
    .to(".farmer-pose--phone-mid", { opacity: 0, duration: .9, ease: "sine.inOut" }, 2.95)
    .to(".farmer-pose--pocket", { opacity: 1, duration: .85, ease: "sine.inOut" }, 2.9)
    .to(".farmer-pose--pocket", { opacity: 0, duration: 1, ease: "sine.inOut" }, 4.35)
    .to(".farmer-pose--lean", { opacity: 1, duration: .95, ease: "sine.inOut" }, 4.3)
    .to(".farmer-pose--lean", { opacity: 0, duration: 1.15, ease: "sine.inOut" }, 5.45)
    .to(".farmer-pose--ready", { opacity: 1, duration: 1.1, ease: "sine.inOut" }, 5.4)
    .to(".crop-label", { opacity: 1, stagger: .32, duration: .8 }, 5.15)
    .to(".journey-complete span", { scaleX: 1, duration: .55, ease: "power2.out" }, 9.05)
    .to(".journey-complete", { autoAlpha: 1, y: 0, duration: .45, ease: "power2.out" }, 9.15);

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
