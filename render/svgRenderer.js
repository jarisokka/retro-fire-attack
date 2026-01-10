// SVG-based LCD Renderer for Fire Attack
// Toggles visibility of SVG elements instead of drawing on canvas

let attackFlashTimer = 0;
let attackAnimationTimer = 0;
let currentAttackPosition = null;

/**
 * Load external SVG sprites and inject into DOM
 */
async function loadSprites() {
  try {
    // Load all SVG files
    const [readyResponse, hitResponse, torchResponse, runnerResponse, livesResponse] = await Promise.all([
      fetch('assets/sprites/cowboy-ready.svg'),
      fetch('assets/sprites/cowboy-hit.svg'),
      fetch('assets/sprites/torch_attack.svg'),
      fetch('assets/sprites/runner_attack.svg'),
      fetch('assets/sprites/lives.svg')
    ]);

    const readyText = await readyResponse.text();
    const hitText = await hitResponse.text();
    const torchText = await torchResponse.text();
    const runnerText = await runnerResponse.text();
    const livesText = await livesResponse.text();

    // Parse SVG content
    const parser = new DOMParser();
    const readyDoc = parser.parseFromString(readyText, 'image/svg+xml');
    const hitDoc = parser.parseFromString(hitText, 'image/svg+xml');
    const torchDoc = parser.parseFromString(torchText, 'image/svg+xml');
    const runnerDoc = parser.parseFromString(runnerText, 'image/svg+xml');
    const livesDoc = parser.parseFromString(livesText, 'image/svg+xml');

    // Extract path content from each sprite group
    const readyGroups = readyDoc.querySelectorAll('g[*|label]');
    const hitGroups = hitDoc.querySelectorAll('g[*|label]');
    const torchGroups = torchDoc.querySelectorAll('g[*|label]');
    const runnerGroups = runnerDoc.querySelectorAll('g[*|label]');
    const livesGroups = livesDoc.querySelectorAll('g[*|label]');

    // Map labels to position codes
    const labelMap = {
      'player_TL_ready': 'TL', 'player_TR_ready': 'TR',
      'player_BL_ready': 'BL', 'player_BR_ready': 'BR',
      'player_TL_hit': 'TL', 'player_TR_hit': 'TR',
      'player_BL_hit': 'BL', 'player_BR_hit': 'BR'
    };

    // Inject ready sprites
    readyGroups.forEach(group => {
      const label = group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label');
      const targetId = label;
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        // Clone the path content
        const paths = group.querySelectorAll('path');
        paths.forEach(path => {
          targetElement.appendChild(path.cloneNode(true));
        });
      }
    });

    // Inject hit sprites
    hitGroups.forEach(group => {
      const label = group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label');
      const targetId = label;
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        // Clone the path content
        const paths = group.querySelectorAll('path');
        paths.forEach(path => {
          targetElement.appendChild(path.cloneNode(true));
        });
      }
    });

    // Inject torch attack sprites
    torchGroups.forEach(group => {
      const label = group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label');
      const targetId = label;
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        // Clone the path content
        const paths = group.querySelectorAll('path');
        paths.forEach(path => {
          targetElement.appendChild(path.cloneNode(true));
        });
      }
    });

    // Inject runner attack sprites
    runnerGroups.forEach(group => {
      const label = group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label');
      const targetId = label;
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        // Clone the path content
        const paths = group.querySelectorAll('path');
        paths.forEach(path => {
          targetElement.appendChild(path.cloneNode(true));
        });
      }
    });

    // Inject burn/lives indicators
    livesGroups.forEach(group => {
      const label = group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label');
      const targetId = label;
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        // Clone the path content
        const paths = group.querySelectorAll('path');
        paths.forEach(path => {
          targetElement.appendChild(path.cloneNode(true));
        });
      }
    });

    console.log('Sprites loaded successfully');
    return true;
  } catch (error) {
    console.error('Failed to load sprites:', error);
    return false;
  }
}

/**
 * Initialize the SVG renderer
 */
export async function initSVG() {
  // Load sprites first
  await loadSprites();
  
  // SVG elements are already in the DOM, just verify they exist
  const svg = document.getElementById('lcdSVG');
  if (!svg) {
    console.error('SVG element not found!');
  } else {
    console.log('SVG renderer initialized successfully');
  }
}

/**
 * Helper function to toggle SVG element visibility
 */
function setSVGVisibility(id, visible) {
  const el = document.getElementById(id);
  if (el) {
    el.setAttribute('visibility', visible ? 'visible' : 'hidden');
  }
}

/**
 * Helper function to set text content
 */
function setSVGText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}

/**
 * Clear all dynamic elements (hide everything except background)
 */
