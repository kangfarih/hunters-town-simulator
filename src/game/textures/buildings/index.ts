// Building texture assembly: grounded foundation slab + per-type body
// painter (one module per building) + floating level pips. To add a
// building, add its painter module and a dispatch case — nothing else moves.

import { Texture } from 'pixi.js';
import type { BuildingType } from '../../../types';
import { createPixelCanvas } from '../../objects/iso';
import { paintTownHall } from './townhall';
import { paintBlacksmith } from './blacksmith';
import { paintAlchemyLab } from './alchemy';
import { paintTavern } from './tavern';
import { paintAcademy } from './academy';
import { paintTradingPost } from './trading';
import { paintClinic } from './clinic';

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

  // True isometric bodies: every painter builds an iso box (or two),
  // then a roof slab / pyramid on the top diamond. Yard props stay as
  // tile-snapped decor sprites so they never break the iso silhouette.
  let apexY = groundY - 78;
  if (type === 'TOWN_HALL') {
    apexY = paintTownHall(ctx, cx, groundY);
  } else if (type === 'BLACKSMITH') {
    apexY = paintBlacksmith(ctx, cx, groundY);
  } else if (type === 'ALCHEMY_LAB') {
    apexY = paintAlchemyLab(ctx, cx, groundY);
  } else if (type === 'TAVERN') {
    apexY = paintTavern(ctx, cx, groundY);
  } else if (type === 'TRAINING_ACADEMY') {
    apexY = paintAcademy(ctx, cx, groundY);
  } else if (type === 'TRADING_POST') {
    apexY = paintTradingPost(ctx, cx, groundY);
  } else {
    apexY = paintClinic(ctx, cx, groundY);
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
