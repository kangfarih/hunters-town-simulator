// Mercy Clinic: white iso ward + teal slab roof + red crosses seated in
// both wall planes + blue door on the SE face.

import { drawIsoBox, drawIsoCross, drawIsoDoor, drawIsoSlab } from '../../objects/iso';

/** Paints the clinic body; returns apexY for level-pip placement. */
export function paintClinic(ctx: CanvasRenderingContext2D, cx: number, groundY: number): number {
  const bw = 30, bh = 15, wh = 26, baseY = groundY + 2;
  const yTop = baseY - wh;
  drawIsoBox(ctx, cx, baseY, bw, bh, wh, '#eef2f7', '#c3cedd', '#f8fafc');
  drawIsoSlab(ctx, cx, yTop, bw + 8, bh + 4, 7, '#14a698', '#0b4f4a', '#0f766e');
  const apexY = yTop - 12;
  drawIsoCross(ctx, cx, baseY, bw, bh, wh, 'L', 0.43, 9, 9);
  drawIsoCross(ctx, cx, baseY, bw, bh, wh, 'R', 0.43, 9, 9);
  drawIsoDoor(ctx, cx, baseY, bw, bh, wh, 'R', 0.62, 0.9, 18, '#1d4ed8', '#fde047');
  return apexY;
}
