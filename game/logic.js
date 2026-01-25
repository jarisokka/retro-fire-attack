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
  missAnimationTriggered: false,  // Flag to trigger miss animation
  torchMissAnimationTriggered: false,  // Flag to trigger torch miss animation
  lastMissPosition: null,  // Track where miss occurred

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

// Timing constants
const DIFFICULTY = {
  A: {
    initialTorchInterval: 180,  // Start slower (easier)
    minTorchInterval: 60,        // Minimum interval (fastest)
    torchStageTime: 50,          // Time per stage
    initialRunnerInterval: 200,  // Runner spawn interval
    minRunnerInterval: 80,
    runnerStageTime: 45,         // Time per runner stage
    fallTime: 30                 // Fall animation duration
  },
  B: {
    initialTorchInterval: 140,
    minTorchInterval: 45,
    torchStageTime: 35,
    initialRunnerInterval: 160,
    minRunnerInterval: 60,
    runnerStageTime: 32,
    fallTime: 25
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
  GameState.activeLanes = ['BL'];  // Start with bottom-left runner for testing

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

    // Handle falling animation for runners
    if (lane.type === "runner" && lane.falling) {
      if (lane.timer > mode.fallTime) {
        lane.stage = 0;
        lane.timer = 0;
        lane.falling = false;
      }
      return;
    }

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

    // Advance stages based on type
    if (lane.type === "torch") {
      // Torch: 5 stages
      if (lane.timer > mode.torchStageTime) {
        lane.stage++;
        lane.timer = 0;

        if (lane.stage > 5) {
          registerMiss(laneKey);
          lane.stage = 0;
        }
      }
    } else if (lane.type === "runner") {
      // Runner: 6 stages (stage 5 and 6 are hittable, stage 7 causes miss)
      if (lane.timer > mode.runnerStageTime) {
        lane.stage++;
        lane.timer = 0;

        if (lane.stage > 6) {
          registerMiss(laneKey);
          lane.stage = 0;
        }
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

  if (!lane) return false;

  // Runner: Allow hitting at stage 5 or 6 (climbing stages)
  if (lane.type === "runner" && (lane.stage === 5 || lane.stage === 6)) {
    // Trigger fall animation
    lane.falling = true;
    lane.stage = 7; // Fall stage
    lane.timer = 0;
    GameState.score += 2;
    GameState.totalHits++;
    
    // Unlock BR after first runner hit
    if (GameState.totalHits === 1 && GameState.activeLanes.length === 1) {
      GameState.activeLanes = ['BL', 'BR'];
    }
    
    // Unlock torches after 5 runner hits
    if (GameState.totalHits === 5 && GameState.activeLanes.length === 2) {
      GameState.activeLanes = ['BL', 'BR', 'TL'];
    }
    
    checkBonus();
    return true; // hit
  }

  // Torch: Only allow hitting at stage 5
  if (lane.type === "torch" && lane.stage === 5) {
    lane.stage = 0;
    lane.timer = 0;
    GameState.score += 2;
    GameState.totalHits++;
    
    // Unlock TR after first torch hit
    if (GameState.activeLanes.length === 3 && !GameState.activeLanes.includes('TR')) {
      GameState.activeLanes = ['BL', 'BR', 'TL', 'TR'];
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
function registerMiss(laneKey) {
  console.log('Register miss called for lane:', laneKey);
  GameState.misses++;

  // Trigger runner miss animation for BL and BR lanes
  if (laneKey === 'BL' || laneKey === 'BR') {
    console.log('Setting missAnimationTriggered for runner miss');
    GameState.lastMissPosition = laneKey;
    GameState.missAnimationTriggered = true;
  }
  
  // Trigger torch miss animation for TL and TR lanes
  if (laneKey === 'TL' || laneKey === 'TR') {
    console.log('Setting torchMissAnimationTriggered for torch miss');
    GameState.lastMissPosition = laneKey;
    GameState.torchMissAnimationTriggered = true;
  }

  if (GameState.misses >= 3) {
    GameState.gameOver = true;
    Sound.gameOver();
    // Transition to GAMEOVER scene after a delay to let animation finish
    // All miss animations are 5 seconds
    setTimeout(() => {
      GameState.scene = 'GAMEOVER';
    }, 5000);
  }
}

