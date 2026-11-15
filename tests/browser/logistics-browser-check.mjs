const endpoint = await fetch(
  "http://127.0.0.1:9339/json/new?http://127.0.0.1:8019/modules/formulario-cosecha/index.html",
  { method: "PUT" },
).then(response => response.json());

const socket = new WebSocket(endpoint.webSocketDebuggerUrl);
const pending = new Map();
const exceptions = [];
let sequence = 0;

socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    exceptions.push(message.params.exceptionDetails.text);
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
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", {
  url: "http://127.0.0.1:8019/modules/formulario-cosecha/index.html",
});

for (let attempt = 0; attempt < 40; attempt += 1) {
  if (await evaluate("!document.querySelector('#product').disabled")) break;
  await wait(250);
}

await evaluate(`(() => {
  const product = document.querySelector('#product');
  product.value = 'Papa';
  product.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#tonnage').value = '30';
  document.querySelector('input[name="capacity"][value="15"]').checked = true;
  document.querySelector('#trucks').value = '2';
  document.querySelector('#harvest-form').requestSubmit();
})()`);

for (let attempt = 0; attempt < 100; attempt += 1) {
  const finished = await evaluate(`(
    !document.querySelector('#results').hidden
    || !document.querySelector('#form-error').hidden
  )`);
  if (finished) break;
  await wait(250);
}

const desktop = await evaluate(`(() => ({
  products: document.querySelector('#product').options.length - 1,
  productEnabled: !document.querySelector('#product').disabled,
  resultsVisible: !document.querySelector('#results').hidden,
  error: document.querySelector('#form-error').hidden
    ? ''
    : document.querySelector('#form-error').textContent,
  markets: document.querySelectorAll('.market-card').length,
  trips: document.querySelectorAll('.trip-card').length,
  summaryStats: document.querySelectorAll('.summary-stat').length,
  backTarget: new URL(document.querySelector('.back-link').href).pathname,
  horizontalOverflow:
    document.documentElement.scrollWidth > document.documentElement.clientWidth
}))()`);

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await wait(300);

const mobile = await evaluate(`(() => ({
  horizontalOverflow:
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  cardsOutside: [...document.querySelectorAll('.market-card,.trip-card')]
    .filter(card => {
      const bounds = card.getBoundingClientRect();
      return bounds.left < 0 || bounds.right > document.documentElement.clientWidth;
    }).length
}))()`);

console.log(JSON.stringify({ desktop, mobile, exceptions }, null, 2));
await send("Browser.close");
socket.close();
