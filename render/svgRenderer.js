// SVG-based LCD Renderer for Fire Attack
// Toggles visibility of SVG elements instead of drawing on canvas

import { Sound } from '../audio/sound.js';

let attackFlashTimer = 0;
let attackAnimationTimer = 0;
let currentAttackPosition = null;
let hitAnimationTimer = 0;
let currentHitPosition = null;

// Track previous stages to detect transitions
const previousStages = {
  TL: 0,
  TR: 0,
  BL: 0,
  BR: 0
};

// Smoke animation state
const smokeAnimations = {
  TL: { active: false, frame: 0, timer: 0 },
  TR: { active: false, frame: 0, timer: 0 }
};

// Miss animation state (runner)
let missAnimationActive = false;
let missAnimationTimer = 0;
let missAnimationPosition = null; // Store where the miss occurred

// Torch miss animation state
let torchMissAnimationActive = false;
let torchMissAnimationTimer = 0;
let torchMissAnimationPosition = null; // TL or TR

// Top fire animation state
let topFireActive = false;
let topFireTimer = 0;
let topFireCycle = 0; // Track animation cycle

/**
 * Load external SVG sprites and inject into DOM
 */
async function loadSprites() {
  try {
    // Load all SVG files
    const [readyResponse, hitResponse, torchResponse, runnerResponse, livesResponse, hitAnimationResponse, smokeAnimationResponse, fireActionsResponse] = await Promise.all([
      fetch('assets/sprites/cowboy-ready.svg'),
      fetch('assets/sprites/cowboy-hit.svg'),
      fetch('assets/sprites/torch_attack.svg'),
      fetch('assets/sprites/runner_attack.svg'),
      fetch('assets/sprites/lives.svg'),
      fetch('assets/sprites/hit-animation.svg'),
      fetch('assets/sprites/smoke-animation.svg'),
      fetch('assets/sprites/fire-actions.svg')
    ]);

    const readyText = await readyResponse.text();
    const hitText = await hitResponse.text();
    const torchText = await torchResponse.text();
    const runnerText = await runnerResponse.text();
    const livesText = await livesResponse.text();
    const hitAnimationText = await hitAnimationResponse.text();
    const smokeAnimationText = await smokeAnimationResponse.text();
    const fireActionsText = await fireActionsResponse.text();

    // Parse SVG content
    const parser = new DOMParser();
    const readyDoc = parser.parseFromString(readyText, 'image/svg+xml');
    const hitDoc = parser.parseFromString(hitText, 'image/svg+xml');
    const torchDoc = parser.parseFromString(torchText, 'image/svg+xml');
    const runnerDoc = parser.parseFromString(runnerText, 'image/svg+xml');
    const livesDoc = parser.parseFromString(livesText, 'image/svg+xml');
    const hitAnimationDoc = parser.parseFromString(hitAnimationText, 'image/svg+xml');
    const smokeAnimationDoc = parser.parseFromString(smokeAnimationText, 'image/svg+xml');
    const fireActionsDoc = parser.parseFromString(fireActionsText, 'image/svg+xml');

    // Extract path content from each sprite group
    const readyGroups = readyDoc.querySelectorAll('g[*|label]');
    const hitGroups = hitDoc.querySelectorAll('g[*|label]');
    const torchGroups = torchDoc.querySelectorAll('g[*|label]');
    const runnerGroups = runnerDoc.querySelectorAll('g[*|label]');
    const livesGroups = livesDoc.querySelectorAll('g[*|label]');
    const hitAnimationGroups = hitAnimationDoc.querySelectorAll('g[*|label]');
    const smokeAnimationGroups = smokeAnimationDoc.querySelectorAll('g[*|label]');
    const fireActionsGroups = fireActionsDoc.querySelectorAll('g[*|label]');

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

    // Inject hit animation sprites
    hitAnimationGroups.forEach(group => {
      const label = group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label');
      // The hit animation has parts: top_right, top_left, bottom_left, bottom_right
      // Map each part to its corresponding position
      const labelToPosition = {
        'top_left': 'TL',
        'top_right': 'TR',
        'bottom_left': 'BL',
        'bottom_right': 'BR'
      };
      
      const position = labelToPosition[label];
      if (position) {
        const targetId = `hit_${position}`;
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
          // Clone all paths from this specific hit animation part
          const allPaths = group.querySelectorAll('path');
          allPaths.forEach(path => {
            targetElement.appendChild(path.cloneNode(true));
          });
        }
      }
    });

    // Inject smoke animation sprites
    smokeAnimationGroups.forEach(group => {
      const label = group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label');
      // The smoke animation has: left1, left2, left3, left4, right1, right2, right3, right4
      // Inject left frames to TL position, right frames to TR position
      
      // For top-left (TL) - use left frames
      if (label && label.startsWith('left')) {
        const targetId = `smoke_TL_${label}`;
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
          const paths = group.querySelectorAll('path');
          paths.forEach(path => {
            targetElement.appendChild(path.cloneNode(true));
          });
        }
      }
      
      // For top-right (TR) - use right frames
      if (label && label.startsWith('right')) {
        const targetId = `smoke_TR_${label}`;
        const targetElement = document.getElementById(targetId);
        
        if (targetElement) {
          const paths = group.querySelectorAll('path');
          paths.forEach(path => {
            targetElement.appendChild(path.cloneNode(true));
          });
        }
      }
    });

    // Inject fire-actions sprites
    fireActionsGroups.forEach(group => {
      const label = group.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label');
      
      // Handle top_fire group (contains fire1-6 sub-groups)
      if (label === 'top_fire') {
        const subGroups = group.querySelectorAll('g[*|label]');
        subGroups.forEach(subGroup => {
          const subLabel = subGroup.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label');
          const targetElement = document.getElementById(subLabel);
          if (targetElement) {
            const paths = subGroup.querySelectorAll('path');
            paths.forEach(path => {
              targetElement.appendChild(path.cloneNode(true));
            });
          }
        });
      }
      
      // Handle roof_fire group (contains roof_fire_center, left, right as direct paths)
      if (label === 'roof_fire') {
        // Look for direct path elements with inkscape:label attributes
        const paths = group.querySelectorAll('path[*|label]');
        paths.forEach(path => {
          const pathLabel = path.getAttributeNS('http://www.inkscape.org/namespaces/inkscape', 'label');
          const targetElement = document.getElementById(pathLabel);
          if (targetElement) {
            targetElement.appendChild(path.cloneNode(true));
          }
        });
      }
      
      // Handle direct sprite elements (player_on_fire, step_on_fire)
      if (label === 'player_on_fire' || label === 'step_on_fire') {
        const targetElement = document.getElementById(label);
        if (targetElement) {
          const paths = group.querySelectorAll('path');
          paths.forEach(path => {
            targetElement.appendChild(path.cloneNode(true));
          });
        }
      }
    });

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
  }
}

