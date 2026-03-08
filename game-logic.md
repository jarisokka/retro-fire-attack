# Fire Attack (Game A) — Working State Table and Pseudocode

Below is a **best-fit reconstruction spec** based on:

* the original Fire Attack manual details,
* your gameplay observations,
* the audio recordings up to 880 points,
* and the miss-at-30 recording.

It is **not a proven ROM dump-level spec**, but it is a strong implementation model that should feel very close to the original.

---

# 1. High-level model

Use these four systems:

1. **Game state machine**
2. **Pattern state machine** for Game A’s 3-of-4 active vectors
3. **Spawn scheduler** using a deterministic cycle table
4. **Micro-step scheduler** that advances active objects one at a time

---

# 2. Main game states

## State table

| State           | Meaning                                     | Entered when                              | Exits when                | Notes                                     |
| --------------- | ------------------------------------------- | ----------------------------------------- | ------------------------- | ----------------------------------------- |
| `ATTRACT`       | Demo / idle / clock mode                    | power on / idle                           | player starts game        | Optional if you are only cloning gameplay |
| `STARTING`      | Short initialization before gameplay begins | game start selected                       | initial timers are armed  | Can be very short                         |
| `NORMAL`        | Standard gameplay                           | after start or after recovery             | miss occurs / game over   | Main play state                           |
| `MISS_RECOVERY` | Pause / miss animation / fire sequence      | unresolved threat reaches fort            | recovery timer ends       | Pattern rotates here in Game A            |
| `CHANCE_TIME`   | Bonus scoring state                         | score checkpoint reached with zero misses | `chanceTimeUntil` expires | Score per hit = 5                         |
| `GAME_OVER`     | End state                                   | `misses >= 3`                             | new game selected         | Standard Game & Watch end                 |

---

# 3. Pattern-state model for Game A

## Idea

Game A uses **3 active attack-vector groups at a time**, chosen from **4 total pattern groups**.

Represent that by storing which one is currently disabled.

## Pattern state table

| `patternIndex` | Disabled pattern group | Enabled groups |
| -------------- | ---------------------- | -------------- |
| `0`            | `P0`                   | `P1, P2, P3`   |
| `1`            | `P1`                   | `P0, P2, P3`   |
| `2`            | `P2`                   | `P0, P1, P3`   |
| `3`            | `P3`                   | `P0, P1, P2`   |

## Rotation rule

Best-fit miss rule:

```text
on miss:
    patternIndex = (patternIndex + 1) mod 4
```

That gives the “pattern cycle” feeling you observed.

---

# 4. Threat model

Each moving attack object should be independent.

## Threat structure

```ts
type ThreatType = "RUNNER" | "TORCH";

interface Threat {
  id: number;
  type: ThreatType;

  // Which route it belongs to
  laneId: string;

  // Which defense corner / response zone this ultimately targets
  targetCorner: 0 | 1 | 2 | 3;

  // Current LCD step on its route
  stepIndex: number;

  // Route length
  maxStepIndex: number;

  // Active / removed
  active: boolean;

  // Optional: for debugging / sound / analytics
  soundClass: "GROUND" | "TORCH";
}
```

---

# 5. Suggested route / lane abstraction

You do not need to hardcode by sprite name. Just define lane metadata.

```ts
interface LaneDef {
  laneId: string;
  type: ThreatType;
  patternGroup: 0 | 1 | 2 | 3;
  targetCorner: 0 | 1 | 2 | 3;
  maxSimultaneous: number;
  maxStepIndex: number;
}
```

Example interpretation:

* multiple lanes may map to the same `targetCorner`
* runners may allow higher lane capacity than torches
* `patternGroup` is what the Game A filter checks

---

# 6. Spawn-cycle model

Use a deterministic table of spawn intents.

## Spawn intent structure

```ts
interface SpawnIntent {
  kind: "NONE" | "SPAWN";
  laneId?: string;
}
```

