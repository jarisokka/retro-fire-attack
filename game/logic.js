// game/logic.js
import { Sound } from "../audio/sound.js";

export const GameState = {
  scene: "TITLE", // TITLE | PLAYING | GAMEOVER
  gameMode: "A", // "A" or "B"
  currentPosition: "TL",
  score: 0,
  misses: 0,
  gameOver: false,
  totalHits: 0,  // Track total successful hits for progression
  activeLanes: ['TL'],  // Start with only one lane active

  bonus: {
    200: false,
    500: false
  },


  lanes: {
    TL: { type: "torch", stage: 0, timer: 0 },
    TR: { type: "torch", stage: 0, timer: 0 }
  }
};

// Timing constants
const DIFFICULTY = {
  A: {
    initialTorchInterval: 180,  // Start slower (easier)
    minTorchInterval: 60,        // Minimum interval (fastest)
    torchStageTime: 50           // Time per stage
  },
  B: {
    initialTorchInterval: 140,
    minTorchInterval: 45,
    torchStageTime: 35
  }
};

// Calculate current difficulty based on score
function getCurrentInterval(mode) {
  const config = DIFFICULTY[mode];
  const hits = GameState.totalHits;
  
  // Gradually decrease interval every 5 hits
  const reduction = Math.floor(hits / 5) * 10;
  const currentInterval = Math.max(
    config.minTorchInterval,
    config.initialTorchInterval - reduction
  );
  
  return currentInterval;
}

export function startGame(mode) {
  GameState.gameMode = mode;
  GameState.scene = "PLAYING";
  GameState.score = 0;
  GameState.misses = 0;
  GameState.gameOver = false;
  GameState.totalHits = 0;
  GameState.activeLanes = ['TL'];  // Start with only left side active

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

  Object.keys(GameState.lanes).forEach((laneKey) => {
    const lane = GameState.lanes[laneKey];
    lane.timer++;

    const mode = DIFFICULTY[GameState.gameMode];

    // Spawn - only in active lanes
    if (lane.stage === 0) {
      // Check if this lane is active
      if (!GameState.activeLanes.includes(laneKey)) {
        return;  // Skip inactive lanes
      }
      
      const currentInterval = getCurrentInterval(GameState.gameMode);
      if (lane.timer > currentInterval && Math.random() < 0.5) {
        lane.stage = 1;
        lane.timer = 0;
      }
      return;
    }

    // Advance (5 stages for torch animation)
    if (lane.timer > mode.torchStageTime) {
      lane.stage++;
      lane.timer = 0;

      if (lane.stage > 5) {
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

  // Only allow hitting at stage 5 (the final torch position)
  if (lane && lane.stage === 5) {
    lane.stage = 0;
    lane.timer = 0;
    GameState.score += 2;
    GameState.totalHits++;
    
    // Unlock second lane after first hit
    if (GameState.totalHits === 1 && GameState.activeLanes.length === 1) {
      GameState.activeLanes = ['TL', 'TR'];
    }
    
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

