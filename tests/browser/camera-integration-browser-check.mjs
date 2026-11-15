import { writeFile } from "node:fs/promises";

const endpoint = await fetch("http://localhost:9225/json/new?http://localhost:8765/index.html", { method: "PUT" }).then(response => response.json());
const socket = new WebSocket(endpoint.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
let sequence = 0;

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
  if (message.method === "Page.javascriptDialogOpening") send("Page.handleJavaScriptDialog", { accept: false }).catch(() => {});
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

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const evaluate = async expression => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://localhost:8765/index.html" });
await wait(1600);

const main = await evaluate(`(() => {
  const link = document.querySelector('.camera-module-link');
  return {
    linkExists: Boolean(link),
    label: link?.textContent.trim(),
    target: new URL(link?.href).pathname,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  };
})()`);
let shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile("docs/evidencias/principal/verificacion-acceso-camara.png", Buffer.from(shot.data, "base64"));

await send("Page.navigate", { url: "http://localhost:8765/modules/diagnostico-hojas/index.html" });
await wait(1400);
await evaluate(`document.body.dataset.cameraState = 'active'`);
await wait(250);
const camera = await evaluate(`(() => ({
  purpose: document.querySelector('#purpose-title')?.textContent,
  contribution: document.querySelector('#contribution-title')?.textContent,
  localOnlyNotice: document.querySelector('.contribution-panel small')?.textContent,
  backTarget: new URL(document.querySelector('.module-back').href).pathname,
  focusRing: Boolean(document.querySelector('.focus-ring')),
  liveLabel: document.querySelector('.live-label')?.textContent.trim(),
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
}))()`);
shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
await writeFile("docs/evidencias/diagnostico-hojas/vista-integrada-contenido.png", Buffer.from(shot.data, "base64"));

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Page.navigate", { url: "http://localhost:8765/index.html" });
await wait(1200);
const mobile = await evaluate(`(() => {
  const link = document.querySelector('.camera-module-link').getBoundingClientRect();
  return {
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    cameraButtonInsideViewport: link.left >= 0 && link.right <= document.documentElement.clientWidth
  };
})()`);

console.log(JSON.stringify({ main, camera, mobile, exceptions }, null, 2));
await send("Browser.close");
socket.close();
