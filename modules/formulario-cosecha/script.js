const form = document.querySelector("#harvest-form");
const product = document.querySelector("#product");
const tonnage = document.querySelector("#tonnage");
const productionValue = document.querySelector("#production-value");
const dataNotice = document.querySelector("#data-notice");
const formError = document.querySelector("#form-error");
const retryServer = document.querySelector("#retry-server");
const submitButton = document.querySelector("#submit-button");
const results = document.querySelector("#results");
const recommendationMeta = document.querySelector("#recommendation-meta");
const recommendationMessage = document.querySelector("#recommendation-message");
const summaryGrid = document.querySelector("#summary-grid");
const marketCards = document.querySelector("#market-cards");
const tripSectionDescription = document.querySelector("#trip-section-description");
const tripCards = document.querySelector("#trip-cards");
const warningsList = document.querySelector("#warnings-list");

const bolivianNumber = new Intl.NumberFormat("es-BO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

let catalog = null;
let apiBase = "";
let catalogLoading = false;
let localMode = false;

const LOCAL_PRODUCTS = {
  Papa: { production: 39117.8, price: 3078, cost: 1955, demandFactor: 1 },
  Alfalfa: { production: 20991.5, price: 1180, cost: 690, demandFactor: 1.35 },
  Avena: { production: 4469.9, price: 1850, cost: 1120, demandFactor: 0.72 },
  Haba: { production: 1674.8, price: 4250, cost: 2700, demandFactor: 0.46 },
  Oca: { production: 920.5, price: 3100, cost: 1980, demandFactor: 0.36 },
  Cebolla: { production: 1363.6, price: 2680, cost: 1580, demandFactor: 0.82 },
  Prod_7: { production: 348.1, price: 2500, cost: 1550, demandFactor: 0.28 },
};

const LOCAL_MARKETS = [
  { id: "EL_ALTO", name: "El Alto", distance: 95, demand: 135, priceFactor: 1 },
  { id: "LA_PAZ", name: "La Paz", distance: 105, demand: 150, priceFactor: 1.02 },
  { id: "ORURO", name: "Oruro", distance: 280, demand: 60, priceFactor: 0.93 },
  { id: "COCHABAMBA", name: "Cochabamba", distance: 420, demand: 105, priceFactor: 0.98 },
  { id: "POTOSI", name: "Potosí", distance: 620, demand: 45, priceFactor: 0.92 },
  { id: "SUCRE", name: "Sucre", distance: 690, demand: 52.5, priceFactor: 0.96 },
  { id: "SANTA_CRUZ", name: "Santa Cruz de la Sierra", distance: 820, demand: 150, priceFactor: 1.04 },
  { id: "TRINIDAD", name: "Trinidad", distance: 830, demand: 37.5, priceFactor: 1.05 },
  { id: "TARIJA", name: "Tarija", distance: 900, demand: 52.5, priceFactor: 1.01 },
  { id: "COBIJA", name: "Cobija", distance: 1080, demand: 26.2, priceFactor: 1.07 },
];

const LOCAL_CATALOG = {
  selected_campaign: "2024-2025",
  products: Object.keys(LOCAL_PRODUCTS),
  production: Object.fromEntries(
    Object.entries(LOCAL_PRODUCTS).map(([name, values]) => [name, values.production]),
  ),
  markets: LOCAL_MARKETS.map(market => ({ id: market.id, name: market.name })),
  defaults: {
    velocidad_demo_kmh: 55,
    precio_diesel_bs_litro: 17.95,
    consumo_litros_100km: 23,
  },
  demand_quality: ["SIMULADO_LOCAL"],
};

const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

function getApiCandidates() {
  const candidates = [];
  if (["http:", "https:"].includes(window.location.protocol)) {
    candidates.push(window.location.origin);
  }
  candidates.push("http://127.0.0.1:8001", "http://localhost:8001");
  return [...new Set(candidates)];
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[character]);
}

function formatDecimal(value) {
  const number = Number(value);
  return Number.isFinite(number) ? bolivianNumber.format(number) : "0,0";
}

