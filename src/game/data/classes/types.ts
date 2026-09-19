// Per-class kit contract. Each class file (berserker.ts, ranger.ts, …)
// exports one ClassKit: base stats, gear nouns, and 3 skill templates.
// skills.ts builds live Skill objects from these templates — class files
// stay pure data with zero imports from simulation.

import type { CharacterClass, Skill, ZoneKind } from '../../types';

export interface SkillTemplate {
  /** Short id fragment, e.g. 'berserk' → skill id `skill-berserk-1`. */
  idPrefix: string;
  name: string;
  cooldownMs: number;
  damageMultiplier: number;
  effectType: Skill['effectType'];
  description: string;
  /**
   * T2 zone config (skill-zone revamp). When present the tier-2 cast
   * creates a persistent ActiveZone instead of instant damage:
   * radius in cells, base duration in sim-seconds (+0.5s/rank),
   * per-tick ATK fraction (DoT, or atk portion for HoT) and optional
   * per-tick effectiveMaxHp fraction (HoT auras).
   */
  zone?: {
    kind: ZoneKind;
    radius: number;
    durationSec: number;
    tickFrac: number;
    hotMaxFrac?: number;
  };
}

export interface ClassKit {
  id: CharacterClass;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseCrit: number;
  speed: number;
  /** Trainee weapon display name, e.g. 'Trainee Broadsword'. */
  traineeWeapon: string;
  /** Loot-name noun for generated weapons, e.g. 'Cleaver'. */
  weaponNoun: string;
  /** Loot-name noun for generated armor, e.g. 'Plate'. */
  armorNoun: string;
  /** Tier 1→3 skill templates (unlocked at Lv 1 / 3 / 6). */
  skillTemplates: [SkillTemplate, SkillTemplate, SkillTemplate];
  notes?: string;
}
