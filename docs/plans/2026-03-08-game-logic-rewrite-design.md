# Game Logic Rewrite — Design Document

Full rewrite of `game/logic.js` to implement the Fire Attack Game A spec from `game-logic.md`.

## Architecture

Four systems replacing the current simple lane model:

1. **Game state machine** — ATTRACT, STARTING, NORMAL, CHANCE_TIME, MISS_RECOVERY, GAME_OVER
2. **Pattern state machine** — 3-of-4 active lanes (Game A), all 4 (Game B)
3. **Spawn scheduler** — deterministic cycle table with spawn intents
4. **Micro-step scheduler** — round-robin, advances one threat per tick

## Files Changed

- `game/logic.js` — full rewrite
- `main.js` — adapt game loop to pass real time, use new state names
- `render/svgRenderer.js` — no structural changes, reads from bridge function

## Data Model

### GameState

```js
{
  scene,              // ATTRACT | STARTING | NORMAL | CHANCE_TIME | MISS_RECOVERY | GAME_OVER
  gameMode,           // A | B
  currentPosition,    // TL | TR | BL | BR
  score, misses,
  patternIndex,       // 0-3, which lane disabled (Game A)
  activeThreats: [],  // Threat objects
  nextThreatId,
  schedulerCursor,    // round-robin index
  spawnCycleIndex,    // position in spawn cycle
  nextSpawnTime, nextMicrostepTime, recoveryUntil, chanceTimeUntil,
  passedBonus200, passedBonus500,
  missAnimationTriggered, torchMissAnimationTriggered, lastMissPosition
}
```

### Threat

```js
{ id, type: "RUNNER"|"TORCH", laneId: "TL"|"TR"|"BL"|"BR", stepIndex, maxStepIndex, active }
```

### Lane Definitions

```js
BL: { type: "RUNNER", patternGroup: 0, maxStepIndex: 6, maxSimultaneous: 1 }
BR: { type: "RUNNER", patternGroup: 1, maxStepIndex: 6, maxSimultaneous: 1 }
TL: { type: "TORCH",  patternGroup: 2, maxStepIndex: 5, maxSimultaneous: 1 }
TR: { type: "TORCH",  patternGroup: 3, maxStepIndex: 5, maxSimultaneous: 1 }
```

Each lane = one pattern group. Game A disables one group at a time. maxSimultaneous: 1 because each lane has one sprite slot.

## Spawn Cycle

Deterministic 8-entry cycle alternating runners/torches with rest slots:

```js
[BL, NONE, TR, NONE, BR, NONE, TL, NONE]
```

Rejected spawns (disabled lane, occupied) are skipped; cycle advances regardless.

## Timing Model

Real-time based (seconds from `performance.now() / 1000`), not frame-counting.

### Micro-step interval

```
base = [0.25, 0.245, 0.24, 0.235, 0.23, 0.225, 0.22, 0.215, 0.21, 0.205]
interval = base[band] - (0.04 * (inBand / 99))
```

### Spawn interval

```
base = [0.9, 0.86, 0.82, 0.79, 0.76, 0.73, 0.70, 0.68, 0.66, 0.64]
interval = base[band] - (0.12 * (inBand / 99))
```

Game B: band offset +2.

### Fixed durations

- Miss recovery: 2.0 seconds
- Chance Time: 40.0 seconds

## Update Loop

1. Skip if ATTRACT or GAME_OVER
2. MISS_RECOVERY: check recovery timer, transition to NORMAL when done, otherwise return
3. CHANCE_TIME: check chance timer, transition to NORMAL when expired
4. Spawn: if due, read spawn cycle, attempt spawn
5. Micro-step: if due, pick next threat (round-robin), advance stepIndex, check defend/miss
6. Cleanup inactive threats

## Defense

- `attack()` checks for active threat in player's lane at hittable step
- Runner: hittable at stepIndex 5 or 6
- Torch: hittable at stepIndex 5
- Points: 2 normal, 5 during Chance Time

## Miss Handling

- misses += 1
- >= 3: GAME_OVER (5s delayed scene transition)
- < 3: MISS_RECOVERY, rotate patternIndex, recoveryUntil = now + 2.0
- Deactivate all remaining threats during recovery

## Bonus Checkpoints

- Thresholds: 200 and 500 only
- misses > 0: clear all misses to 0
- misses === 0: enter CHANCE_TIME for 40s

## Renderer Bridge

`getLaneStages()` converts activeThreats to `{ TL: { stage, falling }, ... }` format for existing renderer. Finds highest-step active threat per lane.

## JavaScript Notes

Spec uses TypeScript interfaces — implemented as plain JS objects. No restrictions; everything is implementable in vanilla JS.
