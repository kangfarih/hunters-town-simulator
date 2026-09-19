// Skill mastery: each cast grants 2 + cooldownSec EXP (longer CD = more).
// At ~5.5-7 EXP/cast, SKILL_EXP_TO_NEXT = 30 means ~5 casts to READY —
// fast enough to see Rank 2-3 in a session, with Academy gold + trips
// still gating the climb to max.

import type { CharacterClass, Hunter, Skill } from '../types';
import { CLASS_KITS } from './classes';

export const SKILL_EXP_TO_NEXT = 30;

/** EXP granted per cast: flat + cooldown bonus (longer CD = more EXP). */
export function skillExpPerCast(cooldownMs: number): number {
  return 2 + cooldownMs / 1000;
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
    expToNext: SKILL_EXP_TO_NEXT,
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
