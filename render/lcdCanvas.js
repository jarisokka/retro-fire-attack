let ctx;
let attackFlashTimer = 0;


export function initLCD(context) {
  ctx = context;
  ctx.imageSmoothingEnabled = false;
}

export function drawTitleScreen(mode) {
  ctx.fillStyle = "#222";
  ctx.font = "16px monospace";
  ctx.fillText("FIRE ATTACK", 90, 80);

  ctx.font = "14px monospace";
  ctx.fillText("GAME A", 120, 120);
  ctx.fillText("GAME B", 120, 145);

  ctx.fillRect(
    100,
    mode === "A" ? 112 : 137,
    10,
    10
  );
}


export function drawStaticLayout(playerPosition) {
  clearLCD();

  drawFort();
  drawLadders();
  drawPlayer(playerPosition);
  drawScoreArea();
}

export function triggerAttack() {
  attackFlashTimer = 6; // frames the attack is visible
}

export function drawTorch(pos, stage) {
  if (stage === 0) return;

  ctx.fillStyle = "#000";

  const positions = {
    TL: [
      { x: 70, y: 30 },
      { x: 90, y: 60 },
      { x: 115, y: 85 }
    ],
    TR: [
      { x: 240, y: 30 },
      { x: 220, y: 60 },
      { x: 195, y: 85 }
    ]
  };

  const p = positions[pos][stage - 1];
  ctx.fillRect(p.x, p.y, 8, 12);
}

export function drawClimber(pos, stage) {
  if (stage === 0) return;

  ctx.fillStyle = "#000";

  const positions = {
    BL: [
      { x: 80, y: 190 },
      { x: 95, y: 165 },
      { x: 115, y: 140 }
    ],
    BR: [
      { x: 230, y: 190 },
      { x: 215, y: 165 },
      { x: 195, y: 140 }
    ]
  };

  const p = positions[pos][stage - 1];
  ctx.fillRect(p.x, p.y, 10, 12);
}


function clearLCD() {
  ctx.clearRect(0, 0, 320, 240);
}

export function drawFires(count) {
  ctx.fillStyle = "#000";

  for (let i = 0; i < count; i++) {
    ctx.fillRect(135 + i * 15, 95, 8, 8);
  }
}

export function drawGameOver() {
  ctx.fillStyle = "#000";
  ctx.fillText("GAME OVER", 115, 130);
}


/* =========================
   STATIC ELEMENTS
   ========================= */

function drawFort() {
  ctx.fillStyle = "#333";

  // Main fort block
  ctx.fillRect(130, 90, 60, 60);

  // Roof
  ctx.fillRect(120, 80, 80, 10);
}

function drawLadders() {
  ctx.fillStyle = "#555";

  // Top left ladder
  ctx.fillRect(80, 40, 10, 50);

  // Top right ladder
  ctx.fillRect(230, 40, 10, 50);

  // Bottom left ladder
  ctx.fillRect(80, 150, 10, 50);

  // Bottom right ladder
  ctx.fillRect(230, 150, 10, 50);
}

function drawPlayer(playerPosition) {
  const positions = {
    TL: { x: 100, y: 70 },
    TR: { x: 210, y: 70 },
    BL: { x: 100, y: 160 },
    BR: { x: 210, y: 160 }
  };

  const p = positions[playerPosition];

  // Player body
  ctx.fillStyle = "#111";
  ctx.fillRect(p.x, p.y, 10, 10);

  // Attack flash (hammer)
  if (attackFlashTimer > 0) {
    ctx.fillStyle = "#000";
    ctx.fillRect(p.x - 5, p.y - 5, 20, 20);
    attackFlashTimer--;
  }
}

function drawScoreArea() {
  ctx.fillStyle = "#222";
  ctx.fillText("SCORE", 10, 20);
  ctx.fillText("0000", 10, 35);
}
