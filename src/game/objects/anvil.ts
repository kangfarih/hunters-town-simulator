// Forge yard object: anvil painter + south-row stations + decor render +
// smithing-hunter station resolver. Each anvil sits on its own tile center.

import { Container, Sprite, Texture } from 'pixi.js';
import { gridToScreen } from '../isometric';
import type { GameSimulation } from '../simulation';
import type { Hunter } from '../types';
import { createPixelCanvas, drawIsoBox } from './iso';
import { southRowSlots } from './rows';
import type { DecorCache } from './chair';

/** Forge anvil on a tree stump: iso cylinder base + iso anvil block. */
export function createAnvilTexture(): Texture {
  const w = 26;
  const h = 24;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const cx = 13;

  // Iso shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 20, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stump body: SW dark / SE lit split + top growth-ring ellipse
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(cx - 6, 12, 6, 8);
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(cx, 12, 6, 8);
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(cx, 12, 1, 8);
  ctx.fillStyle = '#8a5f30';
  ctx.beginPath();
  ctx.ellipse(cx, 12, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.ellipse(cx, 12, 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Anvil waist + top as a mini iso box riding the stump
  drawIsoBox(ctx, cx, 11, 8, 4, 4, '#7c8aa0', '#334155', '#475569');
  // Horn taper to the SE + ember glow on the SW face
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(cx + 8, 6); ctx.lineTo(cx + 12, 7); ctx.lineTo(cx + 8, 8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(cx - 5, 8, 2, 1);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(cx - 7, 3, 12, 1);

  return Texture.from(canvas);
}

/**
 * Forge station grid positions: south-row grid at (gx, gy), deterministic
 * order so the nth smithing hunter (sorted by id) takes the nth anvil.
 */
export function forgeStationPositions(gx: number, gy: number, w: number, h: number, capacity: number): { x: number; y: number }[] {
  return southRowSlots(gx, gy, w, h, capacity);
}

/** Anvil grid position for a smithing hunter, or null with none. */
export function forgeStationFor(sim: GameSimulation, hunter: Hunter): { x: number; y: number } | null {
  if (hunter.state !== 'UPGRADING_GEAR' || !hunter.targetBuildingId) return null;
  const forge = sim.buildings.find(
    b => b.id === hunter.targetBuildingId && b.type === 'BLACKSMITH'
  );
  if (!forge) return null;
  const capacity = sim.buildingCapacity(forge);
  const smiths = sim.hunters
    .filter(h => h.state === 'UPGRADING_GEAR' && h.targetBuildingId === forge.id)
    .map(h => h.id)
    .sort();
  const idx = smiths.indexOf(hunter.id);
  if (idx < 0) return null;
  const stations = forgeStationPositions(forge.gx, forge.gy, forge.width, forge.height, capacity);
  return idx < stations.length ? stations[idx] : null;
}

let anvilTexture: Texture | null = null;

/**
 * Forge station decor: one anvil per buildingCapacity(forge). Cached
 * per forge id + level, rebuilt when capacity changes.
 */
export function renderForgeYard(
  cache: DecorCache, container: Container, sim: GameSimulation
): void {
  if (!anvilTexture) anvilTexture = createAnvilTexture();

  const activeForgeIds = new Set<string>();
  for (const b of sim.buildings) {
    if (b.type !== 'BLACKSMITH') continue;
    activeForgeIds.add(b.id);
    const capacity = sim.buildingCapacity(b);
    const cached = cache.get(b.id);
    if (cached && cached.capacity === capacity && cached.level === b.level) continue;

    // Capacity changed (or first build): drop old sprites and rebuild.
    if (cached) {
      for (const s of cached.sprites) container.removeChild(s);
      cache.delete(b.id);
    }

    const stations = forgeStationPositions(b.gx, b.gy, b.width, b.height, capacity);
    const sprites: Sprite[] = [];
    for (const station of stations) {
      const p = gridToScreen(station.x, station.y);
      const sprite = new Sprite(anvilTexture);
      sprite.anchor.set(0.5, 0.85);
      sprite.x = p.x;
      sprite.y = p.y;
      sprite.zIndex = (station.x + station.y) * 100 + 12;
      container.addChild(sprite);
      sprites.push(sprite);
    }
    cache.set(b.id, { capacity, level: b.level, sprites });
  }

  // Cleanup decor for removed forges.
  for (const [id, cached] of cache.entries()) {
    if (!activeForgeIds.has(id)) {
      for (const s of cached.sprites) container.removeChild(s);
      cache.delete(id);
    }
  }
}
