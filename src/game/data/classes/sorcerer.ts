import type { ClassKit } from './types';

export const SorcererKit: ClassKit = {
  id: 'Sorcerer',
  baseHp: 90,
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
      damageMultiplier: 2.7, // 2.2 + tier(1) * 0.5
      effectType: 'meteor',
      description: 'Summons a blazing arcane meteor blasting all surrounding beasts.',
    },
    {
      idPrefix: 'sorc',
      name: 'Meteor Strike',
      cooldownMs: 5000,
      damageMultiplier: 3.2, // 2.2 + tier(2) * 0.5
      effectType: 'meteor',
      description: 'Summons a blazing arcane meteor blasting all surrounding beasts.',
    },
    {
      idPrefix: 'sorc',
      name: 'Solar Flare',
      cooldownMs: 5000,
      damageMultiplier: 3.7, // 2.2 + tier(3) * 0.5
      effectType: 'meteor',
      description: 'Summons a blazing arcane meteor blasting all surrounding beasts.',
    },
  ],
};
