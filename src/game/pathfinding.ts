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
  // East wall of town (town | forest), gate at gy 29..31 (Town Gate road)
  if (cx === 39 && inRange(cy, 20, 38)) return !inRange(cy, 29, 31);
  // South wall of town (town | graveyard), gate at gx 29..31 (South Gate)
  if (cy === 39 && inRange(cx, 20, 38)) return !inRange(cx, 29, 31);
  // Graveyard | volcano wall, gate at gy 47..49 (West Volcano Gate)
  if (cx === 39 && inRange(cy, 39, 59)) return !inRange(cy, 47, 49);
  // Forest | volcano wall, gate at gx 47..49 (North Volcano Gate)
  if (cy === 39 && inRange(cx, 39, 59)) return !inRange(cx, 47, 49);
  return false;
}

/** Gate (opening) cells — walkable breaches in the walls. */
export const GATE_CELLS: PathPoint[] = [
  { x: 39, y: 29 }, { x: 39, y: 30 }, { x: 39, y: 31 },
  { x: 29, y: 39 }, { x: 30, y: 39 }, { x: 31, y: 39 },
  { x: 39, y: 47 }, { x: 39, y: 48 }, { x: 39, y: 49 },
  { x: 47, y: 39 }, { x: 48, y: 39 }, { x: 49, y: 39 },
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
 * Tavern seat grid positions: fan out south/east of the tavern at
 * (gx, gy), each within ~1.5 cells. Deterministic order so the nth
 * resting hunter (sorted by id) sits on the nth seat. Pure (no DOM).
 */
export function tavernSeatPositions(gx: number, gy: number, capacity: number): { x: number; y: number }[] {
  const offsets: Array<[number, number]> = [
    [0.8, 0.6],
    [-0.8, 0.6],
    [0, 1.2],
    [1.3, -0.2],
    [-1.3, -0.2],
    [0, -1.2],
    [1.0, 1.0],
    [-1.0, 1.0],
  ];
  const n = Math.max(0, Math.min(Math.floor(capacity), offsets.length));
  const seats: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) seats.push({ x: gx + offsets[i][0], y: gy + offsets[i][1] });
  return seats;
}

/**
 * Clinic bed grid positions: flank the clinic at (gx, gy), each within
 * ~1.5 cells. Deterministic order so the nth recovering hunter (sorted by
 * id) lies in the nth bed. Pure (no DOM).
 */
export function clinicBedPositions(gx: number, gy: number, capacity: number): { x: number; y: number }[] {
  const offsets: Array<[number, number]> = [
    [0.9, 0.5],
    [-0.9, 0.5],
    [0, 1.1],
    [0.9, -0.6],
    [-0.9, -0.6],
    [0, -1.2],
    [1.2, 1.0],
    [-1.2, 1.0],
  ];
  const n = Math.max(0, Math.min(Math.floor(capacity), offsets.length));
  const beds: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) beds.push({ x: gx + offsets[i][0], y: gy + offsets[i][1] });
  return beds;
}

/**
 * Forge station grid positions: ring the forge at (gx, gy), each within
 * ~1.5 cells. Deterministic order so the nth smithing hunter (sorted by
 * id) works at the nth anvil. Pure (no DOM).
 */
export function forgeStationPositions(gx: number, gy: number, capacity: number): { x: number; y: number }[] {
  const offsets: Array<[number, number]> = [
    [0.9, 0.5],
    [-0.9, 0.5],
    [0, 1.1],
    [0.9, -0.6],
    [-0.9, -0.6],
    [0, -1.2],
    [1.2, 1.0],
    [-1.2, 1.0],
  ];
  const n = Math.max(0, Math.min(Math.floor(capacity), offsets.length));
  const stations: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) stations.push({ x: gx + offsets[i][0], y: gy + offsets[i][1] });
  return stations;
}

/**
 * Cauldron station grid positions: ring the lab at (gx, gy), each within
 * ~1.5 cells. Deterministic order so the nth brewing hunter (sorted by
 * id) tends the nth vat. Pure (no DOM).
 */
export function cauldronStationPositions(gx: number, gy: number, capacity: number): { x: number; y: number }[] {
  const offsets: Array<[number, number]> = [
    [0.8, 0.6],
    [-0.8, 0.6],
    [0, 1.2],
    [1.3, -0.2],
    [-1.3, -0.2],
    [0, -1.2],
    [1.0, 1.0],
    [-1.0, 1.0],
  ];
  const n = Math.max(0, Math.min(Math.floor(capacity), offsets.length));
  const stations: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) stations.push({ x: gx + offsets[i][0], y: gy + offsets[i][1] });
  return stations;
}

/**
 * Academy station grid positions: a dojo-yard row/arc facing the academy
 * at (gx, gy), each within ~1.5 cells. Deterministic order so the nth
 * training hunter (sorted by id) drills at the nth dummy. Pure (no DOM).
 */
export function academyStationPositions(gx: number, gy: number, capacity: number): { x: number; y: number }[] {
  const offsets: Array<[number, number]> = [
    [0, 0.9],
    [0.9, 0.7],
    [-0.9, 0.7],
    [0, 1.4],
    [1.2, 0.1],
    [-1.2, 0.1],
    [0.6, -0.9],
    [-0.6, -0.9],
  ];
  const n = Math.max(0, Math.min(Math.floor(capacity), offsets.length));
  const stations: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) stations.push({ x: gx + offsets[i][0], y: gy + offsets[i][1] });
  return stations;
}

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