## Example cycle table

This is **illustrative**, not exact:

```ts
const spawnCycle: SpawnIntent[] = [
  { kind: "SPAWN", laneId: "runner_left_1" },
  { kind: "NONE" },
  { kind: "SPAWN", laneId: "runner_left_2" },
  { kind: "NONE" },
  { kind: "SPAWN", laneId: "runner_left_3" },
  { kind: "SPAWN", laneId: "torch_right_1" },
  { kind: "SPAWN", laneId: "runner_left_4" },
  { kind: "SPAWN", laneId: "torch_right_2" },
];
```

In practice your real table will be longer.

---

# 7. Spawn rules

A spawn attempt succeeds only if all checks pass.

## Spawn acceptance table

| Check              | Rule                                                            | Why                                 |
| ------------------ | --------------------------------------------------------------- | ----------------------------------- |
| Pattern enabled    | Lane’s `patternGroup` must be enabled in current Game A pattern | Recreates 3-of-4 vector logic       |
| Lane capacity      | Current active threats in lane `< maxSimultaneous`              | Audio confirms stacking, but finite |
| Corner fairness    | Do not allow impossible same-corner opposite-direction overlap  | Player must be able to defend       |
| State allows spawn | Only spawn in `NORMAL` or `CHANCE_TIME`                         | Not during miss recovery            |
| Spawn clock due    | `now >= nextSpawnTime`                                          | Deterministic timing                |

## Recommended fairness rule

Reject a new threat if another unresolved threat already targets the same `targetCorner` from a conflicting route.

Simplest implementation:

```ts
function causesImpossibleCornerConflict(
  lane: LaneDef,
  activeThreats: Threat[],
  laneDefs: Record<string, LaneDef>
): boolean {
  for (const t of activeThreats) {
    if (!t.active) continue;

    const otherLane = laneDefs[t.laneId];
    if (otherLane.targetCorner !== lane.targetCorner) continue;

    if (otherLane.laneId !== lane.laneId) {
      return true;
    }
  }
  return false;
}
```

You can relax this later if testing shows the original allows a narrow exception.

---

# 8. Micro-step scheduler

This is one of the most important parts.

## Rule

Advance **one active threat per micro-step**, not all threats at once.

That matches the recordings, where:

* opposite-side attacks produce separate sound events,
* multiple threats create short bursts of movement sounds,
* three runners in one direction are possible.

## Scheduler table

| Scheduler field     | Meaning                               |
| ------------------- | ------------------------------------- |
| `activeThreats[]`   | all currently moving threats          |
| `schedulerCursor`   | index of the last moved threat        |
| `nextMicrostepTime` | time when next object movement occurs |

## Selection rule

Use round-robin across active threats:

```ts
function pickNextThreatIndex(activeThreats: Threat[], schedulerCursor: number): number {
  if (activeThreats.length === 0) return -1;

  for (let offset = 1; offset <= activeThreats.length; offset++) {
    const idx = (schedulerCursor + offset) % activeThreats.length;
    if (activeThreats[idx].active) return idx;
  }
  return -1;
}
```

This prevents one lane from starving others and matches the bursty interleaving feel.

---

# 9. Scoring and bonus logic

## Score rules

| Situation                      | Points |
| ------------------------------ | ------ |
| Normal successful defense      | `+2`   |
| Chance Time successful defense | `+5`   |

## Bonus checkpoints

For your recreation, use these checkpoints:

* `200`
* `500`

Since you said you do not need precise jingle-timing verification, use fixed **40 seconds** for Chance Time.

## Bonus state transitions

| Condition                           | Result                                                              |
| ----------------------------------- | ------------------------------------------------------------------- |
| Reach checkpoint with `misses > 0`  | clear misses, play jingle                                           |
| Reach checkpoint with `misses == 0` | enter `CHANCE_TIME`, play jingle, set `chanceTimeUntil = now + 40s` |

---

# 10. Speed model

Use two timing layers:

