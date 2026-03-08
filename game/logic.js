// game/logic.js — Fire Attack rewrite (spec-based architecture)

const LANE_ORDER = ['TL', 'TR', 'BL', 'BR'];

const LANE_DEFS = {
  BL: { laneId: 'BL', type: 'RUNNER', patternGroup: 0, maxStepIndex: 6, maxSimultaneous: 1 },
  BR: { laneId: 'BR', type: 'RUNNER', patternGroup: 1, maxStepIndex: 6, maxSimultaneous: 1 },
  TL: { laneId: 'TL', type: 'TORCH',  patternGroup: 2, maxStepIndex: 5, maxSimultaneous: 1 },
  TR: { laneId: 'TR', type: 'TORCH',  patternGroup: 3, maxStepIndex: 5, maxSimultaneous: 1 },
};

const SPAWN_CYCLE = [
  { kind: 'SPAWN', laneId: 'BL' },
  { kind: 'NONE' },
  { kind: 'SPAWN', laneId: 'TR' },
  { kind: 'NONE' },
  { kind: 'SPAWN', laneId: 'BR' },
  { kind: 'NONE' },
  { kind: 'SPAWN', laneId: 'TL' },
  { kind: 'NONE' },
];

const MICROSTEP_BASE = [0.25, 0.245, 0.24, 0.235, 0.23, 0.225, 0.22, 0.215, 0.21, 0.205];
const SPAWN_BASE     = [0.9,  0.86,  0.82, 0.79,  0.76, 0.73,  0.70, 0.68,  0.66, 0.64];

const CHANCE_TIME_DURATION   = 40.0;
const FALL_DURATION = 30;

let gameOverTimer = null;

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

function currentMicrostepInterval(score, mode) {
  const bandOffset = (mode === 'B') ? 2 : 0;
  const band = Math.min(Math.floor(score / 100) + bandOffset, MICROSTEP_BASE.length - 1);
  const inBand = score % 100;
  return MICROSTEP_BASE[band] - (0.04 * (inBand / 99));
}

