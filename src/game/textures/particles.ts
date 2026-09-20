// Square-pixel particle bases + quantized fire/smoke palettes.
// Ramps are canonized in ../palette (VFX.*); these re-export them so
// existing imports keep working. Strict rule: fillRect only, no arcs /
// gradients. Tinting happens on the sprite (white base texture), never
// by baking new textures per color.

import { Texture } from 'pixi.js';
import { VFX } from '../palette';
import { createPixelCanvas } from '../objects/iso';

/** White-hot -> ember. Indexed by lifeT (1 = just spawned). */
export const FIRE_RAMP = VFX.fire;

/** Cool smoke. Indexed by lifeT (0 = about to die). */
export const SMOKE_RAMP = VFX.smoke;

export const EMBER_COLORS = VFX.ember;

const baseCache = new Map<number, Texture>();

/** Crisp white square, e.g. 2/3/4px. Sprite.tint colors it. */
export function particleSquareTexture(size: 2 | 3 | 4): Texture {
  const hit = baseCache.get(size);
  if (hit) return hit;
  const canvas = createPixelCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const t = Texture.from(canvas);
  baseCache.set(size, t);
  return t;
}

/** Quantized fire color: hot at birth, dark ember at death. 8 steps. */
export function fireColor(lifeT: number, seed: number): string {
  const clamped = Math.max(0, Math.min(1, lifeT));
  // Slight per-particle hue jitter, still quantized.
  const jitter = (seed % 3) - 1; // -1..1
  const idx = Math.max(
    0,
    Math.min(
      FIRE_RAMP.length - 1,
      Math.floor((1 - clamped) * FIRE_RAMP.length) + (jitter > 0 ? 0 : 0),
    ),
  );
  return FIRE_RAMP[idx] as string;
}

/** Quantized smoke color: dark at birth, pale as it disperses. 4 steps. */
export function smokeColor(lifeT: number): string {
  const clamped = Math.max(0, Math.min(1, lifeT));
  const idx = Math.max(0, Math.min(SMOKE_RAMP.length - 1, Math.floor((1 - clamped) * SMOKE_RAMP.length)));
  return SMOKE_RAMP[idx] as string;
}
