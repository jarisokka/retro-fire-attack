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
    console.log('Playing hit sound');
    const audio = new Audio("/audio/hit.m4a");
    audio.volume = 0.5;
    // Start from middle where actual sound is (avoiding silence at beginning)
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = 0.45;
      audio.play().catch(err => console.error('Hit sound error:', err));
    });
  },
  burn: () => {
    console.log('Playing burn sound');
    const audio = new Audio("/audio/burn.m4a");
    audio.volume = 0.5;
    audio.play().catch(err => console.error('Burn sound error:', err));
  },
  flyingTorch: () => {
    console.log('Playing flyingTorch sound');
    const audio = new Audio("/audio/flying-torch.m4a");
    audio.volume = 0.5;
    // Start from middle where actual sound is (avoiding silence at beginning)
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = 0.45;
      audio.play().catch(err => console.error('FlyingTorch sound error:', err));
    });
  },
  runner: () => {
    console.log('Playing runner sound');
    const audio = new Audio("/audio/runner.m4a");
    audio.volume = 0.5;
    // Start from middle where actual sound is (avoiding silence at beginning)
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = 0.45;
      audio.play().catch(err => console.error('Runner sound error:', err));
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
