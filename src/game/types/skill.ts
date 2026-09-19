export interface Skill {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  cooldownMs: number;
  lastUsedMs: number;
  damageMultiplier: number;
  effectType: 'slash' | 'multishot' | 'meteor' | 'smite' | 'whirlwind' | 'holy_burst' | 'heal' | 'ballad' | 'encore';
  description: string;
  exp: number;
  expToNext: number;
}

export type SkillEffectType = Skill['effectType'];
