// Academy yard object: training-dummy painter + south-row stations +
// decor render + training-hunter station resolver. Dojo lines run west to
// east, each next line one block further south.

import { Container, Sprite, Texture } from 'pixi.js';
import { gridToScreen } from '../isometric';
import type { GameSimulation } from '../simulation';
import type { Hunter } from '../types';
import { createPixelCanvas, fillIsoTop, isoPath } from './iso';
import { southRowSlots } from './rows';
import type { DecorCache } from './chair';

/** Straw training dummy: iso diamond base + post + iso-sloped crossbar. */
export function createTrainingDummyTexture(): Texture {
  const w = 24;
  const h = 30;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const cx = 12;

  // Iso ground shadow + foot diamond base
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 27, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  fillIsoTop(ctx, cx, 25, 7, 3.5, '#4a3419');
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  isoPath(ctx, cx, 25, 7, 3.5);
  ctx.stroke();

  // Wooden pole with lit edge
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(cx - 1, 9, 3, 16);
  ctx.fillStyle = '#8a5f30';
  ctx.fillRect(cx - 1, 9, 1, 16);
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(cx + 1, 9, 1, 16);

  // Crossbar arms along the iso slope (down-right 2:1, not horizontal)
  ctx.strokeStyle = '#5b3a1e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 8, 11); ctx.lineTo(cx + 8, 19);
  ctx.stroke();
  ctx.strokeStyle = '#8a5f30';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 8, 10.5); ctx.lineTo(cx + 8, 18.5);
  ctx.stroke();

  // Straw body (bound bundle) riding the pole
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(cx - 4, 15, 8, 8);
  ctx.fillStyle = '#a16207';
  ctx.fillRect(cx - 4, 15, 2, 8);
  ctx.fillRect(cx + 2, 15, 2, 8);
  ctx.fillStyle = '#fde047';
  ctx.fillRect(cx - 2, 15, 1, 8);
  ctx.fillRect(cx + 1, 15, 1, 8);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(cx - 2, 18, 4, 1);
  // Rope ties
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 4, 16, 8, 1);
  ctx.fillRect(cx - 4, 21, 8, 1);

  // Straw head + headband
  ctx.fillStyle = '#e8b64c';
  ctx.fillRect(cx - 3, 4, 6, 5);
  ctx.fillStyle = '#a16207';
  ctx.fillRect(cx - 3, 4, 1, 5);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(cx - 1, 4, 2, 5);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(cx - 3, 7, 6, 1);

  return Texture.from(canvas);
}

/**
 * Academy station grid positions: south-row grid at (gx, gy),
 * deterministic order so the nth trainee (sorted by id) takes the nth dummy.
 */
export function academyStationPositions(gx: number, gy: number, capacity: number): { x: number; y: number }[] {
  return southRowSlots(gx, gy, capacity);
}

/** Dummy grid position for a training hunter, or null with none. */
export function academyStationFor(sim: GameSimulation, hunter: Hunter): { x: number; y: number } | null {
  if (hunter.state !== 'LEARNING_SKILL' || !hunter.targetBuildingId) return null;
  const academy = sim.buildings.find(
    b => b.id === hunter.targetBuildingId && b.type === 'TRAINING_ACADEMY'
  );
  if (!academy) return null;
  const capacity = sim.buildingCapacity(academy);
  const trainees = sim.hunters
    .filter(h => h.state === 'LEARNING_SKILL' && h.targetBuildingId === academy.id)
    .map(h => h.id)
    .sort();
  const idx = trainees.indexOf(hunter.id);
  if (idx < 0) return null;
  const stations = academyStationPositions(academy.gx, academy.gy, capacity);
  return idx < stations.length ? stations[idx] : null;
}

let dummyTexture: Texture | null = null;

/**
 * Academy station decor: one dummy per buildingCapacity(academy). Cached
 * per academy id + level, rebuilt when capacity changes.
 */
export function renderAcademyYard(
  cache: DecorCache, container: Container, sim: GameSimulation
): void {
  if (!dummyTexture) dummyTexture = createTrainingDummyTexture();

  const activeAcademyIds = new Set<string>();
  for (const b of sim.buildings) {
    if (b.type !== 'TRAINING_ACADEMY') continue;
    activeAcademyIds.add(b.id);
    const capacity = sim.buildingCapacity(b);
    const cached = cache.get(b.id);
    if (cached && cached.capacity === capacity && cached.level === b.level) continue;

    // Capacity changed (or first build): drop old sprites and rebuild.
    if (cached) {
      for (const s of cached.sprites) container.removeChild(s);
      cache.delete(b.id);
    }

    const stations = academyStationPositions(b.gx, b.gy, capacity);
    const sprites: Sprite[] = [];
    for (const station of stations) {
      const p = gridToScreen(station.x, station.y);
      const sprite = new Sprite(dummyTexture);
      sprite.anchor.set(0.5, 0.85);
      sprite.x = p.x;
      sprite.y = p.y;
      sprite.zIndex = (station.x + station.y) * 100 + 12;
      container.addChild(sprite);
      sprites.push(sprite);
    }
    cache.set(b.id, { capacity, level: b.level, sprites });
  }

  // Cleanup decor for removed academies.
  for (const [id, cached] of cache.entries()) {
    if (!activeAcademyIds.has(id)) {
      for (const s of cached.sprites) container.removeChild(s);
      cache.delete(id);
    }
  }
}
