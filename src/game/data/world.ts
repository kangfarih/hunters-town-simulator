// World geometry + persistence keys. Pure constants, no logic.
// Town gates, summon portal, and per-zone roam bounds live here so map
// edits never touch simulation logic.

import type { ZoneId } from '../types';

/** East town gate (Town Gate road). */
export const TOWN_GATE_POS = { gx: 38, gy: 30 };

/** South town gate (Graveyard road). */
export const SOUTH_GATE_POS = { gx: 30, gy: 39 };

/** Hero summon portal in town. */
export const SUMMON_PORTAL_POS = { gx: 29, gy: 22 };

/** Roam boundaries per hunting zone (monsters wander inside their home zone). */
export const ZONE_ROAM_BOUNDS: Record<ZoneId, { minGx: number; maxGx: number; minGy: number; maxGy: number }> = {
  1: { minGx: 42, maxGx: 54, minGy: 22, maxGy: 36 }, // Whispering Forest
  2: { minGx: 22, maxGx: 36, minGy: 42, maxGy: 54 }, // Gloomy Graveyard
  3: { minGx: 42, maxGx: 56, minGy: 42, maxGy: 56 }, // Volcanic Ruins
  4: { minGx: 2, maxGx: 17, minGy: 22, maxGy: 57 }, // Dungeon Depths
};

/** Local save persistence key. */
export const SAVE_KEY = 'hunters-town-save-v1';
