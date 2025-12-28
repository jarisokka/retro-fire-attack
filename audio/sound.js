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
  move: () => beep(400, 0.03),
  hit: () => beep(800, 0.06),
  miss: () => beep(200, 0.15),
  gameOver: () => beep(120, 0.4),
  bonus: () => beep(1000, 0.12)
};

// Required for browser autoplay rules
export function unlockAudio() {
  if (audioCtx.state !== "running") {
    audioCtx.resume();
  }
}