* **spawn interval**
* **micro-step interval**

Both should depend on score.

## Score-band model

```ts
const hundredsBand = Math.floor(score / 100);
const inBand = score % 100;
```

## Recommendation

```ts
microstepInterval = baseMicrostepForBand(hundredsBand) - rampWithinBand(inBand)
spawnInterval = baseSpawnForBand(hundredsBand) - spawnRampWithinBand(inBand)
```

That reproduces:

* increasing speed within each 100,
* partial reset at each new hundred,
* gradually harder game overall.

## Example timing helpers

These are placeholders, but good starting values:

```ts
function baseMicrostepForBand(band: number): number {
  const table = [
    0.25, // 0xx
    0.245, // 1xx
    0.24, // 2xx
    0.235, // 3xx
    0.23, // 4xx
    0.225, // 5xx
    0.22, // 6xx
    0.215, // 7xx
    0.21, // 8xx
    0.205, // 9xx
  ];
  return table[Math.min(band, table.length - 1)];
}

function rampWithinBand(inBand: number): number {
  return 0.04 * (inBand / 99);
}
```

For spawn interval you can use a slightly slower base, for example:

```ts
function baseSpawnForBand(band: number): number {
  const table = [
    0.9,
    0.86,
    0.82,
    0.79,
    0.76,
    0.73,
    0.70,
    0.68,
    0.66,
    0.64,
  ];
  return table[Math.min(band, table.length - 1)];
}

function spawnRampWithinBand(inBand: number): number {
  return 0.12 * (inBand / 99);
}
```

Tune these by feel.

---

# 11. Miss handling

## Miss transition table

| Event                                 | Action                                                          |
| ------------------------------------- | --------------------------------------------------------------- |
| Threat reaches fire / fort unresolved | `misses += 1`                                                   |
| If `misses >= 3`                      | go to `GAME_OVER`                                               |
| Else                                  | go to `MISS_RECOVERY`                                           |
| On entering `MISS_RECOVERY`           | rotate `patternIndex`, pause spawn/movement, play miss sequence |
| When recovery ends                    | return to `NORMAL`                                              |

## Recommended recovery values

Use a fixed recovery duration, for example:

```ts
const MISS_RECOVERY_DURATION = 2.0; // seconds
```

You can tune it later.

---

# 12. Full state transition table

| Current state   | Trigger                         | Next state      | Action                                |
| --------------- | ------------------------------- | --------------- | ------------------------------------- |
| `ATTRACT`       | start button                    | `STARTING`      | init game                             |
| `STARTING`      | setup complete                  | `NORMAL`        | arm timers                            |
| `NORMAL`        | score checkpoint with no misses | `CHANCE_TIME`   | play jingle, start 40s timer          |
| `NORMAL`        | score checkpoint with misses    | `NORMAL`        | clear misses, play jingle             |
| `NORMAL`        | miss occurs and misses `< 3`    | `MISS_RECOVERY` | rotate pattern, start recovery timer  |
| `NORMAL`        | miss occurs and misses `>= 3`   | `GAME_OVER`     | end game                              |
| `CHANCE_TIME`   | chance timer expires            | `NORMAL`        | restore normal scoring                |
| `CHANCE_TIME`   | miss occurs and misses `< 3`    | `MISS_RECOVERY` | rotate pattern, end chance if desired |
| `CHANCE_TIME`   | miss occurs and misses `>= 3`   | `GAME_OVER`     | end game                              |
| `MISS_RECOVERY` | recovery timer expires          | `NORMAL`        | resume play                           |
| `GAME_OVER`     | new game selected               | `STARTING`      | reset everything                      |

---

# 13. TypeScript-style pseudocode

## Main types

