(() => {
  const assistant = document.querySelector('[data-frog-assistant]');
  if (!assistant) return;

  const button = assistant.querySelector('.frog-assistant__button');
  const sprite = assistant.querySelector('.frog-assistant__image');
  const bubble = assistant.querySelector('.frog-assistant__bubble');
  const typedMessage = assistant.querySelector('.frog-assistant__message');
  const accessibleMessage = assistant.querySelector('.frog-assistant__announcement');
  const closeButton = assistant.querySelector('.frog-assistant__close');
  const cursor = assistant.querySelector('.frog-assistant__cursor');
  const initialMessage = assistant.dataset.message || 'Estoy aqu\u00ed para ayudarte.';
  const actionPanel = assistant.querySelector('.frog-assistant__actions');
  const actionButtons = assistant.querySelectorAll('[data-frog-action]');
  const sequencePanel = assistant.querySelector('.frog-assistant__sequence');
  const nextButton = assistant.querySelector('[data-frog-next]');
  const progress = assistant.querySelector('.frog-assistant__progress');
  const stepMessages = Array.from(assistant.querySelectorAll('[data-frog-step]'))
    .map((step) => step.textContent.trim());
  const restingSprite = assistant.dataset.restingSprite;
  const talkingSprite = assistant.dataset.talkingSprite;
  const typeSpeed = Number(assistant.dataset.typeSpeed) || 28;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let typeTimer;
  let talkingTimer;
  let bounceTimer;
  let isOpen = false;
  let currentStep = 0;

  if (talkingSprite) {
    const image = new Image();
    image.src = talkingSprite;
  }

  function stopTalking() {
    window.clearInterval(talkingTimer);
    talkingTimer = undefined;
    sprite.src = restingSprite;
  }

  function stopAnimations() {
    window.clearTimeout(typeTimer);
    window.clearTimeout(bounceTimer);
    assistant.classList.remove('is-bouncing');
    stopTalking();
  }

  function bounce() {
    if (reduceMotion.matches) return;
    assistant.classList.remove('is-bouncing');
    void assistant.offsetWidth;
    assistant.classList.add('is-bouncing');
    bounceTimer = window.setTimeout(() => {
      assistant.classList.remove('is-bouncing');
    }, 650);
  }

  function typeMessage(message) {
    window.clearTimeout(typeTimer);
    stopTalking();
    typedMessage.textContent = '';
    accessibleMessage.textContent = message;

    if (reduceMotion.matches) {
      typedMessage.textContent = message;
      cursor.hidden = true;
      return;
    }

    cursor.hidden = false;
    let index = 0;
    talkingTimer = window.setInterval(() => {
      sprite.src = sprite.src.includes('sapo3-transparent.png')
        ? talkingSprite
        : restingSprite;
    }, 180);

    function write() {
      if (!isOpen) return;
      typedMessage.textContent = message.slice(0, index + 1);
      index += 1;
      if (index < message.length) {
        typeTimer = window.setTimeout(write, typeSpeed);
      } else {
        stopTalking();
        cursor.hidden = true;
      }
    }

    write();
  }

  function openAssistant() {
    stopAnimations();
    isOpen = true;
    assistant.classList.add('is-open');
    bubble.classList.add('is-visible');
    bubble.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', 'Cerrar mensaje del ayudante');
    bounce();
    if (actionPanel) actionPanel.hidden = false;
    if (stepMessages.length) {
      currentStep = 0;
      if (sequencePanel) sequencePanel.hidden = false;
      if (nextButton) nextButton.hidden = false;
      if (progress) progress.textContent = `1 de ${stepMessages.length}`;
      typeMessage(stepMessages[0]);
    } else {
      typeMessage(initialMessage);
    }
  }

  function closeAssistant({ returnFocus = false } = {}) {
    isOpen = false;
    stopAnimations();
    assistant.classList.remove('is-open');
    bubble.classList.remove('is-visible');
    bubble.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Abrir mensaje del ayudante');
    typedMessage.textContent = '';
    accessibleMessage.textContent = '';
    if (returnFocus) button.focus();
  }

  button.addEventListener('click', () => {
    if (isOpen) closeAssistant();
    else openAssistant();
  });

  closeButton.addEventListener('click', () => {
    closeAssistant({ returnFocus: true });
  });

  actionButtons.forEach((actionButton) => {
    actionButton.addEventListener('click', () => {
      const action = actionButton.dataset.frogAction;
      const nextMessage = action === 'camera'
        ? assistant.dataset.cameraMessage
        : assistant.dataset.uploadMessage;

      if (actionPanel) actionPanel.hidden = true;
      typeMessage(nextMessage || initialMessage);

      const target = action === 'camera'
        ? document.querySelector('#start-camera')
        : document.querySelector('#upload-photo');
      target?.click();
    });
  });

  nextButton?.addEventListener('click', () => {
    if (currentStep >= stepMessages.length - 1) return;
    currentStep += 1;
    typeMessage(stepMessages[currentStep]);
    if (progress) progress.textContent = `${currentStep + 1} de ${stepMessages.length}`;
    if (currentStep === stepMessages.length - 1) nextButton.hidden = true;
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) {
      closeAssistant({ returnFocus: true });
    }
  });
})();
