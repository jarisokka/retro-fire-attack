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
    // Load both SVG files
    const [readyResponse, hitResponse] = await Promise.all([
      fetch('assets/sprites/cowboy-ready.svg'),
      fetch('assets/sprites/cowboy-hit.svg')
    ]);

    const readyText = await readyResponse.text();
    const hitText = await hitResponse.text();

    // Parse SVG content
    const parser = new DOMParser();
    const readyDoc = parser.parseFromString(readyText, 'image/svg+xml');
    const hitDoc = parser.parseFromString(hitText, 'image/svg+xml');

    // Extract path content from each sprite group
    const readyGroups = readyDoc.querySelectorAll('g[*|label]');
    const hitGroups = hitDoc.querySelectorAll('g[*|label]');

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
  // Hide all torches
  for (let stage = 1; stage <= 3; stage++) {
    setSVGVisibility(`torch_TL_${stage}`, false);
    setSVGVisibility(`torch_TR_${stage}`, false);
  }

  // Hide all climbers
  for (let stage = 1; stage <= 3; stage++) {
    setSVGVisibility(`climber_BL_${stage}`, false);
    setSVGVisibility(`climber_BR_${stage}`, false);
  }

  // Hide all players (both ready and hitting states)
  ['TL', 'TR', 'BL', 'BR'].forEach(pos => {
    setSVGVisibility(`player_${pos}`, false);
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
 * Draw a torch at specified position and stage
 */
export function drawTorch(pos, stage) {
  // Hide all stages for this position first
  for (let s = 1; s <= 3; s++) {
    setSVGVisibility(`torch_${pos}_${s}`, false);
  }

  // Show the current stage if > 0
  if (stage > 0 && stage <= 3) {
    setSVGVisibility(`torch_${pos}_${stage}`, true);
  }

  updateAttackFlash();
}

/**
 * Draw a climber at specified position and stage
 */
export function drawClimber(pos, stage) {
  // Hide all stages for this position first
  for (let s = 1; s <= 3; s++) {
    setSVGVisibility(`climber_${pos}_${s}`, false);
  }

  // Show the current stage if > 0
  if (stage > 0 && stage <= 3) {
    setSVGVisibility(`climber_${pos}_${stage}`, true);
  }

  updateAttackFlash();
}

/**
 * Draw fire indicators based on number of misses
 */
export function drawFires(misses) {
  for (let i = 1; i <= 3; i++) {
    setSVGVisibility(`fire_${i}`, i <= misses);
  }
}

/**
 * Draw game over screen
 */
export function drawGameOver() {
  setSVGVisibility('gameOverScreen', true);
}

/**
 * Draw score
 */
export function drawScore(score) {
  setSVGText('scoreText', score.toString());
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
    
    // Draw climbers
    drawClimber('BL', gameState.lanes.BL.stage);
    drawClimber('BR', gameState.lanes.BR.stage);
    
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
