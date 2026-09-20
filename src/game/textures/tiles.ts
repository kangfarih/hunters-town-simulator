// Isometric terrain tile painter: one 64x32 diamond per zone type with a
// dark depth skirt so tiles seat into each other on the 2:1 grid.
// All colors come from the palette canon (../palette) — no raw hex here.

import { Texture } from 'pixi.js';
import { TILE_WIDTH, TILE_HEIGHT } from '../isometric';
import { TERRAIN } from '../palette';
import { createPixelCanvas } from '../objects/iso';

export function createIsoTileTexture(type: 'town_cobble' | 'town_wood' | 'forest_grass' | 'graveyard_soil' | 'volcanic_rock' | 'stone_road' | 'reserve_dark', lit = false): Texture {
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
    ctx.fillStyle = TERRAIN.cobble;
    ctx.fill();

    // Cobblestone paver pattern
    ctx.fillStyle = TERRAIN.cobbleDark;
    ctx.strokeStyle = TERRAIN.cobbleEdge;
    ctx.lineWidth = 1;
    // Tiny cobblestone blocks
    for (let r = 4; r < TILE_HEIGHT - 4; r += 4) {
      for (let c = 8; c < TILE_WIDTH - 8; c += 8) {
        if (ctx.isPointInPath(c + (r % 8 === 0 ? 0 : 4), r)) {
          ctx.fillRect(c + (r % 8 === 0 ? 0 : 4), r, 5, 2);
        }
      }
    }
    // Lamplight: warm dither spilling onto night cobble near buildings.
    if (lit) {
      ctx.fillStyle = TERRAIN.lamplight;
      ctx.fillRect(28, 12, 3, 2);
      ctx.fillRect(33, 14, 2, 2);
      ctx.fillRect(24, 16, 2, 1);
      ctx.fillRect(36, 10, 2, 1);
    }
  } else if (type === 'town_wood') {
    ctx.fillStyle = TERRAIN.plaza;
    ctx.fill();
    ctx.strokeStyle = TERRAIN.plazaDark;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Wood plank lines
    ctx.fillStyle = TERRAIN.plank;
    for (let i = 6; i < TILE_HEIGHT; i += 4) {
      ctx.beginPath();
      ctx.moveTo(10, i);
      ctx.lineTo(TILE_WIDTH - 10, i);
      ctx.stroke();
    }
    if (lit) {
      ctx.fillStyle = TERRAIN.lamplight;
      ctx.fillRect(28, 12, 3, 2);
      ctx.fillRect(34, 15, 2, 2);
    }
  } else if (type === 'forest_grass') {
    ctx.fillStyle = TERRAIN.grass;
    ctx.fill();
    ctx.fillStyle = TERRAIN.grassTuft;
    // Grass tufts
    const tufts = [[20, 10], [35, 8], [28, 18], [44, 14], [15, 20]];
    tufts.forEach(([x, y]) => {
      ctx.fillRect(x, y, 2, 3);
      ctx.fillRect(x + 1, y - 1, 1, 2);
    });
    // Tiny flowers
    ctx.fillStyle = TERRAIN.flowerA;
    ctx.fillRect(22, 14, 2, 2);
    ctx.fillStyle = TERRAIN.flowerB;
    ctx.fillRect(40, 16, 2, 2);
  } else if (type === 'graveyard_soil') {
    ctx.fillStyle = TERRAIN.soil;
    ctx.fill();
    ctx.fillStyle = TERRAIN.soilLight;
    ctx.fillRect(24, 12, 4, 3);
    ctx.fillRect(36, 16, 3, 2);
    // Tiny bone fragments
    ctx.fillStyle = TERRAIN.bone;
    ctx.fillRect(20, 18, 3, 1);
    ctx.fillRect(38, 10, 2, 2);
  } else if (type === 'volcanic_rock') {
    ctx.fillStyle = TERRAIN.lavaRock;
    ctx.fill();
    // Glowing lava cracks
    ctx.fillStyle = TERRAIN.lava;
    ctx.fillRect(28, 12, 6, 1);
    ctx.fillRect(32, 13, 2, 4);
    ctx.fillRect(30, 17, 8, 1);
    ctx.fillStyle = TERRAIN.lavaHot;
    ctx.fillRect(31, 14, 2, 1);
  } else if (type === 'reserve_dark') {
    // Reserved expansion land: very dark slate/indigo placeholder
    ctx.fillStyle = TERRAIN.reserve;
    ctx.fill();
    // Faint speckles
    ctx.fillStyle = TERRAIN.reserveSpeck;
    ctx.fillRect(22, 10, 2, 2);
    ctx.fillRect(36, 16, 2, 2);
    ctx.fillRect(28, 20, 2, 1);
    ctx.fillStyle = TERRAIN.reserveSpeck2;
    ctx.fillRect(30, 8, 2, 1);
    ctx.fillRect(18, 16, 2, 2);
  } else {
    // stone_road
    ctx.fillStyle = TERRAIN.road;
    ctx.fill();
    ctx.fillStyle = TERRAIN.roadLight;
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
    ctx.strokeStyle = TERRAIN.reserveEdge;
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
