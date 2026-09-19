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
      cooldownMs: 6000,
      damageMultiplier: 1.8,
      effectType: 'smite',
      description: 'Divine wrath dealing 180% damage and raising a 30% maxHp shield (6s).',
    },
    {
      idPrefix: 'pala',
      name: 'Consecrated Aura',
      cooldownMs: 11000,
      damageMultiplier: 1.0,
      effectType: 'smite',
      description: 'Consecrates a following aura (r3, 5s) burning foes ~20% ATK/s, taunts on cast, shields allies each tick.',
      zone: { kind: 'consecration', radius: 3, durationSec: 5, tickFrac: 0.20 },
    },
    {
      idPrefix: 'pala',
      name: 'Judgement Pillar',
      cooldownMs: 15000,
      damageMultiplier: 2.8,
      effectType: 'smite',
      description: 'Pillar of judgement: 280% damage, 45% maxHp shield (7s), taunts nearby beasts (5s).',
    },
  ],
};
