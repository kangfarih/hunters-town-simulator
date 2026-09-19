// Sanctuary Hall: gray iso body + red pyramid roof + crest tower with a
// gold clock. Main gate sits IN the lit SE face; banner hangs as cloth.

import { drawIsoBox, drawIsoDoor, drawIsoPyramid, drawIsoWindow } from '../../objects/iso';

/** Paints the hall body; returns apexY for level-pip placement. */
export function paintTownHall(ctx: CanvasRenderingContext2D, cx: number, groundY: number): number {
  const bw = 32, bh = 16, wh = 30, baseY = groundY + 2;
  const yTop = baseY - wh;
  drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#7d8aa0', '#525f77', '#94a3b8');
  drawIsoPyramid(ctx, cx, yTop, bw + 7, bh + 4, 22, '#7f1d1d', '#b91c1c');
  const apexY = yTop - 24;
  // Crest tower: small iso box riding the roof center
  drawIsoBox(ctx, cx, yTop - 4, 11, 6, 16, '#a31616', '#7f1d1d', '#dc2626');
  ctx.fillStyle = '#fde047';
  ctx.beginPath(); ctx.arc(cx, yTop - 16, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#451a03';
  ctx.fillRect(cx - 1, yTop - 18, 2, 4);
  // Windows + gate seated IN the wall planes (SE door = main entry)
  drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'L', 0.28, 0.58, 10, 18);
  drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'R', 0.28, 0.58, 10, 18);
  drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.62, 0.9, 22);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(cx - 4, yTop + 2, 8, 14);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(cx - 2, yTop + 5, 4, 5);
  return apexY;
}
