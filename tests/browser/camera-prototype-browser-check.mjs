import { writeFile } from "node:fs/promises";

const endpoint = await fetch("http://localhost:9224/json/new?http://127.0.0.1:8001/modules/diagnostico-hojas/", { method: "PUT" }).then(response => response.json());
const socket = new WebSocket(endpoint.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
let sequence = 0;

socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
  if (message.method === "Page.javascriptDialogOpening") {
    send("Page.handleJavaScriptDialog", { accept: false }).catch(() => {});
  }
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
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

await send("Runtime.enable");
await send("Page.enable");
await send("Page.setLifecycleEventsEnabled", { enabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://127.0.0.1:8001" });
await wait(1800);
await evaluate(`document.body.dataset.cameraState = 'active'`);
await wait(250);

const desktop = await evaluate(`(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  viewfinderVisible: getComputedStyle(document.querySelector('.viewfinder')).opacity,
  focusRing: Boolean(document.querySelector('.focus-ring')),
  liveLabel: document.querySelector('.live-label').textContent.trim(),
  font: getComputedStyle(document.querySelector('h1')).fontFamily
}))()`);
let shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile("docs/evidencias/diagnostico-hojas/vista-integrada-desktop.png", Buffer.from(shot.data, "base64"));

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await wait(500);
const mobile = await evaluate(`(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  cameraWidth: Math.round(document.querySelector('.camera-stage').getBoundingClientRect().width),
  viewportWidth: document.documentElement.clientWidth,
  liveLabelVisible: getComputedStyle(document.querySelector('.live-label')).display !== 'none'
}))()`);
shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile("docs/evidencias/diagnostico-hojas/vista-integrada-mobile.png", Buffer.from(shot.data, "base64"));

console.log(JSON.stringify({ desktop, mobile, exceptions }, null, 2));
await send("Browser.close");
socket.close();
