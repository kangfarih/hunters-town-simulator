// Barrel: single import point for all game data tables.
// Simulation systems import tables from here; designers edit the leaf files.
// Rule: data/ files must never import simulation — pure tables + pure helpers.

export { TOWN_GATE_POS, SOUTH_GATE_POS, SUMMON_PORTAL_POS, ZONE_ROAM_BOUNDS, SAVE_KEY } from './world';
export { HUNTER_FIRST_NAMES, HUNTER_TITLES, makeHunterName } from './names';
export {
  DEFAULT_AGENT_CONFIG,
  clampAgentConfig,
  partyColor,
  difficultyMultipliers,
} from './tuning';
export type { AgentConfig, Party } from './tuning';
export {
  CLASS_KITS,
  PLAYABLE_CLASSES,
  baseStatsFor,
  classWeaponNoun,
  classArmorNoun,
} from './classes';
export type { ClassKit, SkillTemplate } from './classes';
export {
  SKILL_EXP_TO_NEXT,
  skillExpToNext,
  skillExpPerCast,
  createClassSkill,
  skillTier,
  academyCostFor,
  readySkills,
  hasAffordableReadySkill,
  cheapestReadyCost,
} from './skills';
export { MONSTER_ARCHETYPES, monsterLabel } from './monsters';
export type { MonsterArchetype, MonsterDensity } from './monsters';
export {
  RARITY_STAT_MULT,
  GEAR_SELL_MULT,
  gearSellPrice,
  AUCTION_STOCK_CAP,
  AUCTION_MAX_COPIES_PER_ITEM,
  auctionItemKey,
  isAuctionable,
  auctionBuyoutPrice,
  auctionBuyerPrice,
  RARITY_HEX,
  RARITY_TEXT_CLASS,
  RARITY_BORDER_CLASS,
  rarityHex,
  rarityTextClass,
  rarityBorderClass,
  EPIC_DEFS,
  epicEffectDescription,
  equipmentDisplayName,
  getEquipmentPrefix,
  zoneGearTier,
} from './loot';
export type { EpicDef } from './loot';
export { INITIAL_BUILDINGS, buildingCapacity, serviceTime } from './buildings';
