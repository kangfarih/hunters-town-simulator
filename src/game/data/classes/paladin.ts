import type { ClassKit } from './types';

export const PaladinKit: ClassKit = {
  id: 'Paladin',
  baseHp: 220,
  baseAtk: 18,
  baseDef: 20,
  baseCrit: 0.05,
  speed: 0.036,
  traineeWeapon: 'Trainee Mace',
  weaponNoun: 'Gavel',
  armorNoun: 'Aegis',
  notes: 'Tank anchor: biggest HP/DEF pool, weakest crit, slowest feet. Trades damage for the line-holding tank kit (shield + taunt + DR aura).',
  skillTemplates: [
    {
      idPrefix: 'pala',
      name: 'Holy Smite',
      cooldownMs: 4500,
      damageMultiplier: 2.05, // 1.7 + tier(1) * 0.35
      effectType: 'smite',
      description: 'Divine wrath that damages the foe and raises a self-shield.',
    },
    {
      idPrefix: 'pala',
      name: 'Radiant Aegis',
      cooldownMs: 6000,
      damageMultiplier: 1.2,
      effectType: 'smite',
      description: 'Bulwark of light: big self-shield, taunts nearby beasts, guards the party.',
    },
    {
      idPrefix: 'pala',
      name: 'Judgement Pillar',
      cooldownMs: 8000,
      damageMultiplier: 2.75, // 1.7 + tier(3) * 0.35
      effectType: 'smite',
      description: 'Pillar of judgement: heavy damage, refreshes shield, taunts nearby beasts.',
    },
  ],
};
