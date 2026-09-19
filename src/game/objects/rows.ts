// Shared yard layout: tile-center rows hugging the SOUTH side of a
// building footprint, filled west to east, 3 per row, each next row one
// block further south.
//
// Slots derive from the footprint (gx, gy, width, height) — never from the
// origin corner alone — so no slot ever lands inside the building's own
// cells, whatever its size. Row 0 starts on the first tile row south of
// the footprint (ty = gy + height); columns span the footprint width,
// west to east. All depth stays in front of the facade, order is
// deterministic (nth stationed hunter, sorted by id, takes nth slot).

export const SOUTH_ROW_WIDTH = 3;
const MAX_SLOTS = 8;

/** West-most tile x of the row, so 3 slots center on the footprint. */
function rowStartTx(gx: number, w: number): number {
  return gx + Math.floor((w - SOUTH_ROW_WIDTH) / 2);
}

/** Take the first n slots of the south-row grid. */
export function southRowSlots(
  gx: number, gy: number, w: number, h: number, capacity: number
): { x: number; y: number }[] {
  const n = Math.max(0, Math.min(Math.floor(capacity), MAX_SLOTS));
  const startTx = rowStartTx(gx, w);
  const out: { x: number; y: number }[] = [];
  let r = 0;
  while (out.length < n) {
    for (let c = 0; c < SOUTH_ROW_WIDTH && out.length < n; c++) {
      out.push({ x: startTx + c + 0.5, y: gy + h + r + 0.5 });
    }
    r++;
  }
  return out;
}

/**
 * Tavern table tile for the i-th chair pair: row 1 (one block south of
 * the chair rows' start), middle column heading east — its own tile
 * center, clear of both the platform and every chair slot at max
 * tavern capacity. Diners sit north of it, facing south to the table.
 */
export function tavernTableSpot(
  gx: number, gy: number, w: number, h: number, pairIndex: number
): { x: number; y: number } {
  const startTx = rowStartTx(gx, w);
  return { x: startTx + 1 + pairIndex + 0.5, y: gy + h + 1 + 0.5 };
}

/** Snap an arbitrary point to the nearest tile center (x.5, y.5). */
export function snapToTileCenter(x: number, y: number): { x: number; y: number } {
  return { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 };
}
