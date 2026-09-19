// Dungeon endgame (phases 1-4): map rect, boss arenas, seeded trash gen,
// boss defs, epic need-rolls, and instance-state helpers.
//
// Pure module: no simulation state, no rendering. Simulation owns behavior
// (entry checks, spawning, tick); renderers + pathfinding read these
// constants. To extend the dungeon, edit here — not the consumers.
//
// ENTRY WIRING (portal lobby): Simulation.evaluateTownNeeds routes idle
// Lv.15 hunters to the town portal (DUNGEON_PORTAL) instead of the field.
// They wait in DUNGEON_LOBBY on role-locked chairs (LOBBY_SEATS); when all
// 5 seats fill, the sim forms a party and admits it via tryEnterDungeon,
// then teleports the delvers to DUNGEON_STAGING. The old crypt-side
// walk-in gate (DUNGEON_GATE) is SEALED — solid wall, entry teleport-only.

import type { CharacterClass, MonsterType } from './types';
import { southRowSlots } from './objects/rows';

/** Dungeon footprint: the contiguous west strip (reserves II + III). */
export const DUNGEON_RECT = { minGx: 0, maxGx: 19, minGy: 20, maxGy: 59 };

/** True when a (possibly fractional) grid position sits inside the dungeon. */
export function dungeonAt(gx: number, gy: number): boolean {
  const x = Math.floor(gx), y = Math.floor(gy);
  return x >= DUNGEON_RECT.minGx && x <= DUNGEON_RECT.maxGx &&
    y >= DUNGEON_RECT.minGy && y <= DUNGEON_RECT.maxGy;
}

/** Boss arena centers, all inside DUNGEON_RECT. */
export const BOSS_ARENAS = [
  { x: 10, y: 30 },
  { x: 10, y: 45 },
  { x: 10, y: 55 },
];

/** The old walkable breach in the west palisade — now SEALED (solid wall
 *  in pathfinding; kept exported so tests/UI can reference the sealed cell).
 *  Entry is teleport-only via the town portal lobby below. */
export const DUNGEON_GATE = { x: 19, y: 41 };

/**
 * Town portal lobby: a free walkable town tile well clear of shops/doors
 * (town cobble north-east of the plaza; nearest door is the Sanctuary
 * Hall's at (29,26), nearest footprint the Hall's x28-30/y24-26 band).
 * Violet portal gfx + 5 chairs render here; idle Lv.15 hunters gather.
 */
export const DUNGEON_PORTAL = { x: 33, y: 22 };

/**
 * Dungeon-side staging cell: fixed interior tile near the BOSS_ARENAS[0]
 * approach where full lobby parties materialize. Inside DUNGEON_RECT,
 * walkable open ground (A* inside the dungeon works unchanged).
 */
export const DUNGEON_STAGING = { x: 10, y: 22 };

/** Lobby chair role locks: 1 tank, 1 healer, 3 open. */
export type LobbySeatRole = 'tank' | 'heal' | 'any';
export interface LobbySeat { role: LobbySeatRole; }
export const LOBBY_SEATS: LobbySeat[] = [
  { role: 'tank' },
  { role: 'heal' },
  { role: 'any' },
  { role: 'any' },
  { role: 'any' },
];

/**
 * Lobby role eligibility: tank seat → Paladin/Berserker, heal seat →
 * Cleric, any seats → anyone. Strict Paladin-only tanking risks the tank
 * seat never filling on Paladin-less rosters; the Berserker is the melee
 * off-tank, so it qualifies. A roster with neither still leaves the tank
 * seat empty by design (documented, no crash — the party just waits).
 */
export function lobbySeatFits(role: LobbySeatRole, charClass: CharacterClass): boolean {
  if (role === 'any') return true;
  if (role === 'tank') return charClass === 'Paladin' || charClass === 'Berserker';
  return charClass === 'Cleric';
}

/**
 * Lobby chair grid: south-row slots for a 3-wide pseudo-footprint at the
 * portal (mirrors tavernSeatPositions: west to east, 3 per row, next row
 * one block further south). Deterministic — seat i is always the same tile.
 */
export function lobbySeatPositions(): { x: number; y: number }[] {
  return southRowSlots(DUNGEON_PORTAL.x - 1, DUNGEON_PORTAL.y, 3, 1, LOBBY_SEATS.length);
}

/** Deterministic PRNG for seeded trash placement (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dungeon trash types (phase 3 kits). */
export type DungeonTrashType = Extract<MonsterType, 'vault_husk' | 'rune_warden' | 'vault_lord'>;

