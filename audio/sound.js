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
  hit:         createAudio("audio/hit.mp3", 0.5),
  burn:        createAudio("audio/burn.mp3", 0.5),
  flyingTorch: createAudio("audio/flying-torch.mp3", 0.5),
  runner:      createAudio("audio/runner.mp3", 0.5),
  bonus:       createAudio("audio/bonus.mp3", 0.5),
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

// ---- Promise-based playback (waits for sound to finish) ----
function playAndWait(audio, offset = 0) {
  return new Promise(resolve => {
    audio.currentTime = offset;
    audio.onended = () => resolve();
    audio.play().catch(() => resolve());
  });
}

// ---- Sound Events ----
export const Sound = {
  hit:         () => playWithOffset(audioFiles.hit),
  burn:        () => playWithOffset(audioFiles.burn),
  flyingTorch: () => playWithOffset(audioFiles.flyingTorch),
  runner:      () => playWithOffset(audioFiles.runner),
  bonus:       () => beep(1000, 0.12),
  bonusMusic:  () => playAndWait(audioFiles.bonus),
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
