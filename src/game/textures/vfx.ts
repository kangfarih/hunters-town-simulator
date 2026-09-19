// Skill VFX sprite painter: one 64px effect texture per skill type.
// Flight/rotation behavior lives in the effects render layer.

import { Texture } from 'pixi.js';
import { createPixelCanvas } from '../objects/iso';

/**
 * Strict-square whirl arc: 270° band of 3-4px blocks on an iso-flattened
 * ring + motion dashes in the gap. White/slate/blue steel palette.
 * The body never spins — this overlay does (see HuntersLayer).
 */
export function createWhirlArcTexture(): Texture {
  const size = 64;
  const canvas = createPixelCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const band = ['#f8fafc', '#94a3b8', '#38bdf8', '#e2e8f0'];
  let k = 0;
  for (let a = 0; a < 270; a += 7.5, k++) {
    const rad = (a * Math.PI) / 180;
    // Dithered radius 20..22 so the band feels hand-placed.
    const r = 20 + (Math.sin(a * 12.9898) * 0.5 + 0.5) * 2;
    const x = Math.round(cx + Math.cos(rad) * r);
    const y = Math.round(cy + Math.sin(rad) * r * 0.55);
    const s = k % 3 === 0 ? 4 : 3;
    ctx.fillStyle = band[k % band.length]!;
    ctx.fillRect(x - 1, y - 1, s, s);
  }
  // Motion dashes in the open 90° gap: tangential 6x2 rects.
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(cx + 12, cy + 8, 6, 2);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(cx + 4, cy + 12, 5, 2);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(cx + 18, cy + 3, 5, 2);
  return Texture.from(canvas);
}

export function createSkillVfxTexture(type: string): Texture {
  const size = 64;
  const canvas = createPixelCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;

  if (type === 'slash') {
    // Arc of razor energy
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center, center, 22, -Math.PI * 0.7, Math.PI * 0.1);
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, 20, -Math.PI * 0.7, Math.PI * 0.1);
    ctx.stroke();
  } else if (type === 'meteor') {
    // Strict-square burning rock: dithered 2-4px blocks, white-hot core,
    // orange mid, dark red rim. No gradients/arcs — particles add the flames.
    const px: Array<[number, number, number, string]> = [
      // x, y, size, color (relative to center)
      [-6, -6, 4, '#7c2d12'], [2, -8, 4, '#7c2d12'], [-10, 0, 4, '#991b1b'],
      [6, -2, 4, '#ea580c'], [-4, 2, 4, '#ea580c'], [4, 6, 4, '#f97316'],
      [-8, 6, 3, '#fb923c'], [0, -4, 4, '#facc15'], [-2, 4, 4, '#fef08a'],
      [2, 0, 4, '#ffffff'], [-12, -2, 2, '#f97316'], [10, 4, 2, '#f97316'],
      [-2, -12, 2, '#fb923c'], [6, 10, 2, '#fb923c'],
    ];
    for (const [ox, oy, s, c] of px) {
      ctx.fillStyle = c;
      ctx.fillRect(center + ox, center + oy, s, s);
    }
  } else if (type === 'whirlwind') {
    // Delegates to the strict-square arc painter above (single source).
    return createWhirlArcTexture();
  } else if (type === 'smite') {
    // Holy radiant beam
    ctx.fillStyle = 'rgba(253, 224, 71, 0.8)';
    ctx.fillRect(center - 6, 0, 12, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center - 2, 0, 4, size);
    // Holy sparkle stars
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(center - 12, center - 2, 24, 4);
  } else if (type === 'multishot') {
    // Single piercing arrow (points up; renderer rotates to flight path).
    // One arrow per sprite — Quick Shot's 3-shot volley comes from 3
    // staggered VFX spawns, not 3 arrows baked into one texture.
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(center, center - 14, 2, 16);
    ctx.beginPath();
    ctx.moveTo(center - 3, center - 14);
    ctx.lineTo(center + 1, center - 20);
    ctx.lineTo(center + 5, center - 14);
    ctx.fill();
  } else if (type === 'heal') {
    // Soft green-gold upward sparkle burst
    const grad = ctx.createRadialGradient(center, center + 6, 2, center, center + 6, 22);
    grad.addColorStop(0, 'rgba(248, 250, 252, 0.95)');
    grad.addColorStop(0.4, 'rgba(74, 222, 128, 0.7)');
    grad.addColorStop(1, 'rgba(212, 160, 23, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center + 6, 22, 0, Math.PI * 2);
    ctx.fill();
    // Rising sparkles (lower = larger, fading upward)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(center - 8, center + 10, 4, 4);
    ctx.fillRect(center + 5, center + 4, 3, 3);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(center - 3, center - 2, 3, 3);
    ctx.fillRect(center - 11, center - 6, 2, 2);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(center + 2, center - 12, 2, 2);
    ctx.fillRect(center - 1, center - 18, 2, 2);
  } else if (type === 'ballad' || type === 'encore') {
    // Bard music burst: teal-gold notes on a soft glow
    const grad = ctx.createRadialGradient(center, center, 2, center, center, 24);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0.9)');
    grad.addColorStop(0.5, 'rgba(251, 191, 36, 0.55)');
    grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, Math.PI * 2);
    ctx.fill();
    // Three note heads + stems
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(center - 12, center + 2, 6, 5);
    ctx.fillRect(center - 1, center - 8, 6, 5);
    ctx.fillRect(center + 8, center + 6, 5, 4);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(center - 8, center - 10, 2, 12);
    ctx.fillRect(center + 3, center - 18, 2, 10);
    ctx.fillRect(center + 11, center - 4, 2, 10);
  } else if (type === 'holy_burst') {
    // Renewing Dawn: gold pillar (party burst) wrapped in a green healing ring
    ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.fillRect(center - 5, 4, 10, size - 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center - 2, 4, 4, size - 8);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center + 6, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center + 6, 26, 0, Math.PI * 2);
    ctx.stroke();
    // Rising healing sparks
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(center - 12, 8, 3, 3);
    ctx.fillRect(center + 8, 16, 3, 3);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(center - 4, 24, 2, 2);
    ctx.fillRect(center + 3, 6, 2, 2);
  } else if (type === 'levelup') {
    // Level-up burst: gold pillar + expanding ring + rising sparks
    ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.fillRect(center - 5, 4, 10, size - 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center - 2, 4, 4, size - 8);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center + 6, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center + 6, 26, 0, Math.PI * 2);
    ctx.stroke();
    // Rising sparks
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(center - 12, 8, 3, 3);
    ctx.fillRect(center + 8, 16, 3, 3);
    ctx.fillRect(center - 4, 24, 2, 2);
    ctx.fillRect(center + 3, 6, 2, 2);
  } else {
    // Strict-square impact burst: 8 dithered sparks on the diagonals +
    // hot 2x2 core. Old version used fillRect on a circle — same squares,
    // now with a quantized fire palette.
    const spark: Array<[number, number, string]> = [
      [14, 0, '#fb923c'], [-14, 0, '#fb923c'], [0, 14, '#f97316'], [0, -14, '#f97316'],
      [10, 10, '#facc15'], [-10, -10, '#facc15'], [10, -10, '#fef08a'], [-10, 10, '#fef08a'],
    ];
    for (const [ox, oy, c] of spark) {
      ctx.fillStyle = c;
      ctx.fillRect(center + ox - 2, center + oy - 2, 4, 4);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center - 2, center - 2, 4, 4);
  }

  return Texture.from(canvas);
}