```ts
type GameState =
  | "ATTRACT"
  | "STARTING"
  | "NORMAL"
  | "CHANCE_TIME"
  | "MISS_RECOVERY"
  | "GAME_OVER";

type ThreatType = "RUNNER" | "TORCH";

interface Threat {
  id: number;
  type: ThreatType;
  laneId: string;
  targetCorner: 0 | 1 | 2 | 3;
  stepIndex: number;
  maxStepIndex: number;
  active: boolean;
  soundClass: "GROUND" | "TORCH";
}

interface LaneDef {
  laneId: string;
  type: ThreatType;
  patternGroup: 0 | 1 | 2 | 3;
  targetCorner: 0 | 1 | 2 | 3;
  maxSimultaneous: number;
  maxStepIndex: number;
}

interface SpawnIntent {
  kind: "NONE" | "SPAWN";
  laneId?: string;
}

interface GameModel {
  state: GameState;
  score: number;
  misses: number;

  patternIndex: 0 | 1 | 2 | 3;

  activeThreats: Threat[];
  nextThreatId: number;

  schedulerCursor: number;
  spawnCycleIndex: number;

  nextSpawnTime: number;
  nextMicrostepTime: number;
  recoveryUntil: number;
  chanceTimeUntil: number;

  passedBonus200: boolean;
  passedBonus500: boolean;
}
```

---

## Initialization

```ts
function createGame(): GameModel {
  return {
    state: "ATTRACT",
    score: 0,
    misses: 0,

    patternIndex: 0,

    activeThreats: [],
    nextThreatId: 1,

    schedulerCursor: -1,
    spawnCycleIndex: 0,

    nextSpawnTime: 0,
    nextMicrostepTime: 0,
    recoveryUntil: 0,
    chanceTimeUntil: 0,

    passedBonus200: false,
    passedBonus500: false,
  };
}
```

---

## Start game

```ts
function startGame(game: GameModel, now: number): void {
  game.state = "STARTING";
  game.score = 0;
  game.misses = 0;
  game.patternIndex = 0;

  game.activeThreats = [];
  game.nextThreatId = 1;
  game.schedulerCursor = -1;
  game.spawnCycleIndex = 0;

  game.recoveryUntil = 0;
  game.chanceTimeUntil = 0;

  game.passedBonus200 = false;
  game.passedBonus500 = false;

  game.nextSpawnTime = now + 0.5;
  game.nextMicrostepTime = now + 0.25;

  game.state = "NORMAL";
}
```

---

## Update loop

```ts
function updateGame(
  game: GameModel,
  now: number,
  laneDefs: Record<string, LaneDef>,
  spawnCycle: SpawnIntent[]
): void {
  if (game.state === "ATTRACT" || game.state === "GAME_OVER") {
    return;
  }

  if (game.state === "MISS_RECOVERY") {
    if (now >= game.recoveryUntil) {
      game.state = "NORMAL";
      game.nextSpawnTime = now + currentSpawnInterval(game);
      game.nextMicrostepTime = now + currentMicrostepInterval(game);
    }
    return;
  }

  if (game.state === "CHANCE_TIME" && now >= game.chanceTimeUntil) {
    game.state = "NORMAL";
  }

  if ((game.state === "NORMAL" || game.state === "CHANCE_TIME") && now >= game.nextSpawnTime) {
    trySpawnFromCycle(game, now, laneDefs, spawnCycle);
    game.nextSpawnTime = now + currentSpawnInterval(game);
  }

  if ((game.state === "NORMAL" || game.state === "CHANCE_TIME") && now >= game.nextMicrostepTime) {
    stepNextThreat(game, now, laneDefs);
    game.nextMicrostepTime = now + currentMicrostepInterval(game);
  }

  cleanupInactiveThreats(game);
}
```

---

## Timing helpers

