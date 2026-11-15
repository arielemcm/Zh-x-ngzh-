const frogButton = document.querySelector('#frogButton');
const frogSprite = document.querySelector('#frogSprite');
const frogStage = document.querySelector('.frog-stage');
const bubble = document.querySelector('#speechBubble');
const typedMessage = document.querySelector('#typedMessage');
const closeBubble = document.querySelector('#closeBubble');
const assistant = document.querySelector('.frog-assistant');

const message = '¡Hola! Soy tu ayudante. Haz clic en mí cuando quieras una guía rápida.';
const restingSprite = 'assets/sapo3-transparent.png';
const talkingSprite = 'assets/sapo4-transparent.png';
const jumpSprites = Array.from({ length: 8 }, (_, index) => `assets/salto${index + 1}.png`);
const jumpLift = [0, -18, -42, -68, -74, -52, -24, 0];
let timer;
let talkingTimer;
let jumpFrameTimer;
let isOpen = false;
let isJumping = false;
let audioContext;

[restingSprite, talkingSprite, ...jumpSprites].forEach((src) => {
  const image = new Image();
  image.src = src;
});

function unlockAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioContext ??= new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume();
}

function playFrogCroak() {
  if (!audioContext) return;
  const context = audioContext;
  const now = context.currentTime;
  const gain = context.createGain();
  const oscillator = context.createOscillator();

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(176, now);
  oscillator.frequency.exponentialRampToValueAtTime(105, now + 0.11);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.16);
}

function stopTalking() {
  window.clearInterval(talkingTimer);
  frogSprite.src = restingSprite;
}

function stopJump() {
  window.clearTimeout(jumpFrameTimer);
  isJumping = false;
  frogStage.style.setProperty('--jump-lift', '0px');
  frogSprite.src = restingSprite;
}

function playJump(onComplete) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stopJump();
    onComplete?.();
    return;
  }
  if (isJumping) stopJump();
  isJumping = true;
  let frame = 0;

  function showNextFrame() {
    frogSprite.src = jumpSprites[frame];
    frogStage.style.setProperty('--jump-lift', `${jumpLift[frame]}px`);
    frame += 1;
    if (frame < jumpSprites.length) {
      jumpFrameTimer = window.setTimeout(showNextFrame, 135);
    } else {
      jumpFrameTimer = window.setTimeout(() => {
        stopJump();
        onComplete?.();
      }, 180);
    }
  }

  showNextFrame();
}

function typeMessage() {
  window.clearTimeout(timer);
  typedMessage.textContent = '';
  let i = 0;
  talkingTimer = window.setInterval(() => {
    frogSprite.src = frogSprite.src.includes('sapo3-transparent.png') ? talkingSprite : restingSprite;
  }, 170);

  function write() {
    typedMessage.textContent = message.slice(0, i++);
    if (i <= message.length) timer = window.setTimeout(write, 30);
    else timer = window.setTimeout(() => {
      stopTalking();
      playFrogCroak();
    }, 420);
  }
  write();
}

function openAssistant() {
  unlockAudio();
  stopJump();
  isOpen = true;
  assistant.classList.add('is-open');
  bubble.classList.add('is-visible');
  bubble.setAttribute('aria-hidden', 'false');
  frogButton.setAttribute('aria-expanded', 'true');
  playJump(typeMessage);
}

function closeAssistant() {
  isOpen = false;
  window.clearTimeout(timer);
  stopTalking();
  assistant.classList.remove('is-open');
  bubble.classList.remove('is-visible');
  bubble.setAttribute('aria-hidden', 'true');
  frogButton.setAttribute('aria-expanded', 'false');
}

frogButton.addEventListener('click', () => {
  if (isOpen) {
    closeAssistant();
    playJump();
  } else {
    openAssistant();
  }
});
closeBubble.addEventListener('click', closeAssistant);
