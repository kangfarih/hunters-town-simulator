import type { ClassKit } from './types';

export const SorcererKit: ClassKit = {
  id: 'Sorcerer',
  baseHp: 130, // TTK tune: 90->130
  baseAtk: 34,
  baseDef: 5,
  baseCrit: 0.18,
  speed: 0.04,
  traineeWeapon: 'Trainee Wooden Staff',
  weaponNoun: 'Staff',
  armorNoun: 'Robe',
  skillTemplates: [
    {
      idPrefix: 'sorc',
      name: 'Arcane Bolt',
      cooldownMs: 5000,
      damageMultiplier: 2.5,
      effectType: 'meteor',
      description: 'Spam arcane meteor dealing 250% blast damage.',
    },
    {
      idPrefix: 'sorc',
      name: 'Meteor Burn',
      cooldownMs: 10000,
      damageMultiplier: 1.0,
      effectType: 'meteor',
      description: 'Ignites a fixed burn zone (r3, 6s) searing foes for ~50% ATK each second.',
      zone: { kind: 'burn', radius: 3, durationSec: 6, tickFrac: 0.50 },
    },
    {
      idPrefix: 'sorc',
      name: 'Solar Cataclysm',
      cooldownMs: 16000,
      damageMultiplier: 4.5,
      effectType: 'meteor',
      description: 'Calls down the sun itself dealing 450% meteor damage.',
    },
  ],
};