function clearDynamicElements() {
  // Hide all torch attack sprites (body + hands + torches)
  ['left', 'right'].forEach(side => {
    setSVGVisibility(`throw_${side}_body`, false);
    setSVGVisibility(`throw_${side}_hand_1`, false);
    setSVGVisibility(`throw_${side}_hand_2`, false);
    setSVGVisibility(`torch_${side}_1`, false);
    setSVGVisibility(`torch_${side}_2`, false);
    setSVGVisibility(`torch_${side}_3`, false);
  });

  // Hide all runner attack sprites
  ['left', 'right'].forEach(side => {
    setSVGVisibility(`runner_${side}_1`, false);
    setSVGVisibility(`runner_${side}_2`, false);
    setSVGVisibility(`runner_${side}_3`, false);
    setSVGVisibility(`runner_${side}_4`, false);
    setSVGVisibility(`climb_${side}_torso`, false);
    setSVGVisibility(`climb_${side}_hand_1`, false);
    setSVGVisibility(`climb_${side}_hand_2`, false);
    setSVGVisibility(`runner_${side}_fall`, false);
  });

  // Hide all players (both ready and hitting states)
  ['TL', 'TR', 'BL', 'BR'].forEach(pos => {
    setSVGVisibility(`player_${pos}_ready`, false);
    setSVGVisibility(`player_${pos}_hit`, false);
  });

  // Hide fires
  for (let i = 1; i <= 3; i++) {
    setSVGVisibility(`fire_${i}`, false);
  }

  // Hide attack flash
  setSVGVisibility('attackFlash', false);
}

/**
 * Draw the title screen
 */
export function drawTitleScreen(mode) {
  clearDynamicElements();
  setSVGVisibility('titleScreen', true);
  setSVGVisibility('gameOverScreen', false);

  // Move selector based on mode
  const selector = document.getElementById('gameModeSelector');
  if (selector) {
    selector.setAttribute('y', mode === 'A' ? '107' : '137');
  }
}

/**
 * Draw static layout with player position
 */
export function drawStaticLayout(playerPosition) {
  clearDynamicElements();
  setSVGVisibility('titleScreen', false);
  setSVGVisibility('gameOverScreen', false);

  // Show the player at current position
  drawPlayer(playerPosition);
}

/**
 * Draw player at specific position
 */
function drawPlayer(position) {
  // Hide all player states (both ready and hitting)
  ['TL', 'TR', 'BL', 'BR'].forEach(pos => {
    setSVGVisibility(`player_${pos}_ready`, false);
    setSVGVisibility(`player_${pos}_hit`, false);
  });

  // Show hitting animation if active, otherwise show ready state
  if (attackAnimationTimer > 0 && currentAttackPosition === position) {
    setSVGVisibility(`player_${position}_hit`, true);
  } else {
    setSVGVisibility(`player_${position}_ready`, true);
  }
}

/**
 * Trigger attack flash effect and hitting animation
 */
export function triggerAttack(position) {
  attackFlashTimer = 6; // frames
  attackAnimationTimer = 18; // frames for hitting animation (about 300ms at 60fps) - slower
  currentAttackPosition = position;
  
  const flash = document.getElementById('attackFlash');
  if (flash) {
    flash.setAttribute('r', '30');
    setSVGVisibility('attackFlash', true);
  }
}

/**
 * Update attack flash animation and hitting animation
 */
function updateAttackFlash() {
  if (attackFlashTimer > 0) {
    attackFlashTimer--;
    const flash = document.getElementById('attackFlash');
    if (flash) {
      const radius = (attackFlashTimer / 6) * 30;
      flash.setAttribute('r', radius.toString());
    }
    if (attackFlashTimer === 0) {
      setSVGVisibility('attackFlash', false);
    }
  }

  // Update hitting animation timer
  if (attackAnimationTimer > 0) {
    attackAnimationTimer--;
    if (attackAnimationTimer === 0) {
      currentAttackPosition = null;
    }
  }
}

/**
 * Draw a torch attack at specified position and stage
 * Stage 1: body + hand_1
 * Stage 2: body + hand_2
 * Stage 3: torch_1
 * Stage 4: torch_2
 * Stage 5: torch_3 (hittable)
 */
