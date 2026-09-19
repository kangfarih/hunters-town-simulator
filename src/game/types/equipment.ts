import type { CharacterClass } from './hunter';

export type MaterialType = 'bone' | 'pelt' | 'horn' | 'fang' | 'magic_orb' | 'dragon_scale';

export type MaterialStock = Record<MaterialType, number>;

export type EquipmentRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic';

export type EquipmentEffectId =
  | 'execution'   // +dmg vs low-HP targets (Kingsbane)
  | 'deadeye'     // +crit, harder crits (Cometfang)
  | 'meteorfall'  // +skill damage (Solar Cataclysm)
  | 'bossbane'    // +dmg vs boss (Dawnbreaker)
  | 'crescendo'   // +skill damage for Encore-buffed allies (Fateweaver Lute)
  | 'lifesteal'   // heal % of damage dealt (Bloodlord)
  | 'swiftwind'   // +attack speed (Windstalker)
  | 'focus'       // -skill cooldowns (Astral Veil)
  | 'martyr';     // reflect + mood guard (Aegis)

export interface Equipment {
  id: string;
  name: string;
  tier: number; // 1 to 5
  type: 'weapon' | 'armor' | 'accessory';
  atkBonus: number;
  defBonus: number;
  hpBonus: number;
  rarity: EquipmentRarity; // shop gear = Common
  requiredClass?: CharacterClass; // epic weapons only
  effectId?: EquipmentEffectId; // epics only
  effectValue?: number;
}
