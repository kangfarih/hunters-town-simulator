import type { ClassKit } from './types';

export const RangerKit: ClassKit = {
  id: 'Ranger',
  baseHp: 140, // TTK tune: 100->140
  baseAtk: 25,
  baseDef: 6,
  baseCrit: 0.25,
  speed: 0.048,
  traineeWeapon: 'Trainee Shortbow',
  weaponNoun: 'Bow',
  armorNoun: 'Garb',
  skillTemplates: [
    {
      idPrefix: 'ranger',
      name: 'Quick Shot',
      cooldownMs: 3500,
      damageMultiplier: 1.8,
      effectType: 'multishot',
      description: 'Spam volley of enchanted arrows dealing 180% damage.',
    },
    {
      idPrefix: 'ranger',
      name: 'Rain of Arrows',
      cooldownMs: 9000,
      damageMultiplier: 1.0,
      effectType: 'multishot',
      description: 'Rains a fixed arrow zone (r3, 5s) piercing foes for ~35% ATK each second.',
      zone: { kind: 'arrows', radius: 3, durationSec: 5, tickFrac: 0.35 },
    },
    {
      idPrefix: 'ranger',
      name: 'Piercing Comet',
      cooldownMs: 14000,
      damageMultiplier: 3.6,
      effectType: 'multishot',
      description: 'Finisher comet dealing 360% damage, piercing most monster DEF.',
    },
  ],
};
