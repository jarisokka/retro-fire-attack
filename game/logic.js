// game/logic.js
import { Sound } from "../audio/sound.js";

export const GameState = {
  scene: "TITLE", // TITLE | PLAYING | GAMEOVER
  gameMode: "A", // "A" or "B"
  currentPosition: "TL",
  score: 0,
  misses: 0,
  gameOver: false,

  bonus: {
    200: false,
    500: false
  },


  lanes: {
    TL: { type: "torch", stage: 0, timer: 0 },
    TR: { type: "torch", stage: 0, timer: 0 },
    BL: { type: "climber", stage: 0, timer: 0 },
    BR: { type: "climber", stage: 0, timer: 0 }
  }
};

// Timing constants
const DIFFICULTY = {
  A: {
    torchInterval: 100,
    torchStageTime: 34,
    climberInterval: 160,
    climberStageTime: 46
  },
  B: {
    torchInterval: 70,
    torchStageTime: 24,
    climberInterval: 110,
    climberStageTime: 32
  }
};

export function startGame(mode) {
  GameState.gameMode = mode;
  GameState.scene = "PLAYING";
  GameState.score = 0;
  GameState.misses = 0;
  GameState.gameOver = false;

  Object.values(GameState.lanes).forEach(l => {
    l.stage = 0;
    l.timer = 0;
  });

  GameState.bonus[200] = false;
  GameState.bonus[500] = false;
}

export function returnToTitle() {
  GameState.scene = "TITLE";
}

// --------------------
// UPDATE
// --------------------
export function updateGame() {
  if (GameState.gameOver) return;

  Object.values(GameState.lanes).forEach((lane) => {
    lane.timer++;

    const mode = DIFFICULTY[GameState.gameMode];

    // Spawn
    if (lane.stage === 0) {
        const interval =
            lane.type === "torch"
                ? mode.torchInterval
                : mode.climberInterval;


      if (lane.timer > interval && Math.random() < 0.5) {
        lane.stage = 1;
        lane.timer = 0;
      }
      return;
    }

    // Advance
    const stageTime =
        lane.type === "torch"
            ? mode.torchStageTime
            : mode.climberStageTime;

    if (lane.timer > stageTime) {
      lane.stage++;
      lane.timer = 0;

      if (lane.stage > 3) {
        registerMiss();
        lane.stage = 0;
      }
    }
  });
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

  if (lane && lane.stage > 0) {
    lane.stage = 0;
    lane.timer = 0;
    GameState.score += 2;
    checkBonus();
    return true; // hit
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
        GameState.misses--;
      }
    }
  });
}


// --------------------
// MISS / GAME OVER
// --------------------
function registerMiss() {
  GameState.misses++;

  if (GameState.misses >= 3) {
    GameState.gameOver = true;
    Sound.gameOver();
  }
}

