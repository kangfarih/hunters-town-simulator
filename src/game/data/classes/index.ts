// Class registry: one kit per hunter class. To add a class, copy a kit
// file, register it below, and add the id to CharacterClass in types/.
// Simulation and skills.ts read through CLASS_KITS — never per-class files.

import type { CharacterClass } from '../../types';
import type { ClassKit } from './types';
import { BerserkerKit } from './berserker';
import { RangerKit } from './ranger';
import { SorcererKit } from './sorcerer';
import { PaladinKit } from './paladin';
import { ClericKit } from './cleric';
import { BardKit } from './bard';

export type { ClassKit, SkillTemplate } from './types';

export const CLASS_KITS: Record<CharacterClass, ClassKit> = {
  Berserker: BerserkerKit,
  Ranger: RangerKit,
  Sorcerer: SorcererKit,
  Paladin: PaladinKit,
  Cleric: ClericKit,
  Bard: BardKit,
};

/** Playable classes in summon rotation order. */
export const PLAYABLE_CLASSES: CharacterClass[] = [
  'Berserker', 'Ranger', 'Sorcerer', 'Paladin', 'Cleric', 'Bard',
];

/** Lv-1 base stats for a class (flat baseline, no rarity multiplier + trainee gear names). */
export function baseStatsFor(charClass: CharacterClass): {
  maxHp: number; atk: number; def: number; critRate: number; speed: number;
  weaponName: string; armorName: string; accessoryName: string;
} {
  const kit = CLASS_KITS[charClass];
  return {
    maxHp: Math.round(kit.baseHp),
    atk: Math.round(kit.baseAtk),
    def: Math.round(kit.baseDef),
    critRate: kit.baseCrit,
    speed: kit.speed,
    weaponName: kit.traineeWeapon,
    armorName: 'Novice Leather Coat',
    accessoryName: 'Copper Ring',
  };
}

/** Loot-name noun for generated weapons, e.g. 'Cleaver'. */
export function classWeaponNoun(charClass: CharacterClass): string {
  return CLASS_KITS[charClass].weaponNoun;
}

/** Loot-name noun for generated armor, e.g. 'Plate'. */
export function classArmorNoun(charClass: CharacterClass): string {
  return CLASS_KITS[charClass].armorNoun;
}
