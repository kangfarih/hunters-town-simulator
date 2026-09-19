// Vulcan Forge: dark stone body + slate slab roof + ember chimney. Forge
// hearth glows on the SW face; iron door on the SE. Yard anvils come from
// the tile-snapped anvil decor, not baked props.

import { drawIsoBox, drawIsoDoor, drawIsoSlab, drawIsoWindow } from '../../objects/iso';

/** Paints the forge body; returns apexY for level-pip placement. */
export function paintBlacksmith(ctx: CanvasRenderingContext2D, cx: number, groundY: number): number {
  const bw = 32, bh = 16, wh = 26, baseY = groundY + 2;
  const yTop = baseY - wh;
  drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#3d4a61', '#273142', '#475569');
  drawIsoSlab(ctx, cx, yTop, bw + 8, bh + 4, 7, '#2b3548', '#141c2b', '#1e293b');
  const apexY = yTop - 12;
  // Chimney: iso column on the SE roof slope + ember cap
  drawIsoBox(ctx, cx + 16, yTop - 2, 7, 4, 22, '#5b6b84', '#3a455c', '#64748b');
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(cx + 12, yTop - 30, 8, 4);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(cx + 14, yTop - 33, 4, 3);
  // Forge hearth glow on SW face, lamp on SE, iron door on SE.
  // (No baked anvil — the tile-snapped anvil decor covers the yard.)
  drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'L', 0.24, 0.6, 8, 17, '#ea580c', '#fef08a');
  drawIsoWindow(ctx, cx, baseY, bw, bh, wh, 'R', 0.2, 0.44, 10, 17);
  drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.52, 0.86, 17, '#1c0f08', '#eab308');
  return apexY;
}
