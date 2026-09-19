// Shared 2:1 isometric canvas primitives for all yard/building painters.
// Convention: verticals stay vertical, horizontals run +/-26.5deg. Every
// solid is an iso box: top diamond + SW (left, dark) face + SE (right, lit).

/** Offscreen canvas with crisp nearest-neighbor pixel scaling. */
export function createPixelCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
  }
  return canvas;
}

export function isoPath(
  ctx: CanvasRenderingContext2D,
  cx: number, yTop: number, hw: number, hh: number
) {
  ctx.beginPath();
  ctx.moveTo(cx, yTop - hh);
  ctx.lineTo(cx + hw, yTop);
  ctx.lineTo(cx, yTop + hh);
  ctx.lineTo(cx - hw, yTop);
  ctx.closePath();
}

export function fillIsoTop(
  ctx: CanvasRenderingContext2D,
  cx: number, yTop: number, hw: number, hh: number, color: string
) {
  isoPath(ctx, cx, yTop, hw, hh);
  ctx.fillStyle = color;
  ctx.fill();
}

/** True iso box: top diamond at (cx, baseY-wallH), two vertical faces down. */
export function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number,
  hw: number, hh: number, wallH: number,
  cTop: string, cLeft: string, cRight: string,
  outline = 'rgba(0,0,0,0.45)'
) {
  const yTop = baseY - wallH;
  const N = { x: cx, y: yTop - hh };
  const E = { x: cx + hw, y: yTop };
  const S = { x: cx, y: yTop + hh };
  const W = { x: cx - hw, y: yTop };
  // Left (SW) face: W -> S -> S+wallH -> W+wallH
  ctx.beginPath();
  ctx.moveTo(W.x, W.y);
  ctx.lineTo(S.x, S.y);
  ctx.lineTo(S.x, S.y + wallH);
  ctx.lineTo(W.x, W.y + wallH);
  ctx.closePath();
  ctx.fillStyle = cLeft;
  ctx.fill();
  // Right (SE) face: E -> S -> S+wallH -> E+wallH
  ctx.beginPath();
  ctx.moveTo(E.x, E.y);
  ctx.lineTo(S.x, S.y);
  ctx.lineTo(S.x, S.y + wallH);
  ctx.lineTo(E.x, E.y + wallH);
  ctx.closePath();
  ctx.fillStyle = cRight;
  ctx.fill();
  // Top diamond
  fillIsoTop(ctx, cx, yTop, hw, hh, cTop);
  // Outline: top diamond + verticals at W/S/E
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  isoPath(ctx, cx, yTop, hw, hh);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(W.x, W.y); ctx.lineTo(W.x, W.y + wallH);
  ctx.moveTo(S.x, S.y); ctx.lineTo(S.x, S.y + wallH);
  ctx.moveTo(E.x, E.y); ctx.lineTo(E.x, E.y + wallH);
  ctx.stroke();
  // Lit edge on the SE top rim so boxes pop against dark ground
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(S.x, S.y); ctx.lineTo(E.x, E.y); ctx.lineTo(N.x, N.y);
  ctx.stroke();
}

/** Flat roof slab: wider diamond + thin skirt, sits at (cx, slabY). */
export function drawIsoSlab(
  ctx: CanvasRenderingContext2D,
  cx: number, slabY: number,
  hw: number, hh: number, thick: number,
  cTop: string, cLeft: string, cRight: string
) {
  // Skirts (thickness)
  ctx.beginPath();
  ctx.moveTo(cx - hw, slabY); ctx.lineTo(cx, slabY + hh);
  ctx.lineTo(cx, slabY + hh + thick); ctx.lineTo(cx - hw, slabY + thick);
  ctx.closePath();
  ctx.fillStyle = cLeft; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + hw, slabY); ctx.lineTo(cx, slabY + hh);
  ctx.lineTo(cx, slabY + hh + thick); ctx.lineTo(cx + hw, slabY + thick);
  ctx.closePath();
  ctx.fillStyle = cRight; ctx.fill();
  fillIsoTop(ctx, cx, slabY, hw, hh, cTop);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  isoPath(ctx, cx, slabY, hw, hh);
  ctx.stroke();
}

/** Pyramid (hip) roof: apex over the top-diamond center, 2 visible slopes. */
export function drawIsoPyramid(
  ctx: CanvasRenderingContext2D,
  cx: number, yTop: number,
  hw: number, hh: number, roofH: number,
  cLeft: string, cRight: string
) {
  const apex = { x: cx, y: yTop - roofH };
  const E = { x: cx + hw, y: yTop };
  const S = { x: cx, y: yTop + hh };
  const W = { x: cx - hw, y: yTop };
  // SW slope (darker)
  ctx.beginPath();
  ctx.moveTo(W.x, W.y); ctx.lineTo(S.x, S.y); ctx.lineTo(apex.x, apex.y);
  ctx.closePath();
  ctx.fillStyle = cLeft; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.stroke();
  // SE slope (lit)
  ctx.beginPath();
  ctx.moveTo(E.x, E.y); ctx.lineTo(S.x, S.y); ctx.lineTo(apex.x, apex.y);
  ctx.closePath();
  ctx.fillStyle = cRight; ctx.fill();
  ctx.stroke();
  // Ridge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.lineTo(apex.x, apex.y); ctx.stroke();
}

/** Face-plane quad on an iso box wall. face 'L' = SW, 'R' = SE.
 *  u0..u1 run outer-corner->S along the top edge (0..1), y0..y1 are px
 *  above the base line. Returns [B0,B1,T1,T0] (bottom edge on the wall,
 *  top edge raised). Sides stay vertical, top/bottom follow the face slope,
 *  so doors/windows sit IN the wall instead of pasted over it. */
