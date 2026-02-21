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

  bonus: {
    200: false,
    500: false
  },


  lanes: {
    TL: { type: "torch", stage: 0, timer: 0 },
    TR: { type: "torch", stage: 0, timer: 0 },
    BL: { type: "runner", stage: 0, timer: 0, falling: false },
    BR: { type: "runner", stage: 0, timer: 0, falling: false }
  }
};

// G&W Global Clock — module-level, not per-lane
let tickCounter = 0;
let currentLaneCheckIndex = 0;  // round-robin for spawning
let beatType = 'runner';        // alternates 'runner' | 'torch' each beat
const LANE_ORDER = ['TL', 'TR', 'BL', 'BR'];
const FALL_DURATION = 30; // frames for fall animation

// 100-point speed tiers (frames to wait between beats at 60 fps).
// Mode B starts 2 tiers higher than Mode A, matching the original.
function getFramesPerBeat(score, mode) {
  const baseSpeed = (mode === "A") ? 0 : 2;
  const tier = Math.floor(score / 100) + baseSpeed;
  const speedTable = [
    48, // 0–99   pts  (slowest)
    43, // 100–199
    38, // 200–299
    34, // 300–399
    29, // 400–499
    24, // 500–599
    22, // 600–699
    19, // 700–799
    17, // 800–899
    14  // 900+         (fastest)
  ];
  return speedTable[Math.min(tier, speedTable.length - 1)];
}

export function startGame(mode) {
  GameState.gameMode = mode;
  GameState.scene = "PLAYING";
  GameState.score = 0;
  GameState.misses = 0;
  GameState.gameOver = false;
  GameState.totalHits = 0;

  // --- Authentic lane rules ---
  const allLanes = ['TL', 'TR', 'BL', 'BR'];
  if (mode === 'A') {
    // Triple-Lane Rule: exactly 3 of 4 lanes active; pick one random lane to disable.
    GameState.disabledLane = allLanes[Math.floor(Math.random() * 4)];
    GameState.activeLanes = allLanes.filter(l => l !== GameState.disabledLane);
  } else {
    // Game B: all 4 lanes active 100% of the time.
    GameState.disabledLane = null;
    GameState.activeLanes = [...allLanes];
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

  GameState.bonus[200] = false;
  GameState.bonus[500] = false;

  // Reset miss animation flags
  GameState.missAnimationTriggered = false;
  GameState.torchMissAnimationTriggered = false;
  GameState.lastMissPosition = null;

  // Reset G&W global clock
  tickCounter = 0;
  currentLaneCheckIndex = 0;
  beatType = 'runner';
  GameState.spawnCooldown = 1;
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

  // --- G&W Global Heartbeat ---
  tickCounter++;
  const framesPerBeat = getFramesPerBeat(GameState.score, GameState.gameMode);

  if (tickCounter < framesPerBeat) return;
  tickCounter = 0;

  // Chance Time countdown — one beat at a time.
  if (GameState.chanceTime) {
    GameState.chanceTimeTicks--;
    if (GameState.chanceTimeTicks <= 0) {
      GameState.chanceTime = false;
    }
  }

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
    for (let i = 0; i < LANE_ORDER.length; i++) {
      const spawnLaneKey = LANE_ORDER[currentLaneCheckIndex];
      const spawnLane = GameState.lanes[spawnLaneKey];
      currentLaneCheckIndex = (currentLaneCheckIndex + 1) % LANE_ORDER.length;

      if (GameState.activeLanes.includes(spawnLaneKey) && spawnLane.stage === 0 && !spawnLane.falling) {
        spawnLane.stage = 1;
        // Cooldown shrinks as score rises: 2 beats at 0pts → 1 beat at 200+pts
        GameState.spawnCooldown = Math.max(1, 2 - Math.floor(GameState.score / 200));
        break;
      }
    }
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
  [200, 500].forEach((threshold) => {
    if (
      GameState.score >= threshold &&
      !GameState.bonus[threshold]
    ) {
      GameState.bonus[threshold] = true;

      if (GameState.misses > 0) {
        // Clear one miss as consolation prize.
        GameState.misses--;
      } else {
        // Perfect play — trigger Chance Time (100–120 beats, matching the
        // original SM510 cycle counter range).
        GameState.chanceTime = true;
        GameState.chanceTimeTicks = Math.floor(Math.random() * 21) + 100;
      }
    }
  });
}


// --------------------
// MISS / GAME OVER
// --------------------
function registerMiss(laneKey) {
  GameState.misses++;

  // Mode A — Lane Shift: pick a NEW random lane to disable (must be different
  // from the current one so the pattern always changes on every miss).
  if (GameState.gameMode === 'A') {
    const allLanes = ['TL', 'TR', 'BL', 'BR'];
    let newDisabled;
    do {
      newDisabled = allLanes[Math.floor(Math.random() * 4)];
    } while (newDisabled === GameState.disabledLane);
    GameState.disabledLane = newDisabled;
    GameState.activeLanes = allLanes.filter(l => l !== newDisabled);
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
    setTimeout(() => {
      GameState.scene = 'GAMEOVER';
    }, 5000);
  }
}

