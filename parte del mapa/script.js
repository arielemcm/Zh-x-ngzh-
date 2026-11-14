const data = window.ACHACACHI_MAP_DATA;
const svg = document.querySelector('#achacachi-map');
const mapCanvas = document.querySelector('#map-canvas');
const zoneContainer = document.querySelector('#zone-shapes');
const contourContainer = document.querySelector('#contours');
const heading = document.querySelector('#map-heading');
const description = document.querySelector('#zone-description');
const buttons = [...document.querySelectorAll('.zone-button')];
const SVG_NS = 'http://www.w3.org/2000/svg';
const MAP_ASSET_BASE = new URL('.', document.currentScript.src);

const zoneCopy = {
  ribera: {
    title: 'Ribera lacustre',
    description: 'Franja próxima al lago Titicaca, interpretada con la altitud, el relieve y una distancia máxima de 4 km a la costa.'
  },
  llanura: {
    title: 'Llanura altiplánica',
    description: 'Planicies y valles interiores situados principalmente por debajo de 4.000 m de altitud.'
  },
  puna: {
    title: 'Puna alta',
    description: 'Terrenos elevados hacia la Cordillera Real. Incluye la transición de 4.000–4.500 m y el piso nival.'
  }
};

const requestedZone = new URLSearchParams(window.location.search).get('zona');
let selectedZone = Object.hasOwn(zoneCopy, requestedZone) ? requestedZone : null;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function buildMap() {
  svg.setAttribute('viewBox', data.viewBox);
  document.querySelector('#clip-boundary').setAttribute('d', data.boundary);
  document.querySelector('#municipality-outline').setAttribute('d', data.boundary);
  document.querySelector('#lake-shape').setAttribute('d', data.lake);

  const hillshade = document.querySelector('#hillshade');
  Object.entries(data.hillshade).forEach(([key, value]) => {
    hillshade.setAttribute(key, key === 'href' ? new URL(value, MAP_ASSET_BASE).href : value);
  });

  data.zones.forEach((zoneData) => {
    const path = svgElement('path', {
      id: `zone-${zoneData.id}`,
      d: zoneData.path,
      class: `zone zone--${zoneData.id}`,
      'data-zone': zoneData.id,
      'fill-rule': 'evenodd',
      tabindex: '0',
      role: 'button',
      'aria-label': zoneData.label,
      'aria-pressed': 'false'
    });
    path.addEventListener('click', () => toggleZone(zoneData.id));
    path.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleZone(zoneData.id);
      }
    });
    zoneContainer.append(path);
  });

  Object.entries(data.contours).forEach(([elevation, paths]) => {
    paths.forEach((pathData) => {
      contourContainer.append(svgElement('path', {
        d: pathData,
        class: `contour contour--${elevation}`
      }));
    });
  });
}

function renderSelection() {
  mapCanvas.classList.toggle('has-selection', Boolean(selectedZone));

  document.querySelectorAll('.zone').forEach((zone) => {
    const active = zone.dataset.zone === selectedZone;
    zone.classList.toggle('is-selected', active);
    zone.setAttribute('aria-pressed', String(active));
  });

  buttons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.zone === selectedZone));
  });

  if (selectedZone) {
    heading.textContent = zoneCopy[selectedZone].title;
    description.textContent = zoneCopy[selectedZone].description;
  } else {
    heading.textContent = 'Todo el municipio';
    description.textContent = 'Las tres zonas están visibles. El relieve se mantiene bajo el color para mostrar montañas, valles y planicies.';
  }
}

function toggleZone(zoneId) {
  selectedZone = selectedZone === zoneId ? null : zoneId;
  renderSelection();
}

buttons.forEach((button) => {
  button.addEventListener('click', () => toggleZone(button.dataset.zone));
});

buildMap();
renderSelection();
