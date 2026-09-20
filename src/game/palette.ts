// Midnight JRPG palette canon: the single source of truth for every
// color in the game. Semantic tokens only — painters and UI reference
// these, never raw hex. Rule: no new hex literals outside this file.
//
// Derived from the canvas as it stood (bg 0x090714, dark indigo crypt,
// charcoal volcano, saturated classes, gold accents) with the wood
// browns collapsed 12 -> 4.

export const NIGHT = {
  /** Renderer clear color + page backdrop. */
  bg: 0x090714,
  bgCss: '#090714',
} as const;

export const TERRAIN = {
  cobble: '#64748b',
  cobbleDark: '#475569',
  cobbleEdge: '#334155',
  plaza: '#78350f',
  plazaDark: '#451a03',
  plank: '#92400e',
  grass: '#166534',
  grassTuft: '#15803d',
  flowerA: '#fde047',
  flowerB: '#f43f5e',
  soil: '#1e1b4b',
  soilLight: '#312e81',
  bone: '#cbd5e1',
  lavaRock: '#18181b',
  lava: '#ea580c',
  lavaHot: '#facc15',
  road: '#94a3b8',
  roadLight: '#cbd5e1',
  reserve: '#0b0f1e',
  reserveSpeck: '#1b2340',
  reserveSpeck2: '#141b33',
  reserveEdge: '#3b476b',
  /** Warm light spilling onto town cobble after dark. */
  lamplight: '#facc15',
} as const;

/** Structural wood: every chair/table/anvil/vat/dummy/beam uses these. */
export const WOOD = {
  dark: '#3a2412',
  mid: '#5b3a1e',
  light: '#8a5f30',
  trim: '#a16207',
  ember: '#451a03',
} as const;

export const METAL = {
  dark: '#334155',
  mid: '#475569',
  light: '#7c8aa0',
  pale: '#94a3b8',
  iron: '#374151',
} as const;

export const CLOTH = {
  white: '#f8fafc',
  pale: '#e2e8f0',
  gold: '#eab308',
  goldBright: '#facc15',
  goldPale: '#fef08a',
} as const;

export type HunterClassKey =
  | 'Berserker'
  | 'Ranger'
  | 'Sorcerer'
  | 'Paladin'
  | 'Cleric'
  | 'Bard';

export const CLASS: Record<HunterClassKey, { main: string; trim: string; cape: string }> = {
  Berserker: { main: '#ef4444', trim: '#991b1b', cape: '#b91c1c' },
  Ranger: { main: '#22c55e', trim: '#14532d', cape: '#15803d' },
  Sorcerer: { main: '#6366f1', trim: '#312e81', cape: '#4338ca' },
  Paladin: { main: '#e2e8f0', trim: '#eab308', cape: '#0284c7' },
  Bard: { main: '#14b8a6', trim: '#5b21b6', cape: '#0f766e' },
  // Cleric is white-gold robe (distinct from Paladin's silver-blue).
  Cleric: { main: '#f8fafc', trim: '#d4a017', cape: '#a16207' },
} as const;

export const SKIN = {
  base: '#ffd2a5',
  shadow: '#0f172a',
  boot: '#334155',
  bootDark: '#0f172a',
} as const;

/** Shared monster bits so eyes/wisps read as one bestiary. */
export const MONSTER = {
  evilEye: '#ef4444',
  goldEye: '#fde047',
  emberEye: '#facc15',
  wisp: '#06b6d4',
  spectral: '#e0e7ff',
  bone: '#e2e8f0',
} as const;

/** Quantized VFX ramps (hot at birth unless noted). */
export const VFX = {
  fire: [
    '#ffffff',
    '#fef08a',
    '#fde047',
    '#facc15',
    '#fb923c',
    '#f97316',
    '#ea580c',
    '#7c2d12',
  ],
  /** Cool smoke: dark at birth, pale as it disperses. */
  smoke: ['#57534c', '#78716c', '#a8a29e', '#d6d3d1'],
  ember: ['#facc15', '#fb923c', '#f97316', '#ef4444'],
  holy: ['#ffffff', '#fef08a', '#facc15'],
  heal: ['#f8fafc', '#4ade80', '#d4a017'],
  nature: ['#d9f99d', '#22c55e', '#f8fafc'],
  storm: ['#e2e8f0', '#94a3b8', '#38bdf8', '#f8fafc'],
  soul: ['#f5f3ff', '#c4b5fd', '#a78bfa'],
  music: ['#fbbf24', '#2dd4bf', '#fef3c7'],
} as const;

/** HUD tokens: deep-navy panels, gold pixel borders, candlelight text. */
export const UI = {
  panel: '#0d0b24',
  panelSoft: '#151238',
  edge: '#2a2560',
  border: '#eab308',
  gold: '#facc15',
  goldPale: '#fef08a',
  text: '#e2e8f0',
  dim: '#8b87b8',
  hp: '#22c55e',
  hpWarn: '#eab308',
  hpLow: '#ef4444',
  danger: '#ef4444',
} as const;

/** Rarity colors stay data-adjacent (loot copy references them) but are
 *  canonized here so future passes have one place to look. */
export const RARITY: Record<string, string> = {
  Common: '#cbd5e1',
  Uncommon: '#4ade80',
  Rare: '#38bdf8',
  Epic: '#c084fc',
};
