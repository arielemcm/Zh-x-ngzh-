const crops = [
  { name: "Papa (Huaycha Imilla)", color: "#71845f", accent: "#b79767", note: "Tubérculo andino adaptado al frío del altiplano." },
  { name: "Haba", color: "#66835c", accent: "#afc58b", note: "Leguminosa que puede aportar nitrógeno a la rotación." },
  { name: "Cebada", color: "#9a8a54", accent: "#d5bd72", note: "Cereal resistente a condiciones frías y secas." },
  { name: "Avena", color: "#7c8d59", accent: "#d2c98d", note: "Cereal útil para grano, forraje y cobertura." },
  { name: "Oca (Ulluku / Hullikus)", color: "#8a6a55", accent: "#d69b61", note: "Tubérculo andino de ciclo largo y buena adaptación." },
  { name: "Papalisa", color: "#766451", accent: "#c68a71", note: "Tubérculo andino que prefiere suelos con buen drenaje." },
  { name: "Cebolla", color: "#6f855c", accent: "#d7c9a0", note: "Hortaliza que requiere manejo cuidadoso de humedad." }
];

const zoneNames = { ribera: "Ribera lacustre", llanura: "Llanura altiplánica", puna: "Puna alta" };
const form = document.querySelector("#planting-form");
const seedSelect = document.querySelector("#seed-select");
const preview = document.querySelector("#crop-preview");
const illustration = document.querySelector("#crop-illustration");
const cropCaption = document.querySelector("#crop-caption");
const cropNote = document.querySelector("#crop-note");
const previousSeed = document.querySelector("#previous-seed");
const suggestions = document.querySelector("#suggestions");
const submit = form.querySelector('button[type="submit"]');
const status = document.querySelector("#form-status");

const params = new URLSearchParams(window.location.search);
const selectedZone = params.get("zona") || sessionStorage.getItem("agricultural-zone") || "";
document.querySelector("#selected-zone").textContent = zoneNames[selectedZone] || "Territorio registrado";

const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const isKnownCrop = value => crops.some(crop => normalize(crop.name) === normalize(value.trim()));

function updateCompletion() {
  const complete = Boolean(seedSelect.value) && isKnownCrop(previousSeed.value);
  submit.disabled = !complete;
  status.textContent = complete ? "Las dos respuestas están listas." : "Completa las dos preguntas para continuar.";
}

seedSelect.addEventListener("change", () => {
  const crop = crops.find(({ name }) => name === seedSelect.value);
  if (!crop) {
    preview.classList.remove("is-selected");
    cropCaption.textContent = "Elige una semilla";
    cropNote.textContent = "Aquí aparecerá una referencia breve de tu elección.";
    updateCompletion();
    return;
  }

  illustration.style.setProperty("--crop-color", crop.color);
  illustration.style.setProperty("--crop-accent", crop.accent);
  cropCaption.textContent = crop.name;
  cropNote.textContent = crop.note;
  preview.classList.add("is-selected");
  updateCompletion();
});

function closeSuggestions() {
  suggestions.innerHTML = "";
  suggestions.classList.add("is-closing");
  previousSeed.setAttribute("aria-expanded", "false");
}

function choosePrevious(name) {
  previousSeed.value = name;
  closeSuggestions();
  updateCompletion();
  previousSeed.focus();
}

function showSuggestions() {
  const search = normalize(previousSeed.value.trim());
  const matches = crops.filter(({ name }) => normalize(name).includes(search));
  suggestions.innerHTML = "";
  suggestions.classList.remove("is-closing");

  matches.forEach(({ name }) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "option");
    button.textContent = name;
    button.addEventListener("click", () => choosePrevious(name));
    item.append(button);
    suggestions.append(item);
  });

  previousSeed.setAttribute("aria-expanded", String(Boolean(matches.length)));
  if (!matches.length) suggestions.classList.add("is-closing");
}

previousSeed.addEventListener("input", () => { showSuggestions(); updateCompletion(); });
previousSeed.addEventListener("focus", showSuggestions);
document.addEventListener("click", event => { if (!event.target.closest("#autocomplete")) closeSuggestions(); });

form.addEventListener("submit", event => {
  event.preventDefault();
  if (submit.disabled) return;
  sessionStorage.setItem("agricultural-current-crop", seedSelect.value);
  sessionStorage.setItem("agricultural-previous-crop", previousSeed.value.trim());
  status.textContent = "Respuestas guardadas correctamente.";
});

updateCompletion();
