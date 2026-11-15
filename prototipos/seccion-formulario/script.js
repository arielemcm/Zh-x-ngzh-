// Imágenes vinculadas desde la carpeta C:\Users\HP\Desktop\semillas.
const crops = [
  { name:'Papa (Huaycha Imilla)', image:'../../assets/semillas/semilla%20de%20papa%20huaycha%20imilla.jfif', alt:'Papa Huaycha Imilla' },
  { name:'Haba', image:'../../assets/semillas/semilla%20de%20haba.jfif', alt:'Habas' },
  { name:'Cebada', image:'../../assets/semillas/semilla%20de%20cebada.jfif', alt:'Cebada' },
  { name:'Avena', image:'../../assets/semillas/semilla%20de%20avena.jfif', alt:'Avena' },
  { name:'Oca (Ulluku / Hullikus)', image:'../../assets/semillas/semilla%20de%20oca%20hulluku.jpg', alt:'Oca, ulluku o hullikus' },
  { name:'Papalisa', image:'../../assets/semillas/semilla%20de%20papalisa.jpg', alt:'Papalisa' },
  { name:'Cebolla', image:'../../assets/semillas/semilla%20de%20cebolla.jpg', alt:'Cebollas' }
];

const seedSelect = document.querySelector('#seed-select');
const reveal = document.querySelector('#image-reveal');
const cropImage = document.querySelector('#crop-image');
const cropCaption = document.querySelector('#crop-caption');
const previousSeed = document.querySelector('#previous-seed');
const suggestions = document.querySelector('#suggestions');

seedSelect.addEventListener('change', () => {
  const crop = crops.find(({ name }) => name === seedSelect.value);
  if (!crop) return;
  cropImage.classList.remove('slide-up');
  cropImage.src = crop.image;
  cropImage.alt = crop.alt;
  cropImage.hidden = false;
  cropCaption.textContent = crop.name;
  reveal.classList.add('is-open');
  void cropImage.offsetWidth; // reinicia la animación al cambiar de semilla
  cropImage.classList.add('slide-up');
});

const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function showSuggestions() {
  const search = normalize(previousSeed.value.trim());
  const matches = crops.filter(({ name }) => normalize(name).includes(search));
  suggestions.classList.remove('is-closing');
  suggestions.innerHTML = '';
  if (!matches.length) { closeSuggestions(); return; }
  matches.forEach(({ name }) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'option';
    button.textContent = name;
    button.addEventListener('click', () => {
      previousSeed.value = name;
      closeSuggestions();
      previousSeed.focus();
    });
    item.append(button);
    suggestions.append(item);
  });
  previousSeed.setAttribute('aria-expanded', 'true');
}

function closeSuggestions() {
  if (!suggestions.children.length) {
    previousSeed.setAttribute('aria-expanded', 'false');
    return;
  }
  suggestions.classList.add('is-closing');
  previousSeed.setAttribute('aria-expanded', 'false');
  window.setTimeout(() => {
    if (suggestions.classList.contains('is-closing')) {
      suggestions.innerHTML = '';
      suggestions.classList.remove('is-closing');
    }
  }, 220);
}

previousSeed.addEventListener('input', showSuggestions);
previousSeed.addEventListener('focus', showSuggestions);
document.addEventListener('click', event => {
  if (!event.target.closest('#autocomplete')) {
    closeSuggestions();
  }
});
