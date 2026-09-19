// Per-class kit contract. Each class file (berserker.ts, ranger.ts, …)
// exports one ClassKit: base stats, gear nouns, and 3 skill templates.
// skills.ts builds live Skill objects from these templates — class files
// stay pure data with zero imports from simulation.

import type { CharacterClass, Skill } from '../../types';

export interface SkillTemplate {
  /** Short id fragment, e.g. 'berserk' → skill id `skill-berserk-1`. */
  idPrefix: string;
  name: string;
  cooldownMs: number;
  damageMultiplier: number;
  effectType: Skill['effectType'];
  description: string;
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
