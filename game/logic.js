// game/logic.js

export const GameState = {
  scene: "TITLE", // TITLE | PLAYING | GAMEOVER
  gameMode: "A", // "A" or "B"
  currentPosition: "TL",
  score: 0,
  misses: 0,
  gameOver: false,
  totalHits: 0,  // Track total successful hits
  activeLanes: ['TL', 'TR', 'BL', 'BR'],
  disabledLane: null,   // Mode A: the one lane currently inactive
  missAnimationTriggered: false,  // Flag to trigger miss animation
  torchMissAnimationTriggered: false,  // Flag to trigger torch miss animation
  lastMissPosition: null,  // Track where miss occurred
  spawnCooldown: 4,  // Beats to wait before next spawn attempt

  // Chance Time
  chanceTime: false,        // Are we currently in Chance Time?
  chanceTimeTicks: 0,       // Remaining beats of Chance Time

  nextBonusThreshold: 200,


  lanes: {
    TL: { type: "torch", stage: 0, timer: 0 },
    TR: { type: "torch", stage: 0, timer: 0 },
    BL: { type: "runner", stage: 0, timer: 0, falling: false },
    BR: { type: "runner", stage: 0, timer: 0, falling: false }
  }
};

// G&W Global Clock — module-level, not per-lane
let tickCounter = 0;
const RUNNER_LANE_ORDER = ['BL', 'BR'];
const TORCH_LANE_ORDER  = ['TR', 'TL'];
let nextRunnerIndex  = 0;
let nextTorchIndex   = 0;
let nextSpawnIsRunner = true;   // alternates each successful spawn, decoupled from beat clock
let beatType = 'runner';        // alternates 'runner' | 'torch' each beat
let gameOverTimer = null;       // cancelable timeout for GAMEOVER scene transition
let patternIndex = 0;           // Game A: sequential disabled-lane cycle index
const LANE_ORDER = ['TL', 'TR', 'BL', 'BR'];
const FALL_DURATION = 30; // frames for fall animation

// 100-point speed tiers (frames to wait between beats at 60 fps).
// Mode B starts 2 tiers higher than Mode A, matching the original.
function getFramesPerBeat(score, mode) {
  const baseSpeed = (mode === "A") ? 0 : 2;
  const tier = Math.floor(score / 100) + baseSpeed;
  const speedTable = [
    48, 43, 38, 34, 29, 24, 22, 19, 17, 14
  ];
  const base = speedTable[Math.min(tier, speedTable.length - 1)];
  const ramp = Math.floor((score % 100) / 10); // 0–9, resets at each 100-pt boundary
  return Math.max(10, base - ramp); // floor at 10 frames to prevent impossibly fast speeds
}

export function startGame(mode) {
  if (gameOverTimer) {
    clearTimeout(gameOverTimer);
    gameOverTimer = null;
  }
  GameState.gameMode = mode;
  GameState.scene = "PLAYING";
  GameState.score = 0;
  GameState.misses = 0;
  GameState.gameOver = false;
  GameState.totalHits = 0;

  // --- Authentic lane rules ---
  if (mode === 'A') {
    patternIndex = Math.floor(Math.random() * 4);
    GameState.disabledLane = LANE_ORDER[patternIndex];
    GameState.activeLanes = LANE_ORDER.filter(l => l !== GameState.disabledLane);
  } else {
    // Game B: all 4 lanes active 100% of the time.
    GameState.disabledLane = null;
    GameState.activeLanes = [...LANE_ORDER];
  }

  // Reset Chance Time
  GameState.chanceTime = false;
  GameState.chanceTimeTicks = 0;

  Object.keys(GameState.lanes).forEach(key => {
    const lane = GameState.lanes[key];
    lane.stage = 0;
    lane.timer = 0;
    if (lane.type === "runner") {
      lane.falling = false;
    }
  });

  GameState.nextBonusThreshold = 200;

  // Reset miss animation flags
  GameState.missAnimationTriggered = false;
  GameState.torchMissAnimationTriggered = false;
  GameState.lastMissPosition = null;

  // Reset G&W global clock
  tickCounter = 0;
  nextRunnerIndex   = 0;
  nextTorchIndex    = 0;
  nextSpawnIsRunner = true;
  beatType = 'runner';
  GameState.spawnCooldown = 1;
  // patternIndex already set above during lane init for mode A
}

