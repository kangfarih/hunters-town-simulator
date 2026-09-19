// Merchant Bazaar: low ochre stall + red/white striped awning clipped to
// its diamond + an iso counter box in front with goods riding its top.

import { drawIsoBox, drawIsoSlab, faceQuad, fillQuad, isoPath } from '../../objects/iso';

/** Paints the bazaar body; returns apexY for level-pip placement. */
export function paintTradingPost(ctx: CanvasRenderingContext2D, cx: number, groundY: number): number {
  const bw = 30, bh = 15, wh = 16, baseY = groundY + 2;
  const yTop = baseY - wh;
  drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#c47a1a', '#8a5410', '#d97706');
  // Striped awning: diamond slab with alternating iso strips
  const aw = bw + 9, ah = bh + 5;
  drawIsoSlab(ctx, cx, yTop, aw, ah, 6, '#ffffff', '#991b1b', '#7f1d1d');
  // Paint red/white bands across the top diamond (clipped)
  ctx.save();
  isoPath(ctx, cx, yTop, aw, ah);
  ctx.clip();
  for (let i = -4; i < 5; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#ffffff';
    const x0 = cx + i * 10;
    ctx.beginPath();
    ctx.moveTo(x0, yTop - ah - 2);
    ctx.lineTo(x0 + 5, yTop - ah - 2);
    ctx.lineTo(x0 + 5 - 14, yTop + ah + 2);
    ctx.lineTo(x0 - 14, yTop + ah + 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  isoPath(ctx, cx, yTop, aw, ah);
  ctx.stroke();
  const apexY = yTop - 10;
  // Stall counter as a low iso box in front + goods riding its top.
  // (Counter front faces get the wood tone; goods are tiny top quads.)
  drawIsoBox(ctx, cx, baseY + bh - 2, 22, 11, 8, '#8a5f30', '#5b3a1e', '#78350f');
  fillQuad(ctx, faceQuad(cx, baseY + bh - 2, 22, 11, 8, 'L', 0.15, 0.32, 8, 11), '#eab308');
  fillQuad(ctx, faceQuad(cx, baseY + bh - 2, 22, 11, 8, 'R', 0.4, 0.57, 8, 11), '#0284c7');
  fillQuad(ctx, faceQuad(cx, baseY + bh - 2, 22, 11, 8, 'R', 0.62, 0.85, 8, 12), '#b45309');
  return apexY;
}
