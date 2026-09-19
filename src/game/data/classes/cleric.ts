import type { ClassKit } from './types';

export const ClericKit: ClassKit = {
  id: 'Cleric',
  baseHp: 85,
  baseAtk: 14,
  baseDef: 8,
  baseCrit: 0.10,
  speed: 0.044,
  traineeWeapon: 'Trainee Chime',
  weaponNoun: 'Gavel',
  armorNoun: 'Aegis',
  notes: 'Frail support healer, slightly quick feet.',
  skillTemplates: [
    {
      idPrefix: 'cleric',
      name: 'Mend Wounds',
      cooldownMs: 5000,
      damageMultiplier: 2.4, // 2.0 + tier(1) * 0.4
      effectType: 'heal',
      description: 'Channels holy light to heal the most wounded nearby ally.',
    },
    {
      idPrefix: 'cleric',
      name: 'Soothing Radiance',
      cooldownMs: 5000,
      damageMultiplier: 2.8, // 2.0 + tier(2) * 0.4
      effectType: 'heal',
      description: 'Channels holy light to heal the most wounded nearby ally.',
    },
    {
      idPrefix: 'cleric',
      name: 'Renewing Dawn',
      cooldownMs: 5000,
      damageMultiplier: 3.2, // 2.0 + tier(3) * 0.4
      effectType: 'heal',
      description: 'Channels holy light to heal the most wounded nearby ally.',
    },
  ],
};
