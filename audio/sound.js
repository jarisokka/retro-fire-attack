const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

// ---- Pre-create audio objects ----
// iOS Safari requires HTMLAudio elements to be played within a user gesture.
// Pre-creating them and doing a silent play inside unlockAudio() registers
// the OS-level authorization so subsequent .play() calls work freely.
function createAudio(src, volume) {
  const audio = new Audio(src);
  audio.volume = volume;
  audio.preload = "auto";
  return audio;
}

const audioFiles = {
  hit:         createAudio("audio/hit.m4a", 0.5),
  burn:        createAudio("audio/burn.m4a", 0.5),
  flyingTorch: createAudio("audio/flying-torch.m4a", 0.5),
  runner:      createAudio("audio/runner.m4a", 0.5),
};

// ---- Web Audio beep ----
function beep(freq, duration = 0.05, volume = 0.15) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// ---- Playback helper ----
function playWithOffset(audio, offset = 0) {
  audio.currentTime = offset;
  audio.play().catch(() => {});
}

// ---- Sound Events ----
export const Sound = {
  // Start from 0.45 s where the actual sound begins (skip leading silence)
  hit:         () => playWithOffset(audioFiles.hit, 0.45),
  burn:        () => playWithOffset(audioFiles.burn, 0),
  flyingTorch: () => playWithOffset(audioFiles.flyingTorch, 0.45),
  runner:      () => playWithOffset(audioFiles.runner, 0.45),
  bonus:       () => beep(1000, 0.12),
};

// ---- iOS / autoplay unlock ----
// Must be called from a real user-gesture handler (touchstart, click, keydown).
// Silently plays then immediately pauses every HTMLAudio element so iOS
// registers each one as "user-activated", enabling later .play() calls.
let audioUnlocked = false;

export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  // Resume Web Audio API context (suspended by iOS on creation)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  // Touch-authorize every HTMLAudio element
  Object.values(audioFiles).forEach(audio => {
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
    }).catch(() => {});
  });
}
