// Shared yard layout: tile-center rows due south of a building facade,
// filled west to east, 3 per row, each next row one block further south.
//
// Row 0 (sy48, a full tile clear of the 88px platform visual):
//   W(0.5,2.5) C(1.5,1.5) E(2.5,0.5) — screen x -64/0/+64.
// Row 1 (sy80): W(1.5,3.5) C(2.5,2.5) E(3.5,1.5). Row 2 (sy112): W/C.
// All depth stays in front of the building; order is deterministic so the
// nth stationed hunter (sorted by id) always takes the nth slot.

export const SOUTH_ROWS_3WIDE: ReadonlyArray<readonly [number, number]> = [
  [0.5, 2.5],
  [1.5, 1.5],
  [2.5, 0.5],
  [1.5, 3.5],
  [2.5, 2.5],
  [3.5, 1.5],
  [2.5, 4.5],
  [3.5, 3.5],
];

/** Take the first n slots of the south-row grid at building (gx, gy). */
export function southRowSlots(
  gx: number, gy: number, capacity: number
): { x: number; y: number }[] {
  const n = Math.max(0, Math.min(Math.floor(capacity), SOUTH_ROWS_3WIDE.length));
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ x: gx + SOUTH_ROWS_3WIDE[i][0], y: gy + SOUTH_ROWS_3WIDE[i][1] });
  return out;
}

/** Snap an arbitrary point to the nearest tile center (x.5, y.5). */
export function snapToTileCenter(x: number, y: number): { x: number; y: number } {
  return { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 };
}