/**
 * Reset all animation state — call this when starting a new game so that
 * in-progress miss/fire animations don't block the new game loop.
 */
export function resetAnimations() {
  attackFlashTimer = 0;
  attackAnimationTimer = 0;
  currentAttackPosition = null;
  hitAnimationTimer = 0;
  currentHitPosition = null;

  smokeAnimations.TL = { active: false, frame: 0, timer: 0 };
  smokeAnimations.TR = { active: false, frame: 0, timer: 0 };

  missAnimationActive = false;
  missAnimationTimer = 0;
  missAnimationPosition = null;

  torchMissAnimationActive = false;
  torchMissAnimationTimer = 0;
  torchMissAnimationPosition = null;

  topFireActive = false;
  topFireTimer = 0;
  topFireCycle = 0;

  previousStages.TL = 0;
  previousStages.TR = 0;
  previousStages.BL = 0;
  previousStages.BR = 0;

  clearDynamicElements();
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
    setSVGVisibility(`hit_${pos}`, false);
  });

  // Hide all smoke animations
  ['TL', 'TR'].forEach(pos => {
    const side = pos === 'TL' ? 'left' : 'right';
    for (let i = 1; i <= 4; i++) {
      setSVGVisibility(`smoke_${pos}_${side}${i}`, false);
    }
  });

  // Hide miss animation elements
  for (let i = 1; i <= 6; i++) {
    setSVGVisibility(`fire${i}`, false);
  }
  setSVGVisibility('roof_fire_center', false);
  setSVGVisibility('roof_fire_left', false);
  setSVGVisibility('roof_fire_right', false);
  setSVGVisibility('player_on_fire', false);
  setSVGVisibility('step_on_fire', false);

  // Hide fires
  for (let i = 1; i <= 3; i++) {
    setSVGVisibility(`fire_${i}`, false);
  }

  // Hide attack flash
  setSVGVisibility('attackFlash', false);
}

