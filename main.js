// Import SVG renderer instead of canvas renderer
import {
  initSVG,
  drawStaticLayout,
  triggerAttack,
  drawTorch,
  drawRunner,
  drawFires,
  drawGameOver,
  drawTitleScreen,
  drawScore,
  startRunnerMissAnimation,
  isMissAnimationActive,
  startTorchMissAnimation,
  isTorchMissAnimationActive,
  render
} from "./render/svgRenderer.js";

import {
  GameState,
  updateGame,
  movePlayer,
  attack,
  startGame,
  returnToTitle,
  setGameMode
} from "./game/logic.js";

import { Sound, unlockAudio } from "./audio/sound.js";

// Initialize SVG renderer (async)
let gameReady = false;
initSVG().then(() => {
  gameReady = true;
  console.log('Game ready');
});

// --------------------
// GAME LOOP
// --------------------
setInterval(() => {
  // Don't update game logic during miss animations
  if (!isMissAnimationActive() && !isTorchMissAnimationActive()) {
    updateGame();
    
    // Check if runner miss animation should be triggered
    if (GameState.missAnimationTriggered && GameState.lastMissPosition) {
      console.log('Triggering runner miss animation for position:', GameState.lastMissPosition);
      startRunnerMissAnimation(GameState.lastMissPosition);
      GameState.missAnimationTriggered = false;
    }
    
    // Check if torch miss animation should be triggered
    if (GameState.torchMissAnimationTriggered && GameState.lastMissPosition) {
      console.log('Triggering torch miss animation for position:', GameState.lastMissPosition);
      startTorchMissAnimation(GameState.lastMissPosition);
      GameState.torchMissAnimationTriggered = false;
    }
  }
  
  // Always call render to update animations
  render(GameState);
}, 1000 / 60);

// --------------------
// DRAW (no longer used, kept for reference)
// --------------------
function draw() {
  if (GameState.scene === "TITLE") {
    drawTitleScreen(GameState.gameMode);
    return;
  }

  if (GameState.scene === "PLAYING") {
    drawScore(GameState.score);
    drawStaticLayout(GameState.currentPosition);

    drawTorch("TL", GameState.lanes.TL.stage);
    drawTorch("TR", GameState.lanes.TR.stage);

    drawRunner("BL", GameState.lanes.BL.stage, GameState.lanes.BL.falling);
    drawRunner("BR", GameState.lanes.BR.stage, GameState.lanes.BR.falling);

    drawFires(GameState.misses);
  }


  if (GameState.gameOver) {
    drawGameOver();
  }
}

// --------------------
// INPUT
// --------------------
window.addEventListener("keydown", (e) => {
  unlockAudio();

  // --------------------
  // TITLE SCREEN INPUT
  // --------------------
  if (GameState.scene === "TITLE") {
    if (e.key === "1") setGameMode("A");
    if (e.key === "2") setGameMode("B");

    if (e.key === "Enter") {
      startGame(GameState.gameMode);
    }
    return;
  }

  // --------------------
  // GAME OVER INPUT
  // --------------------
  if (GameState.scene === "GAMEOVER") {
    if (e.key === "Enter") {
      returnToTitle();
    }
    return;
  }

  // --------------------
  // PLAYING INPUT
  // --------------------
  const keyMap = {
    q: "TL",
    e: "TR",
    a: "BL",
    d: "BR"
  };

  const pos = keyMap[e.key.toLowerCase()];
  if (!pos) return;

  if (pos === GameState.currentPosition) {
    const hit = attack();
    // Determine the target type (torch for TL/TR, runner for BL/BR)
    const targetType = (pos === 'TL' || pos === 'TR') ? 'torch' : 'runner';
    triggerAttack(pos, hit, targetType);
    if (hit) Sound.hit();
  } else {
    movePlayer(pos);
  }
});