export function returnToTitle() {
  GameState.scene = "TITLE";
  // Reset miss animation flags
  GameState.missAnimationTriggered = false;
  GameState.torchMissAnimationTriggered = false;
  GameState.lastMissPosition = null;
}

// --------------------
// UPDATE
// --------------------
export function updateGame() {
  if (GameState.scene !== "PLAYING" || GameState.gameOver) return;

  // Fall animations run every frame, independent of the beat clock.
  Object.keys(GameState.lanes).forEach((key) => {
    const lane = GameState.lanes[key];
    if (lane.type === "runner" && lane.falling) {
      lane.timer++;
      if (lane.timer > FALL_DURATION) {
        lane.stage = 0;
        lane.timer = 0;
        lane.falling = false;
      }
    }
  });

  // Chance Time countdown — runs every frame for accurate duration.
  if (GameState.chanceTime) {
    GameState.chanceTimeTicks--;
    if (GameState.chanceTimeTicks <= 0) {
      GameState.chanceTime = false;
    }
  }

  // --- G&W Global Heartbeat ---
  tickCounter++;
  const framesPerBeat = getFramesPerBeat(GameState.score, GameState.gameMode);

  if (tickCounter < framesPerBeat) return;
  tickCounter = 0;

  // ALTERNATING BEAT RULE:
  // Even beats  → all runners (BL, BR) advance one step together.
  // Odd beats   → all torches (TL, TR) advance one step together.
  // This guarantees two runners can never land on the same hittable stage
  // at the same time (they move in lockstep, spawn offset keeps them apart),
  // and torches/runners are always on opposite beats so they never collide.

  const typeThisBeat = beatType;
  beatType = (beatType === 'runner') ? 'torch' : 'runner'; // flip for next beat

  for (const laneKey of LANE_ORDER) {
    const lane = GameState.lanes[laneKey];
    if (lane.type !== typeThisBeat) continue;
    if (lane.stage === 0 || lane.falling) continue;

    lane.stage++;
    const maxStage = (lane.type === 'torch') ? 5 : 6;
    if (lane.stage > maxStage) {
      registerMiss(laneKey);
      lane.stage = 0;
    }
  }

  // Priority 2 — spawn cooldown ticks every beat, regardless of enemy movement.
  GameState.spawnCooldown--;

  if (GameState.spawnCooldown <= 0) {
    // Alternate runner/torch spawns independently of beat clock.
    // Scan up to all lanes of the chosen type so occupied lanes don't cause
    // a permanent deadlock (preserves deterministic ordering within each type).
    const laneOrder = nextSpawnIsRunner ? RUNNER_LANE_ORDER : TORCH_LANE_ORDER;
    const startIdx  = nextSpawnIsRunner ? nextRunnerIndex   : nextTorchIndex;

    for (let attempt = 0; attempt < laneOrder.length; attempt++) {
      const tryIdx       = (startIdx + attempt) % laneOrder.length;
      const spawnLaneKey = laneOrder[tryIdx];
      const spawnLane    = GameState.lanes[spawnLaneKey];

      if (
        GameState.activeLanes.includes(spawnLaneKey) &&
        spawnLane.stage === 0 &&
        !spawnLane.falling
      ) {
        spawnLane.stage = 1;
        const nextIdx = (tryIdx + 1) % laneOrder.length;
        if (nextSpawnIsRunner) nextRunnerIndex = nextIdx;
        else                   nextTorchIndex  = nextIdx;
        nextSpawnIsRunner = !nextSpawnIsRunner;
        // Cooldown shrinks as score rises: 2 beats at 0pts → 1 beat at 200+pts
        GameState.spawnCooldown = Math.max(1, 2 - Math.floor(GameState.score / 200));
        break;
      }
    }
    // If all lanes of this type are occupied/disabled, keep cooldown at 0
    // and retry next beat (no flip — same type retried to stay balanced).
  }
}

