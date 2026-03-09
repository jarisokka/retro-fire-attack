const LANE_ORDER = ['TL', 'TR', 'BL', 'BR'];

// Lanes = movement vectors
const LANE_DEFS = {
  BL: { laneId: 'BL', type: 'RUNNER', patternGroup: 0, maxStepIndex: 6, maxSimultaneous: 3 },
  BR: { laneId: 'BR', type: 'RUNNER', patternGroup: 1, maxStepIndex: 6, maxSimultaneous: 3 },
  TL: { laneId: 'TL', type: 'TORCH',  patternGroup: 2, maxStepIndex: 5, maxSimultaneous: 2 },
  TR: { laneId: 'TR', type: 'TORCH',  patternGroup: 3, maxStepIndex: 5, maxSimultaneous: 2 },
};

// Spawn order: just lane picks, no NONE gaps.
// The gate tables alone control density/pacing.
// Varied lane ordering avoids obvious repetition.

const SPAWN_CYCLE = [
  'BL', 'TR', 'BR', 'TL',
  'BL', 'BR', 'TL', 'TR',
  'BR', 'BL', 'TR', 'TL',
  'BL', 'BL', 'TR', 'TL',    // BL train
  'TL', 'BR', 'BR', 'TR',    // BR train
  'BL', 'TL', 'BR', 'TR',
  'TR', 'BL', 'TL', 'BR',
  'BR', 'BR', 'TL', 'BL',    // BR train
  'TR', 'BL', 'BL', 'TL',    // BL train
  'BR', 'TR', 'TL', 'BL',
];

// Service order: even 4-entry cycle guarantees each lane advances
// every 4 ticks — consistent step timing within each attack.
const SERVICE_CYCLE_A = ['BL', 'TR', 'BR', 'TL'];
const SERVICE_CYCLE_B = ['BL', 'TR', 'BR', 'TL'];

// Single master tick interval, score-banded
const TICK_BASE = [0.42, 0.40, 0.38, 0.36, 0.34, 0.32, 0.30, 0.28, 0.27, 0.26];

// Spawn gate patterns.
// 1 = allow spawn attempt on this tick
// 0 = do not spawn on this tick

const SPAWN_GATE_A_EARLY = [
  1, 0, 1, 0, 0, 1, 0, 1,
  1, 0, 0, 1, 0, 1, 0, 0,
];

const SPAWN_GATE_A_MID = [
  1, 0, 1, 1, 0, 1, 0, 1,
  1, 0, 1, 0, 1, 1, 0, 1,
];

const SPAWN_GATE_A_LATE = [
  1, 1, 0, 1, 1, 0, 1, 1,
  1, 0, 1, 1, 0, 1, 1, 1,
];

const SPAWN_GATE_B = [
  1, 1, 0, 1, 1, 1, 0, 1,
  1, 1, 0, 1, 1, 1, 0, 1,
];

const CHANCE_TIME_DURATION = 40.0;
const FALL_DURATION = 30;
const MISS_RECOVERY_DURATION = 1.8;

let gameOverTimer = null;

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

function currentTickInterval(score, mode) {
  const bandOffset = mode === 'B' ? 2 : 0;
  const band = Math.min(Math.floor(score / 100) + bandOffset, TICK_BASE.length - 1);
  const inBand = score % 100;
  return TICK_BASE[band] - (0.02 * (inBand / 99));
}

// ---------------------------------------------------------------------------
// GameState
// ---------------------------------------------------------------------------

export const GameState = {
  scene: 'TITLE',
  gameMode: 'A',
  currentPosition: 'TL',
  score: 0,
  misses: 0,
  gameOver: false,

  // Main play flow
  state: 'NORMAL', // NORMAL | MISS_RECOVERY | BONUS_PLAYING

  patternIndex: 0,

  activeThreats: [],
  nextThreatId: 1,

  spawnCycleIndex: 0,
  spawnGateCounter: 0,
  serviceCycleIndex: 0,

  nextTickTime: 0,
  lockedTickInterval: 0,
  recoveryUntil: 0,

  chanceTimeUntil: 0,
  chanceTime: false,

  passedBonus200: false,
  passedBonus500: false,

  missAnimationTriggered: false,
  torchMissAnimationTriggered: false,
  lastMissPosition: null,

  laneSpawnCooldowns: {
    TL: 0,
    TR: 0,
    BL: 0,
    BR: 0,
  },

  lanes: {
    TL: { type: 'torch',  stage: 0, activeStages: [], hitEffectTimer: 0, hitEffectStage: 0 },
    TR: { type: 'torch',  stage: 0, activeStages: [], hitEffectTimer: 0, hitEffectStage: 0 },
    BL: { type: 'runner', stage: 0, activeStages: [], hitEffectTimer: 0, hitEffectStage: 0 },
    BR: { type: 'runner', stage: 0, activeStages: [], hitEffectTimer: 0, hitEffectStage: 0 },
  },
};

