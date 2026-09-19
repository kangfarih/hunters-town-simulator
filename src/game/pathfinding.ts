// Walled regions + A* pathfinding over the 60x60 town grid.
// Town sits center (20..38, 20..38); forest E, graveyard S, volcano SE.
// Single-cell palisade walls separate regions, pierced by 3-wide gates.
// Five dark reserved regions free the northwest bands (gx<20 || gy<20).

import { MAP_GRID_WIDTH, MAP_GRID_HEIGHT } from './isometric';

export interface PathPoint {
  x: number;
  y: number;
}

const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

/**
 * Reserved regions: dark placeholder land in the freed northwest bands
 * (gx<20 || gy<20 side), held for future expansion. Walkable, no
 * walls/gates/decor, no spawns, no buildings, no AI targets. Single
 * source of truth — render + sim both use reserveAt.
 */
export const RESERVE_REGIONS: { name: string; minGx: number; maxGx: number; minGy: number; maxGy: number }[] = [
  { name: 'Reserved Grounds I', minGx: 0, maxGx: 19, minGy: 0, maxGy: 19 },
  { name: 'Reserved Grounds II', minGx: 0, maxGx: 19, minGy: 20, maxGy: 39 },
  { name: 'Reserved Grounds III', minGx: 0, maxGx: 19, minGy: 40, maxGy: 59 },
  { name: 'Reserved Grounds IV', minGx: 20, maxGx: 39, minGy: 0, maxGy: 19 },
  { name: 'Reserved Grounds V', minGx: 40, maxGx: 59, minGy: 0, maxGy: 19 },
];

/** Region name for a grid cell, or null when not inside a reserve. */
export function reserveAt(gx: number, gy: number): string | null {
  for (const r of RESERVE_REGIONS) {
    if (gx >= r.minGx && gx <= r.maxGx && gy >= r.minGy && gy <= r.maxGy) return r.name;
  }
  return null;
}

/** True if the integer cell holds a palisade wall segment. */
export function isWallCell(cx: number, cy: number): boolean {
  // Central interchange: cross-shaped plaza around the four-region corner
  // (39,39) where the palisades meet. Vertical arm (cx==39, cy 37..41) and
  // horizontal arm (cy==39, cx 37..41) stay walkable so hunters can cross
  // between any regions without detouring through the outer gates.
  if (isHubCell(cx, cy)) return false;
  // West palisade: seals the dungeon strip (gx 0..19, gy 20..59) from
  // town/crypt. The old crypt-side gate cell (19,41) is SEALED solid —
  // entry is teleport-only via the town portal lobby, so the whole run
  // stays wall (no walkable crossing, no A* route in or out).
  if (cx === 19 && inRange(cy, 20, 59)) return true;
  // East wall of town (town | forest), gate at gy 29..31 (Town Gate road)
  if (cx === 39 && inRange(cy, 20, 38)) return !inRange(cy, 29, 31);
  // South wall of town (town | graveyard), gate at gx 29..31 (South Gate)
  if (cy === 39 && inRange(cx, 20, 38)) return !inRange(cx, 29, 31);
  // Graveyard | volcano wall: solid, no gate. Volcano is reachable only
  // via the central hub plaza arms.
  if (cx === 39 && inRange(cy, 39, 59)) return true;
  // Forest | volcano wall: solid, no gate. Volcano is reachable only
  // via the central hub plaza arms.
  if (cy === 39 && inRange(cx, 39, 59)) return true;
  return false;
}

/** Four-region corner where the palisades meet (town is gx<=39 && gy<=39). */
export const HUB_X = 39;
export const HUB_Y = 39;

/** True if the integer cell is part of the central interchange plaza. */
export function isHubCell(cx: number, cy: number): boolean {
  return (cx === HUB_X && inRange(cy, HUB_Y - 2, HUB_Y + 2)) ||
    (cy === HUB_Y && inRange(cx, HUB_X - 2, HUB_X + 2));
}

/** Gate (opening) cells — walkable breaches in the walls. */
export const GATE_CELLS: PathPoint[] = [
  { x: 39, y: 29 }, { x: 39, y: 30 }, { x: 39, y: 31 },
  { x: 29, y: 39 }, { x: 30, y: 39 }, { x: 31, y: 39 },
];

/** All wall cells (for rendering the palisades). Computed once. */
export const WALL_CELLS: PathPoint[] = (() => {
  const cells: PathPoint[] = [];
  for (let cx = 0; cx < MAP_GRID_WIDTH; cx++) {
    for (let cy = 0; cy < MAP_GRID_HEIGHT; cy++) {
      if (isWallCell(cx, cy)) cells.push({ x: cx, y: cy });
    }
  }
  return cells;
})();

/** True if the integer cell can be walked on. */
export function isWalkableCell(cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= MAP_GRID_WIDTH || cy >= MAP_GRID_HEIGHT) return false;
  return !isWallCell(cx, cy);
}

/**
 * Tavern seats: tile-center rows due south of the facade, filled west to
 * east, 3 per row, next row one block further south. Row 0 sits a full
 * tile clear of the 88px platform (sy>=48px); all depth stays in front
 * of the building. Deterministic order.
 */
export { tavernSeatPositions } from './objects/chair';

