export type CharacterClass = 'Berserker' | 'Ranger' | 'Sorcerer' | 'Paladin';

export type HunterRarity = 'Normal' | 'Rare' | 'Superior' | 'Heroic' | 'Legendary';

export type HunterState = 
  | 'SPAWNING'
  | 'REGISTERING'
  | 'WANDERING_TOWN'
  | 'TRAVELING_TO_HUNT'
  | 'HUNTING'
  | 'FIGHTING'
  | 'RETURNING_TO_TOWN'
  | 'SELLING_LOOT'
  | 'UPGRADING_GEAR'
  | 'LEARNING_SKILL'
  | 'BREWING_ELIXIR'
  | 'RECOVERING_CLINIC'
  | 'RESTING_TAVERN';

export interface ItemDrop {
  id: string;
  name: string;
  count: number;
  value: number;
  iconType: 'bone' | 'pelt' | 'horn' | 'fang' | 'magic_orb' | 'dragon_scale';
}

export type MaterialType = 'bone' | 'pelt' | 'horn' | 'fang' | 'magic_orb' | 'dragon_scale';

export type MaterialStock = Record<MaterialType, number>;

export interface Equipment {
  id: string;
  name: string;
  tier: number; // 1 to 5
  type: 'weapon' | 'armor' | 'accessory';
  atkBonus: number;
  defBonus: number;
  hpBonus: number;
}

export interface Skill {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  cooldownMs: number;
  lastUsedMs: number;
  damageMultiplier: number;
  effectType: 'slash' | 'multishot' | 'meteor' | 'smite' | 'whirlwind' | 'holy_burst';
  description: string;
}

export interface Hunter {
  id: string;
  name: string;
  charClass: CharacterClass;
  rarity: HunterRarity;
  level: number;
  exp: number;
  expToNext: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  critRate: number; // 0 - 1
  speed: number;
  gold: number;
  state: HunterState;
  stateTimer: number; // time spent or remaining in current state
  
  // Position in grid coordinates (continuous float)
  gx: number;
  gy: number;
  targetGx: number;
  targetGy: number;
  facing: 'SE' | 'SW' | 'NE' | 'NW';
  
  // Target IDs
  targetMonsterId: string | null;
  targetBuildingId: string | null;

  // Field party (runtime-only; dissolved on save/load, reforms live)
  partyId: string | null;

  // Equipment & Inventory
  weapon: Equipment;
  armor: Equipment;
  accessory: Equipment;
  inventory: ItemDrop[];
  maxInventorySlots: number;

  // Skills
  skills: Skill[];
  skillPoints: number;

  // Needs & morale (Hunters Town style)
  mood: number; // 0 - 100: drops when monsters land hits, scales ATK/DEF
  moraleBoost: number; // bonus ATK fraction from tavern drinks (0 = none)
  moraleBoostTimer: number; // seconds remaining on the morale buff
  elixirs: number; // alchemy brews auto-drunk in combat at low HP
  tonics: number; // carried buff tonics (+20% ATK for 60s, drunk at fight start)
  tonicBoost: number; // active tonic ATK fraction (0.20 while buffed, else 0)
  tonicBoostTimer: number; // seconds remaining on the tonic buff
  deaths: number; // times knocked down and rescued by the clinic

  // Visual animation timers
  animFrame: number;
  animTick: number;
  isAttacking: boolean;
  attackAnimTimer: number;
  killCount: number;
}

export interface Monster {
  id: string;
  name: string;
  zone: 1 | 2 | 3;
  type: 'slime' | 'goblin' | 'wolf' | 'skeleton' | 'ghoul' | 'drake' | 'boss_lich';
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  expReward: number;
  goldReward: number;
  drops: ItemDrop[];
  
  gx: number;
  gy: number;
  targetGx: number;
  targetGy: number;
  facing: 'SE' | 'SW';
  
  state: 'IDLE' | 'PATROL' | 'COMBAT';
  targetHunterId: string | null;
  attackCooldown: number;
  roamPauseTimer: number; // idle seconds before picking the next roam target
  
  isBoss?: boolean;
  animFrame: number;
}

export type BuildingType = 
  | 'TOWN_HALL'
  | 'BLACKSMITH'
  | 'ALCHEMY_LAB'
  | 'TAVERN'
  | 'TRAINING_ACADEMY'
  | 'TRADING_POST'
  | 'CLINIC';

export interface Building {
  id: string;
  type: BuildingType;
  name: string;
  level: number;
  maxLevel: number;
  exp: number;
  expToNext: number;
  totalTransactions: number;
  lifetimeGold: number;
  
  // Grid placement
  gx: number;
  gy: number;
  width: number;
  height: number;
  doorGx: number;
  doorGy: number;

  description: string;
  serviceName: string;
  currentVisitors: string[]; // hunter IDs inside or using service
  upgradeEffect: string;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  opacity: number;
  duration: number;
  elapsed: number;
  vy: number;
  isCrit?: boolean;
}

export interface SkillVFX {
  id: string;
  type: 'slash' | 'multishot' | 'meteor' | 'smite' | 'whirlwind' | 'holy_burst' | 'impact';
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  duration: number;
  elapsed: number;
  color: string;
  radius?: number;
}

export interface GameLog {
  id: string;
  timestamp: string;
  type: 'summon' | 'combat' | 'upgrade' | 'trade' | 'skill' | 'boss';
  message: string;
  hunterName?: string;
}
