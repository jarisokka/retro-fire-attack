const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

// ---- Audio pool ----
// Creates N HTMLAudio instances for one sound file and round-robins through them.
// This prevents rapid events (e.g. runner moving through stages) from cutting off
// the previous play of the same sound.
function createAudioPool(src, volume, poolSize = 3) {
  const instances = Array.from({ length: poolSize }, () => {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.preload = "auto";
    return audio;
  });
  let index = 0;
  return {
    play(offset = 0) {
      const audio = instances[index];
      index = (index + 1) % poolSize;
      audio.currentTime = offset;
      audio.play().catch(() => {});
    },
    instances,
  };
}

const audioPools = {
  hit:         createAudioPool("audio/hit.m4a",          0.5, 2),
  burn:        createAudioPool("audio/burn.m4a",         0.5, 2),
  flyingTorch: createAudioPool("audio/flying-torch.m4a", 0.5, 3),
  runner:      createAudioPool("audio/runner.m4a",       0.5, 3),
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

// ---- Sound Events ----
export const Sound = {
  hit:         () => audioPools.hit.play(),
  burn:        () => audioPools.burn.play(),
  flyingTorch: () => audioPools.flyingTorch.play(),
  runner:      () => audioPools.runner.play(),
  bonus:       () => beep(1000, 0.12),
};

// ---- iOS / autoplay unlock ----
// Must be called from a real user-gesture handler (touchstart, click, keydown).
// Silently plays then immediately pauses every HTMLAudio instance so iOS
// registers each one as "user-activated", enabling later .play() calls.
let audioUnlocked = false;

export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  // Resume Web Audio API context (suspended by iOS on creation)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  // Touch-authorize every instance in every pool
  Object.values(audioPools).forEach(pool => {
    pool.instances.forEach(audio => {
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {});
    });
  });
}
