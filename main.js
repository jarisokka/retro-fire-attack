// Import SVG renderer instead of canvas renderer
import {
  initSVG,
  drawStaticLayout,
  triggerAttack,
  drawTorch,
  drawClimber,
  drawFires,
  drawGameOver,
  drawTitleScreen,
  drawScore
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

// Initialize SVG renderer
initSVG();

// --------------------
// GAME LOOP
// --------------------
setInterval(() => {
  updateGame();
  draw();
}, 1000 / 60);

// --------------------
// DRAW
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

    drawClimber("BL", GameState.lanes.BL.stage);
    drawClimber("BR", GameState.lanes.BR.stage);

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
    triggerAttack(pos);
    const hit = attack();
    hit ? Sound.hit() : Sound.miss();
  } else {
    movePlayer(pos);
    Sound.move();
  }
});

