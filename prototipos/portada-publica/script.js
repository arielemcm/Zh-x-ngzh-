(() => {
  const body = document.body;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const phoneButton = document.querySelector(".phone-button");
  const panel = document.querySelector(".weather-panel");
  const panelClose = document.querySelector(".panel-close");
  const completion = document.querySelector(".journey-complete");
  const choices = [...document.querySelectorAll("[data-weather-choice]")];
  const canvases = [...document.querySelectorAll(".rain")];
  const rain = { back: [], front: [], speed: 1, density: 1 };
  let lastRainFrame = 0;
  let completionVisible = false;

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

  function openPanel() {
    phoneButton.setAttribute("aria-expanded", "true");
    panel.style.visibility = "visible";
    if (window.gsap && !reducedMotion) gsap.to(panel, { opacity: 1, y: 0, duration: .32, ease: "power2.out" });
    else { panel.style.opacity = "1"; panel.style.transform = "none"; }
    choices.find(button => button.getAttribute("aria-pressed") === "true")?.focus();
  }

  function closePanel() {
    phoneButton.setAttribute("aria-expanded", "false");
    if (window.gsap && !reducedMotion) {
      gsap.to(panel, { opacity: 0, y: 18, duration: .22, onComplete: () => { panel.style.visibility = "hidden"; } });
    } else { panel.style.opacity = "0"; panel.style.visibility = "hidden"; }
    phoneButton.focus();
  }

  phoneButton.addEventListener("click", () => phoneButton.getAttribute("aria-expanded") === "true" ? closePanel() : openPanel());
  panelClose.addEventListener("click", closePanel);
  choices.forEach(button => button.addEventListener("click", () => setWeather(button.dataset.weatherChoice)));
  document.addEventListener("keydown", event => { if (event.key === "Escape" && phoneButton.getAttribute("aria-expanded") === "true") closePanel(); });

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
    phoneButton.style.pointerEvents = "auto";
    phoneButton.style.opacity = "1";
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
      phoneButton.style.opacity = String(clamp((p - .84) * 12));
      phoneButton.style.pointerEvents = p > .84 ? "auto" : "none";
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
    .to(".crop-label", { opacity: 1, stagger: .32, duration: .8 }, 5.15)
    .to(".phone-button", { opacity: 1, pointerEvents: "auto", duration: .6 }, 8.6)
    .to(".phone-glint", { opacity: .72, duration: .45 }, 8.6)
    .to(".journey-complete span", { scaleX: 1, duration: .55, ease: "power2.out" }, 9.05)
    .to(".journey-complete", { autoAlpha: 1, y: 0, duration: .45, ease: "power2.out" }, 9.15);

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
