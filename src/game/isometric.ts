// Isometric coordinate projection constants and functions

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export const MAP_GRID_WIDTH = 40;
export const MAP_GRID_HEIGHT = 40;

export interface Point {
  x: number;
  y: number;
}

export interface GridPoint {
  gx: number;
  gy: number;
}

/**
 * Converts continuous grid coordinates (gx, gy) to 2D screen coordinates (x, y)
 * with optional elevation offset.
 */
export function gridToScreen(gx: number, gy: number, elevation: number = 0): Point {
  const x = (gx - gy) * (TILE_WIDTH / 2);
  const y = (gx + gy) * (TILE_HEIGHT / 2) - elevation;
  return { x, y };
}

/**
 * Converts screen coordinates to continuous grid coordinates (gx, gy)
 */
export function screenToGrid(screenX: number, screenY: number): GridPoint {
  const gx = (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2;
  const gy = (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2;
  return { gx, gy };
}

/**
 * Calculates depth sort key for isometric rendering.
 * Entities with higher sort keys are rendered in front.
 */
export function getDepthSortKey(gx: number, gy: number, layerOffset: number = 0): number {
  return (gx + gy) * 100 + layerOffset;
}

/**
 * Calculates Euclidean distance in grid units
 */
export function gridDistance(gx1: number, gy1: number, gx2: number, gy2: number): number {
  const dx = gx1 - gx2;
  const dy = gy1 - gy2;
  return Math.hypot(dx, dy);
}

/**
 * Direction calculation for 4 isometric directions
 */
export function getIsometricFacing(fromGx: number, fromGy: number, toGx: number, toGy: number): 'SE' | 'SW' | 'NE' | 'NW' {
  const dx = toGx - fromGx;
  const dy = toGy - fromGy;
  
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'SE' : 'NW';
  } else {
    return dy >= 0 ? 'SW' : 'NE';
  }
}
