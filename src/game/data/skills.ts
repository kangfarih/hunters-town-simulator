// Skill mastery with diminishing returns (DR):
// - Cost side: expToNext = 30 * rank (rank1->2 needs 30, 2->3 needs 60, ...).
// - Gain side: each cast grants (2 + cooldownSec) / (1 + 0.35*(rank-1)),
//   rounded to 1 decimal (rank1 full, rank4 ~half). Gray targets pay 0.
// At rank 1 (~5.5-7 EXP/cast, need 30) that's still ~5 casts to READY —
// fast enough to see Rank 2-3 in a session, with Academy gold + trips
// still gating the climb to max.

import type { CharacterClass, Hunter, Skill } from '../types';
import { CLASS_KITS } from './classes';

export const SKILL_EXP_TO_NEXT = 30;

/** DR cost side: EXP needed to go from this rank to the next (30 * rank). */
export function skillExpToNext(level: number): number {
  const rank = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  return SKILL_EXP_TO_NEXT * rank;
}

/** EXP granted per cast: flat + cooldown bonus, diminished by rank. */
export function skillExpPerCast(cooldownMs: number, level = 1): number {
  const rank = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const base = 2 + cooldownMs / 1000;
  // DR gain side: rank1 full, rank4 ~half (1/(1+0.35*3) ~= 0.49).
  return Math.round((base / (1 + 0.35 * (rank - 1))) * 10) / 10;
}

/** Build a fresh Lv-1 class skill for a tier (1-3). Pure: no simulation state. */
export function createClassSkill(charClass: CharacterClass, tier: number): Skill {
  const kit = CLASS_KITS[charClass];
  const t = Math.max(1, Math.min(3, Math.round(tier)));
  const tpl = kit.skillTemplates[t - 1];
  return {
    id: `skill-${tpl.idPrefix}-${t}`,
    name: tpl.name,
    level: 1,
    maxLevel: 5,
    cooldownMs: tpl.cooldownMs,
    lastUsedMs: 0,
    damageMultiplier: tpl.damageMultiplier,
    effectType: tpl.effectType,
    description: tpl.description,
    exp: 0,
    // DR cost side: fresh rank-1 skill needs the rank-1 base (30).
    expToNext: skillExpToNext(1),
  };
}

/** Tier (1-3) parsed from the skill id suffix (`skill-<prefix>-<tier>`). */
export function skillTier(skill: Pick<Skill, 'id'>): number {
  const m = /-(\d+)\s*$/.exec(typeof skill.id === 'string' ? skill.id : '');
  const t = m ? parseInt(m[1], 10) : NaN;
  return t >= 1 && t <= 3 ? t : 1;
}

/** Gold cost of an Academy promotion for a skill at this level. */
export function academyCostFor(skillLevel: number): number {
  return 40 + 25 * skillLevel;
}

function isReady(s: Skill): boolean {
  return (
    s.level < s.maxLevel &&
    (typeof s.exp === 'number' ? s.exp : 0) >=
      (typeof s.expToNext === 'number' ? s.expToNext : SKILL_EXP_TO_NEXT)
  );
}

/** READY skills (exp >= expToNext), lowest rank first so 2nd/3rd skills catch up. */
export function readySkills(hunter: Hunter): Skill[] {
  return hunter.skills.filter(isReady).sort((a, b) => a.level - b.level);
}

/** True when the hunter has a READY skill it can afford to promote. */
export function hasAffordableReadySkill(hunter: Hunter): boolean {
  return readySkills(hunter).some((s) => hunter.gold >= academyCostFor(s.level));
}

/** Cheapest promotion cost among READY skills (Infinity when none ready). */
export function cheapestReadyCost(hunter: Hunter): number {
  const ready = readySkills(hunter);
  if (ready.length === 0) return Infinity;
  return Math.min(...ready.map((s) => academyCostFor(s.level)));
}
