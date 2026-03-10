// ---- Deferred AudioContext (created on first user gesture) ----
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let buffersReadyPromise = null;

function getContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
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
}

// ---- Ensure context is running (auto-resume if suspended/interrupted) ----
function ensureRunning() {
  const ctx = getContext();
  if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
    ctx.resume();
  }
  return ctx;
}

// ---- Play a decoded buffer (creates fresh source each time) ----
async function playBuffer(name) {
  if (buffersReadyPromise) await buffersReadyPromise;

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
async function playBufferAndWait(name) {
  if (buffersReadyPromise) await buffersReadyPromise;

  const ctx = ensureRunning();
  const buffer = buffers[name];
  if (!buffer) return;

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
export function unlockAudio() {
  const ctx = getContext();

  // Always try to resume — iOS can re-suspend anytime
  if (ctx.state !== 'running') {
    ctx.resume();
  }

  // Play a silent buffer to fully unlock iOS audio pipeline (only first time)
  // Must happen BEFORE loading buffers — Safari can fail decodeAudioData
  // if the context hasn't been "activated" by playing something first
  if (!unlockAudio._silentPlayed) {
    unlockAudio._silentPlayed = true;
    const silentBuffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(ctx.destination);
    source.start();
  }

  // Load buffers only once (tracked by promise so playBuffer can await)
  if (!buffersReadyPromise) {
    buffersReadyPromise = loadAllBuffers();
  }
}

// ---- Resume audio when returning to the tab/app ----
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && audioCtx) {
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
      audioCtx.resume();
    }
  }
});
