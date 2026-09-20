// 16-bit hunter sprite painter: per-class bodies with walk/attack/cast
// frames. Facing is SE natively, mirrored for SW (billboarded units).
// All colors come from the palette canon (../palette) — no raw hex here.

import { Texture } from 'pixi.js';
import type { CharacterClass } from '../../types';
import { CLASS, CLOTH, METAL, MONSTER, SKIN, VFX, WOOD } from '../palette';
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

  // 1. Shadow beneath hunter (square-dithered in the shapes pass)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 44, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Class Colors (canon)
  const kit = CLASS[charClass];
  const mainColor = kit.main;
  const trimColor = kit.trim;
  const capeColor = kit.cape;
  const skinColor = SKIN.base;

  // 3. Cape (behind body)
  ctx.fillStyle = capeColor;
  ctx.fillRect(cx - 6, baseY - 12, 12, 14);

  // 4. Legs (Boots)
  ctx.fillStyle = SKIN.boot;
  // Left leg
  ctx.fillRect(cx - 4, baseY + 2, 3, 8 - legOffset);
  ctx.fillStyle = SKIN.bootDark;
  ctx.fillRect(cx - 5, baseY + 8 - legOffset, 4, 3);

  // Right leg
  ctx.fillStyle = SKIN.boot;
  ctx.fillRect(cx + 1, baseY + 2, 3, 8 + legOffset);
  ctx.fillStyle = SKIN.bootDark;
  ctx.fillRect(cx, baseY + 8 + legOffset, 4, 3);

  // 5. Torso / Tunic / Armor
  ctx.fillStyle = mainColor;
  ctx.fillRect(cx - 5, baseY - 10, 10, 12);
  ctx.fillStyle = trimColor;
  ctx.fillRect(cx - 1, baseY - 10, 2, 12); // belt / center stripe
  ctx.fillStyle = CLOTH.gold;
  ctx.fillRect(cx - 3, baseY - 1, 6, 2); // gold belt buckle

  // 6. Head & Hair / Helmet
  ctx.fillStyle = skinColor;
  ctx.fillRect(cx - 4, baseY - 18, 8, 8); // face

  // Eyes
  ctx.fillStyle = SKIN.shadow;
  ctx.fillRect(cx + 1, baseY - 15, 2, 2);

  // Helmet / Hair depending on class
  if (charClass === 'Berserker') {
    // Horned iron helm
    ctx.fillStyle = METAL.steel;
    ctx.fillRect(cx - 5, baseY - 21, 10, 5);
    // Horns
    ctx.fillStyle = CLOTH.white;
    ctx.fillRect(cx - 6, baseY - 23, 2, 3);
    ctx.fillRect(cx + 4, baseY - 23, 2, 3);
  } else if (charClass === 'Ranger') {
    // Green elven hood
    ctx.fillStyle = trimColor;
    ctx.fillRect(cx - 5, baseY - 21, 10, 4);
    ctx.fillRect(cx - 6, baseY - 18, 2, 6);
    // Red feather
    ctx.fillStyle = CLASS.Berserker.main;
    ctx.fillRect(cx - 3, baseY - 24, 2, 4);
  } else if (charClass === 'Sorcerer') {
    // Wizard Hat
    ctx.fillStyle = trimColor;
    ctx.fillRect(cx - 7, baseY - 19, 14, 2); // brim
    ctx.fillRect(cx - 4, baseY - 25, 8, 6);
    ctx.fillRect(cx - 2, baseY - 28, 4, 4);
    ctx.fillStyle = CLOTH.goldBright;
    ctx.fillRect(cx - 1, baseY - 29, 2, 2); // star
  } else if (charClass === 'Cleric') {
    // White-gold hood with gold trim
    ctx.fillStyle = mainColor;
    ctx.fillRect(cx - 5, baseY - 21, 10, 4);
    ctx.fillRect(cx - 6, baseY - 18, 2, 6);
    ctx.fillRect(cx + 4, baseY - 18, 2, 6);
    ctx.fillStyle = trimColor;
    ctx.fillRect(cx - 5, baseY - 18, 10, 1);
  } else if (charClass === 'Bard') {
    // Feathered minstrel cap: purple cap + teal feather
    ctx.fillStyle = trimColor;
    ctx.fillRect(cx - 5, baseY - 21, 10, 4);
    ctx.fillRect(cx - 3, baseY - 24, 5, 4);
    ctx.fillStyle = VFX.music[1];
    ctx.fillRect(cx + 3, baseY - 26, 2, 6);
    ctx.fillStyle = VFX.music[0];
    ctx.fillRect(cx - 1, baseY - 21, 2, 1);
  } else {
    // Paladin winged crest
    ctx.fillStyle = CLOTH.pale;
    ctx.fillRect(cx - 5, baseY - 21, 10, 5);
    ctx.fillStyle = CLOTH.gold;
    ctx.fillRect(cx - 1, baseY - 24, 2, 4);
  }

  // 7. Weapon & Shield / Hands
  ctx.save();
  ctx.translate(cx + 4, baseY - 6);
  ctx.rotate(armAngle);

  if (charClass === 'Berserker') {
    // Giant Broadsword
    ctx.fillStyle = METAL.pale;
    ctx.fillRect(2, -18, 4, 22);
    ctx.fillStyle = CLOTH.pale;
    ctx.fillRect(3, -18, 2, 20); // sword highlight
    ctx.fillStyle = CLOTH.gold;
    ctx.fillRect(0, 2, 8, 3); // crossguard
    ctx.fillStyle = WOOD.mid;
    ctx.fillRect(3, 5, 2, 4); // hilt
  } else if (charClass === 'Ranger') {
    // Longbow
    ctx.strokeStyle = WOOD.trim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(4, -2, 10, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // String
    ctx.strokeStyle = CLOTH.pale;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, -12);
    ctx.lineTo(4, 8);
    ctx.stroke();
  } else if (charClass === 'Sorcerer') {
    // Magic Staff with glowing orb
    ctx.fillStyle = WOOD.mid;
    ctx.fillRect(3, -16, 2, 24);
    ctx.fillStyle = MONSTER.wisp;
    ctx.beginPath();
    ctx.arc(4, -18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CLOTH.pale;
    ctx.fillRect(3, -19, 2, 2);
  } else if (charClass === 'Cleric') {
    // Small chime staff with a green-gold healing crystal
    ctx.fillStyle = trimColor;
    ctx.fillRect(3, -12, 2, 20);
    ctx.fillStyle = VFX.heal[1];
    ctx.beginPath();
    ctx.arc(4, -14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = VFX.heal[0];
    ctx.fillRect(3, -15, 2, 2);
  } else if (charClass === 'Bard') {
    // Lute: wooden body + neck + strings
    ctx.fillStyle = WOOD.trim;
    ctx.beginPath();
    ctx.arc(4, 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = WOOD.mid;
    ctx.fillRect(3, -14, 3, 12);
    ctx.strokeStyle = VFX.music[2];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3, -14);
    ctx.lineTo(3, 4);
    ctx.moveTo(5, -14);
    ctx.lineTo(5, 4);
    ctx.stroke();
    ctx.fillStyle = VFX.music[0];
    ctx.fillRect(2, -16, 5, 2);
  } else {
    // Paladin: Shield on left, Warhammer on right
    ctx.fillStyle = METAL.pale;
    ctx.fillRect(2, -14, 6, 6); // hammer head
    ctx.fillStyle = WOOD.mid;
    ctx.fillRect(4, -8, 2, 14); // handle
    // Shield on other hand
    ctx.fillStyle = capeColor;
    ctx.fillRect(-12, -8, 6, 12);
    ctx.fillStyle = CLOTH.gold;
    ctx.fillRect(-10, -5, 2, 6); // gold cross
  }
  ctx.restore();

  ctx.restore();
  return Texture.from(canvas);
}
