// 16-bit monster sprite painter: one frame per type with a squish
// animation phase. Boss Lich Lord included.

import { Texture } from 'pixi.js';
import { createPixelCanvas } from '../objects/iso';

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
