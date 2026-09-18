import { Texture } from 'pixi.js';
import { TILE_WIDTH, TILE_HEIGHT } from './isometric';
import { CharacterClass, BuildingType } from '../types';

// Helper to create an offscreen canvas with nearest-neighbor crisp pixel scaling
function createPixelCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
  }
  return canvas;
}

// --------------------------------------------------------------------------
// 1. ISOMETRIC TERRAIN TILES
// --------------------------------------------------------------------------

export function createIsoTileTexture(type: 'town_cobble' | 'town_wood' | 'forest_grass' | 'graveyard_soil' | 'volcanic_rock' | 'stone_road'): Texture {
  const canvas = createPixelCanvas(TILE_WIDTH, TILE_HEIGHT + 8);
  const ctx = canvas.getContext('2d')!;

  const hw = TILE_WIDTH / 2; // 32
  const hh = TILE_HEIGHT / 2; // 16

  // Draw isometric diamond base
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(hw, 0);
  ctx.lineTo(TILE_WIDTH, hh);
  ctx.lineTo(hw, TILE_HEIGHT);
  ctx.lineTo(0, hh);
  ctx.closePath();

  if (type === 'town_cobble') {
    ctx.fillStyle = '#64748b';
    ctx.fill();

    // Cobblestone paver pattern
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    // Tiny cobblestone blocks
    for (let r = 4; r < TILE_HEIGHT - 4; r += 4) {
      for (let c = 8; c < TILE_WIDTH - 8; c += 8) {
        if (ctx.isPointInPath(c + (r % 8 === 0 ? 0 : 4), r)) {
          ctx.fillRect(c + (r % 8 === 0 ? 0 : 4), r, 5, 2);
        }
      }
    }
  } else if (type === 'town_wood') {
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Wood plank lines
    ctx.fillStyle = '#92400e';
    for (let i = 6; i < TILE_HEIGHT; i += 4) {
      ctx.beginPath();
      ctx.moveTo(10, i);
      ctx.lineTo(TILE_WIDTH - 10, i);
      ctx.stroke();
    }
  } else if (type === 'forest_grass') {
    ctx.fillStyle = '#166534';
    ctx.fill();
    ctx.fillStyle = '#15803d';
    // Grass tufts
    const tufts = [[20, 10], [35, 8], [28, 18], [44, 14], [15, 20]];
    tufts.forEach(([x, y]) => {
      ctx.fillRect(x, y, 2, 3);
      ctx.fillRect(x + 1, y - 1, 1, 2);
    });
    // Tiny flowers
    ctx.fillStyle = '#fde047';
    ctx.fillRect(22, 14, 2, 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(40, 16, 2, 2);
  } else if (type === 'graveyard_soil') {
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();
    ctx.fillStyle = '#312e81';
    ctx.fillRect(24, 12, 4, 3);
    ctx.fillRect(36, 16, 3, 2);
    // Tiny bone fragments
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(20, 18, 3, 1);
    ctx.fillRect(38, 10, 2, 2);
  } else if (type === 'volcanic_rock') {
    ctx.fillStyle = '#18181b';
    ctx.fill();
    // Glowing lava cracks
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(28, 12, 6, 1);
    ctx.fillRect(32, 13, 2, 4);
    ctx.fillRect(30, 17, 8, 1);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(31, 14, 2, 1);
  } else {
    // stone_road
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(20, 8, 8, 4);
    ctx.fillRect(32, 14, 10, 4);
  }

  // Diamond subtle border
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Edge depth skirt
  ctx.beginPath();
  ctx.moveTo(0, hh);
  ctx.lineTo(hw, TILE_HEIGHT);
  ctx.lineTo(TILE_WIDTH, hh);
  ctx.lineTo(TILE_WIDTH, hh + 4);
  ctx.lineTo(hw, TILE_HEIGHT + 4);
  ctx.lineTo(0, hh + 4);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  ctx.restore();
  return Texture.from(canvas);
}

// --------------------------------------------------------------------------
// 2. 16-BIT CHARACTER SPRITES (Animated Walk & Attack)
// --------------------------------------------------------------------------

export function createHunterFrame(
  charClass: CharacterClass,
  facing: 'SE' | 'SW',
  action: 'idle' | 'walk' | 'attack' | 'cast',
  frame: number
): Texture {
  const w = 40;
  const h = 48;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;

  // Flip horizontally if facing SW
  const flip = facing === 'SW';
  ctx.save();
  if (flip) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  const cx = 20;
  let bobY = 0;
  let legOffset = 0;
  let armAngle = 0;

  if (action === 'walk') {
    bobY = (frame % 2 === 1) ? -2 : 0;
    legOffset = (frame === 1) ? 3 : (frame === 3 ? -3 : 0);
  } else if (action === 'attack') {
    armAngle = frame === 0 ? -0.4 : (frame === 1 ? 0.6 : 0.2);
    bobY = frame === 1 ? 1 : 0;
  } else if (action === 'cast') {
    bobY = -2;
    armAngle = -0.5;
  }

  const baseY = 32 + bobY;

  // 1. Shadow beneath hunter
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 44, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Class Colors
  let mainColor = '#ef4444'; // Berserker
  let trimColor = '#991b1b';
  let skinColor = '#ffd2a5';
  let capeColor = '#b91c1c';

  if (charClass === 'Ranger') {
    mainColor = '#22c55e';
    trimColor = '#14532d';
    capeColor = '#15803d';
  } else if (charClass === 'Sorcerer') {
    mainColor = '#6366f1';
    trimColor = '#312e81';
    capeColor = '#4338ca';
  } else if (charClass === 'Paladin') {
    mainColor = '#e2e8f0';
    trimColor = '#eab308';
    capeColor = '#0284c7';
  }

  // 3. Cape (behind body)
  ctx.fillStyle = capeColor;
  ctx.fillRect(cx - 6, baseY - 12, 12, 14);

  // 4. Legs (Boots)
  ctx.fillStyle = '#334155';
  // Left leg
  ctx.fillRect(cx - 4, baseY + 2, 3, 8 - legOffset);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(cx - 5, baseY + 8 - legOffset, 4, 3);

  // Right leg
  ctx.fillStyle = '#334155';
  ctx.fillRect(cx + 1, baseY + 2, 3, 8 + legOffset);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(cx, baseY + 8 + legOffset, 4, 3);

  // 5. Torso / Tunic / Armor
  ctx.fillStyle = mainColor;
  ctx.fillRect(cx - 5, baseY - 10, 10, 12);
  ctx.fillStyle = trimColor;
  ctx.fillRect(cx - 1, baseY - 10, 2, 12); // belt / center stripe
  ctx.fillStyle = '#eab308';
  ctx.fillRect(cx - 3, baseY - 1, 6, 2); // gold belt buckle

  // 6. Head & Hair / Helmet
  ctx.fillStyle = skinColor;
  ctx.fillRect(cx - 4, baseY - 18, 8, 8); // face

  // Eyes
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(cx + 1, baseY - 15, 2, 2);

  // Helmet / Hair depending on class
  if (charClass === 'Berserker') {
    // Horned iron helm
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 5, baseY - 21, 10, 5);
    // Horns
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx - 6, baseY - 23, 2, 3);
    ctx.fillRect(cx + 4, baseY - 23, 2, 3);
  } else if (charClass === 'Ranger') {
    // Green elven hood
    ctx.fillStyle = '#15803d';
    ctx.fillRect(cx - 5, baseY - 21, 10, 4);
    ctx.fillRect(cx - 6, baseY - 18, 2, 6);
    // Red feather
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx - 3, baseY - 24, 2, 4);
  } else if (charClass === 'Sorcerer') {
    // Wizard Hat
    ctx.fillStyle = '#4338ca';
    ctx.fillRect(cx - 7, baseY - 19, 14, 2); // brim
    ctx.fillRect(cx - 4, baseY - 25, 8, 6);
    ctx.fillRect(cx - 2, baseY - 28, 4, 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 1, baseY - 29, 2, 2); // star
  } else {
    // Paladin winged crest
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(cx - 5, baseY - 21, 10, 5);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(cx - 1, baseY - 24, 2, 4);
  }

  // 7. Weapon & Shield / Hands
  ctx.save();
  ctx.translate(cx + 4, baseY - 6);
  ctx.rotate(armAngle);

  if (charClass === 'Berserker') {
    // Giant Broadsword
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(2, -18, 4, 22);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(3, -18, 2, 20); // sword highlight
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 2, 8, 3); // crossguard
    ctx.fillStyle = '#78350f';
    ctx.fillRect(3, 5, 2, 4); // hilt
  } else if (charClass === 'Ranger') {
    // Longbow
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(4, -2, 10, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // String
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, -12);
    ctx.lineTo(4, 8);
    ctx.stroke();
  } else if (charClass === 'Sorcerer') {
    // Magic Staff with glowing orb
    ctx.fillStyle = '#78350f';
    ctx.fillRect(3, -16, 2, 24);
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(4, -18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cffafe';
    ctx.fillRect(3, -19, 2, 2);
  } else {
    // Paladin: Shield on left, Warhammer on right
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(2, -14, 6, 6); // hammer head
    ctx.fillStyle = '#78350f';
    ctx.fillRect(4, -8, 2, 14); // handle
    // Shield on other hand
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-12, -8, 6, 12);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-10, -5, 2, 6); // gold cross
  }
  ctx.restore();

  ctx.restore();
  return Texture.from(canvas);
}