// ---------------------------------------------------------------------------
// Pattern helpers
// ---------------------------------------------------------------------------

function isPatternEnabled(patternGroup) {
  if (GameState.gameMode === 'B') return true;
  return patternGroup !== GameState.patternIndex;
}

function rotatePatternAfterMiss() {
  GameState.patternIndex = Math.floor(Math.random() * 4);
}

function getServiceCycle() {
  return GameState.gameMode === 'B' ? SERVICE_CYCLE_B : SERVICE_CYCLE_A;
}

// ---------------------------------------------------------------------------
// Spawn logic
// ---------------------------------------------------------------------------

function currentSpawnGateTable() {
  if (GameState.gameMode === 'B') {
    return SPAWN_GATE_B;
  }

  if (GameState.score < 100) {
    return SPAWN_GATE_A_EARLY;
  }

  if (GameState.score < 300) {
    return SPAWN_GATE_A_MID;
  }

  return SPAWN_GATE_A_LATE;
}

function canSpawnThisTick() {
  const gate = currentSpawnGateTable();
  const idx = GameState.spawnGateCounter % gate.length;
  return gate[idx] === 1;
}

function maybeSpawnOnThisTick() {
  // Always advance spawn cycle every tick (keeps rhythm steady)
  const laneId = SPAWN_CYCLE[GameState.spawnCycleIndex];
  GameState.spawnCycleIndex = (GameState.spawnCycleIndex + 1) % SPAWN_CYCLE.length;

  // Gate controls density independently
  GameState.spawnGateCounter++;
  if (!canSpawnThisTick()) return false;

  return trySpawnOnLane(laneId);
}

function currentLaneCapacity(laneId) {
  const lane = LANE_DEFS[laneId];
  if (!lane) return 1;

  if (lane.type === 'TORCH') {
    if (GameState.score < 200) return 1;
    return 2;
  }

  if (GameState.score < 80) return 1;
  if (GameState.score < 250) return 2;
  return 3;
}

function trySpawnOnLane(laneId) {
  const lane = LANE_DEFS[laneId];
  if (!lane) return false;

  if (!isPatternEnabled(lane.patternGroup)) return false;

  if (GameState.laneSpawnCooldowns[laneId] > 0) return false;

  const activeInLane = GameState.activeThreats.filter(
    (t) => t.active && t.laneId === lane.laneId
  ).length;

  const laneCapacity = Math.min(lane.maxSimultaneous, currentLaneCapacity(lane.laneId));
  if (activeInLane >= laneCapacity) return false;

  const threat = {
    id: GameState.nextThreatId++,
    type: lane.type,
    laneId: lane.laneId,
    stepIndex: 0,
    maxStepIndex: lane.maxStepIndex,
    active: true,
  };

  GameState.activeThreats.push(threat);
  GameState.laneSpawnCooldowns[lane.laneId] = lane.type === 'RUNNER' ? 0 : 3;
  return true;
}

// ---------------------------------------------------------------------------
// Lane stepping
// ---------------------------------------------------------------------------

function stepLane(laneId) {
  const laneThreats = GameState.activeThreats.filter(
    (t) => t.active && t.laneId === laneId
  );

  if (laneThreats.length === 0) return false;

  // Move all threats on this lane together
  for (const threat of laneThreats) {
    threat.stepIndex += 1;
  }

  // Check misses after all moved
  for (const threat of laneThreats) {
    if (threat.stepIndex > threat.maxStepIndex) {
      threat.active = false;
      registerMiss(threat.laneId);
      return true;
    }
  }

  return true;
}

