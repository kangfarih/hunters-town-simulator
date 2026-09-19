import type { ClassKit } from './types';

export const BerserkerKit: ClassKit = {
  id: 'Berserker',
  baseHp: 200, // TTK tune: 150->200
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
      damageMultiplier: 2.0,
      effectType: 'slash',
      description: 'Spam strike in a wide arc dealing 200% slash damage.',
    },
    {
      idPrefix: 'berserk',
      name: 'Whirlwind Storm',
      cooldownMs: 9000,
      damageMultiplier: 1.0,
      effectType: 'whirlwind',
      description: 'Conjures a fixed storm zone (r3, 4s) shredding foes for ~40% ATK each second.',
      zone: { kind: 'storm', radius: 3, durationSec: 4, tickFrac: 0.40 },
    },
    {
      idPrefix: 'berserk',
      name: 'Rage Execute',
      cooldownMs: 14000,
      damageMultiplier: 3.8,
      effectType: 'slash',
      description: 'Executes with apocalyptic fury dealing 380% slash damage.',
    },
  ],
};
