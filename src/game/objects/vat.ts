// Cauldron yard object: brew-vat painter + south-row stations + decor
// render + brewing-hunter station resolver. Each vat sits on its own tile.

import { Container, Sprite, Texture } from 'pixi.js';
import { gridToScreen } from '../isometric';
import type { GameSimulation } from '../simulation';
import type { Hunter } from '../types';
import { createPixelCanvas } from './iso';
import { southRowSlots } from './rows';
import type { DecorCache } from './chair';

/** Brewing vat: iso cylinder tub + 2:1 brew surface. */
export function createVatTexture(): Texture {
  const w = 26;
  const h = 26;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const cx = 13, topY = 10;

  // Iso shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 22, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tub body: SW staves dark / SE staves lit, belly shaded
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(cx - 7, topY, 7, 11);
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(cx, topY, 7, 11);
  ctx.fillStyle = '#8a5f30';
  ctx.fillRect(cx, topY, 1, 11);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(cx - 7, topY + 8, 14, 3);
  // Iron bands follow the tub girth
  ctx.fillStyle = '#374151';
  ctx.fillRect(cx - 7, topY + 2, 14, 2);
  ctx.fillRect(cx - 7, topY + 7, 14, 2);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(cx - 7, topY + 2, 14, 1);
  ctx.fillRect(cx - 7, topY + 7, 14, 1);

  // Wooden rim (darker ellipse) + brew surface (true 2:1)
  ctx.fillStyle = '#2a1a0c';
  ctx.beginPath();
  ctx.ellipse(cx, topY, 7.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.ellipse(cx, topY, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6ee7b7';
  ctx.beginPath();
  ctx.ellipse(cx - 2, topY - 1, 3, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bubbles rise off the surface
  ctx.fillStyle = '#a7f3d0';
  ctx.fillRect(10, 4, 2, 2);
  ctx.fillRect(15, 3, 2, 2);

  return Texture.from(canvas);
}

/**
 * Cauldron station grid positions: south-row grid at (gx, gy),
 * deterministic order so the nth brewer (sorted by id) takes the nth vat.
 */
export function cauldronStationPositions(gx: number, gy: number, capacity: number): { x: number; y: number }[] {
  return southRowSlots(gx, gy, capacity);
}

/** Vat grid position for a brewing hunter, or null with none. */
export function cauldronStationFor(sim: GameSimulation, hunter: Hunter): { x: number; y: number } | null {
  if (hunter.state !== 'BREWING_ELIXIR' || !hunter.targetBuildingId) return null;
  const lab = sim.buildings.find(
    b => b.id === hunter.targetBuildingId && b.type === 'ALCHEMY_LAB'
  );
  if (!lab) return null;
  const capacity = sim.buildingCapacity(lab);
  const brewers = sim.hunters
    .filter(h => h.state === 'BREWING_ELIXIR' && h.targetBuildingId === lab.id)
    .map(h => h.id)
    .sort();
  const idx = brewers.indexOf(hunter.id);
  if (idx < 0) return null;
  const stations = cauldronStationPositions(lab.gx, lab.gy, capacity);
  return idx < stations.length ? stations[idx] : null;
}

let vatTexture: Texture | null = null;

/**
 * Cauldron station decor: one vat per buildingCapacity(lab). Cached
 * per lab id + level, rebuilt when capacity changes.
 */
export function renderLabYard(
  cache: DecorCache, container: Container, sim: GameSimulation
): void {
  if (!vatTexture) vatTexture = createVatTexture();

  const activeLabIds = new Set<string>();
  for (const b of sim.buildings) {
    if (b.type !== 'ALCHEMY_LAB') continue;
    activeLabIds.add(b.id);
    const capacity = sim.buildingCapacity(b);
    const cached = cache.get(b.id);
    if (cached && cached.capacity === capacity && cached.level === b.level) continue;

    // Capacity changed (or first build): drop old sprites and rebuild.
    if (cached) {
      for (const s of cached.sprites) container.removeChild(s);
      cache.delete(b.id);
    }

    const stations = cauldronStationPositions(b.gx, b.gy, capacity);
    const sprites: Sprite[] = [];
    for (const station of stations) {
      const p = gridToScreen(station.x, station.y);
      const sprite = new Sprite(vatTexture);
      sprite.anchor.set(0.5, 0.85);
      sprite.x = p.x;
      sprite.y = p.y;
      sprite.zIndex = (station.x + station.y) * 100 + 12;
      container.addChild(sprite);
      sprites.push(sprite);
    }
    cache.set(b.id, { capacity, level: b.level, sprites });
  }

  // Cleanup decor for removed labs.
  for (const [id, cached] of cache.entries()) {
    if (!activeLabIds.has(id)) {
      for (const s of cached.sprites) container.removeChild(s);
      cache.delete(id);
    }
  }
}