function cleanupInactiveThreats() {
  GameState.activeThreats = GameState.activeThreats.filter((t) => t.active);
}

// ---------------------------------------------------------------------------
// Miss handling and bonus
// ---------------------------------------------------------------------------

function enterMissRecovery() {
  GameState.state = 'MISS_RECOVERY';
  GameState.recoveryUntil = performance.now() / 1000 + MISS_RECOVERY_DURATION;
}

function registerMiss(laneKey) {
  GameState.misses++;

  GameState.lastMissPosition = laneKey;
  if (laneKey === 'BL' || laneKey === 'BR') {
    GameState.missAnimationTriggered = true;
  }
  if (laneKey === 'TL' || laneKey === 'TR') {
    GameState.torchMissAnimationTriggered = true;
  }

  if (GameState.misses >= 3) {
    GameState.gameOver = true;
    gameOverTimer = setTimeout(() => {
      GameState.scene = 'GAMEOVER';
      gameOverTimer = null;
    }, 5000);
    return;
  }

  if (GameState.gameMode === 'A') {
    rotatePatternAfterMiss();
  }

  // Clear active threats after miss, which matches the post-miss reset feel much better
  for (const t of GameState.activeThreats) {
    t.active = false;
  }
  cleanupInactiveThreats();
  enterMissRecovery();
}

function checkBonus(now) {
  if (!GameState.passedBonus200 && GameState.score >= 200) {
    GameState.passedBonus200 = true;
    triggerBonusCheckpoint(now);
  }

  if (!GameState.passedBonus500 && GameState.score >= 500) {
    GameState.passedBonus500 = true;
    triggerBonusCheckpoint(now);
  }
}

import { Sound } from '../audio/sound.js';

function triggerBonusCheckpoint(now) {
  if (GameState.misses > 0) {
    GameState.misses = 0;
    return;
  }

  // Freeze game and play bonus sound
  GameState.state = 'BONUS_PLAYING';
  Sound.bonusMusic().then(() => {
    if (GameState.state !== 'BONUS_PLAYING') return; // game was reset
    GameState.chanceTime = true;
    GameState.chanceTimeUntil = performance.now() / 1000 + CHANCE_TIME_DURATION;
    GameState.state = 'NORMAL';
    GameState.nextTickTime = performance.now() / 1000 + GameState.lockedTickInterval;
  });
}

// ---------------------------------------------------------------------------
// Renderer bridge
// ---------------------------------------------------------------------------

