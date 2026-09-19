import type { ClassKit } from './types';

export const ClericKit: ClassKit = {
  id: 'Cleric',
  baseHp: 125, // TTK tune: 85->125
  baseAtk: 14,
  baseDef: 8,
  baseCrit: 0.10,
  speed: 0.044,
  traineeWeapon: 'Trainee Chime',
  weaponNoun: 'Gavel',
  armorNoun: 'Aegis',
  notes: 'Support healer, slightly quick feet.',
  skillTemplates: [
    {
      idPrefix: 'cleric',
      name: 'Mend Wounds',
      cooldownMs: 4000, // TTK tune: 5000->4000
      damageMultiplier: 1.0,
      effectType: 'heal',
      description: 'Mends the most wounded ally in r5 for 30% maxHp + 1.0 ATK (below 75% HP).', // TTK tune: was 25% maxHp + 0.8 ATK
    },
    {
      idPrefix: 'cleric',
      name: 'Soothing Radiance',
      cooldownMs: 10000,
      damageMultiplier: 1.0,
      effectType: 'heal',
      description: 'Radiates a following healing aura (r3, 5s) restoring ~6% maxHp + 0.2 ATK each second.',
      zone: { kind: 'radiance', radius: 3, durationSec: 5, tickFrac: 0.20, hotMaxFrac: 0.06 },
    },
    {
      idPrefix: 'cleric',
      name: 'Renewing Dawn',
      cooldownMs: 15000,
      damageMultiplier: 2.0,
      effectType: 'holy_burst',
      description: 'Holy burst healing the party in r6 for ~30% maxHp + 1.0 ATK.',
    },
  ],
};