function formatDuration(hours) {
  const totalMinutes = Math.max(0, Math.round(Number(hours || 0) * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours} h ${minutes.toString().padStart(2, "0")} min`;
}

function productLabel(name) {
  return name === "Prod_7" ? "Otro producto" : name;
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.textContent = "";
  formError.hidden = true;
  retryServer.hidden = true;
}

async function requestJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error("No se pudo conectar con el servidor del proyecto.");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("El servidor no devolvió una respuesta válida.");
  }
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "No se pudo completar la solicitud.");
  }
  return data;
}

async function connectToApi(path, options = {}) {
  const candidates = apiBase ? [apiBase] : getApiCandidates();
  let lastError = null;

  for (const candidate of candidates) {
    try {
      const data = await requestJson(`${candidate}${path}`, options);
      apiBase = candidate;
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No se encontró el servidor del proyecto.");
}

function updateProduction() {
  if (!catalog || !product.value) {
    productionValue.textContent = "Sin seleccionar";
    return;
  }
  const production = Number(catalog.production[product.value] || 0);
  productionValue.textContent = `${formatDecimal(production)} toneladas`;
  tonnage.max = String(production);
  if (Number(tonnage.value) > production) {
    tonnage.value = String(production);
  }
  results.classList.remove("is-visible");
  results.hidden = true;
}

async function loadCatalog() {
  if (catalogLoading) return;
  catalogLoading = true;
  clearError();
  product.disabled = true;
  submitButton.disabled = true;
  dataNotice.textContent = "Conectando con el planificador logístico…";

  let lastError = null;
  catalog = null;
  localMode = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      apiBase = "";
      catalog = await connectToApi("/api/logistica/catalogo");
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        dataNotice.textContent = `Esperando al servidor del proyecto… intento ${attempt} de 3`;
        await wait(1000);
      }
    }
  }

  try {
    if (!catalog) {
      catalog = LOCAL_CATALOG;
      localMode = true;
      apiBase = "";
    }
    product.innerHTML = [
      '<option value="" selected disabled>Selecciona un producto</option>',
      ...catalog.products.map(name => (
        `<option value="${escapeHtml(name)}">${escapeHtml(productLabel(name))}</option>`
      )),
    ].join("");
    product.disabled = false;
    submitButton.disabled = false;

    const quality = (catalog.demand_quality || []).join(", ").toLowerCase();
    dataNotice.textContent = localMode
      ? "Modo local activo: puedes calcular sin iniciar el servidor. Las distancias, la demanda, los precios y los costos son estimaciones orientativas guardadas en esta página."
      : quality.includes("simulado")
      ? "Las rutas se consultan en OpenStreetMap mediante OSRM. La demanda, los precios y los costos comerciales siguen siendo datos demostrativos y deben verificarse antes de tomar decisiones reales."
      : "El planificador compara automáticamente rutas, demanda, costos y margen para todos los mercados disponibles.";
  } catch (error) {
    dataNotice.textContent = "El planificador logístico necesita el servidor principal para funcionar.";
    showError(`No se pudo conectar con el servidor del proyecto. ${error.message} Abre http://127.0.0.1:8001 y vuelve a intentarlo.`);
    retryServer.hidden = false;
  } finally {
    catalogLoading = false;
  }
}

function summaryStat(label, value, note, index) {
  return `
    <div class="summary-stat" style="--item-delay: ${420 + (index * 70)}ms">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </div>
  `;
}

function marketCard(market, index) {
  return `
    <article class="market-card" style="--item-delay: ${390 + (index * 70)}ms">
      <div>
        <span>Destino recomendado</span>
        <h4>${escapeHtml(market.Mercado)}</h4>
      </div>
      <dl>
        <div><dt>Entrega</dt><dd>${formatDecimal(market.Entregado_t)} t</dd></div>
        <div><dt>Distancia directa</dt><dd>${formatDecimal(market.Distancia_desde_Achacachi_km)} km</dd></div>
        <div><dt>Tiempo directo</dt><dd>${formatDuration(market.Tiempo_desde_Achacachi_h)}</dd></div>
      </dl>
    </article>
  `;
}

function tripCard(trip, index) {
  const deliveryText = String(trip.Entregas || "Destino calculado").replaceAll(" -> ", " → ");
  return `
    <article class="trip-card" style="--card-delay: ${500 + (index * 90)}ms">
      <h4>🚚 Viaje ${escapeHtml(trip.Viaje)}</h4>
      <p class="trip-route">Achacachi → ${escapeHtml(deliveryText)} → Achacachi</p>
      <div class="trip-stats">
        <div class="trip-stat"><span>Carga</span><strong>${formatDecimal(trip.Carga_t)} t</strong></div>
        <div class="trip-stat"><span>Distancia</span><strong>${formatDecimal(trip.Distancia_ida_vuelta_km)} km</strong></div>
        <div class="trip-stat"><span>Duración estimada</span><strong>${formatDuration(trip.Tiempo_estimado_h)}</strong></div>
        <div class="trip-stat"><span>Combustible</span><strong>${formatDecimal(trip.Combustible_l)} L</strong></div>
      </div>
      <h5 class="trip-path-title">Resultado económico estimado</h5>
      <p class="trip-path">Ingreso: Bs ${formatDecimal(trip.Ingresos_bs)} · Resultado después de costos listados: Bs ${formatDecimal(trip.Resultado_despues_costos_listados_bs)}</p>
    </article>
  `;
}

