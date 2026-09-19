import { Texture } from 'pixi.js';
import { TILE_WIDTH, TILE_HEIGHT } from './isometric';
import { CharacterClass, BuildingType } from '../types';
import {
  createPixelCanvas, isoPath, fillIsoTop, drawIsoBox, drawIsoSlab,
  drawIsoPyramid, faceQuad, fillQuad, drawIsoDoor, drawIsoWindow,
  drawIsoCross,
} from './objects/iso';

// Yard-prop painters live in src/game/objects/* (one module per prop:
// texture + tile layout + decor render). Re-exported here so existing
// imports keep working; new code should import from objects directly.
export {
  createChairTexture, createTableTexture, createBedTexture,
  createAnvilTexture, createVatTexture, createTrainingDummyTexture,
} from './objects';

// --------------------------------------------------------------------------
// 1. ISOMETRIC TERRAIN TILES
// --------------------------------------------------------------------------

export function createIsoTileTexture(type: 'town_cobble' | 'town_wood' | 'forest_grass' | 'graveyard_soil' | 'volcanic_rock' | 'stone_road' | 'reserve_dark'): Texture {
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
  } else if (type === 'reserve_dark') {
    // Reserved expansion land: very dark slate/indigo placeholder
    ctx.fillStyle = '#0b0f1e';
    ctx.fill();
    // Faint speckles
    ctx.fillStyle = '#1b2340';
    ctx.fillRect(22, 10, 2, 2);
    ctx.fillRect(36, 16, 2, 2);
    ctx.fillRect(28, 20, 2, 1);
    ctx.fillStyle = '#141b33';
    ctx.fillRect(30, 8, 2, 1);
    ctx.fillRect(18, 16, 2, 2);
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

  // Reserved land keeps a slightly lighter edge on top so reserve
  // borders read at a glance.
  if (type === 'reserve_dark') {
    ctx.strokeStyle = '#3b476b';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

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
  } else if (charClass === 'Bard') {
    // Bard: teal-purple minstrel jacket with gold trim
    mainColor = '#14b8a6';
    trimColor = '#5b21b6';
    capeColor = '#0f766e';
  } else {
    // Cleric: white-gold robe (distinct from Paladin's silver-blue)
    mainColor = '#f8fafc';
    trimColor = '#d4a017';
    capeColor = '#a16207';
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
  } else if (charClass === 'Cleric') {
    // White-gold hood with gold trim
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx - 5, baseY - 21, 10, 4);
    ctx.fillRect(cx - 6, baseY - 18, 2, 6);
    ctx.fillRect(cx + 4, baseY - 18, 2, 6);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(cx - 5, baseY - 18, 10, 1);
  } else if (charClass === 'Bard') {
    // Feathered minstrel cap: purple cap + teal feather
    ctx.fillStyle = '#5b21b6';
    ctx.fillRect(cx - 5, baseY - 21, 10, 4);
    ctx.fillRect(cx - 3, baseY - 24, 5, 4);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(cx + 3, baseY - 26, 2, 6);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(cx - 1, baseY - 21, 2, 1);
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
  } else if (charClass === 'Cleric') {
    // Small chime staff with a green-gold healing crystal
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(3, -12, 2, 20);
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(4, -14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(3, -15, 2, 2);
  } else if (charClass === 'Bard') {
    // Lute: wooden body + neck + strings
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(4, 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.fillRect(3, -14, 3, 12);
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3, -14);
    ctx.lineTo(3, 4);
    ctx.moveTo(5, -14);
    ctx.lineTo(5, 4);
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(2, -16, 5, 2);
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
  } else if (type === 'wight') {
    // Grave Wight: tall pale spectral figure in a tattered dark cloak
    ctx.fillStyle = '#1e1b4b'; // tattered dark cloak
    ctx.fillRect(cx - 7, cy - 16, 14, 22);
    // Cloak tatters
    ctx.fillRect(cx - 9, cy + 2, 3, 4);
    ctx.fillRect(cx + 6, cy + 2, 3, 5);
    ctx.fillRect(cx - 2, cy + 4, 3, 4);
    // Pale spectral face & hands
    ctx.fillStyle = '#e0e7ff';
    ctx.fillRect(cx - 4, cy - 20, 8, 7); // gaunt face
    ctx.fillRect(cx - 9, cy - 6, 3, 6); // left hand
    ctx.fillRect(cx + 6, cy - 6, 3, 6); // right hand
    // Glowing cyan eyes
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(cx - 2, cy - 17, 2, 2);
    ctx.fillRect(cx + 2, cy - 17, 2, 2);
    // Spectral wisp trail
    ctx.fillStyle = '#818cf8';
    ctx.fillRect(cx - 1, cy + 6 + squish, 2, 3);
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
  } else if (type === 'golem') {
    // Magma Golem: bulky basalt brute with lava cracks
    ctx.fillStyle = '#292524'; // basalt torso
    ctx.fillRect(cx - 9, cy - 10, 18, 14);
    ctx.fillRect(cx - 7, cy - 20, 14, 10); // heavy head/brow block
    // Heavy brow ridge
    ctx.fillStyle = '#44403c';
    ctx.fillRect(cx - 7, cy - 16, 14, 3);
    // Glowing lava cracks
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(cx - 5, cy - 6, 4, 2);
    ctx.fillRect(cx + 2, cy - 2, 5, 2);
    ctx.fillRect(cx - 1, cy - 12, 2, 5);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 4, cy - 6, 2, 1);
    // Ember eyes under the brow
    ctx.fillStyle = '#f97316';
    ctx.fillRect(cx - 3, cy - 13, 2, 2);
    ctx.fillRect(cx + 3, cy - 13, 2, 2);
    // Heavy basalt arms & legs
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(cx - 13, cy - 8, 4, 10);
    ctx.fillRect(cx + 9, cy - 8, 4, 10);
    ctx.fillRect(cx - 7, cy + 4, 4, 6);
    ctx.fillRect(cx + 3, cy + 4, 4, 6);
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
// 4. TOWN BUILDINGS (true 2:1 isometric structures)
// --------------------------------------------------------------------------
// Convention: 2:1 dimetric. Verticals stay vertical, horizontals run
// +/-26.5deg. Every solid is an iso box: top diamond + SW (left, dark)
// face + SE (right, lit) face. Roofs are wider diamond slabs or pyramids
// so the silhouette stays on the iso grid from every tile.

// Iso canvas primitives (isoPath/fillIsoTop/drawIsoBox/drawIsoSlab/
// drawIsoPyramid/faceQuad/fillQuad/drawIsoDoor/drawIsoWindow/drawIsoCross)
// live in src/game/objects/iso.ts and are imported above.

export function createBuildingTexture(type: BuildingType, level: number): Texture {
  const w = 128;
  const h = 120;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;

  const cx = 64;
  const groundY = 88;

  // Grounded footprint: soft outer shadow (south-offset) + tight contact
  // shadow, then a platform slab WITH vertical thickness so the base plugs
  // into the ground instead of floating as a flat diamond.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 16, 46, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 12, 35, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stone foundation slab: top diamond centered at (cx, groundY-2),
  // 44x22, extruded 6px down into the tile.
  const platY = groundY - 2, platHW = 44, platHH = 22, platT = 6;
  // SW skirt (dark)
  ctx.beginPath();
  ctx.moveTo(cx - platHW, platY); ctx.lineTo(cx, platY + platHH);
  ctx.lineTo(cx, platY + platHH + platT); ctx.lineTo(cx - platHW, platY + platT);
  ctx.closePath();
  ctx.fillStyle = '#2b3548'; ctx.fill();
  // SE skirt (mid)
  ctx.beginPath();
  ctx.moveTo(cx + platHW, platY); ctx.lineTo(cx, platY + platHH);
  ctx.lineTo(cx, platY + platHH + platT); ctx.lineTo(cx + platHW, platY + platT);
  ctx.closePath();
  ctx.fillStyle = '#3a455c'; ctx.fill();
  // Slab top
  ctx.beginPath();
  ctx.moveTo(cx, platY - platHH);
  ctx.lineTo(cx + platHW, platY);
  ctx.lineTo(cx, platY + platHH);
  ctx.lineTo(cx - platHW, platY);
  ctx.closePath();
  ctx.fillStyle = '#5b6b84'; ctx.fill();
  // Cobble hints on the slab top (kept inside the diamond)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, platY - platHH);
  ctx.lineTo(cx + platHW, platY);
  ctx.lineTo(cx, platY + platHH);
  ctx.lineTo(cx - platHW, platY);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let r = -18; r <= 18; r += 6) {
    ctx.fillRect(cx - 40, platY + r, 80, 1);
  }
  ctx.restore();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, platY - platHH);
  ctx.lineTo(cx + platHW, platY);
  ctx.lineTo(cx, platY + platHH);
  ctx.lineTo(cx - platHW, platY);
  ctx.closePath();
  ctx.stroke();
  // Contact AO: dark 2px line along the south rim (W-S-E) welds base to soil
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - platHW, platY + platT);
  ctx.lineTo(cx, platY + platHH + platT);
  ctx.lineTo(cx + platHW, platY + platT);
  ctx.stroke();
  // Doorstep stone at the south tip where corner doors land (baseY+bh≈+18)
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(cx, platY + platHH - 8);
  ctx.lineTo(cx + 9, platY + platHH - 4);
  ctx.lineTo(cx, platY + platHH);
  ctx.lineTo(cx - 9, platY + platHH - 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // True isometric bodies: every branch builds an iso box (or two),
  // then a roof slab / pyramid on the top diamond. Props stay as small
  // ground billboards in front so they never break the iso silhouette.
  let apexY = groundY - 78;
  if (type === 'TOWN_HALL') {
    const bw = 32, bh = 16, wh = 30, baseY = groundY + 2;
    const yTop = baseY - wh;
    drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#7d8aa0', '#525f77', '#94a3b8');
    drawIsoPyramid(ctx, cx, yTop, bw + 7, bh + 4, 22, '#7f1d1d', '#b91c1c');
    apexY = yTop - 24;
    // Crest tower: small iso box riding the roof center
    drawIsoBox(ctx, cx, yTop - 4, 11, 6, 16, '#a31616', '#7f1d1d', '#dc2626');
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(cx, yTop - 16, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#451a03';
    ctx.fillRect(cx - 1, yTop - 18, 2, 4);
    // Windows + gate seated IN the wall planes (SE door = main entry)
    drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'L', 0.28, 0.58, 10, 18);
    drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'R', 0.28, 0.58, 10, 18);
    drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.62, 0.9, 22);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(cx - 4, yTop + 2, 8, 14);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 2, yTop + 5, 4, 5);
  } else if (type === 'BLACKSMITH') {
    const bw = 32, bh = 16, wh = 26, baseY = groundY + 2;
    const yTop = baseY - wh;
    drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#3d4a61', '#273142', '#475569');
    drawIsoSlab(ctx, cx, yTop, bw + 8, bh + 4, 7, '#2b3548', '#141c2b', '#1e293b');
    apexY = yTop - 12;
    // Chimney: iso column on the SE roof slope + ember cap
    drawIsoBox(ctx, cx + 16, yTop - 2, 7, 4, 22, '#5b6b84', '#3a455c', '#64748b');
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(cx + 12, yTop - 30, 8, 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx + 14, yTop - 33, 4, 3);
    // Forge hearth glow on SW face, lamp on SE, iron door on SE.
    // (No baked anvil — the tile-snapped anvil decor covers the yard.)
    drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'L', 0.24, 0.6, 8, 17, '#ea580c', '#fef08a');
    drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'R', 0.2, 0.44, 10, 17);
    drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.52, 0.86, 17, '#1c0f08', '#eab308');
  } else if (type === 'ALCHEMY_LAB') {
    const bw = 28, bh = 14, wh = 28, baseY = groundY + 2;
    const yTop = baseY - wh;
    drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#6d28d9', '#4c1d95', '#7e22ce');
    drawIsoPyramid(ctx, cx, yTop, bw + 7, bh + 4, 26, '#5b21b6', '#8b5cf6');
    apexY = yTop - 28;
    // Star tip on the cone
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 1, apexY - 2, 3, 3);
    drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'L', 0.28, 0.58, 11, 19, '#22c55e', '#86efac');
    drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'R', 0.28, 0.58, 11, 19, '#22c55e', '#86efac');
    drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.62, 0.9, 19, '#1e1b4b', '#a7f3d0');
    // (No baked cauldron/flasks — tile-snapped vat decor covers the yard.)
  } else if (type === 'TAVERN') {
    const bw = 30, bh = 15, wh = 26, baseY = groundY + 2;
    const yTop = baseY - wh;
    drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#e8d5a8', '#c9b088', '#fef3c7');
    // Timber corner posts (verticals stay vertical) + sloped mid beams
    // that follow each face's top-edge slope instead of spanning horizontal.
    ctx.fillStyle = '#78350f';
    ctx.fillRect(cx - bw - 1, yTop, 3, wh);
    ctx.fillRect(cx - 1, yTop + bh, 3, wh);
    ctx.fillRect(cx + bw - 2, yTop, 3, wh);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - bw, yTop + wh / 2); ctx.lineTo(cx, yTop + bh + wh / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + bw, yTop + wh / 2); ctx.lineTo(cx, yTop + bh + wh / 2);
    ctx.stroke();
    drawIsoSlab(ctx, cx, yTop, bw + 8, bh + 4, 7, '#c47a1a', '#7c4a10', '#b45309');
    apexY = yTop - 12;
    drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.6, 0.9, 18);
    drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'L', 0.28, 0.58, 10, 17, '#fbbf24', '#fef3c7');
    drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'R', 0.2, 0.44, 10, 17, '#fbbf24', '#fef3c7');
    // (No baked sign/barrel — tile-snapped chairs/tables cover the terrace.)
  } else if (type === 'TRAINING_ACADEMY') {
    const bw = 30, bh = 15, wh = 26, baseY = groundY + 2;
    const yTop = baseY - wh;
    drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#a32424', '#7f1d1d', '#b91c1c');
    // Pagoda: two stacked slabs = two iso diamonds, always on-grid
    drawIsoSlab(ctx, cx, yTop, bw + 9, bh + 5, 6, '#334155', '#111c30', '#1e293b');
    drawIsoSlab(ctx, cx, yTop - 12, bw + 2, bh, 5, '#3b4c66', '#16202f', '#273549');
    apexY = yTop - 20;
    ctx.fillStyle = '#facc15';
    ctx.fillRect(cx - 6, apexY - 2, 12, 3);
    drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'L', 0.28, 0.52, 11, 18, '#fef3c7', '#ffffff');
    drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.6, 0.9, 18, '#2b0d0d', '#facc15');
    // (No baked dummy/rack — tile-snapped dummy decor covers the yard.)
  } else if (type === 'TRADING_POST') {
    const bw = 30, bh = 15, wh = 16, baseY = groundY + 2;
    const yTop = baseY - wh;
    drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#c47a1a', '#8a5410', '#d97706');
    // Striped awning: diamond slab with alternating iso strips
    const aw = bw + 9, ah = bh + 5;
    drawIsoSlab(ctx, cx, yTop, aw, ah, 6, '#ffffff', '#991b1b', '#7f1d1d');
    // Paint red/white bands across the top diamond (clipped)
    ctx.save();
    isoPath(ctx, cx, yTop, aw, ah);
    ctx.clip();
    for (let i = -4; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#ffffff';
      const x0 = cx + i * 10;
      ctx.beginPath();
      ctx.moveTo(x0, yTop - ah - 2);
      ctx.lineTo(x0 + 5, yTop - ah - 2);
      ctx.lineTo(x0 + 5 - 14, yTop + ah + 2);
      ctx.lineTo(x0 - 14, yTop + ah + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    isoPath(ctx, cx, yTop, aw, ah);
    ctx.stroke();
    apexY = yTop - 10;
    // Stall counter as a low iso box in front + goods riding its top.
    // (Counter front faces get the wood tone; goods are tiny top quads.)
    drawIsoBox(ctx, cx, baseY + bh - 2, 22, 11, 8, '#8a5f30', '#5b3a1e', '#78350f');
    fillQuad(ctx, faceQuad(cx, baseY + bh - 2, 22, 11, 8, 'L', 0.15, 0.32, 8, 11), '#eab308');
    fillQuad(ctx, faceQuad(cx, baseY + bh - 2, 22, 11, 8, 'R', 0.4, 0.57, 8, 11), '#0284c7');
    fillQuad(ctx, faceQuad(cx, baseY + bh - 2, 22, 11, 8, 'R', 0.62, 0.85, 8, 12), '#b45309');
  } else {
    // CLINIC: white iso ward + teal slab roof, cross on both faces
    const bw = 30, bh = 15, wh = 26, baseY = groundY + 2;
    const yTop = baseY - wh;
    drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#eef2f7', '#c3cedd', '#f8fafc');
    drawIsoSlab(ctx, cx, yTop, bw + 8, bh + 4, 7, '#14a698', '#0b4f4a', '#0f766e');
    apexY = yTop - 12;
    drawIsoCross(ctx, cx, baseY, bw, bh, wh, 'L', 0.43, 9, 9);
    drawIsoCross(ctx, cx, baseY, bw, bh, wh, 'R', 0.43, 9, 9);
    drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.62, 0.9, 18, '#1d4ed8', '#fde047');
  }

  // Level pips float above the roof apex so they never clip the gable
  if (level > 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const n = Math.min(level, 5);
    for (let s = 0; s < n; s++) {
      const sx = cx - (n * 6) + s * 12 + 3;
      ctx.beginPath();
      ctx.arc(sx, apexY - 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#eab308';
    for (let s = 0; s < n; s++) {
      const sx = cx - (n * 6) + s * 12 + 3;
      ctx.beginPath();
      ctx.arc(sx, apexY - 7, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return Texture.from(canvas);
}

// Yard furniture painters (chair/table/bed/anvil/vat/dummy) moved to
// src/game/objects/* — re-exported at the top of this file for compat.

// (Bed/anvil/vat/dummy painters also moved to src/game/objects/*.)

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
    // Single piercing arrow (points up; renderer rotates to flight path).
    // One arrow per sprite — Quick Shot's 3-shot volley comes from 3
    // staggered VFX spawns, not 3 arrows baked into one texture.
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(center, center - 14, 2, 16);
    ctx.beginPath();
    ctx.moveTo(center - 3, center - 14);
    ctx.lineTo(center + 1, center - 20);
    ctx.lineTo(center + 5, center - 14);
    ctx.fill();
  } else if (type === 'heal') {
    // Soft green-gold upward sparkle burst
    const grad = ctx.createRadialGradient(center, center + 6, 2, center, center + 6, 22);
    grad.addColorStop(0, 'rgba(248, 250, 252, 0.95)');
    grad.addColorStop(0.4, 'rgba(74, 222, 128, 0.7)');
    grad.addColorStop(1, 'rgba(212, 160, 23, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center + 6, 22, 0, Math.PI * 2);
    ctx.fill();
    // Rising sparkles (lower = larger, fading upward)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(center - 8, center + 10, 4, 4);
    ctx.fillRect(center + 5, center + 4, 3, 3);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(center - 3, center - 2, 3, 3);
    ctx.fillRect(center - 11, center - 6, 2, 2);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(center + 2, center - 12, 2, 2);
    ctx.fillRect(center - 1, center - 18, 2, 2);
  } else if (type === 'ballad' || type === 'encore') {
    // Bard music burst: teal-gold notes on a soft glow
    const grad = ctx.createRadialGradient(center, center, 2, center, center, 24);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0.9)');
    grad.addColorStop(0.5, 'rgba(251, 191, 36, 0.55)');
    grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, Math.PI * 2);
    ctx.fill();
    // Three note heads + stems
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(center - 12, center + 2, 6, 5);
    ctx.fillRect(center - 1, center - 8, 6, 5);
    ctx.fillRect(center + 8, center + 6, 5, 4);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(center - 8, center - 10, 2, 12);
    ctx.fillRect(center + 3, center - 18, 2, 10);
    ctx.fillRect(center + 11, center - 4, 2, 10);
  } else if (type === 'holy_burst') {
    // Renewing Dawn: gold pillar (party burst) wrapped in a green healing ring
    ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.fillRect(center - 5, 4, 10, size - 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center - 2, 4, 4, size - 8);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center + 6, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center + 6, 26, 0, Math.PI * 2);
    ctx.stroke();
    // Rising healing sparks
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(center - 12, 8, 3, 3);
    ctx.fillRect(center + 8, 16, 3, 3);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(center - 4, 24, 2, 2);
    ctx.fillRect(center + 3, 6, 2, 2);
  } else if (type === 'levelup') {
    // Level-up burst: gold pillar + expanding ring + rising sparks
    ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.fillRect(center - 5, 4, 10, size - 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center - 2, 4, 4, size - 8);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center + 6, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center + 6, 26, 0, Math.PI * 2);
    ctx.stroke();
    // Rising sparks
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(center - 12, 8, 3, 3);
    ctx.fillRect(center + 8, 16, 3, 3);
    ctx.fillRect(center - 4, 24, 2, 2);
    ctx.fillRect(center + 3, 6, 2, 2);
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
