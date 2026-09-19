// Tavern yard object: chair painter + south-row seats + chairs/tables
// decor render + resting-hunter seat resolver. Chairs and tables each sit
// on their own tile centers south of the facade, clear of the platform.

import { Container, Sprite, Texture } from 'pixi.js';
import { gridToScreen } from '../isometric';
import type { GameSimulation } from '../simulation';
import type { Hunter } from '../types';
import { createPixelCanvas, fillIsoTop, isoPath } from './iso';
import { southRowSlots } from './rows';
import { createTableTexture, tableSpotForPair } from './table';

/** Wooden tavern chair: billboard backrest + true iso diamond seat. */
export function createChairTexture(): Texture {
  const w = 22;
  const h = 26;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const cx = 11, seatY = 15, hw = 8, hh = 4;

  // Iso ground shadow (2:1)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 23, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Backrest posts (behind seat, north edge)
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(3, 2, 3, 13);
  ctx.fillRect(16, 2, 3, 13);
  ctx.fillStyle = '#8a5f30';
  ctx.fillRect(3, 2, 1, 13);
  ctx.fillRect(16, 2, 1, 13);
  // Backrest slats
  ctx.fillStyle = '#78350f';
  ctx.fillRect(3, 4, 16, 3);
  ctx.fillRect(3, 9, 16, 3);
  ctx.fillStyle = '#a16207';
  ctx.fillRect(3, 4, 16, 1);
  ctx.fillRect(3, 9, 16, 1);

  // Seat skirt: SW dark + SE lit vertical faces under the diamond
  ctx.beginPath();
  ctx.moveTo(cx - hw, seatY); ctx.lineTo(cx, seatY + hh);
  ctx.lineTo(cx, seatY + hh + 3); ctx.lineTo(cx - hw, seatY + 3);
  ctx.closePath();
  ctx.fillStyle = '#5b3a1e'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + hw, seatY); ctx.lineTo(cx, seatY + hh);
  ctx.lineTo(cx, seatY + hh + 3); ctx.lineTo(cx + hw, seatY + 3);
  ctx.closePath();
  ctx.fillStyle = '#78350f'; ctx.fill();
  // Seat top diamond (plank) + center seam along the S-N axis
  fillIsoTop(ctx, cx, seatY, hw, hh, '#a16207');
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, seatY - hh); ctx.lineTo(cx, seatY + hh); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  isoPath(ctx, cx, seatY, hw, hh);
  ctx.stroke();

  // Front legs (south, longer)
  ctx.fillStyle = '#3a2412';
  ctx.fillRect(5, seatY + hh + 2, 2, 4);
  ctx.fillRect(15, seatY + hh + 2, 2, 4);

  return Texture.from(canvas);
}

/**
 * Tavern seat grid positions: south-row grid at (gx, gy), deterministic
 * order so the nth resting hunter (sorted by id) sits on the nth seat.
 */
export function tavernSeatPositions(gx: number, gy: number, capacity: number): { x: number; y: number }[] {
  return southRowSlots(gx, gy, capacity);
}

/**
 * Seat grid position for a resting hunter, or null when they have no seat.
 */
export function seatFor(sim: GameSimulation, hunter: Hunter): { x: number; y: number } | null {
  if (hunter.state !== 'RESTING_TAVERN' || !hunter.targetBuildingId) return null;
  const tavern = sim.buildings.find(
    b => b.id === hunter.targetBuildingId && b.type === 'TAVERN'
  );
  if (!tavern) return null;
  const capacity = sim.buildingCapacity(tavern);
  const resters = sim.hunters
    .filter(h => h.state === 'RESTING_TAVERN' && h.targetBuildingId === tavern.id)
    .map(h => h.id)
    .sort();
  const idx = resters.indexOf(hunter.id);
  if (idx < 0) return null;
  const seats = tavernSeatPositions(tavern.gx, tavern.gy, capacity);
  return idx < seats.length ? seats[idx] : null;
}

export type DecorCache = Map<string, { capacity: number; level: number; sprites: Sprite[] }>;

let chairTexture: Texture | null = null;
let tableTexture: Texture | null = null;

/**
 * Tavern furniture decor: one chair per buildingCapacity(tavern) seat plus
 * one round table per 2 chairs on its own snapped tile. Cached per tavern
 * id + level, rebuilt when capacity changes.
 */
export function renderTavernYard(
  cache: DecorCache, container: Container, sim: GameSimulation
): void {
  if (!chairTexture) chairTexture = createChairTexture();
  if (!tableTexture) tableTexture = createTableTexture();

  const activeTavernIds = new Set<string>();
  for (const b of sim.buildings) {
    if (b.type !== 'TAVERN') continue;
    activeTavernIds.add(b.id);
    const capacity = sim.buildingCapacity(b);
    const cached = cache.get(b.id);
    if (cached && cached.capacity === capacity && cached.level === b.level) continue;

    // Capacity changed (or first build): drop old sprites and rebuild.
    if (cached) {
      for (const s of cached.sprites) container.removeChild(s);
      cache.delete(b.id);
    }

    const seats = tavernSeatPositions(b.gx, b.gy, capacity);
    const sprites: Sprite[] = [];
    for (const seat of seats) {
      const p = gridToScreen(seat.x, seat.y);
      const chair = new Sprite(chairTexture);
      chair.anchor.set(0.5, 0.85);
      chair.x = p.x;
      chair.y = p.y;
      chair.zIndex = (seat.x + seat.y) * 100 + 12;
      container.addChild(chair);
      sprites.push(chair);
    }
    // One table per 2 chairs on a snapped tile center (see table.ts).
    for (let i = 0; i + 1 < seats.length; i += 2) {
      const t = tableSpotForPair(seats[i], seats[i + 1]);
      const p = gridToScreen(t.x, t.y);
      const table = new Sprite(tableTexture);
      table.anchor.set(0.5, 0.85);
      table.x = p.x;
      table.y = p.y;
      table.zIndex = (t.x + t.y) * 100 + 11;
      container.addChild(table);
      sprites.push(table);
    }
    cache.set(b.id, { capacity, level: b.level, sprites });
  }

  // Cleanup decor for removed taverns.
  for (const [id, cached] of cache.entries()) {
    if (!activeTavernIds.has(id)) {
      for (const s of cached.sprites) container.removeChild(s);
      cache.delete(id);
    }
  }
}
