import type { ClassKit } from './types';

export const RangerKit: ClassKit = {
  id: 'Ranger',
  baseHp: 100,
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
      damageMultiplier: 1.95, // 1.6 + tier(1) * 0.35
      effectType: 'multishot',
      description: 'Fires rapid enchanted arrows piercing monster defenses.',
    },
    {
      idPrefix: 'ranger',
      name: 'Rain of Arrows',
      cooldownMs: 3500,
      damageMultiplier: 2.3, // 1.6 + tier(2) * 0.35
      effectType: 'multishot',
      description: 'Fires rapid enchanted arrows piercing monster defenses.',
    },
    {
      idPrefix: 'ranger',
      name: 'Piercing Comet',
      cooldownMs: 3500,
      damageMultiplier: 2.65, // 1.6 + tier(3) * 0.35
      effectType: 'multishot',
      description: 'Fires rapid enchanted arrows piercing monster defenses.',
    },
  ],
};
