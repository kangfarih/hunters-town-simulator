// Clinic yard object: cot painter + south-row beds + decor render +
// recovering-hunter bed resolver. Each bed sits on its own tile center.

import { Container, Sprite, Texture } from 'pixi.js';
import { gridToScreen } from '../isometric';
import type { GameSimulation } from '../simulation';
import type { Hunter } from '../types';
import { createPixelCanvas, fillIsoTop, isoPath } from './iso';
import { southRowSlots } from './rows';
import type { DecorCache } from './chair';

/** Clinic cot as a mini iso box: diamond sheet + SW/SE faces. */
export function createBedTexture(): Texture {
  const w = 30;
  const h = 24;
  const canvas = createPixelCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const cx = 15, topY = 10, hw = 12, hh = 6, wallH = 5;

  // Iso shadow + legs at W/S/E corners
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, 20, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(cx - hw - 1, topY + wallH + 2, 2, 3);
  ctx.fillRect(cx - 1, topY + hh + wallH - 1, 2, 3);
  ctx.fillRect(cx + hw - 1, topY + wallH + 2, 2, 3);

  // SW face (dark steel) + SE face (lit steel)
  ctx.beginPath();
  ctx.moveTo(cx - hw, topY); ctx.lineTo(cx, topY + hh);
  ctx.lineTo(cx, topY + hh + wallH); ctx.lineTo(cx - hw, topY + wallH);
  ctx.closePath();
  ctx.fillStyle = '#3f4a5e'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + hw, topY); ctx.lineTo(cx, topY + hh);
  ctx.lineTo(cx, topY + hh + wallH); ctx.lineTo(cx + hw, topY + wallH);
  ctx.closePath();
  ctx.fillStyle = '#5b6b84'; ctx.fill();
  // Sheet top diamond
  fillIsoTop(ctx, cx, topY, hw, hh, '#f8fafc');
  // Blanket: eastern half-diamond (foot) in teal
  ctx.save();
  isoPath(ctx, cx, topY, hw, hh);
  ctx.clip();
  ctx.fillStyle = '#0f766e';
  ctx.beginPath();
  ctx.moveTo(cx, topY - hh); ctx.lineTo(cx + hw, topY);
  ctx.lineTo(cx, topY + hh); ctx.lineTo(cx, topY - hh);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#14b8a6';
  ctx.fillRect(cx + 1, topY - 3, 6, 1);
  // Pillow: small white diamond at the west (head) end
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - hw + 1, topY); ctx.lineTo(cx - hw + 5, topY - 2);
  ctx.lineTo(cx - hw + 9, topY); ctx.lineTo(cx - hw + 5, topY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  isoPath(ctx, cx, topY, hw, hh);
  ctx.stroke();
  // Head/foot posts at W/E top corners
  ctx.fillStyle = '#374151';
  ctx.fillRect(cx - hw - 1, topY - 6, 2, 8);
  ctx.fillRect(cx + hw - 1, topY - 6, 2, 8);
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(cx - hw - 1, topY - 6, 1, 2);
  ctx.fillRect(cx + hw - 1, topY - 6, 1, 2);

  return Texture.from(canvas);
}

/**
 * Clinic bed grid positions: south-row grid at (gx, gy), deterministic
 * order so the nth recovering hunter (sorted by id) takes the nth bed.
 */
export function clinicBedPositions(gx: number, gy: number, capacity: number): { x: number; y: number }[] {
  return southRowSlots(gx, gy, capacity);
}

/** Bed grid position for a recovering hunter, or null with no bed. */
export function bedFor(sim: GameSimulation, hunter: Hunter): { x: number; y: number } | null {
  if (hunter.state !== 'RECOVERING_CLINIC' || !hunter.targetBuildingId) return null;
  const clinic = sim.buildings.find(
    b => b.id === hunter.targetBuildingId && b.type === 'CLINIC'
  );
  if (!clinic) return null;
  const capacity = sim.buildingCapacity(clinic);
  const patients = sim.hunters
    .filter(h => h.state === 'RECOVERING_CLINIC' && h.targetBuildingId === clinic.id)
    .map(h => h.id)
    .sort();
  const idx = patients.indexOf(hunter.id);
  if (idx < 0) return null;
  const beds = clinicBedPositions(clinic.gx, clinic.gy, capacity);
  return idx < beds.length ? beds[idx] : null;
}

let bedTexture: Texture | null = null;

/**
 * Clinic furniture decor: one bed per buildingCapacity(clinic). Cached
 * per clinic id + level, rebuilt when capacity changes.
 */
export function renderClinicYard(
  cache: DecorCache, container: Container, sim: GameSimulation
): void {
  if (!bedTexture) bedTexture = createBedTexture();

  const activeClinicIds = new Set<string>();
  for (const b of sim.buildings) {
    if (b.type !== 'CLINIC') continue;
    activeClinicIds.add(b.id);
    const capacity = sim.buildingCapacity(b);
    const cached = cache.get(b.id);
    if (cached && cached.capacity === capacity && cached.level === b.level) continue;

    // Capacity changed (or first build): drop old sprites and rebuild.
    if (cached) {
      for (const s of cached.sprites) container.removeChild(s);
      cache.delete(b.id);
    }

    const beds = clinicBedPositions(b.gx, b.gy, capacity);
    const sprites: Sprite[] = [];
    for (const bed of beds) {
      const p = gridToScreen(bed.x, bed.y);
      const sprite = new Sprite(bedTexture);
      sprite.anchor.set(0.5, 0.85);
      sprite.x = p.x;
      sprite.y = p.y;
      sprite.zIndex = (bed.x + bed.y) * 100 + 12;
      container.addChild(sprite);
      sprites.push(sprite);
    }
    cache.set(b.id, { capacity, level: b.level, sprites });
  }

  // Cleanup decor for removed clinics.
  for (const [id, cached] of cache.entries()) {
    if (!activeClinicIds.has(id)) {
      for (const s of cached.sprites) container.removeChild(s);
      cache.delete(id);
    }
  }
}
