// Isometric terrain tile painter: one 64x32 diamond per zone type with a
// dark depth skirt so tiles seat into each other on the 2:1 grid.

import { Texture } from 'pixi.js';
import { TILE_WIDTH, TILE_HEIGHT } from '../isometric';
import { createPixelCanvas } from '../objects/iso';

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