function currentSpawnInterval(score, mode) {
  const bandOffset = (mode === 'B') ? 2 : 0;
  const band = Math.min(Math.floor(score / 100) + bandOffset, SPAWN_BASE.length - 1);
  const inBand = score % 100;
  return SPAWN_BASE[band] - (0.12 * (inBand / 99));
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

  patternIndex: 0,

  activeThreats: [],
  nextThreatId: 1,

  schedulerCursor: -1,
  spawnCycleIndex: 0,

  nextSpawnTime: 0,
  nextMicrostepTime: 0,
  chanceTimeUntil: 0,
  chanceTime: false,

  passedBonus200: false,
  passedBonus500: false,

  missAnimationTriggered: false,
  torchMissAnimationTriggered: false,
  lastMissPosition: null,

  lanes: {
    TL: { type: 'torch',  stage: 0, timer: 0, falling: false },
    TR: { type: 'torch',  stage: 0, timer: 0, falling: false },
    BL: { type: 'runner', stage: 0, timer: 0, falling: false },
    BR: { type: 'runner', stage: 0, timer: 0, falling: false },
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
  GameState.patternIndex = (GameState.patternIndex + 1) % 4;
}

// ---------------------------------------------------------------------------
// Spawn logic
// ---------------------------------------------------------------------------

function trySpawnFromCycle(now) {
  const intent = SPAWN_CYCLE[GameState.spawnCycleIndex];
  GameState.spawnCycleIndex = (GameState.spawnCycleIndex + 1) % SPAWN_CYCLE.length;

  if (intent.kind === 'NONE' || !intent.laneId) return;

  const lane = LANE_DEFS[intent.laneId];
  if (!lane) return;

  if (!isPatternEnabled(lane.patternGroup)) return;

  const activeInLane = GameState.activeThreats.filter(
    t => t.active && t.laneId === lane.laneId
  ).length;
  if (activeInLane >= lane.maxSimultaneous) return;

  const threat = {
    id: GameState.nextThreatId++,
    type: lane.type,
    laneId: lane.laneId,
    stepIndex: 1,
    maxStepIndex: lane.maxStepIndex,
    active: true,
  };

  GameState.activeThreats.push(threat);
}

// ---------------------------------------------------------------------------
// Micro-step scheduler
// ---------------------------------------------------------------------------

function pickNextThreatIndex() {
  const threats = GameState.activeThreats;
  if (threats.length === 0) return -1;

  for (let offset = 1; offset <= threats.length; offset++) {
    const idx = (GameState.schedulerCursor + offset) % threats.length;
    if (threats[idx].active) return idx;
  }
  return -1;
}

function stepNextThreat(now) {
  if (GameState.activeThreats.length === 0) return;

  const idx = pickNextThreatIndex();
  if (idx < 0) return;

  const threat = GameState.activeThreats[idx];
  if (!threat.active) return;

  GameState.schedulerCursor = idx;
  threat.stepIndex += 1;

  if (threat.stepIndex > threat.maxStepIndex) {
    registerMiss(threat.laneId);
    threat.active = false;
  }
}

function cleanupInactiveThreats() {
  GameState.activeThreats = GameState.activeThreats.filter(t => t.active);
  if (GameState.schedulerCursor >= GameState.activeThreats.length) {
    GameState.schedulerCursor = Math.max(-1, GameState.activeThreats.length - 1);
  }
}

// ---------------------------------------------------------------------------
// Miss handling and bonus
// ---------------------------------------------------------------------------

function registerMiss(laneKey) {
  GameState.misses++;

  if (laneKey === 'BL' || laneKey === 'BR') {
    GameState.lastMissPosition = laneKey;
    GameState.missAnimationTriggered = true;
  }
  if (laneKey === 'TL' || laneKey === 'TR') {
    GameState.lastMissPosition = laneKey;
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
    for (const t of GameState.activeThreats) {
      if (t.active && LANE_DEFS[t.laneId].patternGroup === GameState.patternIndex) {
        t.active = false;
      }
    }
  }

  for (const t of GameState.activeThreats) {
    t.active = false;
  }
  cleanupInactiveThreats();
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

function triggerBonusCheckpoint(now) {
  if (GameState.misses > 0) {
    GameState.misses = 0;
    return;
  }
  GameState.chanceTime = true;
  GameState.chanceTimeUntil = now + CHANCE_TIME_DURATION;
}

// ---------------------------------------------------------------------------
// Renderer bridge
// ---------------------------------------------------------------------------

function updateLaneStages() {
  for (const key of LANE_ORDER) {
    const lane = GameState.lanes[key];
    if (lane.falling) {
      lane.timer++;
      if (lane.timer > FALL_DURATION) {
        lane.stage = 0;
        lane.timer = 0;
        lane.falling = false;
      }
      continue;
    }
    lane.stage = 0;
  }

  for (const threat of GameState.activeThreats) {
    if (!threat.active) continue;
    const lane = GameState.lanes[threat.laneId];
    if (lane && !lane.falling) {
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
  GameState.score = 0;
  GameState.misses = 0;
  GameState.gameOver = false;

  GameState.patternIndex = (mode === 'A') ? Math.floor(Math.random() * 4) : 0;

  GameState.activeThreats = [];
  GameState.nextThreatId = 1;

  GameState.schedulerCursor = -1;
  GameState.spawnCycleIndex = 0;

  GameState.nextSpawnTime = now + 0.5;
  GameState.nextMicrostepTime = now + 0.25;
  GameState.chanceTimeUntil = 0;
  GameState.chanceTime = false;

  GameState.passedBonus200 = false;
  GameState.passedBonus500 = false;

  GameState.missAnimationTriggered = false;
  GameState.torchMissAnimationTriggered = false;
  GameState.lastMissPosition = null;

  for (const key of LANE_ORDER) {
    const lane = GameState.lanes[key];
    lane.stage = 0;
    lane.timer = 0;
    if (lane.falling !== undefined) lane.falling = false;
  }
}

export function returnToTitle() {
  GameState.scene = 'TITLE';
  GameState.missAnimationTriggered = false;
  GameState.torchMissAnimationTriggered = false;
  GameState.lastMissPosition = null;
}

export function setGameMode(mode) {
  if (mode === 'A' || mode === 'B') {
    GameState.gameMode = mode;
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

  for (const threat of GameState.activeThreats) {
    if (!threat.active || threat.laneId !== pos) continue;

    if (threat.type === 'RUNNER' && (threat.stepIndex === 5 || threat.stepIndex === 6)) {
      threat.active = false;
      GameState.lanes[pos].falling = true;
      GameState.lanes[pos].stage = 7;
      GameState.lanes[pos].timer = 0;
      GameState.score += hitPoints;
      checkBonus(now);
      return true;
    }

    if (threat.type === 'TORCH' && threat.stepIndex === 5) {
      threat.active = false;
      GameState.score += hitPoints;
      checkBonus(now);
      return true;
    }
  }

  return false;
}

export function updateGame() {
  if (GameState.scene !== 'PLAYING' || GameState.gameOver) {
    updateLaneStages();
    return;
  }

  const now = performance.now() / 1000;

  // Chance Time expiry
  if (GameState.chanceTime && now >= GameState.chanceTimeUntil) {
    GameState.chanceTime = false;
  }

  // Spawn
  if (now >= GameState.nextSpawnTime) {
    trySpawnFromCycle(now);
    GameState.nextSpawnTime = now + currentSpawnInterval(GameState.score, GameState.gameMode);
  }

  // Micro-step
  if (now >= GameState.nextMicrostepTime) {
    stepNextThreat(now);
    GameState.nextMicrostepTime = now + currentMicrostepInterval(GameState.score, GameState.gameMode);
  }

  cleanupInactiveThreats();
  updateLaneStages();
}