// --------------------
// INPUT ACTIONS
// --------------------
export function setGameMode(mode) {
  if (mode === "A" || mode === "B") {
    GameState.gameMode = mode;
  }
}

export function movePlayer(pos) {
  GameState.currentPosition = pos;
}

export function attack() {
  const pos = GameState.currentPosition;
  const lane = GameState.lanes[pos];

  if (!lane) return false;

  const hitPoints = GameState.chanceTime ? 5 : 2;

  // Runner: Allow hitting at stage 5 or 6 (climbing stages)
  if (lane.type === "runner" && (lane.stage === 5 || lane.stage === 6)) {
    lane.falling = true;
    lane.stage = 7; // fall stage
    lane.timer = 0;
    GameState.score += hitPoints;
    GameState.totalHits++;
    checkBonus();
    return true;
  }

  // Torch: Only allow hitting at stage 5
  if (lane.type === "torch" && lane.stage === 5) {
    lane.stage = 0;
    GameState.score += hitPoints;
    GameState.totalHits++;
    checkBonus();
    return true;
  }

  return false;
}

function checkBonus() {
  if (GameState.score >= GameState.nextBonusThreshold) {
    // Advance threshold: 200 → 500 → 1500 → 2500 → 3500 → ...
    if (GameState.nextBonusThreshold === 200) {
      GameState.nextBonusThreshold = 500;
    } else {
      GameState.nextBonusThreshold += 1000;
    }

    if (GameState.misses > 0) {
      // Clear one miss as consolation prize.
      GameState.misses--;
    } else {
      // Perfect play — trigger Chance Time (30–50 s at 60fps = 1800–3000 frames).
      GameState.chanceTime = true;
      GameState.chanceTimeTicks = Math.floor(Math.random() * 1200) + 1800;
    }
  }
}


// --------------------
// MISS / GAME OVER
// --------------------
function registerMiss(laneKey) {
  GameState.misses++;

  // Mode A — Lane Shift: advance to the next lane in the sequential cycle.
  if (GameState.gameMode === 'A') {
    patternIndex = (patternIndex + 1) % 4;
    const newDisabled = LANE_ORDER[patternIndex];
    GameState.disabledLane = newDisabled;
    GameState.activeLanes = LANE_ORDER.filter(l => l !== newDisabled);
    // If there's an enemy in the newly disabled lane, reset it so the
    // player isn't penalised for a lane that just went inactive.
    const disabledLaneObj = GameState.lanes[newDisabled];
    if (disabledLaneObj && disabledLaneObj.stage > 0) {
      disabledLaneObj.stage = 0;
      disabledLaneObj.timer = 0;
      if (disabledLaneObj.falling !== undefined) disabledLaneObj.falling = false;
    }
  }

  // Trigger runner miss animation for BL and BR lanes
  if (laneKey === 'BL' || laneKey === 'BR') {
    GameState.lastMissPosition = laneKey;
    GameState.missAnimationTriggered = true;
  }

  // Trigger torch miss animation for TL and TR lanes
  if (laneKey === 'TL' || laneKey === 'TR') {
    GameState.lastMissPosition = laneKey;
    GameState.torchMissAnimationTriggered = true;
  }

  if (GameState.misses >= 3) {
    GameState.gameOver = true;
    // Transition to GAMEOVER scene after a delay to let animation finish
    // All miss animations are 5 seconds
    gameOverTimer = setTimeout(() => {
      GameState.scene = 'GAMEOVER';
      gameOverTimer = null;
    }, 5000);
  }
}

