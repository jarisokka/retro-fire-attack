// ---- Deferred AudioContext (created on first user gesture) ----
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let buffersLoaded = false;

function getContext() {
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  return audioCtx;
}

// ---- Web Audio API buffer loading ----
const buffers = {};
const SOUND_FILES = {
  hit:         'audio/hit.mp3',
  burn:        'audio/burn.mp3',
  flyingTorch: 'audio/flying-torch.mp3',
  runner:      'audio/runner.mp3',
  bonus:       'audio/bonus.mp3',
};

const VOLUMES = {
  hit: 0.5,
  burn: 0.5,
  flyingTorch: 0.5,
  runner: 0.5,
  bonus: 0.5,
};

async function loadBuffer(name, url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    buffers[name] = await getContext().decodeAudioData(arrayBuffer);
  } catch (e) {
    // Silently fail — sound just won't play
  }
}

async function loadAllBuffers() {
  await Promise.all(
    Object.entries(SOUND_FILES).map(([name, url]) => loadBuffer(name, url))
  );
  buffersLoaded = true;
}

// ---- Ensure context is running (auto-resume if suspended) ----
function ensureRunning() {
  const ctx = getContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

// ---- Play a decoded buffer (creates fresh source each time) ----
function playBuffer(name) {
  const ctx = ensureRunning();
  const buffer = buffers[name];
  if (!buffer) return;

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = VOLUMES[name] || 0.5;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

// ---- Play buffer and wait for it to finish ----
function playBufferAndWait(name) {
  const ctx = ensureRunning();
  const buffer = buffers[name];
  if (!buffer) return Promise.resolve();

  return new Promise(resolve => {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = VOLUMES[name] || 0.5;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.onended = () => resolve();
    source.start();
  });
}

// ---- Web Audio beep ----
function beep(freq, duration = 0.05, volume = 0.15) {
  const ctx = ensureRunning();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// ---- Sound Events ----
export const Sound = {
  hit:         () => playBuffer('hit'),
  burn:        () => playBuffer('burn'),
  flyingTorch: () => playBuffer('flyingTorch'),
  runner:      () => playBuffer('runner'),
  bonus:       () => beep(1000, 0.12),
  bonusMusic:  () => playBufferAndWait('bonus'),
};

// ---- Audio unlock (call from user gesture: touchstart, click, keydown) ----
let audioUnlocked = false;

export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  const ctx = getContext();

  // Resume suspended context (required on iOS/mobile), then load buffers
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => loadAllBuffers());
  } else {
    loadAllBuffers();
  }

  // Play a silent buffer to fully unlock iOS audio pipeline
  const silentBuffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = silentBuffer;
  source.connect(ctx.destination);
  source.start();
}
