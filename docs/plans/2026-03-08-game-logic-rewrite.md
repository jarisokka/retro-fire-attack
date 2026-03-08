# Game Logic Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `game/logic.js` to use the spec's threat-object architecture with micro-step scheduler, deterministic spawn cycle, and real-time timing.

**Architecture:** Replace the current lane-stage model with independent Threat objects managed by a round-robin micro-step scheduler and deterministic spawn cycle. A bridge function (`getLaneStages()`) converts threat state back to the lane/stage format the existing SVG renderer expects. Timing moves from frame-counting to real-time seconds.

**Tech Stack:** Vanilla JavaScript (ES modules), SVG renderer (unchanged), HTML5 Audio (unchanged)

---

### Task 1: Rewrite GameState and constants in `game/logic.js`

**Files:**
- Rewrite: `game/logic.js` (lines 1-44, replace all state and constants)

**Step 1: Replace the entire top section of `game/logic.js`**

Delete everything from line 1 through line 57 (the old GameState, module-level variables, and `getFramesPerBeat`). Replace with:

```js
// game/logic.js — Fire Attack rewrite (spec-based architecture)

// ---- Constants ----
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

const MISS_RECOVERY_DURATION = 2.0;  // seconds
const CHANCE_TIME_DURATION   = 40.0; // seconds
const FALL_DURATION = 30; // frames for fall animation (renderer-side)

let gameOverTimer = null;

// ---- Game State ----
export const GameState = {
  scene: 'TITLE',           // TITLE | PLAYING | MISS_RECOVERY | GAMEOVER
  gameMode: 'A',
  currentPosition: 'TL',
  score: 0,
  misses: 0,
  gameOver: false,

  // Pattern system
  patternIndex: 0,

  // Threat system
  activeThreats: [],
  nextThreatId: 1,

  // Schedulers
  schedulerCursor: -1,
  spawnCycleIndex: 0,

  // Timing (seconds)
  nextSpawnTime: 0,
  nextMicrostepTime: 0,
  recoveryUntil: 0,
  chanceTimeUntil: 0,
  chanceTime: false,

  // Bonus
  passedBonus200: false,
  passedBonus500: false,

  // Animation flags (renderer compatibility)
  missAnimationTriggered: false,
  torchMissAnimationTriggered: false,
  lastMissPosition: null,

  // Renderer bridge (computed each frame)
  lanes: {
    TL: { type: 'torch',  stage: 0, timer: 0 },
    TR: { type: 'torch',  stage: 0, timer: 0 },
    BL: { type: 'runner', stage: 0, timer: 0, falling: false },
    BR: { type: 'runner', stage: 0, timer: 0, falling: false },
  },
};
```

**Step 2: Commit**

```bash
git add game/logic.js
git commit -m "refactor: replace GameState with spec-based threat architecture"
```

---

### Task 2: Add timing helper functions

**Files:**
- Modify: `game/logic.js` (add after constants, before GameState)

**Step 1: Add timing functions after the constant declarations**

Insert these functions between the constants block and the `GameState` export:

```js
// ---- Timing helpers ----
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
```

**Step 2: Commit**

```bash
git add game/logic.js
git commit -m "feat: add real-time timing helpers with score-band speed model"
```

---

### Task 3: Rewrite `startGame()` and `returnToTitle()`

**Files:**
- Modify: `game/logic.js` (replace existing `startGame` and `returnToTitle`)

**Step 1: Replace `startGame` function**

Delete the old `startGame` (lines 59-110) and `returnToTitle` (lines 112-118). Replace with:

```js
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

  // Pattern: random start for Game A, irrelevant for Game B
  GameState.patternIndex = (mode === 'A') ? Math.floor(Math.random() * 4) : 0;

  // Threats
  GameState.activeThreats = [];
  GameState.nextThreatId = 1;

  // Schedulers
  GameState.schedulerCursor = -1;
  GameState.spawnCycleIndex = 0;

  // Timing
  GameState.nextSpawnTime = now + 0.5;
  GameState.nextMicrostepTime = now + 0.25;
  GameState.recoveryUntil = 0;
  GameState.chanceTimeUntil = 0;
  GameState.chanceTime = false;

  // Bonus
  GameState.passedBonus200 = false;
  GameState.passedBonus500 = false;

  // Animation flags
  GameState.missAnimationTriggered = false;
  GameState.torchMissAnimationTriggered = false;
  GameState.lastMissPosition = null;

  // Reset renderer bridge lanes
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
```

**Step 2: Commit**

```bash
git add game/logic.js
git commit -m "feat: rewrite startGame with real-time timing initialization"
```

---

### Task 4: Add pattern and spawn logic

**Files:**
- Modify: `game/logic.js` (add new functions)

**Step 1: Add pattern helpers**

```js
// ---- Pattern helpers ----
function isPatternEnabled(patternGroup) {
  if (GameState.gameMode === 'B') return true;
  return patternGroup !== GameState.patternIndex;
}

function rotatePatternAfterMiss() {
  GameState.patternIndex = (GameState.patternIndex + 1) % 4;
}
```