function updateLaneStages() {
  for (const key of LANE_ORDER) {
    const lane = GameState.lanes[key];

    lane.stage = 0;
    lane.activeStages = [];

    // Tick down hit effect (overlay, does not block occupancy)
    if (lane.hitEffectTimer > 0) {
      lane.hitEffectTimer--;
    }
  }

  // Keep active threats visible always, even during hit effects
  for (const threat of GameState.activeThreats) {
    if (!threat.active) continue;
    if (threat.stepIndex <= 0) continue;

    const lane = GameState.lanes[threat.laneId];
    if (!lane) continue;

    lane.activeStages.push(threat.stepIndex);

    if (threat.stepIndex > lane.stage) {
      lane.stage = threat.stepIndex;
    }
  }
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export function startGame(mode) {
  if (gameOverTimer) {
    clearTimeout(gameOverTimer);
    gameOverTimer = null;
  }

  const now = performance.now() / 1000;

  GameState.gameMode = mode;
  GameState.scene = 'PLAYING';
  GameState.state = 'NORMAL';

  GameState.score = 0;
  GameState.misses = 0;
  GameState.gameOver = false;

  GameState.patternIndex = Math.floor(Math.random() * 4);

  GameState.activeThreats = [];
  GameState.nextThreatId = 1;

  GameState.spawnCycleIndex = 0;
  GameState.spawnGateCounter = 0;
  GameState.serviceCycleIndex = 0;

  GameState.lockedTickInterval = currentTickInterval(0, mode);
  GameState.nextTickTime = now + 0.1;
  GameState.recoveryUntil = 0;

  GameState.chanceTimeUntil = 0;
  GameState.chanceTime = false;

  GameState.passedBonus200 = false;
  GameState.passedBonus500 = false;

  GameState.missAnimationTriggered = false;
  GameState.torchMissAnimationTriggered = false;
  GameState.lastMissPosition = null;

  for (const key of LANE_ORDER) {
    GameState.laneSpawnCooldowns[key] = 0;
    const lane = GameState.lanes[key];
    lane.stage = 0;
    lane.activeStages = [];
    lane.hitEffectTimer = 0;
    lane.hitEffectStage = 0;
  }
}

export function returnToTitle() {
  GameState.scene = 'TITLE';
  GameState.state = 'NORMAL';
  GameState.missAnimationTriggered = false;
  GameState.torchMissAnimationTriggered = false;
  GameState.lastMissPosition = null;
}

export function setGameMode(mode) {
  if (mode === 'A' || mode === 'B') {
    GameState.gameMode = mode;
    GameState.score = 0;
  }
}

export function movePlayer(pos) {
  GameState.currentPosition = pos;
}

export function attack() {
  const pos = GameState.currentPosition;
  const laneDef = LANE_DEFS[pos];
  if (!laneDef) return false;

  const now = performance.now() / 1000;
  const hitPoints = GameState.chanceTime ? 5 : 2;

  // Hit the front-most valid threat on that lane
  let bestThreat = null;

  for (const threat of GameState.activeThreats) {
    if (!threat.active || threat.laneId !== pos) continue;

    if (threat.type === 'RUNNER' && (threat.stepIndex === 5 || threat.stepIndex === 6)) {
      if (!bestThreat || threat.stepIndex > bestThreat.stepIndex) {
        bestThreat = threat;
      }
    }

    if (threat.type === 'TORCH' && threat.stepIndex === 5) {
      if (!bestThreat || threat.stepIndex > bestThreat.stepIndex) {
        bestThreat = threat;
      }
    }
  }

  if (!bestThreat) return false;

  bestThreat.active = false;

  if (bestThreat.type === 'RUNNER') {
    GameState.lanes[pos].hitEffectTimer = FALL_DURATION;
    GameState.lanes[pos].hitEffectStage = 7;
  }

  GameState.score = (GameState.score + hitPoints) % 10000;
  checkBonus(now);
  cleanupInactiveThreats();
  return true;
}

export function updateGame() {
  if (GameState.scene !== 'PLAYING' || GameState.gameOver) {
    updateLaneStages();
    return;
  }

  const now = performance.now() / 1000;

  if (GameState.chanceTime && now >= GameState.chanceTimeUntil) {
    GameState.chanceTime = false;
  }

  if (GameState.state === 'BONUS_PLAYING') {
    updateLaneStages();
    return;
  }

  if (GameState.state === 'MISS_RECOVERY') {
    if (now >= GameState.recoveryUntil) {
      GameState.state = 'NORMAL';
      // Recalculate speed after miss recovery (board is empty)
      GameState.lockedTickInterval = currentTickInterval(GameState.score, GameState.gameMode);
      GameState.nextTickTime = now + GameState.lockedTickInterval;
    }
    updateLaneStages();
    return;
  }

  if (now >= GameState.nextTickTime) {
    // Tick down lane spawn cooldowns
    for (const key of LANE_ORDER) {
      if (GameState.laneSpawnCooldowns[key] > 0) {
        GameState.laneSpawnCooldowns[key]--;
      }
    }

    // Spawn with score-based gating
    maybeSpawnOnThisTick();

    // Service one lane (even if empty, to keep per-lane timing consistent)
    const serviceCycle = getServiceCycle();
    const laneId = serviceCycle[GameState.serviceCycleIndex];
    GameState.serviceCycleIndex = (GameState.serviceCycleIndex + 1) % serviceCycle.length;
    stepLane(laneId);

    // Only update tick speed when board is empty (between waves)
    const hasActiveThreats = GameState.activeThreats.some(t => t.active);
    if (!hasActiveThreats) {
      GameState.lockedTickInterval = currentTickInterval(GameState.score, GameState.gameMode);
    }

    GameState.nextTickTime = now + GameState.lockedTickInterval;
  }

  cleanupInactiveThreats();
  updateLaneStages();
}