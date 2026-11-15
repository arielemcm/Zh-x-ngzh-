const endpoint = await fetch("http://localhost:9223/json/new?http://localhost:8765/index.html", { method: "PUT" }).then(response => response.json());
const socket = new WebSocket(endpoint.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
let sequence = 0;

socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const evaluate = async expression => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://localhost:8765/index.html" });
await wait(1800);

await evaluate(`(() => {
  const form = document.querySelector('#experience-form');
  form.hidden = false;
  document.querySelector('.territory-form [name="zone"]').value = 'llanura';
  sessionStorage.setItem('agricultural-zone', 'llanura');
  window.goToOnboardingStep(2);
  const papa = document.querySelector('input[name="cultivo-anterior"][value="Papa (Huaycha Imilla)"]');
  papa.checked = true;
  papa.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('[data-onboarding-step="2"] [data-onboarding-next]').click();
})()`);
await wait(1800);

await evaluate(`document.querySelector('.recommendation-card').click()`);

const desktop = await evaluate(`(() => {
  const cards = [...document.querySelectorAll('.recommendation-card')];
  const form = document.querySelector('#experience-form').getBoundingClientRect();
  return {
    cards: cards.length,
    firstThree: cards.slice(0, 3).map(card => card.querySelector('strong').textContent),
    source: document.querySelector('#recommendation-source-status').textContent,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    formWidth: Math.round(form.width),
    visibleStep: document.querySelector('[data-onboarding-step="3"]:not([hidden])') !== null,
    selectedCards: cards.filter(card => card.getAttribute('aria-checked') === 'true').length,
    evidenceRows: document.querySelectorAll('#recommendation-evidence dt').length,
    finishEnabled: !document.querySelector('#finish-onboarding').disabled
  };
})()`);

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await wait(500);
const mobile = await evaluate(`(() => {
  const body = document.documentElement;
  const step = document.querySelector('[data-onboarding-step="3"]');
  const cards = [...document.querySelectorAll('.recommendation-card')];
  return {
    horizontalOverflow: body.scrollWidth > body.clientWidth,
    documentWidth: body.clientWidth,
    scrollWidth: body.scrollWidth,
    cardsOutside: cards.filter(card => {
      const rect = card.getBoundingClientRect();
      return rect.left < 0 || rect.right > body.clientWidth;
    }).length,
    stepHeight: Math.round(step.getBoundingClientRect().height)
  };
})()`);

console.log(JSON.stringify({ desktop, mobile, exceptions }, null, 2));
socket.close();
