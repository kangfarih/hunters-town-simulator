// Boar & Barrel Tavern: plaster iso body with timber corner posts (real
// verticals) and sloped mid-beams that follow each face — never a flat
// horizontal span. Terrace seating comes from tile-snapped chair decor.

import { drawIsoBox, drawIsoDoor, drawIsoSlab, drawIsoWindow } from '../../objects/iso';

/** Paints the tavern body; returns apexY for level-pip placement. */
export function paintTavern(ctx: CanvasRenderingContext2D, cx: number, groundY: number): number {
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
  const apexY = yTop - 12;
  drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.6, 0.9, 18);
  drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'L', 0.28, 0.58, 10, 17, '#fbbf24', '#fef3c7');
  drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'R', 0.2, 0.44, 10, 17, '#fbbf24', '#fef3c7');
  // (No baked sign/barrel — tile-snapped chairs/tables cover the terrace.)
  return apexY;
}