**Step 2: Add spawn logic**

```js
// ---- Spawn logic ----
function trySpawnFromCycle(now) {
  const intent = SPAWN_CYCLE[GameState.spawnCycleIndex];
  GameState.spawnCycleIndex = (GameState.spawnCycleIndex + 1) % SPAWN_CYCLE.length;

  if (intent.kind === 'NONE' || !intent.laneId) return;

  const lane = LANE_DEFS[intent.laneId];
  if (!lane) return;

  // Check pattern enabled
  if (!isPatternEnabled(lane.patternGroup)) return;

  // Check lane capacity
  const activeInLane = GameState.activeThreats.filter(
    t => t.active && t.laneId === lane.laneId
  ).length;
  if (activeInLane >= lane.maxSimultaneous) return;

  // Create threat
  const threat = {
    id: GameState.nextThreatId++,
    type: lane.type,
    laneId: lane.laneId,
    stepIndex: 1,  // start at step 1 (visible)
    maxStepIndex: lane.maxStepIndex,
    active: true,
  };

  GameState.activeThreats.push(threat);
}
```

**Step 3: Commit**

```bash
git add game/logic.js
git commit -m "feat: add pattern system and deterministic spawn cycle"
```

---

### Task 5: Add micro-step scheduler and threat evaluation

**Files:**
- Modify: `game/logic.js` (add new functions)

**Step 1: Add round-robin picker**

```js
// ---- Micro-step scheduler ----
function pickNextThreatIndex() {
  const threats = GameState.activeThreats;
  if (threats.length === 0) return -1;

  for (let offset = 1; offset <= threats.length; offset++) {
    const idx = (GameState.schedulerCursor + offset) % threats.length;
    if (threats[idx].active) return idx;
  }
  return -1;
}
```

**Step 2: Add step and evaluation logic**

```js
function stepNextThreat(now) {
  if (GameState.activeThreats.length === 0) return;

  const idx = pickNextThreatIndex();
  if (idx < 0) return;

  const threat = GameState.activeThreats[idx];
  if (!threat.active) return;

  GameState.schedulerCursor = idx;
  threat.stepIndex += 1;

  // Check if threat has passed its max step (miss)
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
```

**Step 3: Commit**

```bash
git add game/logic.js
git commit -m "feat: add round-robin micro-step scheduler"
```

---

### Task 6: Add miss handling and bonus logic

**Files:**
- Modify: `game/logic.js` (replace old `registerMiss` and `checkBonus`)

**Step 1: Replace miss and bonus functions**

Delete the old `registerMiss` (lines 280-319) and `checkBonus` (lines 256-274). Replace with:

```js
// ---- Miss handling ----
function registerMiss(laneKey) {
  GameState.misses++;

  // Trigger animation based on lane type
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

  // Mode A: rotate pattern
  if (GameState.gameMode === 'A') {
    rotatePatternAfterMiss();
    // Deactivate any threat in the newly disabled lane
    for (const t of GameState.activeThreats) {
      if (t.active && LANE_DEFS[t.laneId].patternGroup === GameState.patternIndex) {
        t.active = false;
      }
    }
  }

  // Enter miss recovery
  const now = performance.now() / 1000;
  GameState.recoveryUntil = now + MISS_RECOVERY_DURATION;

  // Deactivate all remaining threats during recovery
  for (const t of GameState.activeThreats) {
    t.active = false;
  }
  cleanupInactiveThreats();
}

// ---- Bonus logic ----
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
  // Perfect play: Chance Time
  GameState.chanceTime = true;
  GameState.chanceTimeUntil = now + CHANCE_TIME_DURATION;
}
```

**Step 2: Commit**

```bash
git add game/logic.js
git commit -m "feat: add miss recovery, pattern rotation, and bonus checkpoints"
```

---

### Task 7: Rewrite `attack()` function and add `getLaneStages()`

**Files:**
- Modify: `game/logic.js` (replace old `attack`, add bridge function)

**Step 1: Replace `attack()` to work with threats**

Delete the old `attack` function (lines 225-253). Replace with:

```js
export function attack() {
  const pos = GameState.currentPosition;
  const laneDef = LANE_DEFS[pos];
  if (!laneDef) return false;

  const now = performance.now() / 1000;
  const hitPoints = GameState.chanceTime ? 5 : 2;

  // Find an active threat in this lane at a hittable step
  for (const threat of GameState.activeThreats) {
    if (!threat.active || threat.laneId !== pos) continue;

    if (threat.type === 'RUNNER' && (threat.stepIndex === 5 || threat.stepIndex === 6)) {
      threat.active = false;
      // Set fall animation on the renderer bridge lane
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
```

**Step 2: Add `getLaneStages()` bridge and `updateLaneStages()`**

