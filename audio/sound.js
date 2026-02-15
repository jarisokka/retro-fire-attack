const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

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

// ---- Sound Events ----
export const Sound = {
  hit: () => {
    const audio = new Audio("/audio/hit.m4a");
    audio.volume = 0.5;
    // Start from middle where actual sound is (avoiding silence at beginning)
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = 0.45;
      audio.play().catch(() => {});
    });
  },
  burn: () => {
    const audio = new Audio("/audio/burn.m4a");
    audio.volume = 0.5;
    audio.play().catch(() => {});
  },
  flyingTorch: () => {
    const audio = new Audio("/audio/flying-torch.m4a");
    audio.volume = 0.5;
    // Start from middle where actual sound is (avoiding silence at beginning)
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = 0.45;
      audio.play().catch(() => {});
    });
  },
  runner: () => {
    const audio = new Audio("/audio/runner.m4a");
    audio.volume = 0.5;
    // Start from middle where actual sound is (avoiding silence at beginning)
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = 0.45;
      audio.play().catch(() => {});
    });
  },
  bonus: () => beep(1000, 0.12)
};

// Required for browser autoplay rules
export function unlockAudio() {
  if (audioCtx.state !== "running") {
    audioCtx.resume();
  }
}