export function drawTorch(pos, stage) {
  // Determine side (TL uses left, TR uses right)
  const side = pos === 'TL' ? 'left' : 'right';
  
  // Hide all torch attack sprites for this side first
  setSVGVisibility(`throw_${side}_body`, false);
  setSVGVisibility(`throw_${side}_hand_1`, false);
  setSVGVisibility(`throw_${side}_hand_2`, false);
  setSVGVisibility(`torch_${side}_1`, false);
  setSVGVisibility(`torch_${side}_2`, false);
  setSVGVisibility(`torch_${side}_3`, false);

  // Show the appropriate sprites based on stage
  if (stage === 1) {
    setSVGVisibility(`throw_${side}_body`, true);
    setSVGVisibility(`throw_${side}_hand_1`, true);
  } else if (stage === 2) {
    setSVGVisibility(`throw_${side}_body`, true);
    setSVGVisibility(`throw_${side}_hand_2`, true);
  } else if (stage === 3) {
    setSVGVisibility(`torch_${side}_1`, true);
  } else if (stage === 4) {
    setSVGVisibility(`torch_${side}_2`, true);
  } else if (stage === 5) {
    setSVGVisibility(`torch_${side}_3`, true);
  }

  updateAttackFlash();
}

/**
 * Draw a runner attack at specified position and stage
 * Stage 1-4: running animations
 * Stage 5: climbing (torso + hand_1) - hittable
 * Stage 6: climbing (torso + hand_2) - hittable, causes miss if not hit
 * Stage 7: fall animation
 */
export function drawRunner(pos, stage, falling) {
  // Determine side (BL uses left, BR uses right)
  const side = pos === 'BL' ? 'left' : 'right';
  
  // Hide all runner attack sprites for this side first
  setSVGVisibility(`runner_${side}_1`, false);
  setSVGVisibility(`runner_${side}_2`, false);
  setSVGVisibility(`runner_${side}_3`, false);
  setSVGVisibility(`runner_${side}_4`, false);
  setSVGVisibility(`climb_${side}_torso`, false);
  setSVGVisibility(`climb_${side}_hand_1`, false);
  setSVGVisibility(`climb_${side}_hand_2`, false);
  setSVGVisibility(`runner_${side}_fall`, false);

  // Show fall animation if falling
  if (falling) {
    setSVGVisibility(`runner_${side}_fall`, true);
    updateAttackFlash();
    return;
  }

  // Show the appropriate sprites based on stage
  if (stage === 1) {
    setSVGVisibility(`runner_${side}_1`, true);
  } else if (stage === 2) {
    setSVGVisibility(`runner_${side}_2`, true);
  } else if (stage === 3) {
    setSVGVisibility(`runner_${side}_3`, true);
  } else if (stage === 4) {
    setSVGVisibility(`runner_${side}_4`, true);
  } else if (stage === 5) {
    setSVGVisibility(`climb_${side}_torso`, true);
    setSVGVisibility(`climb_${side}_hand_1`, true);
  } else if (stage === 6) {
    setSVGVisibility(`climb_${side}_torso`, true);
    setSVGVisibility(`climb_${side}_hand_2`, true);
  }

  updateAttackFlash();
}

/**
 * Draw burn indicators based on number of misses
 */
export function drawFires(misses) {
  const burnIds = ['burn1', 'burn2', 'burn3'];
  burnIds.forEach((id, index) => {
    setSVGVisibility(id, index < misses);
  });
}

/**
 * Draw game over screen
 */
export function drawGameOver() {
  setSVGVisibility('gameOverScreen', true);
}

/**
 * Draw score using 7-segment display
 */
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

export function drawScore(score) {
  const padded = Math.min(score, 999).toString().padStart(3, "0");
  
  for (let i = 0; i < 3; i++) {
    const digitGroup = document.getElementById(`digit-${i}`);
    
    // Hide digits that aren't needed yet
    if ((i === 0 && score < 100) || (i === 1 && score < 10)) {
      if (digitGroup) {
        digitGroup.setAttribute('visibility', 'hidden');
      }
      continue;
    }
    
    // Show the digit group
    if (digitGroup) {
      digitGroup.setAttribute('visibility', 'visible');
    }
    
    const digit = parseInt(padded[i]);
    const activeSegments = SEGMENTS[digit];
    
    // Update each segment (A-G) for this digit
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(segment => {
      const segmentId = `digit-${i}-${segment}`;
      const element = document.getElementById(segmentId);
      if (element) {
        element.setAttribute('visibility', activeSegments.includes(segment) ? 'visible' : 'hidden');
      }
    });
  }
}

/**
 * Main render function - call this every frame
 */
export function render(gameState) {
  if (gameState.scene === 'TITLE') {
    drawTitleScreen(gameState.gameMode);
    return;
  }

  if (gameState.scene === 'PLAYING') {
    drawStaticLayout(gameState.currentPosition);
    
    // Draw torches
    drawTorch('TL', gameState.lanes.TL.stage);
    drawTorch('TR', gameState.lanes.TR.stage);
    
    // Draw fires
    drawFires(gameState.misses);
    
    // Draw score
    drawScore(gameState.score);
    
    // Check for game over
    if (gameState.gameOver) {
      drawGameOver();
    }
  }

  updateAttackFlash();
}