```js
// ---- Renderer bridge ----
// Converts active threats into the lane/stage format the SVG renderer expects.
function updateLaneStages() {
  // Reset all lanes to stage 0 (but preserve falling state which has its own timer)
  for (const key of LANE_ORDER) {
    const lane = GameState.lanes[key];
    if (lane.falling) {
      // Fall animation runs on its own timer, don't reset
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

  // Write threat positions into lanes
  for (const threat of GameState.activeThreats) {
    if (!threat.active) continue;
    const lane = GameState.lanes[threat.laneId];
    if (lane && !lane.falling) {
      lane.stage = threat.stepIndex;
    }
  }
}
```

**Step 3: Commit**

```bash
git add game/logic.js
git commit -m "feat: rewrite attack() for threat objects, add renderer bridge"
```

---

### Task 8: Rewrite `updateGame()` — the main loop

**Files:**
- Modify: `game/logic.js` (replace old `updateGame`)

**Step 1: Replace the entire `updateGame` function**

Delete the old `updateGame` (lines 123-210). Replace with:

```js
export function updateGame() {
  if (GameState.scene !== 'PLAYING' || GameState.gameOver) {
    updateLaneStages();
    return;
  }

  const now = performance.now() / 1000;

  // Miss recovery: wait until recovery period ends
  if (GameState.recoveryUntil > 0 && now < GameState.recoveryUntil) {
    updateLaneStages();
    return;
  }

  // Exiting recovery
  if (GameState.recoveryUntil > 0 && now >= GameState.recoveryUntil) {
    GameState.recoveryUntil = 0;
    GameState.nextSpawnTime = now + currentSpawnInterval(GameState.score, GameState.gameMode);
    GameState.nextMicrostepTime = now + currentMicrostepInterval(GameState.score, GameState.gameMode);
  }

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
```

**Step 2: Commit**

```bash
git add game/logic.js
git commit -m "feat: rewrite updateGame with real-time spawn and micro-step scheduling"
```

---

### Task 9: Update `main.js` — adapt game loop and scene checks

**Files:**
- Modify: `main.js`

**Step 1: Update the scene check in the game loop**

The game loop in `main.js` (line 41) checks `isMissAnimationActive()` to pause game logic. This still works because miss recovery in `logic.js` now handles the pause internally (via `recoveryUntil`). However, the renderer animation blocking should remain so that the miss animation plays out visually.

No changes needed to the `setInterval` game loop — `updateGame()` already reads `performance.now()` internally.

**Step 2: Update the GAMEOVER scene check**

In the keydown handler (line 100), `GameState.scene` is now `'GAMEOVER'` (already matches). The `'PLAYING'` check on line 110 also still works since we kept that scene name.

**Step 3: Verify exports match**

Check that `main.js` imports match what `logic.js` exports. Current imports:

```js
import { GameState, updateGame, movePlayer, attack, startGame, returnToTitle, setGameMode } from "./game/logic.js";
```

All of these are still exported. `setGameMode` and `movePlayer` are unchanged. No import changes needed.

**Step 4: Commit (only if changes were needed)**

```bash
git add main.js
git commit -m "chore: verify main.js compatibility with new game logic"
```

---

### Task 10: Keep `setGameMode` and `movePlayer` exports

**Files:**
- Verify: `game/logic.js` (ensure these are still present)

**Step 1: Confirm these functions exist in the rewritten file**

These should be present as-is:

```js
export function setGameMode(mode) {
  if (mode === 'A' || mode === 'B') {
    GameState.gameMode = mode;
  }
}

export function movePlayer(pos) {
  GameState.currentPosition = pos;
}
```

No changes needed — just verify they weren't accidentally deleted during the rewrite.

**Step 2: Commit full rewrite**

```bash
git add game/logic.js
git commit -m "feat: complete game logic rewrite with spec-based architecture"
```

---

### Task 11: Manual play-test and tuning

**Files:**
- May adjust: `game/logic.js` (timing constants, spawn cycle)

**Step 1: Open the game in browser**

Run: `open index.html` (or use a local server if needed)

**Step 2: Test these scenarios**

1. **Start Game A** — verify only 3 lanes are active, enemies spawn and advance one at a time
2. **Get hit (miss)** — verify 2-second pause, pattern rotates (different lane disabled), board clears
3. **3 misses** — verify game over with 5-second animation delay
4. **Reach 200 with misses** — verify all misses cleared
5. **Reach 200 with no misses** — verify Chance Time starts (5 pts per hit for 40s)
6. **Game B** — verify all 4 lanes active, faster speed
7. **Speed progression** — verify game gets faster within each 100-point band

**Step 3: Tune if needed**

The most likely adjustments:
- `SPAWN_CYCLE` order and NONE slot count (controls attack density)
- `MICROSTEP_BASE` / `SPAWN_BASE` values (controls speed feel)
- `MISS_RECOVERY_DURATION` (controls pause length)
- Initial `stepIndex` in `trySpawnFromCycle` (1 = visible immediately, 0 = invisible first step)

**Step 4: Final commit**

```bash
git add game/logic.js
git commit -m "tune: adjust timing and spawn cycle after play-testing"
```