export function faceQuad(
  cx: number, baseY: number, hw: number, hh: number, wallH: number,
  face: 'L' | 'R', u0: number, u1: number, y0: number, y1: number
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  const yTop = baseY - wallH;
  const W = { x: cx - hw, y: yTop };
  const S = { x: cx, y: yTop + hh };
  const E = { x: cx + hw, y: yTop };
  const A = face === 'L' ? W : E;
  const lerp = (u: number) => ({ x: A.x + (S.x - A.x) * u, y: A.y + (S.y - A.y) * u });
  const p0 = lerp(u0), p1 = lerp(u1);
  const B0 = { x: p0.x, y: p0.y + wallH - y0 };
  const B1 = { x: p1.x, y: p1.y + wallH - y0 };
  const T1 = { x: p1.x, y: p1.y + wallH - y1 };
  const T0 = { x: p0.x, y: p0.y + wallH - y1 };
  return [B0, B1, T1, T0];
}

export function fillQuad(ctx: CanvasRenderingContext2D, q: { x: number; y: number }[], color: string) {
  ctx.beginPath();
  ctx.moveTo(q[0].x, q[0].y); ctx.lineTo(q[1].x, q[1].y);
  ctx.lineTo(q[2].x, q[2].y); ctx.lineTo(q[3].x, q[3].y);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

/** Iso door: frame + panel + planks + knob + step, all on the face plane. */
export function drawIsoDoor(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number, hw: number, hh: number, wallH: number,
  face: 'L' | 'R', u0: number, u1: number, h: number,
  fill = '#451a03', trim = '#eab308'
) {
  // Frame (slightly larger, dark) then panel inset
  fillQuad(ctx, faceQuad(cx, baseY, hw, hh, wallH, face, u0 - 0.03, u1 + 0.03, -1, h + 1), 'rgba(0,0,0,0.55)');
  const q = faceQuad(cx, baseY, hw, hh, wallH, face, u0, u1, 0, h);
  fillQuad(ctx, q, fill);
  // Vertical plank seams: interpolate bottom->top at thirds
  for (const v of [0.33, 0.66]) {
    const bx = q[0].x + (q[1].x - q[0].x) * v, by = q[0].y + (q[1].y - q[0].y) * v;
    const tx = q[3].x + (q[2].x - q[3].x) * v, ty = q[3].y + (q[2].y - q[3].y) * v;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
  }
  // Top rail highlight follows the face slope
  ctx.strokeStyle = trim; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(q[3].x, q[3].y + 2); ctx.lineTo(q[2].x, q[2].y + 2); ctx.stroke();
  // Knob: small dot 2/3 up, toward the S jamb
  const kx = q[0].x + (q[1].x - q[0].x) * 0.78, ky = q[0].y + (q[1].y - q[0].y) * 0.78 - h * 0.45;
  ctx.fillStyle = trim;
  ctx.fillRect(kx - 1, ky - 1, 2, 2);
  // Step stone at the base (parallelogram on the ground line)
  const s = faceQuad(cx, baseY, hw, hh, wallH, face, u0 - 0.02, u1 + 0.02, -3, -0.5);
  fillQuad(ctx, s, '#94a3b8');
}

/** Iso window: frame + glow + mullions, all sheared to the face. */
export function drawIsoWindow(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number, hw: number, hh: number, wallH: number,
  face: 'L' | 'R', u0: number, u1: number, y0: number, y1: number,
  glow = '#fde047', hi = '#fef9c3'
) {
  fillQuad(ctx, faceQuad(cx, baseY, hw, hh, wallH, face, u0 - 0.04, u1 + 0.04, y0 - 1, y1 + 1), 'rgba(0,0,0,0.6)');
  const q = faceQuad(cx, baseY, hw, hh, wallH, face, u0, u1, y0, y1);
  fillQuad(ctx, q, glow);
  // Sheen along the top rail
  const sheen = faceQuad(cx, baseY, hw, hh, wallH, face, u0 + 0.05, u1 - 0.05, y1 - 2, y1);
  fillQuad(ctx, sheen, hi);
  // Mullions: one vertical, one along-slope mid bar
  const vbx = q[0].x + (q[1].x - q[0].x) * 0.5, vby = q[0].y + (q[1].y - q[0].y) * 0.5;
  const vtx = q[3].x + (q[2].x - q[3].x) * 0.5, vty = q[3].y + (q[2].y - q[3].y) * 0.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(vbx, vby); ctx.lineTo(vtx, vty); ctx.stroke();
  const mid = 0.5;
  const mlx = q[0].x + (q[3].x - q[0].x) * mid, mly = q[0].y + (q[3].y - q[0].y) * mid;
  const mrx = q[1].x + (q[2].x - q[1].x) * mid, mry = q[1].y + (q[2].y - q[1].y) * mid;
  ctx.beginPath(); ctx.moveTo(mlx, mly); ctx.lineTo(mrx, mry); ctx.stroke();
}

/** Iso cross badge (clinic): vertical bar + slope-following bar per face. */
export function drawIsoCross(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number, hw: number, hh: number, wallH: number,
  face: 'L' | 'R', u: number, y: number, size: number, color = '#ef4444'
) {
  // Vertical bar: narrow u-span, tall y-span
  fillQuad(ctx, faceQuad(cx, baseY, hw, hh, wallH, face, u - 0.04, u + 0.04, y, y + size), color);
  // Horizontal bar: wide u-span, thin y-span at mid height
  fillQuad(ctx, faceQuad(cx, baseY, hw, hh, wallH, face, u - 0.13, u + 0.13, y + size * 0.38, y + size * 0.62), color);
}
