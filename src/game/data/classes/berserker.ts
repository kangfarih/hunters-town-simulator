import type { ClassKit } from './types';

export const BerserkerKit: ClassKit = {
  id: 'Berserker',
  baseHp: 150,
  baseAtk: 28,
  baseDef: 10,
  baseCrit: 0.15,
  speed: 0.042,
  traineeWeapon: 'Trainee Broadsword',
  weaponNoun: 'Cleaver',
  armorNoun: 'Plate',
  skillTemplates: [
    {
      idPrefix: 'berserk',
      name: 'Cleave Slash',
      cooldownMs: 4000,
      damageMultiplier: 2.2, // 1.8 + tier(1) * 0.4
      effectType: 'slash',
      description: 'Strikes viciously in a wide arc dealing heavy physical damage.',
    },
    {
      idPrefix: 'berserk',
      name: 'Whirlwind',
      cooldownMs: 4000,
      damageMultiplier: 2.6, // 1.8 + tier(2) * 0.4
      effectType: 'whirlwind',
      description: 'Strikes viciously in a wide arc dealing heavy physical damage.',
    },
    {
      idPrefix: 'berserk',
      name: 'Rage Berserk',
      cooldownMs: 4000,
      damageMultiplier: 3.0, // 1.8 + tier(3) * 0.4
      effectType: 'slash',
      description: 'Strikes viciously in a wide arc dealing heavy physical damage.',
    },
  ],
};