/**
 * Draw the title screen (now just shows waiting state)
 */
export function drawTitleScreen(mode) {
  clearDynamicElements();
  setSVGVisibility('gameOverScreen', false);
  drawScore(0);
  drawFires(0);
  // Show static layout with player at default position
  setSVGVisibility('player_TL', true);
}

/**
 * Draw static layout with player position
 */
export function drawStaticLayout(playerPosition, gameState = null) {
  clearDynamicElements();
  setSVGVisibility('gameOverScreen', false);

  // Show the player at current position
  // Hide player only if game over AND miss animation is past frame 50
  // This ensures player is visible during first 50 frames of 3rd miss animation
  const shouldHidePlayer = gameState && gameState.gameOver && 
                           ((missAnimationActive && missAnimationTimer > 50) ||
                            (torchMissAnimationActive && torchMissAnimationTimer > 50));
  
  if (!shouldHidePlayer) {
    drawPlayer(playerPosition);
  }
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

  // Don't show player during miss animations after frame 50 (player_on_fire is shown instead)
  // Only hide if timer has actually started (> 0) to avoid premature hiding
  if ((missAnimationActive && missAnimationTimer > 0 && missAnimationTimer > 50) ||
      (torchMissAnimationActive && torchMissAnimationTimer > 0 && torchMissAnimationTimer > 50)) {
    return;
  }

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
export function triggerAttack(position, isSuccessfulHit = false, targetType = null) {
  attackFlashTimer = 6; // frames
  attackAnimationTimer = 36; // frames for hitting animation (about 600ms at 60fps) - longer duration
  currentAttackPosition = position;
  
  // Trigger hit animation on successful hit
  if (isSuccessfulHit) {
    hitAnimationTimer = 36; // frames for hit animation (about 600ms at 60fps) - match hitting pose duration
    currentHitPosition = position;
    
    // Trigger smoke animation for successful torch hits
    if (targetType === 'torch' && (position === 'TL' || position === 'TR')) {
      startSmokeAnimation(position);
    }
  }
  
  const flash = document.getElementById('attackFlash');
  if (flash) {
    flash.setAttribute('r', '30');
    setSVGVisibility('attackFlash', true);
  }
}

/**
 * Start smoke animation for a torch position
 */
function startSmokeAnimation(position) {
  if (position === 'TL' || position === 'TR') {
    smokeAnimations[position].active = true;
    smokeAnimations[position].frame = 0;
    smokeAnimations[position].timer = 0;
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

  // Update hit animation timer
  if (hitAnimationTimer > 0) {
    hitAnimationTimer--;
    if (currentHitPosition) {
      setSVGVisibility(`hit_${currentHitPosition}`, true);
    }
    if (hitAnimationTimer === 0) {
      if (currentHitPosition) {
        setSVGVisibility(`hit_${currentHitPosition}`, false);
      }
      currentHitPosition = null;
    }
  }
}

/**
 * Update smoke animations
 * Animation sequence over 3 seconds (180 frames at 60fps):
 * - Frames 0-44: Show frame 1
 * - Frames 45-89: Show frames 1+2
 * - Frames 90-134: Show frames 1+2+3
 * - Frames 135-157: Show only frame 4
 * - Frames 158+: Hide all
 */
function updateSmokeAnimations() {
  ['TL', 'TR'].forEach(pos => {
    const smoke = smokeAnimations[pos];
    if (!smoke.active) return;
    
    smoke.timer++;
    const side = pos === 'TL' ? 'left' : 'right';
    
    // Hide all frames first
    for (let i = 1; i <= 4; i++) {
      setSVGVisibility(`smoke_${pos}_${side}${i}`, false);
    }
    
    // Show frames based on timer (3 seconds = 180 frames at 60fps)
    if (smoke.timer <= 45) {
      // Phase 1: Show frame 1
      setSVGVisibility(`smoke_${pos}_${side}1`, true);
    } else if (smoke.timer <= 90) {
      // Phase 2: Show frames 1+2
      setSVGVisibility(`smoke_${pos}_${side}1`, true);
      setSVGVisibility(`smoke_${pos}_${side}2`, true);
    } else if (smoke.timer <= 135) {
      // Phase 3: Show frames 1+2+3
      setSVGVisibility(`smoke_${pos}_${side}1`, true);
      setSVGVisibility(`smoke_${pos}_${side}2`, true);
      setSVGVisibility(`smoke_${pos}_${side}3`, true);
    } else if (smoke.timer <= 158) {
      // Phase 4: Show only frame 4
      setSVGVisibility(`smoke_${pos}_${side}4`, true);
    } else {
      // Animation complete
      smoke.active = false;
      smoke.timer = 0;
    }
  });
}

/**
 * Start torch miss animation
 */
export function startTorchMissAnimation(position) {
  Sound.burn();
  torchMissAnimationActive = true;
  torchMissAnimationTimer = 0;
  torchMissAnimationPosition = position;
  topFireActive = true;
  topFireTimer = 0;
  topFireCycle = 0;
}

/**
 * Check if torch miss animation is active
 */
export function isTorchMissAnimationActive() {
  return torchMissAnimationActive;
}

/**
 * Update torch miss animation sequence
 * Timeline (5 seconds = 300 frames at 60fps):
 * 0-50: roof_fire_left (if TL) OR roof_fire_right (if TR)
 * 50-150: roof_fire_center + player_on_fire + step_on_fire
 * 150-300: roof_fire_right (if TL) OR roof_fire_left (if TR)
 */
function updateTorchMissAnimation() {
  if (!torchMissAnimationActive) return;
  
  // Check if animation is complete (at frame 300)
  if (torchMissAnimationTimer >= 300) {
    // Import GameState to check if game is over
    import('../game/logic.js').then(module => {
      const isGameOver = module.GameState.gameOver;
      
      if (isGameOver) {
        // Game over - keep animation "active" so visibility code keeps running
        // Don't increment timer anymore, keep it at 300
        torchMissAnimationTimer = 300;
      } else {
        // Normal case - animation complete, hide elements
        torchMissAnimationActive = false;
        setSVGVisibility('step_on_fire', false);
        setSVGVisibility('player_on_fire', false);
        setSVGVisibility('roof_fire_center', false);
        setSVGVisibility('roof_fire_left', false);
        setSVGVisibility('roof_fire_right', false);
        torchMissAnimationPosition = null;
      }
      
      // Reset the trigger flag
      module.GameState.torchMissAnimationTriggered = false;
    });
    
    // Don't increment timer if at 300
    if (torchMissAnimationTimer > 300) {
      torchMissAnimationTimer = 300;
    }
  } else {
    // Normal animation in progress - increment timer
    torchMissAnimationTimer++;
  }
  
  // Determine which roof_fire to show first and last based on position
  const isLeft = torchMissAnimationPosition === 'TL';
  const firstRoofFire = isLeft ? 'roof_fire_left' : 'roof_fire_right';
  const lastRoofFire = isLeft ? 'roof_fire_right' : 'roof_fire_left';
  
  // Set position for player_on_fire and step_on_fire (centered for torch miss)
  const stepOnFire = document.getElementById('step_on_fire');
  const playerOnFire = document.getElementById('player_on_fire');
  if (stepOnFire) stepOnFire.setAttribute('transform', 'translate(17.5, 5) scale(1.15)');
  if (playerOnFire) playerOnFire.setAttribute('transform', 'translate(17.5, 5) scale(1.15)');
  
  // Phase 1 (0-50): Show first roof_fire (left if TL, right if TR)
  if (torchMissAnimationTimer >= 0 && torchMissAnimationTimer <= 300) {
    setSVGVisibility(firstRoofFire, true);
  }
  
  // Phase 2 (50-300): Show roof_fire_center + player_on_fire + step_on_fire
  if (torchMissAnimationTimer > 50 && torchMissAnimationTimer <= 300) {
    setSVGVisibility('roof_fire_center', true);
    setSVGVisibility('player_on_fire', true);
    setSVGVisibility('step_on_fire', true);
  }
  
  // Phase 3 (150-300): Show last roof_fire (right if TL, left if TR)
  if (torchMissAnimationTimer > 150 && torchMissAnimationTimer <= 300) {
    setSVGVisibility(lastRoofFire, true);
  }
}

/**
 * Start runner miss animation
 */
export function startRunnerMissAnimation(position) {
  Sound.burn();
  missAnimationActive = true;
  missAnimationTimer = 0;
  missAnimationPosition = position;
  topFireActive = true;
  topFireTimer = 0;
  topFireCycle = 0;
}

/**
 * Check if miss animation is active
 */
export function isMissAnimationActive() {
  return missAnimationActive;
}

/**
 * Update top fire animation (cycles through fire1-6 with repeating pattern)
 * Fire spreads: 1 → 1+2 → 1+2+3 → 1+2+3+4+5+6
 * Then cycles smoke frames (4, 5, 6) to create flickering effect
 */
function updateTopFireAnimation() {
  if (!topFireActive) return;
  
  topFireTimer++;
  
  // Hide all fire elements first
  for (let i = 1; i <= 6; i++) {
    setSVGVisibility(`fire${i}`, false);
  }
  
  // 5 seconds total = 300 frames
  // Phase timing (each phase 50 frames = ~0.83s)
  if (topFireTimer <= 50) {
    // Phase 1: fire1 only
    setSVGVisibility('fire1', true);
  } else if (topFireTimer <= 100) {
    // Phase 2: fire1+2
    setSVGVisibility('fire1', true);
    setSVGVisibility('fire2', true);
  } else if (topFireTimer <= 150) {
    // Phase 3: fire1+2+3
    setSVGVisibility('fire1', true);
    setSVGVisibility('fire2', true);
    setSVGVisibility('fire3', true);
  } else {
    // Phase 4: fire1+2+3+4+5+6 (all visible, creates smoke/fire effect)
    // Cycle through different combinations for flickering
    const cycleFrame = (topFireTimer - 150) % 30;
    setSVGVisibility('fire1', true);
    setSVGVisibility('fire2', true);
    setSVGVisibility('fire3', true);
    
    // Flicker the smoke layers (4, 5, 6) in patterns
    if (cycleFrame < 10) {
      setSVGVisibility('fire4', true);
      setSVGVisibility('fire5', true);
      setSVGVisibility('fire6', true);
    } else if (cycleFrame < 20) {
      setSVGVisibility('fire4', true);
      setSVGVisibility('fire6', true);
    } else {
      setSVGVisibility('fire5', true);
      setSVGVisibility('fire6', true);
    }
  }
  
  // Stop at 300 frames (5 seconds) to match miss animation
  if (topFireTimer >= 300) {
    // Check if game is over
    import('../game/logic.js').then(module => {
      const isGameOver = module.GameState.gameOver;
      
      if (isGameOver) {
        // Game over - keep animation active so fire stays visible
        topFireTimer = 300;
      } else {
        // Normal case - stop animation
        topFireActive = false;
        topFireTimer = 0;
        // Leave fire4, fire5, fire6 visible as smoke
        setSVGVisibility('fire4', true);
        setSVGVisibility('fire5', true);
        setSVGVisibility('fire6', true);
      }
    });
    
    // Keep timer at 300 to prevent increment past it
    if (topFireTimer > 300) {
      topFireTimer = 300;
    }
  }
}

/**
 * Update runner miss animation sequence
 * Timeline (5 seconds = 300 frames at 60fps):
 * 0-50: step_on_fire visible
 * 50-150: hide player, show player_on_fire
 * 100: roof_fire_center appears
 * 150: roof_fire_left appears  
 * 200: roof_fire_right appears
 * 300: animation ends, restore player
 */
function updateRunnerMissAnimation() {
  if (!missAnimationActive) return;
  
  // Check if animation is complete (at frame 300)
  if (missAnimationTimer >= 300) {
    // Import GameState to check if game is over
    import('../game/logic.js').then(module => {
      const isGameOver = module.GameState.gameOver;
      
      if (isGameOver) {
        // Game over - keep animation "active" so visibility code keeps running
        // Don't increment timer anymore, keep it at 300
        missAnimationTimer = 300;
      } else {
        // Normal case - animation complete, hide elements
        missAnimationActive = false;
        setSVGVisibility('step_on_fire', false);
        setSVGVisibility('player_on_fire', false);
        setSVGVisibility('roof_fire_center', false);
        setSVGVisibility('roof_fire_left', false);
        setSVGVisibility('roof_fire_right', false);
        missAnimationPosition = null;
      }
      
      // Reset the trigger flag
      module.GameState.missAnimationTriggered = false;
    });
    
    // Don't increment timer if at 300
    if (missAnimationTimer > 300) {
      missAnimationTimer = 300;
    }
  } else {
    // Normal animation in progress - increment timer
    missAnimationTimer++;
  }
  
  // Set position-specific transforms for player_on_fire and step_on_fire
  const positionTransforms = {
    'BL': 'translate(10, 5) scale(1.15)',
    'BR': 'translate(25, 5) scale(1.15)'
  };
  
  const transform = positionTransforms[missAnimationPosition] || positionTransforms['BL'];
  
  const stepOnFire = document.getElementById('step_on_fire');
  const playerOnFire = document.getElementById('player_on_fire');
  if (stepOnFire) stepOnFire.setAttribute('transform', transform);
  if (playerOnFire) playerOnFire.setAttribute('transform', transform);
  
  // Phase 1 (0-300): Show step_on_fire throughout entire animation
  if (missAnimationTimer <= 300) {
    setSVGVisibility('step_on_fire', true);
  }
  
  // Phase 2 (50-300): Hide player, show player_on_fire
  if (missAnimationTimer > 50 && missAnimationTimer <= 300) {
    setSVGVisibility('player_on_fire', true);
  }
  
  // Phase 3 (100+): Show roof_fire_center
  if (missAnimationTimer >= 100 && missAnimationTimer <= 300) {
    setSVGVisibility('roof_fire_center', true);
  }
  
  // Phase 4 (150+): Show roof_fire_left
  if (missAnimationTimer >= 150 && missAnimationTimer <= 300) {
    setSVGVisibility('roof_fire_left', true);
  }
  
  // Phase 5 (200+): Show roof_fire_right
  if (missAnimationTimer >= 200 && missAnimationTimer <= 300) {
    setSVGVisibility('roof_fire_right', true);
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
  
  // Play flying torch sound on stage transitions 1-5 (throwing and flying)
  if (stage >= 1 && stage <= 5 && previousStages[pos] !== stage) {
    Sound.flyingTorch();
  }
  
  // Always update previous stage
  previousStages[pos] = stage;
  
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
  updateSmokeAnimations();
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
  
  // Play runner sound on stage transitions 1-5 (running + first climb)
  // Don't play on stage 6 (climb_hand_2) or stage 7 (fall)
  if (stage >= 1 && stage <= 5 && !falling && previousStages[pos] !== stage) {
    Sound.runner();
  }
  
  // Always update previous stage
  previousStages[pos] = stage;
  
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
  updateSmokeAnimations();
}

/**
 * Draw burn indicators based on number of misses
 */
export function drawFires(misses) {
  const burnIds = ['burn1', 'burn2', 'burn3'];
  // Show burns from right to left (burn3 first, then burn2, then burn1)
  burnIds.forEach((id, index) => {
    const reverseIndex = burnIds.length - 1 - index; // 2, 1, 0
    setSVGVisibility(id, reverseIndex < misses);
  });
  
  // Show MISS text when there are any misses
  setSVGVisibility('missText', misses > 0);
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
    drawStaticLayout(gameState.currentPosition, gameState);
    
    // Draw torches
    drawTorch('TL', gameState.lanes.TL.stage);
    drawTorch('TR', gameState.lanes.TR.stage);
    
    // Draw runners
    drawRunner('BL', gameState.lanes.BL.stage, gameState.lanes.BL.falling);
    drawRunner('BR', gameState.lanes.BR.stage, gameState.lanes.BR.falling);
    
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
  updateSmokeAnimations();
  updateTopFireAnimation();
  updateRunnerMissAnimation();
  updateTorchMissAnimation();
}
