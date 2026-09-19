import type { SkillVFX } from './vfx';

/**
 * Skill-zone revamp: persistent battlefield zones created by T2 casts.
 * Damage zones (storm/arrows/burn) are ground-fixed (followHunterId null);
 * support auras (consecration/radiance/hymn) re-anchor to the caster each
 * frame and die early if the caster goes down.
 */
export type ZoneKind =
  | 'storm' // Berserker Whirlwind Storm (fixed DoT)
  | 'arrows' // Ranger Rain of Arrows (fixed DoT)
  | 'burn' // Sorcerer Meteor Burn (fixed DoT)
  | 'consecration' // Paladin Consecrated Aura (following DoT + shields)
  | 'radiance' // Cleric Soothing Radiance (following HoT)
  | 'hymn'; // Bard Resonant Hymn (following HoT + Encore)

export interface ActiveZone {
  id: string;
  kind: ZoneKind;
  x: number;
  y: number;
  radius: number;
  /** Total lifetime in sim-seconds (base + 0.5s per skill rank above 1). Always < its skill CD. */
  duration: number;
  elapsed: number;
  /** Accumulates dt; a tick fires every 1s. */
  tickTimer: number;
  /** Caster effectiveAtk snapshot at cast time (DoT/HoT atk portion). */
  atkRef: number;
  /** Hunter id for kill credit (handleMonsterDefeat) + mastery gating. */
  sourceId: string;
  /** Set for support auras: re-anchor to this hunter each frame. */
  followHunterId?: string;
  /** Skill rank at cast: DoT/HoT ticks scale +10%/rank. */
  level: number;
  /** Per-tick ATK fraction (DoT) or atk portion (HoT). */
  tickFrac: number;
  /** Per-tick effectiveMaxHp fraction (HoT only, 0 for DoT). */
  hotMaxFrac: number;
  /** Usage-based mastery granted once (damage zones gate on non-gray ticks). */
  masteryEarned: boolean;
}

/** True for caster-following support auras (HoT + buffs). */
export function isSupportZone(kind: ZoneKind): boolean {
  return kind === 'consecration' || kind === 'radiance' || kind === 'hymn';
}

/** Mini-burst VFX type reused on every zone tick (short SkillVFX). */
export function zoneTickVfx(kind: ZoneKind): SkillVFX['type'] {
  switch (kind) {
    case 'storm': return 'whirlwind';
    case 'arrows': return 'multishot';
    case 'burn': return 'meteor';
    case 'consecration': return 'smite';
    case 'radiance': return 'heal';
    case 'hymn': return 'encore';
  }
}

/** Cast-time VFX type for a zone kind (full-size SkillVFX at the anchor). */
export function zoneCastVfx(kind: ZoneKind): SkillVFX['type'] {
  return zoneTickVfx(kind);
}

/** Flat render color per zone kind (renderer ground discs). */
export function zoneColor(kind: ZoneKind): number {
  switch (kind) {
    case 'storm': return 0x38bdf8;
    case 'arrows': return 0x22c55e;
    case 'burn': return 0xea580c;
    case 'consecration': return 0xfacc15;
    case 'radiance': return 0x4ade80;
    case 'hymn': return 0x2dd4bf;
  }
}
