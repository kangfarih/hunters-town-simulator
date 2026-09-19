// Tavern table yard prop: texture painter + tile-snapped table placement.
// Tables sit on their own tile centers (never on cracks), one per chair
// pair, so shadows land on diamond centers like every other yard prop.

import { Texture } from 'pixi.js';
import { createPixelCanvas } from './iso';

/** Round wooden tavern table: iso 2:1 top + skirt + pedestal. */
export function createTableTexture(): Texture {
  const w = 26;
  const h = 26;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const cx = 13, topY = 13;

  // Iso ground shadow + pedestal foot
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 23, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1a0c';
  ctx.beginPath();
  ctx.ellipse(cx, 21, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pedestal leg
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(cx - 2, topY + 2, 4, 7);
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(cx - 2, topY + 2, 1, 7);

  // Table rim skirt (darker ellipse offset +3y, then top over it)
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.ellipse(cx, topY + 3, 11, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tabletop: true 2:1 iso ellipse + sheen
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.ellipse(cx, topY, 11, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.ellipse(cx, topY - 1, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Plank seam across the top along the major axis
  ctx.strokeStyle = 'rgba(69,26,3,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 10, topY); ctx.lineTo(cx + 10, topY);
  ctx.stroke();

  // Ale mugs sit ON the top surface (bases tucked into the ellipse)
  ctx.fillStyle = '#92400e';
  ctx.fillRect(8, 6, 3, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 5, 3, 1);
  ctx.fillStyle = '#92400e';
  ctx.fillRect(15, 7, 3, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(15, 6, 3, 1);

  return Texture.from(canvas);
}

// Table placement lives in rows.ts (tavernTableSpot): dedicated row-1
// tiles per chair pair, so tables never share a tile with a chair.