// --------------------------------------------------------------------------
// 3. MONSTER SPRITES (16-bit)
// --------------------------------------------------------------------------

export function createMonsterFrame(type: string, frame: number): Texture {
  const w = 48;
  const h = 48;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;

  const cx = 24;
  const cy = 30;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, 42, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const squish = Math.sin(frame * Math.PI) * 2;

  if (type === 'slime') {
    // Bouncy green slime
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(cx, cy + squish, 12 - squish, 10 + squish, 0, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = '#86efac';
    ctx.fillRect(cx - 6, cy - 4 + squish, 4, 3);
    // Evil eyes
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx + 2, cy - 1 + squish, 3, 3);
    ctx.fillRect(cx + 7, cy - 1 + squish, 3, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx + 3, cy + squish, 1, 1);
  } else if (type === 'goblin') {
    // Green sneaky goblin
    ctx.fillStyle = '#65a30d';
    // Body & head
    ctx.fillRect(cx - 5, cy - 10, 10, 12);
    ctx.fillRect(cx - 6, cy - 18, 12, 8); // head
    // Big pointy ears
    ctx.fillStyle = '#4d7c0f';
    ctx.fillRect(cx - 10, cy - 16, 4, 3);
    ctx.fillRect(cx + 6, cy - 16, 4, 3);
    // Yellow glint eyes
    ctx.fillStyle = '#fde047';
    ctx.fillRect(cx - 2, cy - 14, 2, 2);
    ctx.fillRect(cx + 3, cy - 14, 2, 2);
    // Rusty dagger
    ctx.fillStyle = '#b45309';
    ctx.fillRect(cx + 6, cy - 4 + squish, 8, 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx + 12, cy - 5 + squish, 4, 4);
  } else if (type === 'wolf') {
    // Feral dark wolf
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 10, cy - 6, 18, 10); // body
    ctx.fillRect(cx + 4, cy - 12, 10, 8); // head
    ctx.fillRect(cx + 12, cy - 8, 4, 4); // snout
    // Ears
    ctx.fillRect(cx + 5, cy - 15, 3, 3);
    // Yellow eyes
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx + 10, cy - 11, 2, 2);
    // Legs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 8, cy + 4, 3, 6);
    ctx.fillRect(cx + 4, cy + 4, 3, 6);
  } else if (type === 'skeleton') {
    // Clattering Skeleton Knight
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cx - 4, cy - 16, 8, 8); // skull
    ctx.fillRect(cx - 3, cy - 8, 6, 10); // ribcage
    // Red glowing eye sockets
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx - 1, cy - 13, 2, 2);
    ctx.fillRect(cx + 3, cy - 13, 2, 2);
    // Shield & sword
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 9, cy - 6, 5, 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(cx + 5, cy - 14, 2, 14);
    // Legs
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cx - 3, cy + 2, 2, 8);
    ctx.fillRect(cx + 1, cy + 2, 2, 8);
  } else if (type === 'drake') {
    // Fire Drake mini-dragon
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(cx - 8, cy - 8, 16, 12);
    ctx.fillRect(cx + 6, cy - 14, 8, 8);
    // Dragon horns
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx + 8, cy - 18, 2, 4);
    // Wings
    ctx.fillStyle = '#7c2d12';
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 8);
    ctx.lineTo(cx - 16, cy - 20 + squish * 2);
    ctx.lineTo(cx + 2, cy - 14);
    ctx.fill();
    // Fire breath ember
    ctx.fillStyle = '#fde047';
    ctx.fillRect(cx + 14, cy - 11, 3, 3);
  } else {
    // Boss Evil Lich Lord
    ctx.fillStyle = '#312e81'; // Dark void robe
    ctx.fillRect(cx - 8, cy - 14, 16, 22);
    // Hood & Skull
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(cx - 7, cy - 22, 14, 10);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx - 4, cy - 20, 8, 6);
    // Glowing cyan demonic eyes
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(cx - 2, cy - 18, 2, 2);
    ctx.fillRect(cx + 2, cy - 18, 2, 2);
    // Floating golden horned crown
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(cx - 6, cy - 26, 12, 3);
    ctx.fillRect(cx - 6, cy - 28, 2, 3);
    ctx.fillRect(cx, cy - 29, 2, 4);
    ctx.fillRect(cx + 4, cy - 28, 2, 3);
    // Floating cosmic scythe
    ctx.fillStyle = '#a855f7';
    ctx.fillRect(cx + 10, cy - 24, 2, 28);
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(cx + 12, cy - 22, 8, Math.PI, Math.PI * 1.6);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c084fc';
    ctx.stroke();
  }

  return Texture.from(canvas);
}