/** Dungeon boss types, in bossesDown order (warden 0, hoarder 1, primus 2). */
export const DUNGEON_BOSS_TYPES = ['boss_warden', 'boss_hoarder', 'boss_primus'] as const;
export type DungeonBossType = (typeof DUNGEON_BOSS_TYPES)[number];

/** Index into bossesDown for a dungeon boss type, or -1 when not one. */
export function dungeonBossIndex(type: MonsterType): number {
  return (DUNGEON_BOSS_TYPES as readonly string[]).indexOf(type);
}

export interface TrashPackSpawn {
  x: number;
  y: number;
  type: DungeonTrashType;
}

/**
 * Seeded trash layout: ~12 packs of 2-3 stand-ins along the x 6-14 lanes,
 * keeping a 3-radius clear around every boss arena.
 */
export function generateTrashPacks(seed: number): TrashPackSpawn[] {
  const rand = mulberry32(seed);
  const packs: TrashPackSpawn[] = [];
  for (let p = 0; p < 12; p++) {
    const laneX = 6 + Math.floor(rand() * 9); // lanes x 6..14
    let cy = 22 + Math.floor(rand() * 35);    // y 22..56
    for (let tries = 0; tries < 8; tries++) {
      const clear = BOSS_ARENAS.every(a => Math.hypot(laneX - a.x, cy - a.y) > 3);
      if (clear) break;
      cy = 22 + Math.floor(rand() * 35);
      if (tries === 7) cy = 24; // deterministic fallback, clear of arena 1
    }
    const n = 2 + Math.floor(rand() * 2); // 2-3 per pack
    for (let i = 0; i < n; i++) {
      const x = Math.min(17, Math.max(2, laneX + Math.floor(rand() * 3) - 1));
      const y = Math.min(57, Math.max(22, cy + Math.floor(rand() * 3) - 1));
      const r = rand();
      packs.push({ x, y, type: r < 0.5 ? 'vault_husk' : (r < 0.8 ? 'rune_warden' : 'vault_lord') });
    }
  }
  return packs;
}

export interface BossDef {
  key: string;
  name: string;
  level: number;
  arena: number; // index into BOSS_ARENAS
  type: MonsterType; // phase-3 boss kit (boss_warden/hoarder/primus)
}

/** Boss defs (key,name,level,arena,type) — stats live in the spawn roster. */
export const BOSS_DEFS: BossDef[] = [
  { key: 'warden', name: 'Crypt Warden', level: 15, arena: 0, type: 'boss_warden' },
  { key: 'hoarder', name: 'Hoarder of the Deep', level: 16, arena: 1, type: 'boss_hoarder' },
  { key: 'primus', name: 'Dungeon Primus', level: 17, arena: 2, type: 'boss_primus' },
];

export type DungeonState = 'dormant' | 'active' | 'cleared' | 'lockout';

export interface DungeonInstance {
  seed: number;
  state: DungeonState;
  lockoutTimer: number; // sim-seconds remaining in lockout
  bossesDown: [boolean, boolean, boolean];
  partyIds: string[]; // entered-party snapshot (phase 4 wipe lens; additive)
}

/** Minutes-scale re-entry delay after a clear or wipe (phase 4 triggers). */
export const DUNGEON_LOCKOUT_SECONDS = 300;

/** Town plaza muster point — wipe ejects live delvers here. */
export const DUNGEON_EJECT = { x: 29, y: 29 };

/** Town gold bonus on a full clear (phase 4). */
export const DUNGEON_CLEAR_BONUS_GOLD = 1000;

/** Fresh instance: dormant, unseeded (also the pre-v4 save migration default). */
export function defaultDungeonInstance(): DungeonInstance {
  return { seed: 0, state: 'dormant', lockoutTimer: 0, bossesDown: [false, false, false], partyIds: [] };
}

/** Need-roll entrant: id + display name + class for the class-lock check. */
export interface NeedRollMember {
  id: string;
  name: string;
  charClass: string;
}

/**
 * Epic need-roll (phase 3): eligible = members whose class matches the
 * epic's class lock (the same requiredClass source auto-equip enforces;
 * class-open armor passes undefined/null so the whole party is eligible).
 * Winner = uniform random among eligible; null when none eligible (the
 * caller then vendors the epic for split gold).
 */
export function needRoll(partyMembers: NeedRollMember[], epicClass?: string | null): string | null {
  const eligible = !epicClass
    ? partyMembers
    : partyMembers.filter(m => m.charClass === epicClass);
  if (eligible.length === 0) return null;
  const winner = eligible[Math.floor(Math.random() * eligible.length)];
  return winner ? winner.id : null;
}
