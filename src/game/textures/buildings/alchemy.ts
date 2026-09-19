// Elixir Cauldron: purple tower + witch-cone pyramid + star tip. Mystic
// green windows on both faces; brewing happens at tile-snapped vats.

import { drawIsoBox, drawIsoDoor, drawIsoPyramid, drawIsoWindow } from '../../objects/iso';

/** Paints the lab body; returns apexY for level-pip placement. */
export function paintAlchemyLab(ctx: CanvasRenderingContext2D, cx: number, groundY: number): number {
  const bw = 28, bh = 14, wh = 28, baseY = groundY + 2;
  const yTop = baseY - wh;
  drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#6d28d9', '#4c1d95', '#7e22ce');
  drawIsoPyramid(ctx, cx, yTop, bw + 7, bh + 4, 26, '#5b21b6', '#8b5cf6');
  const apexY = yTop - 28;
  // Star tip on the cone
  ctx.fillStyle = '#facc15';
  ctx.fillRect(cx - 1, apexY - 2, 3, 3);
  drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'L', 0.28, 0.58, 11, 19, '#22c55e', '#86efac');
  drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'R', 0.28, 0.58, 11, 19, '#22c55e', '#86efac');
  drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.62, 0.9, 19, '#1e1b4b', '#a7f3d0');
  // (No baked cauldron/flasks — tile-snapped vat decor covers the yard.)
  return apexY;
}
