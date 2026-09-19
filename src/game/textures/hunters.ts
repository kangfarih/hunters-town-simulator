// 16-bit hunter sprite painter: per-class bodies with walk/attack/cast
// frames. Facing is SE natively, mirrored for SW (billboarded units).

import { Texture } from 'pixi.js';
import type { CharacterClass } from '../../types';
import { createPixelCanvas } from '../objects/iso';

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