// --------------------------------------------------------------------------
// 4. TOWN BUILDINGS (16-bit Isometric Structures)
// --------------------------------------------------------------------------

export function createBuildingTexture(type: BuildingType, level: number): Texture {
  const w = 128;
  const h = 120;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;

  const cx = 64;
  const groundY = 88;

  // Ground footprint shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 12, 44, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stone Foundation / Platform
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(cx, groundY + 20);
  ctx.lineTo(cx + 44, groundY - 2);
  ctx.lineTo(cx, groundY - 24);
  ctx.lineTo(cx - 44, groundY - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Main Walls & Isometric Structure
  if (type === 'TOWN_HALL') {
    // Grand Sanctuary / Castle Manor
    // Left wall
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx - 36, groundY - 50, 36, 40);
    // Right wall (lit)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx, groundY - 50, 36, 40);

    // Mansard Red Roof
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.moveTo(cx - 40, groundY - 50);
    ctx.lineTo(cx, groundY - 72);
    ctx.lineTo(cx + 40, groundY - 50);
    ctx.lineTo(cx, groundY - 40);
    ctx.closePath();
    ctx.fill();

    // Central Clock / Sanctuary Crest Tower
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(cx - 12, groundY - 88, 24, 24);
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(cx, groundY - 76, 5, 0, Math.PI * 2);
    ctx.fill(); // Gold clock face
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 1, groundY - 79, 2, 4);

    // Large Oak Castle Gate
    ctx.fillStyle = '#451a03';
    ctx.fillRect(cx - 10, groundY - 30, 20, 26);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(cx - 8, groundY - 18, 4, 4); // golden studs
    ctx.fillRect(cx + 4, groundY - 18, 4, 4);

    // Royal Banner
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(cx - 4, groundY - 60, 8, 16);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 2, groundY - 56, 4, 6); // Lion emblem
  } else if (type === 'BLACKSMITH') {
    // Stone Forge & Anvil
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 34, groundY - 42, 68, 36);

    // Slate roof
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(cx - 38, groundY - 42);
    ctx.lineTo(cx, groundY - 62);
    ctx.lineTo(cx + 38, groundY - 42);
    ctx.closePath();
    ctx.fill();

    // Stone Chimney with glowing embers
    ctx.fillStyle = '#475569';
    ctx.fillRect(cx + 18, groundY - 75, 12, 30);
    // Glowing smoke/embers
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(cx + 20, groundY - 78, 8, 5);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx + 22, groundY - 82, 4, 4);

    // Open forge hearth with red/yellow glow
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(cx - 22, groundY - 24, 16, 14);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(cx - 20, groundY - 21, 12, 9);

    // Anvil outside
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx + 4, groundY - 14, 12, 10); // stump
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx + 2, groundY - 18, 16, 5); // anvil iron

    // Blacksmith Sign with Crossed Swords
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 30, groundY - 48, 16, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cx - 26, groundY - 46, 8, 2);
    ctx.fillRect(cx - 26, groundY - 43, 8, 2);
  } else if (type === 'ALCHEMY_LAB') {
    // Magical Turret with Purple Roof & Bubbling Potions
    ctx.fillStyle = '#581c87';
    ctx.fillRect(cx - 28, groundY - 45, 56, 38);

    // Conical Witch/Alchemist Roof
    ctx.fillStyle = '#7e22ce';
    ctx.beginPath();
    ctx.moveTo(cx - 34, groundY - 45);
    ctx.lineTo(cx, groundY - 78);
    ctx.lineTo(cx + 34, groundY - 45);
    ctx.closePath();
    ctx.fill();

    // Glowing window with green mystic light
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(cx - 8, groundY - 35, 16, 16);
    ctx.fillStyle = '#86efac';
    ctx.fillRect(cx - 6, groundY - 33, 5, 5);

    // Cauldron outside with boiling green potion
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 26, groundY - 16, 14, 12);
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(cx - 19, groundY - 16, 6, Math.PI, 0);
    ctx.fill();

    // Potion Flasks on table
    ctx.fillStyle = '#ef4444'; // Red HP flask
    ctx.fillRect(cx + 8, groundY - 14, 5, 7);
    ctx.fillStyle = '#3b82f6'; // Blue MP flask
    ctx.fillRect(cx + 16, groundY - 14, 5, 7);
  } else if (type === 'TAVERN') {
    // Cozy Half-Timber Inn with Beer Mug Sign
    ctx.fillStyle = '#fef3c7'; // Plaster wall
    ctx.fillRect(cx - 32, groundY - 44, 64, 38);
    // Dark timber beams
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 32, groundY - 44, 4, 38);
    ctx.fillRect(cx + 28, groundY - 44, 4, 38);
    ctx.fillRect(cx - 2, groundY - 44, 4, 38);
    ctx.fillRect(cx - 32, groundY - 26, 64, 4);

    // Warm Thatch / Tile Roof
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(cx - 36, groundY - 44);
    ctx.lineTo(cx, groundY - 68);
    ctx.lineTo(cx + 36, groundY - 44);
    ctx.closePath();
    ctx.fill();

    // Oak door
    ctx.fillStyle = '#451a03';
    ctx.fillRect(cx - 8, groundY - 22, 16, 20);

    // Beer Stein Signboard
    ctx.fillStyle = '#fde047';
    ctx.fillRect(cx + 12, groundY - 38, 10, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + 12, groundY - 40, 10, 3); // foam
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx + 22, groundY - 36, 3, 6); // handle

    // Wine Barrels outside
    ctx.fillStyle = '#92400e';
    ctx.fillRect(cx - 26, groundY - 14, 10, 12);
  } else if (type === 'TRAINING_ACADEMY') {
    // Martial Dojo Pagoda Roof & Weapon Racks
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(cx - 30, groundY - 44, 60, 38);

    // Pagoda Tiered Roof
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(cx - 38, groundY - 44);
    ctx.lineTo(cx, groundY - 66);
    ctx.lineTo(cx + 38, groundY - 44);
    ctx.closePath();
    ctx.fill();
    // Gold roof crest
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 6, groundY - 69, 12, 4);

    // Straw Training Dummy outside
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 22, groundY - 24, 4, 20); // pole
    ctx.fillStyle = '#fde047';
    ctx.fillRect(cx - 26, groundY - 22, 12, 10); // straw body
    ctx.fillRect(cx - 24, groundY - 28, 8, 6); // head

    // Weapon Rack with Spears & Swords
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx + 10, groundY - 16, 16, 12);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cx + 12, groundY - 24, 2, 18);
    ctx.fillRect(cx + 16, groundY - 24, 2, 18);
    ctx.fillRect(cx + 20, groundY - 24, 2, 18);
  } else if (type === 'TRADING_POST') {
    // Open Bazaar with Red & White Striped Awning
    ctx.fillStyle = '#d97706';
    ctx.fillRect(cx - 30, groundY - 32, 60, 26);

    // Striped Awning
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = (i % 2 === 0) ? '#ef4444' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx - 35 + i * 10, groundY - 50);
      ctx.lineTo(cx - 25 + i * 10, groundY - 50);
      ctx.lineTo(cx - 27 + i * 10, groundY - 32);
      ctx.lineTo(cx - 37 + i * 10, groundY - 32);
      ctx.closePath();
      ctx.fill();
    }

    // Wooden sales counter
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - 26, groundY - 22, 52, 12);

    // Crates and gold pouches on counter
    ctx.fillStyle = '#eab308';
    ctx.fillRect(cx - 16, groundY - 26, 6, 6); // Gold sack
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(cx - 6, groundY - 26, 6, 6); // Gem crate
    ctx.fillStyle = '#b45309';
    ctx.fillRect(cx + 6, groundY - 28, 10, 8); // Wooden chest
  } else {
    // CLINIC / INFIRMARY
    ctx.fillStyle = '#f8fafc'; // Clean white clinic walls
    ctx.fillRect(cx - 30, groundY - 44, 60, 38);

    // Teal roof
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.moveTo(cx - 36, groundY - 44);
    ctx.lineTo(cx, groundY - 66);
    ctx.lineTo(cx + 36, groundY - 44);
    ctx.closePath();
    ctx.fill();

    // Distinct Red Cross Emblem on front
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(cx - 2, groundY - 36, 4, 14);
    ctx.fillRect(cx - 7, groundY - 31, 14, 4);

    // Warm clinic door
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(cx - 8, groundY - 20, 16, 18);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(cx - 6, groundY - 12, 3, 3); // brass knob
  }

  // Golden Level Star Badges atop building
  if (level > 1) {
    ctx.fillStyle = '#eab308';
    for (let s = 0; s < Math.min(level, 5); s++) {
      const sx = cx - (Math.min(level, 5) * 6) + s * 12 + 6;
      ctx.beginPath();
      ctx.arc(sx, groundY - 82, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return Texture.from(canvas);
}

// --------------------------------------------------------------------------
// 5. TAVERN FURNITURE (small crisp pixel-art decor, ~20x24)
// --------------------------------------------------------------------------

/** Wooden tavern chair: backrest slats, plank seat, four legs. */
export function createChairTexture(): Texture {
  const w = 20;
  const h = 24;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(10, 21, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Backrest posts
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(3, 2, 3, 14);
  ctx.fillRect(14, 2, 3, 14);
  // Post highlights
  ctx.fillStyle = '#8a5f30';
  ctx.fillRect(3, 2, 1, 14);
  ctx.fillRect(14, 2, 1, 14);
  // Backrest slats
  ctx.fillStyle = '#78350f';
  ctx.fillRect(3, 4, 14, 3);
  ctx.fillRect(3, 9, 14, 3);
  ctx.fillStyle = '#a16207';
  ctx.fillRect(3, 4, 14, 1);
  ctx.fillRect(3, 9, 14, 1);

  // Plank seat
  ctx.fillStyle = '#92400e';
  ctx.fillRect(2, 15, 16, 4);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(2, 15, 16, 1);
  // Plank seams
  ctx.fillStyle = '#451a03';
  ctx.fillRect(7, 15, 1, 4);
  ctx.fillRect(12, 15, 1, 4);

  // Legs
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(3, 19, 2, 3);
  ctx.fillRect(15, 19, 2, 3);

  return Texture.from(canvas);
}

/** Round wooden tavern table with ale mugs on top. */
export function createTableTexture(): Texture {
  const w = 24;
  const h = 24;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(12, 21, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Table leg / pedestal
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(10, 15, 4, 6);
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(10, 15, 1, 6);

  // Round tabletop (pixel ellipse)
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(12, 12, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tabletop highlight (worn wood sheen)
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.ellipse(12, 11, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rim edge
  ctx.fillStyle = '#451a03';
  ctx.fillRect(3, 12, 2, 2);
  ctx.fillRect(19, 12, 2, 2);

  // Ale mugs on top
  ctx.fillStyle = '#92400e';
  ctx.fillRect(7, 5, 3, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(7, 4, 3, 1); // foam
  ctx.fillStyle = '#92400e';
  ctx.fillRect(14, 6, 3, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(14, 5, 3, 1); // foam

  return Texture.from(canvas);
}

// --------------------------------------------------------------------------
// 6. CLINIC FURNITURE (small crisp pixel-art decor, ~24x20)
// --------------------------------------------------------------------------

/** Clinic cot: metal frame, white sheet, teal blanket, pillow. */
export function createBedTexture(): Texture {
  const w = 24;
  const h = 20;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(12, 17, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bed legs
  ctx.fillStyle = '#374151';
  ctx.fillRect(2, 14, 2, 3);
  ctx.fillRect(20, 14, 2, 3);

  // Metal frame
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(1, 8, 22, 8);
  // Headboard / footboard posts
  ctx.fillStyle = '#374151';
  ctx.fillRect(1, 4, 2, 12);
  ctx.fillRect(21, 4, 2, 12);
  // Post highlights
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(1, 4, 1, 12);
  ctx.fillRect(21, 4, 1, 12);

  // White sheet / mattress
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(3, 9, 18, 5);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(3, 12, 18, 2);

  // Teal blanket (foot half)
  ctx.fillStyle = '#0f766e';
  ctx.fillRect(12, 9, 9, 5);
  ctx.fillStyle = '#14b8a6';
  ctx.fillRect(12, 9, 9, 1);

  // Pillow at head
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4, 9, 5, 4);
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(4, 12, 5, 1);

  return Texture.from(canvas);
}

// --------------------------------------------------------------------------
// 7. SKILL VFX & VISUAL EFFECTS
// --------------------------------------------------------------------------

export function createSkillVfxTexture(type: string): Texture {
  const size = 64;
  const canvas = createPixelCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;

  if (type === 'slash') {
    // Arc of razor energy
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center, center, 22, -Math.PI * 0.7, Math.PI * 0.1);
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, 20, -Math.PI * 0.7, Math.PI * 0.1);
    ctx.stroke();
  } else if (type === 'meteor') {
    // Burning asteroid meteor
    const grad = ctx.createRadialGradient(center, center, 4, center, center, 24);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.4, '#ea580c');
    grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, Math.PI * 2);
    ctx.fill();
    // Inner core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(center, center, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'whirlwind') {
    // Double cyclone vortex
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center, 18, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, 24, Math.PI * 0.5, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'smite') {
    // Holy radiant beam
    ctx.fillStyle = 'rgba(253, 224, 71, 0.8)';
    ctx.fillRect(center - 6, 0, 12, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center - 2, 0, 4, size);
    // Holy sparkle stars
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(center - 12, center - 2, 24, 4);
  } else if (type === 'multishot') {
    // 3 Piercing Arrows
    ctx.fillStyle = '#22c55e';
    [-10, 0, 10].forEach(offset => {
      ctx.fillRect(center + offset, center - 14, 2, 16);
      ctx.beginPath();
      ctx.moveTo(center + offset - 3, center - 14);
      ctx.lineTo(center + offset + 1, center - 20);
      ctx.lineTo(center + offset + 5, center - 14);
      ctx.fill();
    });
  } else {
    // Impact spark burst
    ctx.fillStyle = '#facc15';
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      const x = center + Math.cos(angle) * 14;
      const y = center + Math.sin(angle) * 14;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  return Texture.from(canvas);
}
