// Valor Academy: red dojo body + two stacked pagoda slabs (both true iso
// diamonds) + gold crest. Drills happen at tile-snapped dummies.

import { drawIsoBox, drawIsoDoor, drawIsoSlab, drawIsoWindow } from '../../objects/iso';

/** Paints the academy body; returns apexY for level-pip placement. */
export function paintAcademy(ctx: CanvasRenderingContext2D, cx: number, groundY: number): number {
  const bw = 30, bh = 15, wh = 26, baseY = groundY + 2;
  const yTop = baseY - wh;
  drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#a32424', '#7f1d1d', '#b91c1c');
  // Pagoda: two stacked slabs = two iso diamonds, always on-grid
  drawIsoSlab(ctx, cx, yTop, bw + 9, bh + 5, 6, '#334155', '#111c30', '#1e293b');
  drawIsoSlab(ctx, cx, yTop - 12, bw + 2, bh, 5, '#3b4c66', '#16202f', '#273549');
  const apexY = yTop - 20;
  ctx.fillStyle = '#facc15';
  ctx.fillRect(cx - 6, apexY - 2, 12, 3);
  drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'L', 0.28, 0.52, 11, 18, '#fef3c7', '#ffffff');
  drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.6, 0.9, 18, '#2b0d0d', '#facc15');
  // (No baked dummy/rack — tile-snapped dummy decor covers the yard.)
  return apexY;
}
