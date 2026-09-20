// 16-bit monster sprite painter: one frame per type with a squish
// animation phase. Boss Lich Lord included.
// All colors come from the palette canon (../palette) — no raw hex here.

import { Texture } from 'pixi.js';
import { BEAST, CLOTH, METAL, MONSTER, RARITY, SKIN, STONE, TERRAIN, VFX, WOOD } from '../palette';
import { createPixelCanvas } from '../objects/iso';

export function createMonsterFrame(type: string, frame: number): Texture {
  const w = 48;
  const h = 48;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;

  const cx = 24;
  const cy = 30;

  // Shadow (square-dithered in the shapes pass)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, 42, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const squish = Math.sin(frame * Math.PI) * 2;

  if (type === 'slime') {
    // Bouncy green slime
    ctx.fillStyle = BEAST.slimeBody;
    ctx.beginPath();
    ctx.ellipse(cx, cy + squish, 12 - squish, 10 + squish, 0, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = BEAST.slimeHi;
    ctx.fillRect(cx - 6, cy - 4 + squish, 4, 3);
    // Evil eyes
    ctx.fillStyle = MONSTER.evilEye;
    ctx.fillRect(cx + 2, cy - 1 + squish, 3, 3);
    ctx.fillRect(cx + 7, cy - 1 + squish, 3, 3);
    ctx.fillStyle = CLOTH.white;
    ctx.fillRect(cx + 3, cy + squish, 1, 1);
  } else if (type === 'goblin') {
    // Green sneaky goblin
    ctx.fillStyle = BEAST.goblinBody;
    // Body & head
    ctx.fillRect(cx - 5, cy - 10, 10, 12);
    ctx.fillRect(cx - 6, cy - 18, 12, 8); // head
    // Big pointy ears
    ctx.fillStyle = BEAST.goblinDark;
    ctx.fillRect(cx - 10, cy - 16, 4, 3);
    ctx.fillRect(cx + 6, cy - 16, 4, 3);
    // Yellow glint eyes
    ctx.fillStyle = MONSTER.goldEye;
    ctx.fillRect(cx - 2, cy - 14, 2, 2);
    ctx.fillRect(cx + 3, cy - 14, 2, 2);
    // Rusty dagger
    ctx.fillStyle = WOOD.trim;
    ctx.fillRect(cx + 6, cy - 4 + squish, 8, 2);
    ctx.fillStyle = METAL.pale;
    ctx.fillRect(cx + 12, cy - 5 + squish, 4, 4);
  } else if (type === 'wolf') {
    // Feral dark wolf
    ctx.fillStyle = SKIN.boot;
    ctx.fillRect(cx - 10, cy - 6, 18, 10); // body
    ctx.fillRect(cx + 4, cy - 12, 10, 8); // head
    ctx.fillRect(cx + 12, cy - 8, 4, 4); // snout
    // Ears
    ctx.fillRect(cx + 5, cy - 15, 3, 3);
    // Yellow eyes
    ctx.fillStyle = MONSTER.emberEye;
    ctx.fillRect(cx + 10, cy - 11, 2, 2);
    // Legs
    ctx.fillStyle = SKIN.bootDark;
    ctx.fillRect(cx - 8, cy + 4, 3, 6);
    ctx.fillRect(cx + 4, cy + 4, 3, 6);
  } else if (type === 'skeleton') {
    // Clattering Skeleton Knight
    ctx.fillStyle = MONSTER.bone;
    ctx.fillRect(cx - 4, cy - 16, 8, 8); // skull
    ctx.fillRect(cx - 3, cy - 8, 6, 10); // ribcage
    // Red glowing eye sockets
    ctx.fillStyle = MONSTER.evilEye;
    ctx.fillRect(cx - 1, cy - 13, 2, 2);
    ctx.fillRect(cx + 3, cy - 13, 2, 2);
    // Shield & sword
    ctx.fillStyle = METAL.steel;
    ctx.fillRect(cx - 9, cy - 6, 5, 8);
    ctx.fillStyle = TERRAIN.bone;
    ctx.fillRect(cx + 5, cy - 14, 2, 14);
    // Legs
    ctx.fillStyle = MONSTER.bone;
    ctx.fillRect(cx - 3, cy + 2, 2, 8);
    ctx.fillRect(cx + 1, cy + 2, 2, 8);
  } else if (type === 'wight') {
    // Grave Wight: tall pale spectral figure in a tattered dark cloak
    ctx.fillStyle = TERRAIN.soil; // tattered dark cloak
    ctx.fillRect(cx - 7, cy - 16, 14, 22);
    // Cloak tatters
    ctx.fillRect(cx - 9, cy + 2, 3, 4);
    ctx.fillRect(cx + 6, cy + 2, 3, 5);
    ctx.fillRect(cx - 2, cy + 4, 3, 4);
    // Pale spectral face & hands
    ctx.fillStyle = MONSTER.spectral;
    ctx.fillRect(cx - 4, cy - 20, 8, 7); // gaunt face
    ctx.fillRect(cx - 9, cy - 6, 3, 6); // left hand
    ctx.fillRect(cx + 6, cy - 6, 3, 6); // right hand
    // Glowing cyan eyes
    ctx.fillStyle = MONSTER.wisp;
    ctx.fillRect(cx - 2, cy - 17, 2, 2);
    ctx.fillRect(cx + 2, cy - 17, 2, 2);
    // Spectral wisp trail
    ctx.fillStyle = MONSTER.trail;
    ctx.fillRect(cx - 1, cy + 6 + squish, 2, 3);
  } else if (type === 'drake') {
    // Fire Drake mini-dragon
    ctx.fillStyle = BEAST.drakeBody;
    ctx.fillRect(cx - 8, cy - 8, 16, 12);
    ctx.fillRect(cx + 6, cy - 14, 8, 8);
    // Dragon horns
    ctx.fillStyle = BEAST.drakeHorn;
    ctx.fillRect(cx + 8, cy - 18, 2, 4);
    // Wings
    ctx.fillStyle = BEAST.drakeWing;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 8);
    ctx.lineTo(cx - 16, cy - 20 + squish * 2);
    ctx.lineTo(cx + 2, cy - 14);
    ctx.fill();
    // Fire breath ember
    ctx.fillStyle = VFX.fire[2];
    ctx.fillRect(cx + 14, cy - 11, 3, 3);
  } else if (type === 'golem') {
    // Magma Golem: bulky basalt brute with lava cracks
    ctx.fillStyle = STONE.mid; // basalt torso
    ctx.fillRect(cx - 9, cy - 10, 18, 14);
    ctx.fillRect(cx - 7, cy - 20, 14, 10); // heavy head/brow block
    // Heavy brow ridge
    ctx.fillStyle = STONE.light;
    ctx.fillRect(cx - 7, cy - 16, 14, 3);
    // Glowing lava cracks
    ctx.fillStyle = TERRAIN.lava;
    ctx.fillRect(cx - 5, cy - 6, 4, 2);
    ctx.fillRect(cx + 2, cy - 2, 5, 2);
    ctx.fillRect(cx - 1, cy - 12, 2, 5);
    ctx.fillStyle = TERRAIN.lavaHot;
    ctx.fillRect(cx - 4, cy - 6, 2, 1);
    // Ember eyes under the brow
    ctx.fillStyle = VFX.fire[5];
    ctx.fillRect(cx - 3, cy - 13, 2, 2);
    ctx.fillRect(cx + 3, cy - 13, 2, 2);
    // Heavy basalt arms & legs
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(cx - 13, cy - 8, 4, 10);
    ctx.fillRect(cx + 9, cy - 8, 4, 10);
    ctx.fillRect(cx - 7, cy + 4, 4, 6);
    ctx.fillRect(cx + 3, cy + 4, 4, 6);
  } else {
    // Boss Evil Lich Lord
    ctx.fillStyle = TERRAIN.soilLight; // Dark void robe
    ctx.fillRect(cx - 8, cy - 14, 16, 22);
    // Hood & Skull
    ctx.fillStyle = TERRAIN.soil;
    ctx.fillRect(cx - 7, cy - 22, 14, 10);
    ctx.fillStyle = CLOTH.white;
    ctx.fillRect(cx - 4, cy - 20, 8, 6);
    // Glowing cyan demonic eyes
    ctx.fillStyle = MONSTER.wisp;
    ctx.fillRect(cx - 2, cy - 18, 2, 2);
    ctx.fillRect(cx + 2, cy - 18, 2, 2);
    // Floating golden horned crown
    ctx.fillStyle = VFX.music[0];
    ctx.fillRect(cx - 6, cy - 26, 12, 3);
    ctx.fillRect(cx - 6, cy - 28, 2, 3);
    ctx.fillRect(cx, cy - 29, 2, 4);
    ctx.fillRect(cx + 4, cy - 28, 2, 3);
    // Floating cosmic scythe
    ctx.fillStyle = MONSTER.void;
    ctx.fillRect(cx + 10, cy - 24, 2, 28);
    ctx.fillStyle = RARITY.Epic;
    ctx.beginPath();
    ctx.arc(cx + 12, cy - 22, 8, Math.PI, Math.PI * 1.6);
    ctx.lineWidth = 3;
    ctx.strokeStyle = RARITY.Epic;
    ctx.stroke();
  }

  return Texture.from(canvas);
}
