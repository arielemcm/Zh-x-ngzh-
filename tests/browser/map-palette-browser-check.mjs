import { writeFile } from "node:fs/promises";

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
await wait(1600);
await evaluate(`(() => {
  const form = document.querySelector('#experience-form');
  form.hidden = false;
  window.goToOnboardingStep(1);
})()`);
await wait(800);

const result = await evaluate(`(() => {
  const map = document.querySelector('#map-canvas');
  const colors = Object.fromEntries(['ribera', 'llanura', 'puna'].map(zone => [
    zone,
    getComputedStyle(document.querySelector('.zone--' + zone)).fill
  ]));
  const bounds = map.getBoundingClientRect();
  return {
    colors,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    mapVisible: bounds.width > 0 && bounds.height > 0,
    labels: document.querySelectorAll('.map-labels text').length
  };
})()`);

const clip = await evaluate(`(() => {
  const rect = document.querySelector('.territory-panel').getBoundingClientRect();
  return { x: rect.x + scrollX, y: Math.max(0, rect.y + scrollY), width: rect.width, height: Math.min(rect.height, innerHeight) };
})()`);
const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...clip, scale: 1 } });
await writeFile("docs/evidencias/mapa/verificacion-paleta-mapa.png", Buffer.from(screenshot.data, "base64"));

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await wait(400);
const mobile = await evaluate(`(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  mapWidth: Math.round(document.querySelector('#map-canvas').getBoundingClientRect().width),
  viewportWidth: document.documentElement.clientWidth
}))()`);

console.log(JSON.stringify({ ...result, mobile, exceptions }, null, 2));
await send("Browser.close");
socket.close();