```ts
function currentMicrostepInterval(game: GameModel): number {
  const band = Math.floor(game.score / 100);
  const inBand = game.score % 100;
  return baseMicrostepForBand(band) - rampWithinBand(inBand);
}

function currentSpawnInterval(game: GameModel): number {
  const band = Math.floor(game.score / 100);
  const inBand = game.score % 100;
  return baseSpawnForBand(band) - spawnRampWithinBand(inBand);
}

function baseMicrostepForBand(band: number): number {
  const table = [0.25, 0.245, 0.24, 0.235, 0.23, 0.225, 0.22, 0.215, 0.21, 0.205];
  return table[Math.min(band, table.length - 1)];
}

function rampWithinBand(inBand: number): number {
  return 0.04 * (inBand / 99);
}

function baseSpawnForBand(band: number): number {
  const table = [0.9, 0.86, 0.82, 0.79, 0.76, 0.73, 0.70, 0.68, 0.66, 0.64];
  return table[Math.min(band, table.length - 1)];
}

function spawnRampWithinBand(inBand: number): number {
  return 0.12 * (inBand / 99);
}
```

---

## Pattern helpers

```ts
function isPatternEnabled(game: GameModel, patternGroup: 0 | 1 | 2 | 3): boolean {
  return patternGroup !== game.patternIndex;
}

function rotatePatternAfterMiss(game: GameModel): void {
  game.patternIndex = ((game.patternIndex + 1) % 4) as 0 | 1 | 2 | 3;
}
```

---

## Spawn logic

```ts
function trySpawnFromCycle(
  game: GameModel,
  now: number,
  laneDefs: Record<string, LaneDef>,
  spawnCycle: SpawnIntent[]
): void {
  const intent = spawnCycle[game.spawnCycleIndex];
  game.spawnCycleIndex = (game.spawnCycleIndex + 1) % spawnCycle.length;

  if (intent.kind === "NONE" || !intent.laneId) {
    return;
  }

  const lane = laneDefs[intent.laneId];
  if (!lane) return;

  if (!isPatternEnabled(game, lane.patternGroup)) {
    return;
  }

  const activeInLane = game.activeThreats.filter(
    t => t.active && t.laneId === lane.laneId
  ).length;

  if (activeInLane >= lane.maxSimultaneous) {
    return;
  }

  if (causesImpossibleCornerConflict(lane, game.activeThreats, laneDefs)) {
    return;
  }

  const threat: Threat = {
    id: game.nextThreatId++,
    type: lane.type,
    laneId: lane.laneId,
    targetCorner: lane.targetCorner,
    stepIndex: 0,
    maxStepIndex: lane.maxStepIndex,
    active: true,
    soundClass: lane.type === "RUNNER" ? "GROUND" : "TORCH",
  };

  game.activeThreats.push(threat);
}
```

---

## Micro-step logic

```ts
function stepNextThreat(
  game: GameModel,
  now: number,
  laneDefs: Record<string, LaneDef>
): void {
  if (game.activeThreats.length === 0) {
    return;
  }

  const idx = pickNextThreatIndex(game.activeThreats, game.schedulerCursor);
  if (idx < 0) return;

  const threat = game.activeThreats[idx];
  if (!threat.active) return;

  game.schedulerCursor = idx;

  threat.stepIndex += 1;

  playMovementSound(threat);

  const result = evaluateThreatPosition(threat);

  if (result === "DEFENDED") {
    onThreatDefended(game, threat, now);
  } else if (result === "MISSED") {
    onThreatMissed(game, threat, now);
  }
}
```

---

## Threat evaluation

This part depends on your route definitions.

```ts
type ThreatResolution = "NONE" | "DEFENDED" | "MISSED";

function evaluateThreatPosition(threat: Threat): ThreatResolution {
  if (!threat.active) return "NONE";

  // Replace with your real defend / miss windows.
  const defendStep = threat.maxStepIndex - 1;
  const missStep = threat.maxStepIndex;

  if (playerDefendedThreat(threat, defendStep)) {
    return "DEFENDED";
  }

  if (threat.stepIndex >= missStep) {
    return "MISSED";
  }

  return "NONE";
}
```

---

## Defense and scoring