/**
 * Clinic beds: same 3-wide south rows as tavern (see tavern). West to
 * east per row, next row one block south. Nth patient takes nth bed.
 */
export { clinicBedPositions } from './objects/bed';

/**
 * Forge stations: same 3-wide south rows as tavern (see tavern). West to
 * east per row, next row one block south. Nth smith takes nth anvil.
 */
export { forgeStationPositions } from './objects/anvil';

/**
 * Cauldron stations: same 3-wide south rows as tavern (see tavern).
 * West to east per row, next row one block south. Nth brewer, nth vat.
 */
export { cauldronStationPositions } from './objects/vat';

/**
 * Academy dummies: same 3-wide south rows as tavern (see tavern). West
 * to east per row, next row one block south. Nth trainee, nth dummy.
 */
export { academyStationPositions } from './objects/dummy';

const clampCell = (v: number, max: number) => Math.max(0, Math.min(max - 1, Math.round(v)));

/** Nearest walkable cell to (cx, cy), spiral search. Falls back to input. */
function nearestWalkable(cx: number, cy: number): PathPoint {
  if (isWalkableCell(cx, cy)) return { x: cx, y: cy };
  for (let r = 1; r <= 8; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isWalkableCell(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
      }
    }
  }
  return { x: cx, y: cy };
}

// Minimal binary heap for the A* open set
class Heap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size() { return this.keys.length; }
  push(key: number, val: number) {
    this.keys.push(key); this.vals.push(val);
    let i = this.keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.vals[p] <= this.vals[i]) break;
      [this.keys[p], this.keys[i]] = [this.keys[i], this.keys[p]];
      [this.vals[p], this.vals[i]] = [this.vals[i], this.vals[p]];
      i = p;
    }
  }
  pop(): number {
    const top = this.keys[0];
    const lk = this.keys.pop()!;
    const lv = this.vals.pop()!;
    if (this.keys.length > 0) {
      this.keys[0] = lk; this.vals[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < this.keys.length && this.vals[l] < this.vals[m]) m = l;
        if (r < this.keys.length && this.vals[r] < this.vals[m]) m = r;
        if (m === i) break;
        [this.keys[m], this.keys[i]] = [this.keys[i], this.keys[m]];
        [this.vals[m], this.vals[i]] = [this.vals[i], this.vals[m]];
        i = m;
      }
    }
    return top;
  }
}

const DIRS = [
  { dx: 1, dy: 0, c: 1 }, { dx: -1, dy: 0, c: 1 },
  { dx: 0, dy: 1, c: 1 }, { dx: 0, dy: -1, c: 1 },
  { dx: 1, dy: 1, c: Math.SQRT2 }, { dx: 1, dy: -1, c: Math.SQRT2 },
  { dx: -1, dy: 1, c: Math.SQRT2 }, { dx: -1, dy: -1, c: Math.SQRT2 },
];

/**
 * A* over region cells. Returns cell-center waypoints from start (exclusive)
 * to goal (inclusive). Returns [] when already adjacent/inside goal or when
 * no route exists (caller should fall back to straight steering).
 */
export function findPath(sx: number, sy: number, tx: number, ty: number): PathPoint[] {
  const W = MAP_GRID_WIDTH;
  const start = nearestWalkable(clampCell(sx, W), clampCell(sy, MAP_GRID_HEIGHT));
  const goal = nearestWalkable(clampCell(tx, W), clampCell(ty, MAP_GRID_HEIGHT));
  const startIdx = start.y * W + start.x;
  const goalIdx = goal.y * W + goal.x;
  if (startIdx === goalIdx) return [];

  // Octile heuristic
  const heuristic = (x: number, y: number) => {
    const dx = Math.abs(x - goal.x), dy = Math.abs(y - goal.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };

  const open = new Heap();
  const gScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  gScore.set(startIdx, 0);
  open.push(startIdx, heuristic(start.x, start.y));

  let found = false;
  let iterations = 0;
  while (open.size > 0 && iterations++ < 6000) {
    const current = open.pop();
    if (current === goalIdx) { found = true; break; }
    if (closed.has(current)) continue;
    closed.add(current);
    const cx = current % W, cy = Math.floor(current / W);
    const cg = gScore.get(current)!;

    for (const d of DIRS) {
      const nx = cx + d.dx, ny = cy + d.dy;
      if (!isWalkableCell(nx, ny)) continue;
      // No corner cutting on diagonals
      if (d.dx !== 0 && d.dy !== 0) {
        if (!isWalkableCell(cx + d.dx, cy) || !isWalkableCell(cx, cy + d.dy)) continue;
      }
      const nIdx = ny * W + nx;
      if (closed.has(nIdx)) continue;
      const ng = cg + d.c;
      if (ng < (gScore.get(nIdx) ?? Infinity)) {
        gScore.set(nIdx, ng);
        cameFrom.set(nIdx, current);
        open.push(nIdx, ng + heuristic(nx, ny));
      }
    }
  }

  if (!found) return [];
  const cells: PathPoint[] = [];
  let cur = goalIdx;
  while (cur !== startIdx) {
    cells.push({ x: cur % W, y: Math.floor(cur / W) });
    cur = cameFrom.get(cur)!;
  }
  cells.reverse();
  return cells;
}