function renderResults(data) {
  const summary = data.summary;
  const recommendedMarkets = data.markets
    .filter(market => Number(market.Entregado_t) > 0)
    .sort((first, second) => (
      Number(first.Distancia_desde_Achacachi_km || Infinity)
      - Number(second.Distancia_desde_Achacachi_km || Infinity)
    ));

  recommendationMeta.textContent = `${productLabel(summary.Producto)} · Campaña ${summary.Campana} · Salida desde Achacachi`;
  if (Number(summary.Entregado_t) <= 0) {
    recommendationMessage.textContent = "No se encontró una distribución con margen positivo. Revisa la cantidad o los datos de demanda y precios.";
  } else if (Number(summary.Sin_asignar_t) > 0.01) {
    recommendationMessage.textContent = `Se asignaron ${formatDecimal(summary.Entregado_t)} t y quedaron ${formatDecimal(summary.Sin_asignar_t)} t sin destino por límites de demanda o margen.`;
  } else {
    recommendationMessage.textContent = `Se encontró una distribución para toda la carga en ${recommendedMarkets.length} ${recommendedMarkets.length === 1 ? "ciudad" : "ciudades"}.`;
  }
  if (data.route_fallback) {
    recommendationMessage.textContent += " OSRM no respondió y se utilizó la estimación geográfica de respaldo.";
  }

  summaryGrid.innerHTML = [
    summaryStat("Cantidad asignada", `${formatDecimal(summary.Entregado_t)} t`, "Carga con destino", 0),
    summaryStat("Viajes necesarios", formatDecimal(summary.Viajes_estimados), `${formatDecimal(summary.Camiones_disponibles)} camiones declarados`, 1),
    summaryStat("Distancia total", `${formatDecimal(summary.Distancia_total_km)} km`, "Todos los recorridos", 2),
    summaryStat("Tiempo acumulado", formatDuration(summary.Horas_ruta_totales_estimadas), "Tiempo estimado en carretera", 3),
    summaryStat("Combustible", `${formatDecimal(summary.Combustible_total_l)} L`, "Consumo estimado", 4),
    summaryStat("Costo de diésel", `Bs ${formatDecimal(summary.Costo_diesel_total_bs)}`, "Sin mantenimiento ni peajes", 5),
  ].join("");

  marketCards.innerHTML = recommendedMarkets.length
    ? recommendedMarkets.map(marketCard).join("")
    : '<p class="empty-result">No hay ciudades recomendadas para esta carga.</p>';

  const trips = data.trips || [];
  tripSectionDescription.textContent = `${trips.length} ${trips.length === 1 ? "viaje calculado" : "viajes calculados"} para ${formatDecimal(summary.Camiones_disponibles)} ${Number(summary.Camiones_disponibles) === 1 ? "camión disponible" : "camiones disponibles"}.`;
  tripCards.innerHTML = trips.length
    ? trips.map(tripCard).join("")
    : '<p class="empty-result">No se generaron viajes.</p>';

  warningsList.innerHTML = (data.warnings || [])
    .map(warning => `<li>${escapeHtml(warning)}</li>`)
    .join("");

  results.classList.remove("is-visible");
  results.hidden = false;
  void results.offsetWidth;
  results.classList.add("is-visible");
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function planLocally(payload) {
  const productData = LOCAL_PRODUCTS[payload.product] || LOCAL_PRODUCTS.Prod_7;
  const requested = Math.max(0, Number(payload.quantity_t));
  const capacity = Math.max(0.1, Number(payload.truck_capacity_t));
  const trucksAvailable = Math.max(1, Math.round(Number(payload.trucks_available)));
  const dieselPrice = Math.max(0, Number(payload.diesel_price));
  const fuelConsumption = Math.max(0, Number(payload.fuel_consumption));
  const speed = Math.max(20, Number(payload.demo_speed || 55));
  let remaining = requested;
  let tripNumber = 1;

  const candidates = LOCAL_MARKETS.map(market => {
    const demand = market.demand * productData.demandFactor;
    const salePrice = productData.price * market.priceFactor;
    const transportPerTon = ((market.distance * 2 * fuelConsumption / 100) * dieselPrice) / capacity;
    return { ...market, demand, salePrice, margin: salePrice - productData.cost - transportPerTon };
  }).filter(market => market.margin > 0)
    .sort((first, second) => second.margin - first.margin);

  const allocations = [];
  const trips = [];

  for (const market of candidates) {
    if (remaining <= 0.001) break;
    const delivered = Math.min(remaining, market.demand);
    if (delivered <= 0) continue;
    allocations.push({ market, delivered });
    remaining -= delivered;

    let pendingForMarket = delivered;
    while (pendingForMarket > 0.001) {
      const load = Math.min(capacity, pendingForMarket);
      const roundTripDistance = market.distance * 2;
      const hours = (roundTripDistance / speed) + 1.5;
      const fuel = roundTripDistance * fuelConsumption / 100;
      const income = load * market.salePrice;
      const result = income - (load * productData.cost) - (fuel * dieselPrice);
      trips.push({
        Viaje: tripNumber,
        Entregas: market.name,
        Carga_t: load,
        Distancia_ida_vuelta_km: roundTripDistance,
        Tiempo_estimado_h: hours,
        Combustible_l: fuel,
        Ingresos_bs: income,
        Resultado_despues_costos_listados_bs: result,
      });
      pendingForMarket -= load;
      tripNumber += 1;
    }
  }

  const deliveredTotal = allocations.reduce((total, item) => total + item.delivered, 0);
  const distanceTotal = trips.reduce((total, trip) => total + trip.Distancia_ida_vuelta_km, 0);
  const hoursTotal = trips.reduce((total, trip) => total + trip.Tiempo_estimado_h, 0);
  const fuelTotal = trips.reduce((total, trip) => total + trip.Combustible_l, 0);
  const incomeTotal = trips.reduce((total, trip) => total + trip.Ingresos_bs, 0);
  const resultTotal = trips.reduce((total, trip) => total + trip.Resultado_despues_costos_listados_bs, 0);
  const round = value => Number(value.toFixed(2));

  return {
    route_fallback: true,
    summary: {
      Producto: payload.product,
      Campana: LOCAL_CATALOG.selected_campaign,
      Entregado_t: round(deliveredTotal),
      Sin_asignar_t: round(Math.max(0, requested - deliveredTotal)),
      Viajes_estimados: trips.length,
      Camiones_disponibles: trucksAvailable,
      Distancia_total_km: round(distanceTotal),
      Horas_ruta_totales_estimadas: round(hoursTotal),
      Combustible_total_l: round(fuelTotal),
      Costo_diesel_total_bs: round(fuelTotal * dieselPrice),
      Ingresos_bs: round(incomeTotal),
      Resultado_despues_costos_listados_bs: round(resultTotal),
    },
    markets: allocations.map(({ market, delivered }) => ({
      Mercado: market.name,
      Entregado_t: round(delivered),
      Distancia_desde_Achacachi_km: market.distance,
      Tiempo_desde_Achacachi_h: round(market.distance / speed),
    })),
    trips: trips.map(trip => Object.fromEntries(
      Object.entries(trip).map(([key, value]) => [key, typeof value === "number" ? round(value) : value]),
    )),
    warnings: [
      "Cálculo realizado en modo local porque el servidor no está disponible.",
      "Las distancias, la demanda, los precios y los costos son orientativos; verifica estos datos antes de tomar una decisión comercial.",
    ],
  };
}

product.addEventListener("change", updateProduction);
retryServer.addEventListener("click", loadCatalog);

form.addEventListener("submit", async event => {
  event.preventDefault();
  clearError();
  if (!catalog) {
    showError("El catálogo logístico todavía no está disponible.");
    return;
  }

  const data = new FormData(form);
  const payload = {
    campaign: catalog.selected_campaign,
    product: data.get("product"),
    quantity_t: Number(data.get("tonnage")),
    truck_capacity_t: Number(data.get("capacity")),
    trucks_available: Number(data.get("trucks")),
    deadline_days: 7,
    hours_per_day: 8,
    route_mode: "osrm",
    demo_speed: Number(catalog.defaults.velocidad_demo_kmh || 60),
    diesel_price: Number(catalog.defaults.precio_diesel_bs_litro || 17.95),
    fuel_consumption: Number(catalog.defaults.consumo_litros_100km || 23),
    markets: catalog.markets.map(market => market.id),
    accept_simulated: true,
  };

  submitButton.disabled = true;
  submitButton.classList.add("is-loading");
  submitButton.textContent = "Calculando rutas y mercados…";
  results.hidden = true;

  try {
    let plan;
    if (localMode) {
      plan = planLocally(payload);
    } else {
      try {
        plan = await connectToApi("/api/logistica/planificar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        localMode = true;
        dataNotice.textContent = "Modo local activo: el servidor dejó de responder y el cálculo se realizó con estimaciones guardadas en esta página.";
        plan = planLocally(payload);
      }
    }
    renderResults(plan);
  } catch (error) {
    showError(error.message);
    formError.scrollIntoView({ behavior: "smooth", block: "center" });
  } finally {
    submitButton.disabled = false;
    submitButton.classList.remove("is-loading");
    submitButton.textContent = "Recomendar ciudades y calcular mis viajes";
  }
});

loadCatalog();
