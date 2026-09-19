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
      damageMultiplier: 1.7,
      effectType: 'ballad',
      description: 'Strums a jarring chord dealing 170% sonic damage.',
    },
    {
      idPrefix: 'bard',
      name: 'Resonant Hymn',
      cooldownMs: 10000,
      damageMultiplier: 1.0,
      effectType: 'encore',
      description: 'Sings a following hymn aura (r3, 5s) healing ~3% maxHp/s and refreshing Encore +20% ATK.',
      zone: { kind: 'hymn', radius: 3, durationSec: 5, tickFrac: 0.0, hotMaxFrac: 0.03 },
    },
    {
      idPrefix: 'bard',
      name: 'Golden Finale',
      cooldownMs: 16000,
      damageMultiplier: 3.2,
      effectType: 'encore',
      description: 'Grand finale: 320% sonic damage plus Gold Fever (+10% gold, 15s) for the party.',
    },
  ],
};