```ts
function onThreatDefended(game: GameModel, threat: Threat, now: number): void {
  threat.active = false;

  const points = game.state === "CHANCE_TIME" ? 5 : 2;
  game.score += points;

  checkBonusMilestones(game, now);
}

function checkBonusMilestones(game: GameModel, now: number): void {
  if (!game.passedBonus200 && game.score >= 200) {
    game.passedBonus200 = true;
    triggerBonusCheckpoint(game, now);
  }

  if (!game.passedBonus500 && game.score >= 500) {
    game.passedBonus500 = true;
    triggerBonusCheckpoint(game, now);
  }
}

function triggerBonusCheckpoint(game: GameModel, now: number): void {
  playBonusJingle();

  if (game.misses > 0) {
    game.misses = 0;
    return;
  }

  game.state = "CHANCE_TIME";
  game.chanceTimeUntil = now + 40.0;
}
```

---

## Miss handling

```ts
function onThreatMissed(game: GameModel, threat: Threat, now: number): void {
  threat.active = false;

  game.misses += 1;

  if (game.misses >= 3) {
    game.state = "GAME_OVER";
    playGameOverSound();
    return;
  }

  rotatePatternAfterMiss(game);

  game.state = "MISS_RECOVERY";
  game.recoveryUntil = now + 2.0;

  playMissSequence();
}
```

---

## Helpers

```ts
function cleanupInactiveThreats(game: GameModel): void {
  game.activeThreats = game.activeThreats.filter(t => t.active);

  if (game.schedulerCursor >= game.activeThreats.length) {
    game.schedulerCursor = game.activeThreats.length - 1;
  }
}

function pickNextThreatIndex(activeThreats: Threat[], schedulerCursor: number): number {
  if (activeThreats.length === 0) return -1;

  for (let offset = 1; offset <= activeThreats.length; offset++) {
    const idx = (schedulerCursor + offset) % activeThreats.length;
    if (activeThreats[idx].active) return idx;
  }

  return -1;
}
```

---

# 14. Recommended lane setup example

This is just a template.

```ts
const laneDefs: Record<string, LaneDef> = {
  runner_left_1: {
    laneId: "runner_left_1",
    type: "RUNNER",
    patternGroup: 0,
    targetCorner: 0,
    maxSimultaneous: 3,
    maxStepIndex: 5,
  },
  runner_left_2: {
    laneId: "runner_left_2",
    type: "RUNNER",
    patternGroup: 1,
    targetCorner: 1,
    maxSimultaneous: 3,
    maxStepIndex: 5,
  },
  runner_left_3: {
    laneId: "runner_left_3",
    type: "RUNNER",
    patternGroup: 2,
    targetCorner: 2,
    maxSimultaneous: 3,
    maxStepIndex: 5,
  },
  torch_right_1: {
    laneId: "torch_right_1",
    type: "TORCH",
    patternGroup: 3,
    targetCorner: 0,
    maxSimultaneous: 2,
    maxStepIndex: 4,
  },
};
```

You will replace these with your actual geometry.

---

# 15. Practical implementation notes

## Good defaults

Start with these assumptions:

* `patternIndex = 0` on new game
* rotate `patternIndex` on each miss
* Chance Time duration = **40 s**
* runner lane capacity = **3**
* torch lane capacity = **2**
* one threat moved per micro-step
* deterministic spawn cycle with empty slots

## Things to tune by feel

These are the knobs you’ll probably adjust most:

* `spawnCycle`
* lane capacities
* `maxStepIndex` per lane
* speed tables
* miss recovery duration
* fairness rule strictness

---

# 16. Most likely “why it feels authentic”

This design reproduces the main behaviors your recordings exposed:

* **not all enemies move together**
* **same pattern can emit two sounds in close succession**
* **multiple runners can stack in one direction**
* **Game A behaves like 3 active vector groups out of 4**
* **misses cause a temporary interruption and pattern shift**
* **200 and 500 checkpoints trigger bonus logic**

---
