import type { ClassKit } from './types';

export const BardKit: ClassKit = {
  id: 'Bard',
  baseHp: 95,
  baseAtk: 16,
  baseDef: 7,
  baseCrit: 0.12,
  speed: 0.046,
  traineeWeapon: 'Trainee Lute',
  weaponNoun: 'Lute',
  armorNoun: 'Cloak',
  notes: 'Frail party buffer, fastest feet, weak solo damage.',
  skillTemplates: [
    {
      idPrefix: 'bard',
      name: 'Dissonant Chord',
      cooldownMs: 4000,
      damageMultiplier: 1.7, // 1.4 + tier(1) * 0.3
      effectType: 'ballad',
      description: 'Strums a jarring chord dealing sonic damage.',
    },
    {
      idPrefix: 'bard',
      name: 'Encore Anthem',
      cooldownMs: 6000,
      damageMultiplier: 0, // pure buff: no damage, handled by the Encore support path
      effectType: 'encore',
      description: 'Sings an anthem buffing nearby allies +20% ATK for 8s.',
    },
    {
      idPrefix: 'bard',
      name: 'Golden Finale',
      cooldownMs: 8000,
      damageMultiplier: 3.2, // 2.0 + tier(3) * 0.4
      effectType: 'encore',
      description: 'Grand finale: sonic damage plus +10% gold fever for the party (15s).',
    },
  ],
};
