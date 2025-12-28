// render/scoreDisplay.js

const SEGMENTS = {
  0: ["A", "B", "C", "D", "E", "F"],
  1: ["B", "C"],
  2: ["A", "B", "G", "E", "D"],
  3: ["A", "B", "G", "C", "D"],
  4: ["F", "G", "B", "C"],
  5: ["A", "F", "G", "C", "D"],
  6: ["A", "F", "E", "D", "C", "G"],
  7: ["A", "B", "C"],
  8: ["A", "B", "C", "D", "E", "F", "G"],
  9: ["A", "B", "C", "D", "F", "G"]
};

export function drawScore(ctx, score) {
  const padded = Math.min(score, 999)
    .toString()
    .padStart(3, "0");

  for (let i = 0; i < 3; i++) {
    drawDigit(ctx, padded[i], 220 + i * 28, 22);
  }
}

function drawDigit(ctx, digit, x, y) {
  const active = SEGMENTS[digit];

  drawSegment(ctx, x + 6, y, 14, 3, active.includes("A")); // A
  drawSegment(ctx, x + 20, y + 4, 3, 14, active.includes("B")); // B
  drawSegment(ctx, x + 20, y + 22, 3, 14, active.includes("C")); // C
  drawSegment(ctx, x + 6, y + 38, 14, 3, active.includes("D")); // D
  drawSegment(ctx, x, y + 22, 3, 14, active.includes("E")); // E
  drawSegment(ctx, x, y + 4, 3, 14, active.includes("F")); // F
  drawSegment(ctx, x + 6, y + 19, 14, 3, active.includes("G")); // G
}

function drawSegment(ctx, x, y, w, h, on) {
  ctx.fillStyle = on ? "#222" : "rgba(0,0,0,0.08)";
  ctx.fillRect(x, y, w, h);
}
