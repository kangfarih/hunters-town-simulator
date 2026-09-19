import {
  Hunter, Monster, Building, FloatingText, SkillVFX, GameLog,
  CharacterClass, ItemDrop, Equipment, Skill,
  MaterialStock, MaterialType, EquipmentRarity, EquipmentEffectId
} from '../types';
import { gridDistance, getIsometricFacing } from './isometric';
import { findPath, PathPoint, reserveAt } from './pathfinding';
import { soundFx } from './audioSynth';

// Town Building Locations (Isometric Grid)
export const INITIAL_BUILDINGS: Building[] = [
  {
    id: 'b-townhall',
    type: 'TOWN_HALL',
    name: 'Sanctuary Hall',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 100,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 28,
    gy: 24,
    width: 3,
    height: 3,
    doorGx: 29,
    doorGy: 26,
    description: 'The Chief Sanctuary. Manages town territory and hunter allowances.',
    serviceName: 'Town Governance',
    currentVisitors: [],
    upgradeEffect: 'Increases max hunters & global town hunting tax rate.'
  },
  {
    id: 'b-blacksmith',
    type: 'BLACKSMITH',
    name: 'Vulcan Forge',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 80,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 24,
    gy: 28,
    width: 2,
    height: 2,
    doorGx: 25,
    doorGy: 30,
    description: 'Crafts and upgrades high-grade weapons and heavy armor for hunters.',
    serviceName: 'Weapon & Armor Crafting',
    currentVisitors: [],
    upgradeEffect: 'Unlocks higher weapon & armor tiers for auto-buying.'
  },
  {
    id: 'b-alchemy',
    type: 'ALCHEMY_LAB',
    name: 'Elixir Cauldron',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 75,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 32,
    gy: 28,
    width: 2,
    height: 2,
    doorGx: 32,
    doorGy: 30,
    description: 'Brews restorative HP and combat elixirs from monster essences.',
    serviceName: 'Potion Dispensing',
    currentVisitors: [],
    upgradeEffect: 'Brews stronger restorative potions with instant heal.'
  },
  {
    id: 'b-tavern',
    type: 'TAVERN',
    name: 'Boar & Barrel Tavern',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 90,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 24,
    gy: 33,
    width: 2,
    height: 2,
    doorGx: 25,
    doorGy: 35,
    description: 'Serves roast meat and frothy ale to recharge exhausted hunters.',
    serviceName: 'Food & Lodging',
    currentVisitors: [],
    upgradeEffect: 'Grants temporary Morale ATK buff to visiting hunters.'
  },
  {
    id: 'b-academy',
    type: 'TRAINING_ACADEMY',
    name: 'Valor Academy',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 100,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 32,
    gy: 33,
    width: 2,
    height: 2,
    doorGx: 32,
    doorGy: 35,
    description: 'Martial school where hunters study and auto-upgrade combat skills.',
    serviceName: 'Skill Mastery',
    currentVisitors: [],
    upgradeEffect: 'Unlocks advanced skill masteries and reduces cooldowns.'
  },
  {
    id: 'b-trading',
    type: 'TRADING_POST',
    name: 'Merchant Bazaar',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 60,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 28,
    gy: 31,
    width: 2,
    height: 2,
    doorGx: 28,
    doorGy: 33,
    description: 'Buys all harvested monster trophies, fangs, and pelts for gold.',
    serviceName: 'Loot Exchange',
    currentVisitors: [],
    upgradeEffect: 'Increases purchase price paid to hunters by +15% per level.'
  },
  {
    id: 'b-clinic',
    type: 'CLINIC',
    name: 'Mercy Clinic',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 70,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 28,
    gy: 35,
    width: 2,
    height: 2,
    doorGx: 28,
    doorGy: 37,
    description: 'Tends to wounded hunters and resurrects fallen warriors from fields.',
    serviceName: 'Emergency Healing',
    currentVisitors: [],
    upgradeEffect: 'Dramatically speeds up recovery time from field wounds.'
  }
];

// Town gates: East (Town Gate road) and South (Graveyard road)
export const TOWN_GATE_POS = { gx: 38, gy: 30 };
export const SOUTH_GATE_POS = { gx: 30, gy: 39 };
export const SUMMON_PORTAL_POS = { gx: 29, gy: 22 };

// Roam boundaries per hunting zone (monsters wander inside their home zone)
export const ZONE_ROAM_BOUNDS: Record<1 | 2 | 3, { minGx: number; maxGx: number; minGy: number; maxGy: number }> = {
  1: { minGx: 42, maxGx: 54, minGy: 22, maxGy: 36 }, // Whispering Forest
  2: { minGx: 22, maxGx: 36, minGy: 42, maxGy: 54 }, // Gloomy Graveyard
  3: { minGx: 42, maxGx: 56, minGy: 42, maxGy: 56 }, // Volcanic Ruins
};

// Local save persistence
export const SAVE_KEY = 'hunters-town-save-v1';
const LEGACY_SAVE_KEY = 'evil-hunter-tycoon-save-v1';
const SAVE_VERSION = 3;
// Grid shift applied when migrating pre-shift (v1) saves: every settled
// coordinate moves +20/+20 as town relocated NW→center.
const SAVE_SHIFT = 20;

// Hunter-brain tuning knobs (persisted, live-tunable from World Config).
// retreatHpFrac: fraction of effective max HP below which a hunting hunter
//   retreats to the clinic. dangerHits: minimum hits-to-die for a fight to
//   read as fair (lower = braver). grayGap: level gap at/above which kills
//   pay no spoils. huntBaseline: post-kill utility the hunt itself scores —
//   town needs must outscore it to interrupt the field. tavernMood: mood
//   points (0-100) below which the tavern errand scores nonzero.
export interface AgentConfig {
  retreatHpFrac: number;
  dangerHits: number;
  grayGap: number;
  huntBaseline: number;
  tavernMood: number;
  partiesEnabled: boolean;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  retreatHpFrac: 0.20,
  dangerHits: 6,
  grayGap: 3,
  huntBaseline: 0.5,
  tavernMood: 65,
  partiesEnabled: true,
};

/** Runtime-only field party: up to 5 hunters, led by the highest level. */
export interface Party {
  id: string;
  leaderId: string;
  memberIds: string[];
  lootTurn: number;
}

/**
 * Deterministic per-party badge color: all members of the same party share
 * one color. Pure (no state): null in → null out, else a stable hash of the
 * party id into an 8-color palette of saturated mid-brights readable on dark
 * slate and in the Pixi canvas text. Never persisted.
 */
const PARTY_COLOR_PALETTE = [
  '#f472b6', // pink
  '#60a5fa', // blue
  '#4ade80', // green
  '#facc15', // yellow
  '#c084fc', // purple
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#f87171', // red
] as const;

export function partyColor(partyId: string | null): string | null {
  if (partyId == null) return null;
  let hash = 5381;
  for (let i = 0; i < partyId.length; i++) {
    hash = ((hash << 5) + hash + partyId.charCodeAt(i)) | 0;
  }
  return PARTY_COLOR_PALETTE[Math.abs(hash) % PARTY_COLOR_PALETTE.length];
}

/** Clamp a (possibly foreign) agent-config blob into valid ranges. */
export function clampAgentConfig(cfg: Partial<AgentConfig>): AgentConfig {
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    retreatHpFrac: Math.min(0.5, Math.max(0.05, num(cfg.retreatHpFrac, DEFAULT_AGENT_CONFIG.retreatHpFrac))),
    dangerHits: Math.min(12, Math.max(2, Math.round(num(cfg.dangerHits, DEFAULT_AGENT_CONFIG.dangerHits)))),
    grayGap: Math.min(6, Math.max(2, Math.round(num(cfg.grayGap, DEFAULT_AGENT_CONFIG.grayGap)))),
    huntBaseline: Math.min(0.9, Math.max(0.1, num(cfg.huntBaseline, DEFAULT_AGENT_CONFIG.huntBaseline))),
    tavernMood: Math.min(100, Math.max(10, num(cfg.tavernMood, DEFAULT_AGENT_CONFIG.tavernMood))),
    partiesEnabled: typeof cfg.partiesEnabled === 'boolean' ? cfg.partiesEnabled : DEFAULT_AGENT_CONFIG.partiesEnabled,
  };
}

// Random Name Generation
const HUNTER_FIRST_NAMES = [
  'Arthur', 'Kaelen', 'Valkor', 'Lyra', 'Seraphina', 'Garrick', 'Rowan', 
  'Eldrin', 'Draven', 'Zephyr', 'Aria', 'Morrigan', 'Boran', 'Kallum', 
  'Thorin', 'Ember', 'Ignis', 'Sylvia', 'Vance', 'Cassian'
];
const HUNTER_TITLES = [
  'the Brave', 'Stormcaller', 'Ironclad', 'Shadowstrike', 'Lightbringer', 
  'Flameheart', 'Swiftwind', 'Dragonbane', 'Oathkeeper', 'Gloomstalker'
];

export type MonsterDensity = 'sparse' | 'normal' | 'swarming'; // legacy preset, migrated to monsterPopulation on load

/** Display label for any monster: `Lv.{level} {name}`. Pure (no DOM). */
export function monsterLabel(m: Monster): string {
  return `Lv.${m.level} ${m.name}`;
}

/** Max concurrent customers inside a building. */
export function buildingCapacity(b: Building): number {
  if (b.type === 'TOWN_HALL') return 3 + Math.floor(b.level / 2);
  return 1 + Math.floor(b.level / 3);
}

/** Seconds a hunter spends receiving a building's service. */
export function serviceTime(b: Building): number {
  switch (b.type) {
    case 'TRADING_POST': return Math.max(1.5, 11 - 0.95 * b.level);
    case 'BLACKSMITH': return Math.max(1.5, 12 - 1.0 * b.level);
    case 'TRAINING_ACADEMY': return Math.max(1.5, 11 - 0.9 * b.level);
    case 'ALCHEMY_LAB': return Math.max(1.5, 12 - 1.0 * b.level);
    case 'TAVERN': return Math.max(1.5, 11 - 0.9 * b.level);
    case 'CLINIC': return Math.max(2.0, 13 - 1.1 * b.level);
    default: return Math.max(1.5, 11 - 0.9 * b.level);
  }
}

/** Lv-1 base stats for a class (flat baseline, no rarity multiplier + trainee gear names). */
export function baseStatsFor(charClass: CharacterClass): {
  maxHp: number; atk: number; def: number; critRate: number; speed: number;
  weaponName: string; armorName: string; accessoryName: string;
} {
  let baseHp = 120;
  let baseAtk = 22;
  let baseDef = 8;
  let baseCrit = 0.1;
  let speed = 0.04;

  if (charClass === 'Berserker') {
    baseHp = 150;
    baseAtk = 28;
    baseDef = 10;
    baseCrit = 0.15;
    speed = 0.042;
  } else if (charClass === 'Ranger') {
    baseHp = 100;
    baseAtk = 25;
    baseDef = 6;
    baseCrit = 0.25;
    speed = 0.048;
  } else if (charClass === 'Sorcerer') {
    baseHp = 90;
    baseAtk = 34;
    baseDef = 5;
    baseCrit = 0.18;
    speed = 0.04;
  } else if (charClass === 'Paladin') {
    // Tank anchor: biggest HP/DEF pool, weakest crit, slowest feet.
    // Trades damage for the line-holding tank kit (shield + taunt + DR aura).
    baseHp = 220;
    baseAtk = 18;
    baseDef = 20;
    baseCrit = 0.05;
    speed = 0.036;
  } else if (charClass === 'Bard') {
    // Bard: frail party buffer, fastest feet, weak solo damage
    baseHp = 95;
    baseAtk = 16;
    baseDef = 7;
    baseCrit = 0.12;
    speed = 0.046;
  } else {
    // Cleric: frail support healer, slightly quick feet
    baseHp = 85;
    baseAtk = 14;
    baseDef = 8;
    baseCrit = 0.10;
    speed = 0.044;
  }

  return {
    maxHp: Math.round(baseHp),
    atk: Math.round(baseAtk),
    def: Math.round(baseDef),
    critRate: baseCrit,
    speed,
    weaponName: `Trainee ${charClass === 'Berserker' ? 'Broadsword' : charClass === 'Ranger' ? 'Shortbow' : charClass === 'Sorcerer' ? 'Wooden Staff' : charClass === 'Paladin' ? 'Mace' : charClass === 'Bard' ? 'Lute' : 'Chime'}`,
    armorName: 'Novice Leather Coat',
    accessoryName: 'Copper Ring',
  };
}

// --------------------------------------------------------------------------
// Rarity loot: Normal x1.0 / Uncommon x1.15 / Rare x1.35 / Epic x1.6 on tier base.
// Tier base (shop equivalent): weapon 5+(t-1)*8; armor DEF 3+(t-1)*4, HP 20+(t-1)*15.
// Uncommon/Rare are stats-only; only Epics carry effectId.
// --------------------------------------------------------------------------

export const RARITY_STAT_MULT: Record<EquipmentRarity, number> = {
  Common: 1.0,
  Uncommon: 1.15,
  Rare: 1.35,
  Epic: 1.6,
};

export const GEAR_SELL_MULT: Record<EquipmentRarity, number> = {
  Common: 1.0,
  Uncommon: 1.5,
  Rare: 2.5,
  Epic: 5.0,
};

export function gearSellPrice(tier: number, rarity: EquipmentRarity): number {
  return Math.round(tier * 40 * (GEAR_SELL_MULT[rarity] ?? 1));
}

// --------------------------------------------------------------------------
// Rarity colors: Common white, Uncommon green, Rare blue, Epic purple.
// Single source of truth for UI text/border + canvas floating-text hex.
// --------------------------------------------------------------------------

export const RARITY_HEX: Record<EquipmentRarity, string> = {
  Common: '#e2e8f0', // slate-200 white
  Uncommon: '#4ade80', // green
  Rare: '#60a5fa', // blue
  Epic: '#c084fc', // purple
};

export const RARITY_TEXT_CLASS: Record<EquipmentRarity, string> = {
  Common: 'text-slate-200',
  Uncommon: 'text-emerald-400',
  Rare: 'text-blue-400',
  Epic: 'text-purple-400',
};

export const RARITY_BORDER_CLASS: Record<EquipmentRarity, string> = {
  Common: 'border-slate-700/60',
  Uncommon: 'border-emerald-500/50',
  Rare: 'border-blue-500/50',
  Epic: 'border-purple-500/60',
};

export function rarityHex(rarity: EquipmentRarity | undefined | null): string {
  return RARITY_HEX[rarity ?? 'Common'] ?? RARITY_HEX.Common;
}

export function rarityTextClass(rarity: EquipmentRarity | undefined | null): string {
  return RARITY_TEXT_CLASS[rarity ?? 'Common'] ?? RARITY_TEXT_CLASS.Common;
}

export function rarityBorderClass(rarity: EquipmentRarity | undefined | null): string {
  return RARITY_BORDER_CLASS[rarity ?? 'Common'] ?? RARITY_BORDER_CLASS.Common;
}

// --------------------------------------------------------------------------
// Skill mastery: each cast grants 2 + cooldownSec EXP (longer CD = more).
// At ~5.5-7 EXP/cast, SKILL_EXP_TO_NEXT = 30 means ~5 casts to READY —
// fast enough to see Rank 2-3 in a session, with Academy gold + trips
// still gating the climb to max.
// --------------------------------------------------------------------------

export const SKILL_EXP_TO_NEXT = 30;

interface EpicDef {
  name: string;
  slot: 'weapon' | 'armor';
  reqClass?: CharacterClass;
  effectId: EquipmentEffectId;
  effectValue: number;
}

// Boss-only Tier 5 epics. Weapons are class-locked, armors are open.
export const EPIC_DEFS: EpicDef[] = [
  { name: 'Kingsbane Reaver', slot: 'weapon', reqClass: 'Berserker', effectId: 'execution', effectValue: 0.6 },
  { name: 'Cometfang Longbow', slot: 'weapon', reqClass: 'Ranger', effectId: 'deadeye', effectValue: 0.12 },
  { name: 'Solar Cataclysm Staff', slot: 'weapon', reqClass: 'Sorcerer', effectId: 'meteorfall', effectValue: 0.35 },
  { name: 'Dawnbreaker Gavel', slot: 'weapon', reqClass: 'Paladin', effectId: 'bossbane', effectValue: 0.5 },
  { name: 'Fateweaver Lute', slot: 'weapon', reqClass: 'Bard', effectId: 'crescendo', effectValue: 0.25 },
  { name: 'Bloodlord Carapace', slot: 'armor', effectId: 'lifesteal', effectValue: 0.10 },
  { name: 'Windstalker Shroud', slot: 'armor', effectId: 'swiftwind', effectValue: 0.012 },
  { name: 'Astral Veil Robe', slot: 'armor', effectId: 'focus', effectValue: 0.20 },
  { name: 'Aegis of the Martyr', slot: 'armor', effectId: 'martyr', effectValue: 0.25 },
];

export function epicEffectDescription(effectId: EquipmentEffectId, value: number): string {
  switch (effectId) {
    case 'execution': return `Execute: +${Math.round(value * 100)}% damage vs targets below 30% HP`;
    case 'deadeye': return `Deadeye: +${Math.round(value * 100)}% crit, crits hit x2.1`;
    case 'meteorfall': return `Meteorfall: +${Math.round(value * 100)}% skill damage`;
    case 'bossbane': return `Bossbane: +${Math.round(value * 100)}% damage vs bosses`;
    case 'crescendo': return `Crescendo: Encore-buffed allies deal +${Math.round(value * 100)}% skill damage`;
    case 'lifesteal': return `Lifesteal: heal ${Math.round(value * 100)}% of damage dealt`;
    case 'swiftwind': return `Swiftwind: faster attacks`;
    case 'focus': return `Focus: skills recharge ${Math.round(value * 100)}% faster`;
    case 'martyr': return `Martyr: reflect ${Math.round(value * 100)}% damage, calmer under fire`;
  }
}

export class GameSimulation {
  public hunters: Hunter[] = [];
  public monsters: Monster[] = [];
  public buildings: Building[] = [];
  public floatingTexts: FloatingText[] = [];
  public skillVfxs: SkillVFX[] = [];
  public logs: GameLog[] = [];

  // Town material stock: loot sold at the Trading Post becomes forge/brew stock.
  public materialStock: MaterialStock = GameSimulation.emptyStock();

  public townGold: number = 250;
  public totalMonstersDefeated: number = 0;
  public totalSummonedHunters: number = 0;
  public totalHunterDeaths: number = 0; // knockdowns (hunters are rescued, never permadeath)

  // World difficulty level 1-10 (5 = standard). Scales new spawns.
  public difficulty: number = 5;

  // Hunter-brain tuning knobs (persisted, live-tunable from World Config).
  public agentConfig: AgentConfig = { ...DEFAULT_AGENT_CONFIG };

  // Monster population: total concurrent monster target (3-40),
  // split across forest/crypt/volcano at roughly 6/5/3 weights.
  public monsterPopulation: number = 14;

  // Auto-director: dynamically scales spawns to hold survival near 75%
  public autoDirector: boolean = true;
  public dynamicHp: number = 1;
  public dynamicAtk: number = 1;
  private windowKills: number = 0;
  private windowDeaths: number = 0;
  private simTime: number = 0;
  private lastDirectorEval: number = 0;

  // Field parties: runtime-only (EXCLUDED from save snapshots; all
  // partyIds dissolve to null on load and parties reform live).
  public parties: Map<string, Party> = new Map();
  private partyTimer: number = 0;
  // Party-rescue cooldowns (runtime-only, never saved): hunterId -> simTime
  // of the last field rescue. Bounded by town capacity (hunters are never
  // removed, only retrained), so no pruning needed.
  private lastPartyRescue: Map<string, number> = new Map();

  // Kill-switch for saving (used by Reset World so the pagehide
  // autosave doesn't resurrect the cleared save during reload)
  public saveEnabled: boolean = true;

  // 30-Second Auto Summon Timer
  public summonCountdown: number = 30; // in seconds
  public autoSummonInterval: number = 30;

  // Game speed multiplier
  public speedMultiplier: number = 1;
  public isPaused: boolean = false;

  // Boss Spawn Timer
  public bossSpawnTimer: number = 90; // Spawns an Evil Lich every 90 seconds
  public isBossActive: boolean = false;

  constructor(skipSeed: boolean = false) {
    this.buildings = JSON.parse(JSON.stringify(INITIAL_BUILDINGS));
    if (skipSeed) return;
    // Seed initial monsters across the 3 zones
    this.spawnInitialMonsters();

    // Spawn 2 starter hunters so the simulation starts immediately
    this.summonHero('Berserker');
    this.summonHero('Ranger');

    this.addLog('summon', 'The Sanctuary Gate is open! Autonomous hunters will arrive every 30 seconds.');
  }

    /** Load a saved game if present and valid, otherwise start a fresh game. */
  public static loadOrNew(): GameSimulation {
    const loaded = GameSimulation.loadFromLocalStorage();
    if (loaded) {
      loaded.addLog('summon', 'Omniscience restored — saved town state reloaded from local archive.');
      return loaded;
    }
    return new GameSimulation();
  }

  // --------------------------------------------------------------------------
  // 1. AUTO SUMMON ENGINE (Every 30 Seconds)
  // --------------------------------------------------------------------------

  /** All-zero town material stock. */
  private static emptyStock(): MaterialStock {
    return { bone: 0, pelt: 0, horn: 0, fang: 0, magic_orb: 0, dragon_scale: 0 };
  }

  /** Total materials across all 6 piles. */
  private totalMaterials(): number {
    return (Object.keys(this.materialStock) as MaterialType[])
      .reduce((sum, k) => sum + this.materialStock[k], 0);
  }

  /** Consume up to n materials, fullest piles first. Returns how many taken. */
  private takeMaterials(n: number): number {
    let taken = 0;
    while (taken < n) {
      let best: MaterialType | null = null;
      let bestCount = 0;
      for (const k of Object.keys(this.materialStock) as MaterialType[]) {
        if (this.materialStock[k] > bestCount) {
          bestCount = this.materialStock[k];
          best = k;
        }
      }
      if (best === null) break;
      this.materialStock[best]--;
      taken++;
    }
    return taken;
  }

  /** Hunter slot cap grows with Sanctuary Hall level (4 base + 2/level). */
  public maxHunters(): number {
    const hall = this.buildings.find(b => b.type === 'TOWN_HALL');
    return 4 + (hall ? hall.level : 1) * 2;
  }

  /** Town tax rate on kill gold grows with Sanctuary Hall level. */
  public townTaxRate(): number {
    const hall = this.buildings.find(b => b.type === 'TOWN_HALL');
    return 0.10 + (hall ? hall.level : 1) * 0.01;
  }

  /** Elixir carrying capacity grows with Elixir Cauldron level. */
  public elixirCapacity(): number {
    const lab = this.buildings.find(b => b.type === 'ALCHEMY_LAB');
    return 1 + Math.floor((lab ? lab.level : 1) / 3);
  }

  /** Buff tonic carrying capacity grows with Elixir Cauldron level (L1-3: 1, L4-7: 2, L8+: 3). */
  public tonicCapacity(): number {
    const lab = this.buildings.find(b => b.type === 'ALCHEMY_LAB');
    return 1 + Math.floor((lab ? lab.level : 1) / 4);
  }

  /** Max concurrent customers inside a building (delegates to helper). */
  public buildingCapacity(b: Building): number {
    return buildingCapacity(b);
  }

  /** Seconds a hunter spends receiving a building's service. */
  public serviceTime(b: Building): number {
    return serviceTime(b);
  }

  /** Spawn multipliers for a difficulty level 1-10 (5 = standard 1x). */
  public static difficultyMultipliers(level: number): { hp: number; atk: number; def: number; reward: number } {
    const lv = Number.isFinite(level) ? Math.max(1, Math.min(10, Math.round(level))) : 5;
    return {
      hp: 0.5 + lv * 0.1,
      atk: 0.55 + lv * 0.09,
      def: 0.7 + lv * 0.06,
      reward: 0.7 + lv * 0.06,
    };
  }

  /** Set world difficulty 1-10 (applies to newly spawned monsters). */
  public setDifficulty(level: number) {
    if (!Number.isFinite(level)) return;
    const lv = Math.max(1, Math.min(10, Math.round(level)));
    if (this.difficulty === lv) return;
    this.difficulty = lv;
    const m = GameSimulation.difficultyMultipliers(lv);
    this.addLog('upgrade', `World difficulty set to ${lv}: beasts HP ×${m.hp.toFixed(1)}, ATK ×${m.atk.toFixed(1)}, loot ×${m.reward.toFixed(1)}. Applies to newly spawned monsters.`);
    this.saveToLocalStorage();
  }

  /** Patch hunter-brain tuning knobs (clamped), persist, and log. */
  public updateAgentConfig(patch: Partial<AgentConfig>) {
    const before = JSON.stringify(this.agentConfig);
    this.agentConfig = clampAgentConfig({ ...this.agentConfig, ...patch });
    if (JSON.stringify(this.agentConfig) === before) return;
    const c = this.agentConfig;
    this.addLog('upgrade', `Agent behavior tuned: retreat ${Math.round(c.retreatHpFrac * 100)}% HP · bravery ${c.dangerHits} hits · gray gap ${c.grayGap} · hunt drive ${Math.round(c.huntBaseline * 100)} · tavern mood ${c.tavernMood} · parties ${c.partiesEnabled ? 'ON' : 'OFF'}.`);
    this.saveToLocalStorage();
  }

  // --------------------------------------------------------------------------
  // FIELD PARTIES (runtime-only; dissolve on load, reform live)
  // --------------------------------------------------------------------------

  /** Live party of a hunter, or null when solo / dissolved. */
  public partyOf(hunter: Hunter): Party | null {
    if (!hunter.partyId) return null;
    const p = this.parties.get(hunter.partyId);
    if (!p) { hunter.partyId = null; return null; }
    return p;
  }

  /** Live members of a hunter's party (resolves ids, prunes dead/missing). */
  public partyMembers(hunter: Hunter): Hunter[] {
    const p = this.partyOf(hunter);
    if (!p) return [];
    const live = p.memberIds
      .map(id => this.hunters.find(h => h.id === id))
      .filter((h): h is Hunter => h !== undefined);
    p.memberIds = live.map(h => h.id);
    return live;
  }

  /** Count of live party members (1 when solo). Never counts the missing. */
  private livePartySize(hunter: Hunter): number {
    if (!hunter.partyId) return 1;
    const p = this.parties.get(hunter.partyId);
    if (!p) return 1;
    let n = 0;
    for (const id of p.memberIds) {
      if (this.hunters.some(h => h.id === id)) n++;
    }
    return Math.max(1, n);
  }

  /** True when this hunter currently leads their party. */
  public isPartyLeader(hunter: Hunter): boolean {
    const p = this.partyOf(hunter);
    return p !== null && p.leaderId === hunter.id;
  }

  /** Dissolve a party: every member goes solo. */
  public disbandParty(id: string) {
    const p = this.parties.get(id);
    if (!p) return;
    for (const mid of p.memberIds) {
      const m = this.hunters.find(h => h.id === mid);
      if (m && m.partyId === id) m.partyId = null;
    }
    this.parties.delete(id);
  }

  /**
   * Pull one hunter out of their party. Reassigns the lead to the
   * highest-level remaining member; disbands below 2. Called by the
   * knockdown path and every town entry (field-only parties).
   */
  public removeFromParty(hunter: Hunter) {
    const pid = hunter.partyId;
    if (!pid) return;
    hunter.partyId = null;
    const p = this.parties.get(pid);
    if (!p) return;
    p.memberIds = p.memberIds.filter(id => id !== hunter.id && this.hunters.some(h => h.id === id));
    if (p.memberIds.length < 2) {
      this.disbandParty(pid);
      return;
    }
    if (!p.memberIds.includes(p.leaderId)) {
      let best = this.hunters.find(h => h.id === p.memberIds[0]) ?? null;
      for (const id of p.memberIds) {
        const m = this.hunters.find(h => h.id === id);
        if (m && (!best || m.level > best.level)) best = m;
      }
      if (best) p.leaderId = best.id;
    }
  }

  /**
   * Crowding trigger: hunters-per-fair-monster in the hunter's zone above
   * 1.5 (counts HUNTING/FIGHTING hunters vs alive fair-for-them monsters).
   */
  private isCrowdedFor(hunter: Hunter): boolean {
    const z = this.zoneOf(hunter.gx, hunter.gy);
    if (z < 1) return false;
    let hunters = 0;
    for (const o of this.hunters) {
      if ((o.state === 'HUNTING' || o.state === 'FIGHTING') && this.zoneOf(o.gx, o.gy) === z) hunters++;
    }
    let fair = 0;
    for (const m of this.monsters) {
      if (m.hp > 0 && m.zone === z && !this.isTooHardFor(m, hunter)) fair++;
    }
    return fair > 0 && hunters / fair > 1.5;
  }

  /**
   * Ambition trigger: the best pref-zone prey is too hard solo (danger
   * recomputed WITHOUT the party bonus) but fair WITH a full party bonus.
   */
  private isAmbitiousFor(hunter: Hunter): boolean {
    const pref = this.preferredZone(hunter.level);
    let best: Monster | null = null;
    let bestDist = Infinity;
    for (const m of this.monsters) {
      if (m.hp <= 0 || m.zone !== pref) continue;
      const d = gridDistance(hunter.gx, hunter.gy, m.gx, m.gy);
      if (!best || m.level > best.level || (m.level === best.level && d < bestDist)) {
        best = m;
        bestDist = d;
      }
    }
    if (!best) return false;
    return this.isTooHardFor(best, hunter, 1) && !this.isTooHardFor(best, hunter, 5);
  }

  /**
   * Plaza LFP muster + matching pass. Motivated solo seekers (crowded or
   * ambitious, in HUNTING/FIGHTING/TRAVELING_TO_HUNT, cooldown expired, not
   * already at the plaza) are rerouted to the town plaza to wait as
   * LOOKING_FOR_PARTY (12s budget). The matching pass then groups plaza
   * seekers by preferredZone + level ±4 — filling existing parties <5 first,
   * then forming new greedy groups to 5 — and every matched hunter leaves
   * for the hunt immediately. Logs formations only.
   */
  public runPartyFormation() {
    if (!this.agentConfig.partiesEnabled) return;
    // 0. Reroute motivated solo field hunters to the plaza muster.
    // Motivation is snapshotted for all seekers BEFORE rerouting, so the
    // first departure can't un-crowd the zone for the rest of the pack.
    const seekers = this.hunters.filter(h =>
      h.partyId == null && (h.state === 'HUNTING' || h.state === 'FIGHTING' || h.state === 'TRAVELING_TO_HUNT'));
    const motivated = seekers.filter(h => (h.lfpCooldown ?? 0) <= 0 && (this.isCrowdedFor(h) || this.isAmbitiousFor(h)));
    for (const s of motivated) {
      if (gridDistance(s.gx, s.gy, 29, 29) < 1.5) continue; // already at plaza
      s.state = 'LOOKING_FOR_PARTY';
      s.targetMonsterId = null;
      s.targetBuildingId = null;
      s.targetGx = 29;
      s.targetGy = 29;
      s.stateTimer = 12; // LFP wait budget (sim-seconds)
      this.addFloatingText('🔍 Seeking party!', s.gx, s.gy, '#67e8f9', 11);
    }
    this.matchLfpSeekers();
  }

  /**
   * Match plaza LFP seekers into parties. Only seekers who have ARRIVED at
   * the muster (within 3 of the plaza) are matchable, so compatible seekers
   * visibly wait at the plaza (🔍) before forming; loners wait out their 12s
   * budget and march out solo. Existing parties <5 with a compatible leader
   * (same preferredZone, leader level ±4) are filled first; leftovers form
   * new greedy level-sorted groups (within ±4, to 5) per preferredZone.
   * Every matched hunter leaves for the hunt at once so no one idles at the
   * plaza after matching.
   */
  private matchLfpSeekers() {
    // Candidates: arrived plaza LFP waiters plus motivated solo field
    // hunters already standing at the plaza (routing skips them, but they
    // are physically at the muster and must never stick unmatched).
    const atPlaza = (h: Hunter) => gridDistance(h.gx, h.gy, 29, 29) <= 3;
    const lfp = this.hunters.filter(h => h.state === 'LOOKING_FOR_PARTY' && h.partyId == null && atPlaza(h));
    const atPlazaMotivated = this.hunters.filter(h =>
      h.partyId == null &&
      (h.state === 'HUNTING' || h.state === 'FIGHTING' || h.state === 'TRAVELING_TO_HUNT') &&
      atPlaza(h) &&
      (this.isCrowdedFor(h) || this.isAmbitiousFor(h)));
    const pool = [...lfp, ...atPlazaMotivated];
    if (pool.length === 0) return;
    const unplaced = new Set(pool.map(h => h.id));

    // 1. Fill existing parties first (same preferredZone, leader level ±4, cap 5).
    for (const p of this.parties.values()) {
      const live = p.memberIds
        .map(id => this.hunters.find(h => h.id === id))
        .filter((h): h is Hunter => h !== undefined);
      p.memberIds = live.map(h => h.id);
      if (live.length >= 5 || unplaced.size === 0) continue;
      const leader = live.find(h => h.id === p.leaderId) ?? live[0];
      if (!leader) continue;
      p.leaderId = leader.id;
      const lz = this.preferredZone(leader.level);
      for (const s of pool) {
        if (live.length >= 5) break;
        if (!unplaced.has(s.id)) continue;
        if (this.preferredZone(s.level) !== lz) continue;
        if (Math.abs(s.level - leader.level) > 4) continue;
        p.memberIds.push(s.id);
        s.partyId = p.id;
        live.push(s);
        unplaced.delete(s.id);
        this.leaveForHunt(s);
      }
    }

    // 2. Form new parties: group by preferredZone, greedy fill to 5 within ±4 levels.
    const byZone = new Map<number, Hunter[]>();
    for (const s of pool) {
      if (!unplaced.has(s.id)) continue;
      const z = this.preferredZone(s.level);
      const list = byZone.get(z);
      if (list) list.push(s);
      else byZone.set(z, [s]);
    }
    for (const list of byZone.values()) {
      list.sort((a, b) => a.level - b.level);
      let i = 0;
      while (i < list.length) {
        const group: Hunter[] = [list[i]];
        i++;
        while (group.length < 5 && i < list.length && list[i].level - group[0].level <= 4) {
          group.push(list[i]);
          i++;
        }
        if (group.length < 2) continue; // leftover singles wait out their timer
        const leader = group.reduce((a, b) => (b.level > a.level ? b : a));
        const ordered = [leader, ...group.filter(g => g.id !== leader.id)];
        const id = `party-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        this.parties.set(id, { id, leaderId: leader.id, memberIds: ordered.map(h => h.id), lootTurn: 0 });
        for (const m of ordered) m.partyId = id;
        const names = ordered.map(h => h.name.split(' ')[0]);
        this.addLog('combat', `${names.slice(0, 2).join(', ')} formed a party (${ordered.length})!`, leader.name);
        for (const m of ordered) this.leaveForHunt(m);
      }
    }
  }

  public summonHero(forcedClass?: CharacterClass): Hunter | null {
    // Town full: no more slots until Sanctuary Hall levels up
    if (this.hunters.length >= this.maxHunters()) {
      this.addFloatingText('🏠 Town full! Upgrade Sanctuary Hall for +2 slots', SUMMON_PORTAL_POS.gx, SUMMON_PORTAL_POS.gy, '#fca5a5', 12);
      return null;
    }
    const classes: CharacterClass[] = ['Berserker', 'Ranger', 'Sorcerer', 'Paladin', 'Cleric', 'Bard'];
    const charClass = forcedClass || classes[Math.floor(Math.random() * classes.length)];

    const base = baseStatsFor(charClass);

    const firstName = HUNTER_FIRST_NAMES[Math.floor(Math.random() * HUNTER_FIRST_NAMES.length)];
    const title = HUNTER_TITLES[Math.floor(Math.random() * HUNTER_TITLES.length)];
    const fullName = `${firstName} ${title}`;

    // Starting Skill
    const starterSkill = this.createClassSkill(charClass, 1);

    const hunter: Hunter = {
      id: `hunter-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: fullName,
      charClass,
      level: 1,
      exp: 0,
      expToNext: 50,
      hp: base.maxHp,
      maxHp: base.maxHp,
      atk: base.atk,
      def: base.def,
      critRate: base.critRate,
      speed: base.speed,
      gold: 50,
      state: 'SPAWNING',
      stateTimer: 2.0,
      gx: SUMMON_PORTAL_POS.gx + (Math.random() - 0.5) * 1.5,
      gy: SUMMON_PORTAL_POS.gy + (Math.random() - 0.5) * 1.5,
      targetGx: 29,
      targetGy: 28,
      facing: 'SE',
      // Target IDs
      targetMonsterId: null,
      targetBuildingId: null,
      // Field party (runtime-only; joins live via formation)
      partyId: null,
      // Plaza LFP muster cooldown (sim-seconds until re-queue allowed)
      lfpCooldown: 0,
      weapon: {
        id: `wpn-${charClass}`,
        name: base.weaponName,
        tier: 1,
        type: 'weapon',
        atkBonus: 5,
        defBonus: 0,
        hpBonus: 0,
        rarity: 'Common'
      },
      armor: {
        id: `arm-${charClass}`,
        name: base.armorName,
        tier: 1,
        type: 'armor',
        atkBonus: 0,
        defBonus: 3,
        hpBonus: 20,
        rarity: 'Common'
      },
      accessory: {
        id: 'acc-novice',
        name: base.accessoryName,
        tier: 1,
        type: 'accessory',
        atkBonus: 2,
        defBonus: 1,
        hpBonus: 10,
        rarity: 'Common'
      },
      inventory: [],
      maxInventorySlots: 12,
      skills: [starterSkill],
      mood: 100,
      moraleBoost: 0,
      moraleBoostTimer: 0,
      elixirs: 1,
      tonics: 0,
      tonicBoost: 0,
      tonicBoostTimer: 0,
      encoreBoost: 0,
      encoreTimer: 0,
      goldFeverTimer: 0,
      deaths: 0,
      // Paladin tank kit starts unshielded
      shieldHp: 0,
      shieldTimer: 0,
      animFrame: 0,
      animTick: 0,
      isAttacking: false,
      attackAnimTimer: 0,
      killCount: 0
    };

    this.hunters.push(hunter);
    this.totalSummonedHunters++;

    // Audio & Visual Fanfare
    soundFx.playSummon();
    this.addFloatingText(`✨ SUMMON: ${hunter.name}`, hunter.gx, hunter.gy, '#fde047', 14);
    this.addLog('summon', `Summon Portal called ${hunter.charClass} ${hunter.name} into town!`, hunter.name);

    return hunter;
  }

  private createClassSkill(charClass: CharacterClass, tier: number): Skill {
    if (charClass === 'Berserker') {
      return {
        id: `skill-berserk-${tier}`,
        name: tier === 1 ? 'Cleave Slash' : (tier === 2 ? 'Whirlwind' : 'Rage Berserk'),
        level: 1,
        maxLevel: 5,
        cooldownMs: 4000,
        lastUsedMs: 0,
        damageMultiplier: 1.8 + tier * 0.4,
        effectType: tier === 2 ? 'whirlwind' : 'slash',
        description: 'Strikes viciously in a wide arc dealing heavy physical damage.',
        exp: 0,
        expToNext: SKILL_EXP_TO_NEXT
      };
    } else if (charClass === 'Ranger') {
      return {
        id: `skill-ranger-${tier}`,
        name: tier === 1 ? 'Quick Shot' : (tier === 2 ? 'Rain of Arrows' : 'Piercing Comet'),
        level: 1,
        maxLevel: 5,
        cooldownMs: 3500,
        lastUsedMs: 0,
        damageMultiplier: 1.6 + tier * 0.35,
        effectType: 'multishot',
        description: 'Fires rapid enchanted arrows piercing monster defenses.',
        exp: 0,
        expToNext: SKILL_EXP_TO_NEXT
      };
    } else if (charClass === 'Sorcerer') {
      return {
        id: `skill-sorc-${tier}`,
        name: tier === 1 ? 'Arcane Bolt' : (tier === 2 ? 'Meteor Strike' : 'Solar Flare'),
        level: 1,
        maxLevel: 5,
        cooldownMs: 5000,
        lastUsedMs: 0,
        damageMultiplier: 2.2 + tier * 0.5,
        effectType: 'meteor',
        description: 'Summons a blazing arcane meteor blasting all surrounding beasts.',
        exp: 0,
        expToNext: SKILL_EXP_TO_NEXT
      };
    } else if (charClass === 'Paladin') {
      // Tank kit: T1 self-shield + damage, T2 big shield + AoE taunt + party
      // guard, T3 damage + shield refresh + AoE taunt. Longer CDs than DPS
      // classes so taunt uptime always leaves gaps (bosses stay honest).
      if (tier === 2) {
        return {
          id: `skill-pala-${tier}`,
          name: 'Radiant Aegis',
          level: 1,
          maxLevel: 5,
          cooldownMs: 6000,
          lastUsedMs: 0,
          damageMultiplier: 1.2,
          effectType: 'smite',
          description: 'Bulwark of light: big self-shield, taunts nearby beasts, guards the party.',
          exp: 0,
          expToNext: SKILL_EXP_TO_NEXT
        };
      } else if (tier === 3) {
        return {
          id: `skill-pala-${tier}`,
          name: 'Judgement Pillar',
          level: 1,
          maxLevel: 5,
          cooldownMs: 8000,
          lastUsedMs: 0,
          damageMultiplier: 1.7 + tier * 0.35,
          effectType: 'smite',
          description: 'Pillar of judgement: heavy damage, refreshes shield, taunts nearby beasts.',
          exp: 0,
          expToNext: SKILL_EXP_TO_NEXT
        };
      }
      return {
        id: `skill-pala-${tier}`,
        name: 'Holy Smite',
        level: 1,
        maxLevel: 5,
        cooldownMs: 4500,
        lastUsedMs: 0,
        damageMultiplier: 1.7 + tier * 0.35,
        effectType: 'smite',
        description: 'Divine wrath that damages the foe and raises a self-shield.',
        exp: 0,
        expToNext: SKILL_EXP_TO_NEXT
      };
    } else if (charClass === 'Bard') {
      return {
        id: `skill-bard-${tier}`,
        name: tier === 1 ? 'Dissonant Chord' : (tier === 2 ? 'Encore Anthem' : 'Golden Finale'),
        level: 1,
        maxLevel: 5,
        cooldownMs: tier === 2 ? 6000 : (tier === 3 ? 8000 : 4000),
        lastUsedMs: 0,
        damageMultiplier: tier === 2 ? 0 : (tier === 1 ? 1.4 + tier * 0.3 : 2.0 + tier * 0.4),
        effectType: tier === 1 ? 'ballad' : 'encore',
        description: tier === 1
          ? 'Strums a jarring chord dealing sonic damage.'
          : tier === 2
            ? 'Sings an anthem buffing nearby allies +20% ATK for 8s.'
            : 'Grand finale: sonic damage plus +10% gold fever for the party (15s).',
        exp: 0,
        expToNext: SKILL_EXP_TO_NEXT
      };
    } else {
      return {
        id: `skill-cleric-${tier}`,
        name: tier === 1 ? 'Mend Wounds' : (tier === 2 ? 'Soothing Radiance' : 'Renewing Dawn'),
        level: 1,
        maxLevel: 5,
        cooldownMs: 5000,
        lastUsedMs: 0,
        damageMultiplier: 2.0 + tier * 0.4,
        effectType: 'heal',
        description: 'Channels holy light to heal the most wounded nearby ally.',
        exp: 0,
        expToNext: SKILL_EXP_TO_NEXT
      };
    }
  }

  /** Retrain all hunters to Lv 1 trainee state (keeps identity, deaths, position). */
  public resetHunterStats() {
    for (const h of this.hunters) {
      const base = baseStatsFor(h.charClass);
      h.level = 1;
      h.exp = 0;
      h.expToNext = 50;
      h.maxHp = base.maxHp;
      h.atk = base.atk;
      h.def = base.def;
      h.critRate = base.critRate;
      h.speed = base.speed;
      h.hp = h.maxHp;
      h.gold = 50;
      h.mood = 100;
      h.moraleBoost = 0;
      h.moraleBoostTimer = 0;
      h.elixirs = Math.min(1, this.elixirCapacity());
      h.tonics = 0;
      h.tonicBoost = 0;
      h.tonicBoostTimer = 0;
      h.shieldHp = 0;
      h.shieldTimer = 0;
      h.encoreBoost = 0;
      h.encoreTimer = 0;
      h.goldFeverTimer = 0;
      h.inventory = [];
      h.skills = [this.createClassSkill(h.charClass, 1)];
      h.killCount = 0;
      h.weapon = {
        id: `wpn-${h.charClass}`,
        name: base.weaponName,
        tier: 1,
        type: 'weapon',
        atkBonus: 5,
        defBonus: 0,
        hpBonus: 0,
        rarity: 'Common'
      };
      h.armor = {
        id: `arm-${h.charClass}`,
        name: base.armorName,
        tier: 1,
        type: 'armor',
        atkBonus: 0,
        defBonus: 3,
        hpBonus: 20,
        rarity: 'Common'
      };
      h.accessory = {
        id: 'acc-novice',
        name: base.accessoryName,
        tier: 1,
        type: 'accessory',
        atkBonus: 2,
        defBonus: 1,
        hpBonus: 10,
        rarity: 'Common'
      };
      h.isAttacking = false;
      h.attackAnimTimer = 0;
      h.animFrame = 0;
      h.animTick = 0;
      h.stateTimer = 0;
      h.targetMonsterId = null;
      h.targetBuildingId = null;
      h.partyId = null; // retraining dissolves field parties (they reform live)
      h.lfpCooldown = 0; // fresh legs: eligible for the plaza muster at once
      this.marchOutToHunt(h);
    }
    for (const b of this.buildings) b.currentVisitors = [];
    this.pathCache.clear();
    this.addLog('summon', `World retraining complete: all hunters reset to Lv 1 with trainee gear.`);
    this.saveToLocalStorage();
  }

  // --------------------------------------------------------------------------
  // 2. MONSTER ECOSYSTEM SPAWN
  // --------------------------------------------------------------------------

  private spawnInitialMonsters() {
    // Zone 1: Whispering Forest (slimes, goblins, wolves) — pays bands 1-5
    for (let i = 0; i < 8; i++) {
      this.spawnMonster(1, Math.random() < 0.5 ? 'slime' : (Math.random() < 0.5 ? 'goblin' : 'wolf'));
    }
    // Zone 2: Gloomy Graveyard (skeletons, ghouls, wights) — pays bands 6-10
    for (let i = 0; i < 4; i++) {
      const r = Math.random();
      this.spawnMonster(2, r < 0.4 ? 'skeleton' : (r < 0.75 ? 'ghoul' : 'wight'));
    }
    for (let i = 0; i < 2; i++) {
      this.spawnMonster(2, 'wight');
    }
    // Zone 3: Volcanic Ruins (drakes, golems) — pays bands 11-15
    for (let i = 0; i < 3; i++) {
      this.spawnMonster(3, 'drake');
    }
    this.spawnMonster(3, 'golem');
  }

  public spawnMonster(zone: 1 | 2 | 3, type: Monster['type'], isBoss: boolean = false): Monster {
    let gx = 0;
    let gy = 0;

    if (zone === 1) {
      // Whispering Forest: gx 42..54, gy 22..36
      gx = 42 + Math.random() * 12;
      gy = 22 + Math.random() * 14;
    } else if (zone === 2) {
      // Gloomy Graveyard: gx 22..36, gy 42..54
      gx = 22 + Math.random() * 14;
      gy = 42 + Math.random() * 12;
    } else {
      // Volcanic Ruins: gx 42..56, gy 42..56
      gx = 42 + Math.random() * 14;
      gy = 42 + Math.random() * 14;
    }

    let name = 'Forest Slime';
    let level = 1;
    let hp = 45;
    let atk = 10;
    let def = 3;
    let expReward = 15;
    let goldReward = 8;
    let dropName = 'Slime Gel';
    let dropIcon: ItemDrop['iconType'] = 'magic_orb';

    if (type === 'slime') {
      name = 'Emerald Slime';
      level = 1;
      hp = 60;
      atk = 14;
      def = 3;
      expReward = 16;
      goldReward = 9;
      dropName = 'Slime Essence';
      dropIcon = 'magic_orb';
    } else if (type === 'goblin') {
      name = 'Goblin Scavenger';
      level = 3;
      hp = 95;
      atk = 22;
      def = 4;
      expReward = 25;
      goldReward = 16;
      dropName = 'Goblin Horn';
      dropIcon = 'horn';
    } else if (type === 'wolf') {
      name = 'Shadow Wolf';
      level = 5;
      hp = 144;
      atk = 33;
      def = 6;
      expReward = 38;
      goldReward = 23;
      dropName = 'Dire Wolf Pelt';
      dropIcon = 'pelt';
    } else if (type === 'skeleton') {
      name = 'Undead Skeleton';
      level = 6;
      hp = 190;
      atk = 38;
      def = 10;
      expReward = 50;
      goldReward = 31;
      dropName = 'Curse Bone';
      dropIcon = 'bone';
    } else if (type === 'ghoul') {
      name = 'Graveyard Ghoul';
      level = 8;
      hp = 258;
      atk = 47;
      def = 12;
      expReward = 73;
      goldReward = 45;
      dropName = 'Venom Fang';
      dropIcon = 'fang';
    } else if (type === 'wight') {
      name = 'Grave Wight';
      level = 9;
      hp = 300;
      atk = 55;
      def = 14;
      expReward = 90;
      goldReward = 55;
      dropName = 'Wight Shard';
      dropIcon = 'bone';
    } else if (type === 'drake') {
      name = 'Magma Drake';
      level = 12;
      hp = 477;
      atk = 78;
      def = 23;
      expReward = 150;
      goldReward = 107;
      dropName = 'Dragon Scale';
      dropIcon = 'dragon_scale';
    } else if (type === 'golem') {
      name = 'Magma Golem';
      level = 14;
      hp = 650;
      atk = 95;
      def = 28;
      expReward = 220;
      goldReward = 150;
      dropName = 'Magma Core';
      dropIcon = 'dragon_scale';
    } else if (type === 'boss_lich') {
      name = '☠ EVIL LICH LORD ☠';
      level = 15;
      hp = 1500;
      atk = 95;
      def = 28;
      expReward = 450;
      goldReward = 350;
      dropName = 'Dark Nether Orb';
      dropIcon = 'magic_orb';
      isBoss = true;
    }

    // World difficulty scaling (applies at spawn time)
    const diff = GameSimulation.difficultyMultipliers(this.difficulty);
    hp = Math.max(1, Math.round(hp * diff.hp));
    atk = Math.max(1, Math.round(atk * diff.atk));
    def = Math.max(0, Math.round(def * diff.def));
    expReward = Math.max(1, Math.round(expReward * diff.reward));
    goldReward = Math.max(1, Math.round(goldReward * diff.reward));

    // Auto-director scaling (compounds with difficulty, clamped 0.4x-3x).
    // Zone 1 (forest nursery) only feels half the swing so lowbies
    // always have something fair to cut their teeth on.
    const zoneDamp = zone === 1 ? 0.5 : 1;
    const dynHp = 1 + (this.dynamicHp - 1) * zoneDamp;
    const dynAtk = 1 + (this.dynamicAtk - 1) * zoneDamp;
    hp = Math.max(1, Math.round(hp * dynHp));
    atk = Math.max(1, Math.round(atk * dynAtk));

    const drops: ItemDrop[] = [
      {
        id: `drop-${Date.now()}-${Math.random()}`,
        name: dropName,
        count: isBoss ? 3 : 1,
        value: goldReward,
        iconType: dropIcon
      }
    ];

    const monster: Monster = {
      id: `mon-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      zone,
      type,
      level,
      hp,
      maxHp: hp,
      atk,
      def,
      expReward,
      goldReward,
      drops,
      gx,
      gy,
      targetGx: gx,
      targetGy: gy,
      facing: 'SE',
      state: 'IDLE',
      targetHunterId: null,
      attackCooldown: 1.5,
      roamPauseTimer: Math.random() * 2.5,
      tauntHunterId: null,
      tauntTimer: 0,
      isBoss,
      animFrame: 0,
      animTick: 0,
      attackAnimTimer: 0
    };

    this.monsters.push(monster);
    return monster;
  }

  // --------------------------------------------------------------------------
  // 3. MAIN SIMULATION TICK
  // --------------------------------------------------------------------------

  public update(dtSeconds: number) {
    if (this.isPaused) return;
    const effectiveDt = dtSeconds * this.speedMultiplier;
    this.simTime += effectiveDt;

    // 1. Auto Summon Countdown
    this.summonCountdown -= effectiveDt;
    if (this.summonCountdown <= 0) {
      this.summonCountdown = this.autoSummonInterval;
      this.summonHero();
    }

    // 2. Boss Spawn Countdown
    this.bossSpawnTimer -= effectiveDt;
    if (this.bossSpawnTimer <= 0 && !this.isBossActive) {
      this.bossSpawnTimer = 110;
      this.spawnBoss();
    }

    // 2b. Field parties: OFF dissolves everything live; ON runs a
    // matching pass every ~3 sim-seconds.
    if (!this.agentConfig.partiesEnabled) {
      if (this.parties.size > 0) {
        for (const id of [...this.parties.keys()]) this.disbandParty(id);
      }
      // No muster while parties are off: waiting seekers march straight out.
      for (const h of this.hunters) {
        if (h.state === 'LOOKING_FOR_PARTY') this.leaveForHunt(h);
      }
      this.partyTimer = 0;
    } else {
      this.partyTimer += effectiveDt;
      if (this.partyTimer >= 3) {
        this.partyTimer = 0;
        this.runPartyFormation();
      }
    }

    // 3. Update Hunters (AI & Autonomous Decision Making)
    for (let i = this.hunters.length - 1; i >= 0; i--) {
      this.updateHunterAI(this.hunters[i], effectiveDt);
    }

    // Hunter-hunter separation: minimal hard-contact de-overlap so dogpiles,
    // marching clumps, and door queues keep personal space. Hunters only
    // (not monsters), all states; only true overlaps (d < 0.25) are touched
    // and each pair is resolved exactly to 0.25 apart, split evenly, subject
    // to a per-tick cap so deep overlaps converge over a few ticks. No
    // velocity/drift is accumulated by construction, and the 0.25 radius
    // keeps hunters well within the 0.8 arrival radius of their targets.
    {
      const R = 0.25, CAP = 0.06;
      const hs = this.hunters;
      for (let i = 0; i < hs.length; i++) {
        for (let j = i + 1; j < hs.length; j++) {
          const a = hs[i], b = hs[j];
          const dx = b.gx - a.gx, dy = b.gy - a.gy;
          const d = Math.hypot(dx, dy);
          if (d >= R) continue;
          let nx: number, ny: number, dist: number;
          if (d < 1e-6) { nx = (a.id < b.id ? -1 : 1); ny = 0; dist = 0; }
          else { nx = dx / d; ny = dy / d; dist = d; }
          const push = Math.min((R - dist) / 2, CAP);
          a.gx -= nx * push; a.gy -= ny * push;
          b.gx += nx * push; b.gy += ny * push;
        }
      }
    }

    // 4. Update Monsters
    for (let m = this.monsters.length - 1; m >= 0; m--) {
      this.updateMonsterAI(this.monsters[m], effectiveDt);
    }

    // 5. Update Floating Text & Skill VFX
    this.updateVfx(effectiveDt);

    // 6. Monster Repopulation Check
    this.checkMonsterRepopulation();

    // 7. Auto-director heartbeat: lets the time-based eval (120s/10
    // outcomes) and the starvation drift (>180s/<10 outcomes) fire on
    // schedule even when combat outcomes dry up (e.g. roster farming
    // gray zone-1 prey that never feeds the director window).
    this.evaluateDirector();
  }

  private spawnBoss() {
    this.isBossActive = true;
    const boss = this.spawnMonster(3, 'boss_lich', true);
    soundFx.playSmite();
    this.addFloatingText('☠ EVIL LICH LORD HAS AWOKEN! ☠', boss.gx, boss.gy, '#ef4444', 18);
    this.addLog('boss', 'A massive sinister aura emerges: The Evil Lich Lord has spawned in the Volcanic Crater!');
  }

  // --------------------------------------------------------------------------
  // 4. HUNTER AUTONOMOUS AI ENGINE
  // --------------------------------------------------------------------------

  private updateHunterAI(hunter: Hunter, dt: number) {
    // Animation ticker
    hunter.animTick += dt;
    if (hunter.animTick > 0.15) {
      hunter.animTick = 0;
      hunter.animFrame = (hunter.animFrame + 1) % 4;
    }

    // Tavern morale buff ticks down in real time
    if (hunter.moraleBoostTimer > 0) {
      hunter.moraleBoostTimer -= dt;
      if (hunter.moraleBoostTimer <= 0) {
        hunter.moraleBoostTimer = 0;
        hunter.moraleBoost = 0;
      }
    }

    // Alchemy tonic buff ticks down alongside the morale buff
    if (hunter.tonicBoostTimer > 0) {
      hunter.tonicBoostTimer -= dt;
      if (hunter.tonicBoostTimer <= 0) {
        hunter.tonicBoostTimer = 0;
        hunter.tonicBoost = 0;
      }
    }

    // Bard Encore + Gold Fever buffs tick down in real time
    if (typeof hunter.encoreTimer !== 'number' || !Number.isFinite(hunter.encoreTimer)) hunter.encoreTimer = 0;
    if (typeof hunter.encoreBoost !== 'number' || !Number.isFinite(hunter.encoreBoost)) hunter.encoreBoost = 0;
    if (hunter.encoreTimer > 0) {
      hunter.encoreTimer -= dt;
      if (hunter.encoreTimer <= 0) {
        hunter.encoreTimer = 0;
        hunter.encoreBoost = 0;
      }
    }
    if (typeof hunter.goldFeverTimer !== 'number' || !Number.isFinite(hunter.goldFeverTimer)) hunter.goldFeverTimer = 0;
    if (hunter.goldFeverTimer > 0) hunter.goldFeverTimer -= dt;

    // Plaza LFP re-queue cooldown ticks down in real time
    if (typeof hunter.lfpCooldown !== 'number' || !Number.isFinite(hunter.lfpCooldown)) hunter.lfpCooldown = 0;
    if (hunter.lfpCooldown > 0) hunter.lfpCooldown -= dt;

    // Paladin absorb shield ticks down (transient tank kit)
    if (typeof hunter.shieldHp !== 'number' || !Number.isFinite(hunter.shieldHp)) hunter.shieldHp = 0;
    if (typeof hunter.shieldTimer !== 'number' || !Number.isFinite(hunter.shieldTimer)) hunter.shieldTimer = 0;
    if (hunter.shieldTimer > 0) {
      hunter.shieldTimer -= dt;
      if (hunter.shieldTimer <= 0) {
        hunter.shieldTimer = 0;
        hunter.shieldHp = 0;
      }
    } else if (hunter.shieldHp < 0) {
      hunter.shieldHp = 0;
    }

    // Field parties are field-only: any town state dissolves membership.
    if (hunter.partyId && (hunter.state === 'RETURNING_TO_TOWN' ||
        hunter.state === 'SELLING_LOOT' || hunter.state === 'UPGRADING_GEAR' ||
        hunter.state === 'LEARNING_SKILL' || hunter.state === 'BREWING_ELIXIR' ||
        hunter.state === 'RECOVERING_CLINIC' || hunter.state === 'RESTING_TAVERN' ||
        hunter.state === 'WANDERING_TOWN' || hunter.state === 'LOOKING_FOR_PARTY')) {
      this.removeFromParty(hunter);
    }

    // Party follow: non-leader members adopt the live leader's target.
    // Members run all own logic (movement/combat/HP-retreat/knockdown)
    // normally against it; pooled danger math covers fairness, and the
    // HP retreat + knockdown paths above/below still fire on their own.
    if (this.agentConfig.partiesEnabled && hunter.partyId) {
      const party = this.parties.get(hunter.partyId);
      if (party && party.leaderId !== hunter.id) {
        const leader = this.hunters.find(h => h.id === party.leaderId);
        if (leader && leader.targetMonsterId) {
          const prey = this.monsters.find(m => m.id === leader.targetMonsterId);
          if (prey && prey.hp > 0) {
            hunter.targetMonsterId = prey.id;
            hunter.targetGx = prey.gx;
            hunter.targetGy = prey.gy;
          }
        }
      }
    }

    if (hunter.isAttacking) {
      hunter.attackAnimTimer -= dt;
      if (hunter.attackAnimTimer <= 0) {
        hunter.isAttacking = false;
      }
    }

    // Hunter State Machine
    switch (hunter.state) {
      case 'SPAWNING': {
        hunter.stateTimer -= dt;
        if (hunter.stateTimer <= 0) {
          // New arrivals register at Sanctuary Hall before their first hunt
          const hall = this.buildings.find(b => b.type === 'TOWN_HALL');
          hunter.state = 'REGISTERING';
          hunter.targetGx = hall ? hall.doorGx : 29;
          hunter.targetGy = hall ? hall.doorGy : 28;
        }
        break;
      }

      case 'REGISTERING': {
        // Walk to the Sanctuary door, check in, then march out to hunt.
        // Proximity counts as arrival: hunter-hunter separation jitter can
        // hold a queue just outside moveTowards snap range (~0.04) while
        // still well within door range (0.8).
        const arrived = this.moveTowards(hunter, hunter.targetGx, hunter.targetGy, hunter.speed * 60 * dt)
          || gridDistance(hunter.gx, hunter.gy, hunter.targetGx, hunter.targetGy) < 0.8;
        if (arrived) {
          const hall = this.buildings.find(b => b.type === 'TOWN_HALL');
          if (hall) {
            this.recordStoreTransaction(hall, 12, 0);
            this.addFloatingText(`📋 ${hunter.name} registered!`, hunter.gx, hunter.gy - 0.5, '#fde047', 11);
          }
          this.leaveForHunt(hunter);
        }
        break;
      }

      case 'TRAVELING_TO_HUNT': {
        // Move towards the nearest town gate, then choose hunting field.
        // Proximity counts as arrival (see REGISTERING: separation jitter).
        const reachedGate = this.moveTowards(hunter, hunter.targetGx, hunter.targetGy, hunter.speed * 60 * dt)
          || gridDistance(hunter.gx, hunter.gy, hunter.targetGx, hunter.targetGy) < 0.8;
        if (reachedGate) {
          // Fair fight first, gear up second, desperate brawl last resort
          const fair = this.findBestMonsterForHunter(hunter);
          const desperate = fair ? null : this.findDesperateTarget(hunter);
          if (fair) {
            hunter.targetMonsterId = fair.id;
            hunter.state = 'HUNTING';
            hunter.targetGx = fair.gx;
            hunter.targetGy = fair.gy;
          } else if (this.onlyHardTargetsRemain(hunter) && this.canImproveInTown(hunter)) {
            // Field is suicide right now: head back to gear up
            this.addFloatingText('⚠️ Too dangerous — gearing up!', hunter.gx, hunter.gy, '#fca5a5', 11);
            this.returnToTownToSell(hunter);
          } else if (desperate) {
            // Nothing fair and town can't help: take the least-bad fight
            hunter.targetMonsterId = desperate.id;
            hunter.state = 'HUNTING';
            hunter.targetGx = desperate.gx;
            hunter.targetGy = desperate.gy;
          } else {
            // Wander in field
            hunter.targetGx = 44 + Math.random() * 8;
            hunter.targetGy = 28 + Math.random() * 8;
          }
        }
        break;
      }

      case 'HUNTING': {
        // Check health first - if critical, auto retreat to town clinic!
        // (Paladin tanks hold the line to 15% before bailing.)
        if (hunter.hp < this.effectiveMaxHp(hunter) * this.retreatHpFracFor(hunter)) {
          this.retreatToTown(hunter, 'low HP');
          break;
        }

        // Full bags first: sell before anything else so one town trip
        // covers every errand (repairs, drinks, brews, training)
        if (hunter.inventory.length >= hunter.maxInventorySlots) {
          this.returnToTownToSell(hunter);
          break;
        }

        // Outgrown zone: transit to town only when SETTLING for local prey —
        // never while marching through to better-zone prey. A hunter crossing
        // the forest en route to a volcano target keeps walking; only a hunter
        // whose target is local (or missing) bounces back via the plaza.
        const z = this.zoneOf(hunter.gx, hunter.gy);
        const pref = this.preferredZone(hunter.level);
        if (z >= 1 && pref > z) {
          const best = this.findBestMonsterForHunter(hunter);
          if (best && best.zone === pref) {
            const cur = hunter.targetMonsterId ? this.monsters.find(m => m.id === hunter.targetMonsterId) : undefined;
            if (!cur || cur.zone < pref) { this.returnToPlaza(hunter); break; }
            // else: already headed to the better zone — keep walking
          }
        }

        // Track target monster
        let monster: Monster | null | undefined = this.monsters.find(m => m.id === hunter.targetMonsterId);
        if (!monster || monster.hp <= 0) {
          // Find next monster
          monster = this.findBestMonsterForHunter(hunter);
          if (!monster) {
            // Everything left alive is too dangerous: gear up if possible,
            // otherwise take the least-bad fight instead of pacing forever
            if (this.onlyHardTargetsRemain(hunter) && this.canImproveInTown(hunter)) {
              this.addFloatingText('⚠️ Too dangerous — gearing up!', hunter.gx, hunter.gy, '#fca5a5', 11);
              this.returnToTownToSell(hunter);
              break;
            }
            monster = this.findDesperateTarget(hunter);
            if (!monster) {
              // Field truly empty: idle wander
              hunter.targetGx = 42 + Math.random() * 10;
              hunter.targetGy = 26 + Math.random() * 10;
              this.moveTowards(hunter, hunter.targetGx, hunter.targetGy, hunter.speed * 40 * dt);
              break;
            }
          }
          hunter.targetMonsterId = monster.id;
        }

        // Move towards monster
        const dist = gridDistance(hunter.gx, hunter.gy, monster.gx, monster.gy);
        const attackRange = (hunter.charClass === 'Ranger' || hunter.charClass === 'Sorcerer' || hunter.charClass === 'Cleric' || hunter.charClass === 'Bard') ? 2.8 : 1.2;

        if (dist <= attackRange) {
          hunter.state = 'FIGHTING';
        } else {
          this.moveTowards(hunter, monster.gx, monster.gy, hunter.speed * 60 * dt);
        }
        break;
      }

      case 'FIGHTING': {
        const monster = this.monsters.find(m => m.id === hunter.targetMonsterId);
        if (!monster || monster.hp <= 0) {
          hunter.targetMonsterId = null;
          // Post-kill utility routing: needs must outscore the hunt
          // (cfg.huntBaseline) to earn the interruption. Lab/forge/clinic never interrupt the
          // field (restock via town trips; clinic-critical is the HP<20%
          // hard retreat in HUNTING). Bags-full falls out of sell=1.0
          // naturally; sell always wins ties via the >= chain below.
          const s = this.scoreNeeds(hunter);
          // transit scored here: out-leveled + fair better-zone prey → 0.6
          let transitU = 0;
          const z = this.zoneOf(hunter.gx, hunter.gy);
          const pref = this.preferredZone(hunter.level);
          if (z >= 1 && pref > z) { const best = this.findBestMonsterForHunter(hunter); if (best && best.zone === pref) transitU = 0.6; }
          // Strict field routing: hunters hold the field until HP runs low
          // (HUNTING hard retreat), bags fill (sell=1.0), or they outgrow
          // the zone (transit=0.6). Low mood never interrupts the field —
          // it self-corrects via weaker combat → faster HP loss → clinic
          // retreat → town-hub tavern chain. Academy (≤0.45) always defers.
          // Wound-wall escape below: a bleeding hunter whose own zone is
          // structurally walled heals instead of parking on gray prey.
          // Ascending priority with >= so the later (higher-priority)
          // entry wins ties: transit < academy < sell; hunt is base.
          let best: 'sell' | 'academy' | 'transit' | 'hunt' = 'hunt';
          let bestU = this.agentConfig.huntBaseline;
          if (transitU >= bestU) { best = 'transit'; bestU = transitU; }
          if (s.academy >= bestU) { best = 'academy'; bestU = s.academy; }
          if (s.sell >= bestU) { best = 'sell'; bestU = s.sell; }
          if (best === 'sell') this.returnToTownToSell(hunter);
          else if (best === 'academy') this.returnToAcademy(hunter);
          else if (best === 'transit') this.returnToPlaza(hunter);
          else {
            // Wound-wall escape: the hunter's own zone just read as empty of
            // fair prey while they are bleeding (clinic knee 0.7, mirrors
            // scoreNeeds) AND the zone is structurally walled (alive count
            // at target — not a transient repop dip, which refills in ~a
            // tick) AND the fallback is a progression dead end (nothing
            // fair, or gray: diff ≥ gap pays no EXP). Such walls reopen
            // with a heal ~9 times in 10, so retreat to a real errand
            // instead of parking in the forest on gray prey. Healed hunters
            // re-enter through the town hub, which picks fair pref-zone
            // prey (no ping-pong: fires only on a walled zone, and
            // productive fair fallbacks still hold the field).
            const pref = this.preferredZone(hunter.level);
            const inPref = this.monsters.filter(m => m.zone === pref && m.hp > 0);
            const targets = this.populationTargets();
            const atTarget = inPref.length >= (pref === 1 ? targets.z1 : pref === 2 ? targets.z2 : targets.z3);
            const fairPref = inPref.filter(m => !this.isTooHardFor(m, hunter));
            if (fairPref.length === 0 && atTarget && hunter.hp < this.effectiveMaxHp(hunter) * 0.7) {
              const fallback = this.findBestMonsterForHunter(hunter);
              if (!fallback || (!fallback.isBoss && hunter.level - fallback.level >= this.agentConfig.grayGap)) {
                this.retreatToTown(hunter, 'wounds');
                break;
              }
            }
            hunter.state = 'HUNTING';
          }
          break;
        }

        // Face monster
        hunter.facing = monster.gx >= hunter.gx ? 'SE' : 'SW';

        // Gulp an alchemy elixir when badly hurt (instant lifesaver)
        if (hunter.hp < this.effectiveMaxHp(hunter) * 0.35 && hunter.elixirs > 0) {
          hunter.elixirs--;
          const heal = Math.round(this.effectiveMaxHp(hunter) * 0.35);
          hunter.hp = Math.min(this.effectiveMaxHp(hunter), hunter.hp + heal);
          soundFx.playCoin();
          this.addFloatingText(`🧪 Elixir! +${heal} HP`, hunter.gx, hunter.gy - 0.5, '#4ade80', 12);
        }

        // Swig a buff tonic at the start of a fight (+20% ATK for 60s)
        if (hunter.tonics > 0 && hunter.tonicBoostTimer <= 0) {
          hunter.tonics--;
          hunter.tonicBoost = 0.20;
          hunter.tonicBoostTimer = 60;
          this.addFloatingText(`🥤 Tonic! +20% ATK`, hunter.gx, hunter.gy - 0.5, '#fb923c', 12);
        }

        // Auto Attack & Skill Execution
        this.resolveHunterCombat(hunter, monster, dt);
        break;
      }

      case 'RETURNING_TO_TOWN': {
        // Move towards town gate first. Proximity counts as arrival (see
        // REGISTERING: separation jitter); targetGx/Gy is the building door
        // when building-targeted, so this matches the < 0.8 door check.
        const reached = this.moveTowards(hunter, hunter.targetGx, hunter.targetGy, hunter.speed * 60 * dt)
          || gridDistance(hunter.gx, hunter.gy, hunter.targetGx, hunter.targetGy) < 0.8;
        if (reached) {
          // Head to designated target building
          if (hunter.targetBuildingId) {
            const building = this.buildings.find(b => b.id === hunter.targetBuildingId);
            if (building) {
              hunter.targetGx = building.doorGx;
              hunter.targetGy = building.doorGy;
              // Once reached building door:
              if (gridDistance(hunter.gx, hunter.gy, building.doorGx, building.doorGy) < 0.8) {
                if (hunter.stateTimer > 0) { hunter.stateTimer -= dt; break; } // queue wait tick
                const occupants = building.currentVisitors.length;
                if (occupants >= this.buildingCapacity(building)) {
                  hunter.stateTimer = 1.5;
                  if (Math.random() < 0.3) this.addFloatingText(`⌛ Queued for ${building.name}`, hunter.gx, hunter.gy, '#cbd5e1', 11);
                  break;
                }
                if (building.type === 'BLACKSMITH') {
                  const canBuyWeapon = hunter.weapon.tier < 5 && hunter.gold >= hunter.weapon.tier * 80;
                  const canBuyArmor = hunter.weapon.tier >= 5 && hunter.armor.tier < 5 && hunter.gold >= hunter.armor.tier * 60;
                  if (!canBuyWeapon && !canBuyArmor) {
                    this.addFloatingText(`💸 Can't afford the forge`, hunter.gx, hunter.gy, '#fca5a5', 11);
                    hunter.targetBuildingId = null;
                    hunter.state = 'WANDERING_TOWN';
                    hunter.stateTimer = 2;
                    break;
                  }
                } else if (building.type === 'ALCHEMY_LAB') {
                    const elixirNeed = Math.max(0, this.elixirCapacity() - hunter.elixirs);
                    const elixirCostPer = 15 + building.level * 5;
                    const tonicNeed = Math.max(0, this.tonicCapacity() - hunter.tonics);
                    const tonicPrice = 20 + building.level * 5;
                    const canBuyElixir = elixirNeed > 0 && hunter.gold >= elixirCostPer;
                    const canBuyTonic = tonicNeed > 0 && hunter.gold >= tonicPrice;
                    if (!canBuyElixir && !canBuyTonic) {
                      this.addFloatingText(`💸 Can't afford elixirs`, hunter.gx, hunter.gy, '#fca5a5', 11);
                      hunter.targetBuildingId = null;
                      hunter.state = 'WANDERING_TOWN';
                      hunter.stateTimer = 2;
                      break;
                    }
                }
                this.executeBuildingVisit(hunter, building);
              }
            } else {
              hunter.state = 'WANDERING_TOWN';
            }
          } else {
            // Null-target arrival (plaza transit): fan out through the hub.
            this.evaluateTownNeeds(hunter);
          }
        }
        break;
      }

      case 'SELLING_LOOT':
      case 'UPGRADING_GEAR':
      case 'LEARNING_SKILL':
      case 'BREWING_ELIXIR':
      case 'RECOVERING_CLINIC':
      case 'RESTING_TAVERN': {
        // Progressive service: clinic HP and tavern mood climb visibly
        // during the visit; completion snaps to full.
        const svc = hunter.targetBuildingId ? this.buildings.find(x => x.id === hunter.targetBuildingId) ?? null : null;
        const st = svc ? Math.max(1, this.serviceTime(svc)) : 3;
        if (hunter.state === 'RECOVERING_CLINIC') {
          hunter.hp = Math.min(this.effectiveMaxHp(hunter), hunter.hp + this.effectiveMaxHp(hunter) * dt / st);
        }
        if (hunter.state === 'RESTING_TAVERN') {
          hunter.mood = Math.min(100, hunter.mood + 100 * dt / st);
        }
        // Timed interaction with store
        hunter.stateTimer -= dt;
        if (hunter.stateTimer <= 0) {
          this.finishStoreInteraction(hunter);
        }
        break;
      }

      case 'WANDERING_TOWN': {
        // Idle stroll in town plaza, then check the town errand hub:
        // turned-away strollers pick up other errands before marching out
        hunter.stateTimer -= dt;
        if (hunter.stateTimer <= 0) {
          this.evaluateTownNeeds(hunter);
        }
        break;
      }

      case 'LOOKING_FOR_PARTY': {
        // Plaza LFP muster: walk to/stay at the town plaza (29,29) while
        // the matching pass looks for a level-compatible group. No shop
        // targeting, no errand evaluation, no combat out here (monsters
        // never enter town, and monster AI only engages HUNTING/FIGHTING).
        // On the 12s wait budget expiring with no match, march out SOLO
        // and start the 90s re-queue cooldown so seekers can't spin.
        this.moveTowards(hunter, 29, 29, hunter.speed * 60 * dt);
        hunter.stateTimer -= dt;
        if (hunter.stateTimer <= 0) {
          hunter.lfpCooldown = 90;
          this.addFloatingText('🚶 No party found — hunting solo', hunter.gx, hunter.gy, '#94a3b8', 11);
          this.leaveForHunt(hunter);
        }
        break;
      }

      default: {
        // Safety net: no hunter may ever freeze in an unhandled state.
        // Send them back out to the hunting grounds.
        hunter.targetMonsterId = null;
        this.leaveForHunt(hunter);
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. COMBAT & SKILL ANIMATION
  // --------------------------------------------------------------------------

  /** Mood multiplier: miserable hunters fight at 75%, ecstatic ones at 125%. */
  public moodScale(hunter: Hunter): number {
    const mood = Math.max(0, Math.min(100, hunter.mood));
    return 0.75 + (mood / 100) * 0.5;
  }

  /** Effective attack after mood scaling and tavern morale + tonic + Encore buffs. */
  public effectiveAtk(hunter: Hunter): number {
    return (hunter.atk + hunter.weapon.atkBonus + hunter.accessory.atkBonus) * this.moodScale(hunter) * (1 + hunter.moraleBoost + hunter.tonicBoost + (hunter.encoreBoost ?? 0));
  }

  /** Effective defense after mood scaling + Paladin guard aura. */
  public effectiveDef(hunter: Hunter): number {
    const base = (hunter.def + hunter.armor.defBonus + hunter.accessory.defBonus) * this.moodScale(hunter);
    if (hunter.charClass === 'Paladin') return base;
    // Guard aura: a live Paladin within 4 tiles grants +25% DEF. Same-party
    // preferred (so the tank guards its own pack); falls back to any nearby
    // Paladin when parties are off or the hunter is solo.
    const party = this.agentConfig.partiesEnabled ? this.partyOf(hunter) : null;
    const partyIds = party ? new Set(this.partyMembers(hunter).map(m => m.id)) : null;
    for (const p of this.hunters) {
      if (p.charClass !== 'Paladin' || p.id === hunter.id || p.hp <= 0) continue;
      if (p.state !== 'HUNTING' && p.state !== 'FIGHTING') continue;
      if (partyIds && !partyIds.has(p.id)) continue;
      if (gridDistance(hunter.gx, hunter.gy, p.gx, p.gy) <= 4) return base * 1.25;
    }
    if (!partyIds) {
      for (const p of this.hunters) {
        if (p.charClass !== 'Paladin' || p.id === hunter.id || p.hp <= 0) continue;
        if (p.state !== 'HUNTING' && p.state !== 'FIGHTING') continue;
        if (gridDistance(hunter.gx, hunter.gy, p.gx, p.gy) <= 4) return base * 1.25;
      }
    }
    return base;
  }

  /** Real max HP: base (level growth) + armor + accessory bonuses. Stored maxHp stays base-only. */
  public effectiveMaxHp(hunter: Hunter): number {
    return hunter.maxHp + hunter.armor.hpBonus + hunter.accessory.hpBonus;
  }

  /** Epic effect value equipped (weapon or armor), else 0. */
  private equippedEffect(hunter: Hunter, effectId: EquipmentEffectId): number {
    for (const eq of [hunter.weapon, hunter.armor, hunter.accessory]) {
      if (eq && eq.effectId === effectId && typeof eq.effectValue === 'number' && Number.isFinite(eq.effectValue)) {
        return eq.effectValue;
      }
    }
    return 0;
  }

  /** Effective crit rate after Deadeye (Cometfang). */
  public effectiveCritRate(hunter: Hunter): number {
    return hunter.critRate + this.equippedEffect(hunter, 'deadeye');
  }

  /** Effective attack speed after Swiftwind (Windstalker). Movement uses base speed. */
  public effectiveSpeed(hunter: Hunter): number {
    return hunter.speed + this.equippedEffect(hunter, 'swiftwind');
  }

  /** Effective skill cooldown after Focus (Astral Veil). */
  public effectiveCooldownMs(hunter: Hunter, skill: Skill): number {
    const focus = this.equippedEffect(hunter, 'focus');
    return focus > 0 ? skill.cooldownMs * (1 - Math.min(0.5, focus)) : skill.cooldownMs;
  }

  /**
   * Danger assessment: true if the monster would mulch the hunter
   * (dead in under ~dangerHits hits, lower = braver) or vastly out-levels
   * them. Hunters refuse such fights and go gear up in town instead — if
   * they can afford to. Carried elixirs count toward survivability: each
   * one is +35% maxHp of potential in-combat healing, so an elixir-rich
   * hunter (e.g. a Lv.8 carrying brews) reads a crypt fight as fair where
   * a raw-HP test would pin them in the forest on gray prey forever.
   * Party pooling: with ≥1 other live party member the hunter side scales
   * by 1 + 0.25 per extra live member, applied to effective DEF and to
   * effective HP (hp + elixir bank) in the hits-to-die test. The +4
   * level-gap veto is unchanged, and combat damage itself stays individual.
   * Pass an explicit partySizeOverride for hypotheticals (1 = solo lens,
   * 5 = full-party lens); when parties are disabled the bonus never applies
   * unless an override is given.
   */
  public isTooHardFor(monster: Monster, hunter: Hunter, partySizeOverride?: number): boolean {
    if (monster.level > hunter.level + 4) return true;
    const size = partySizeOverride ?? (this.agentConfig.partiesEnabled ? this.livePartySize(hunter) : 1);
    const mult = 1 + 0.25 * Math.max(0, size - 1);
    const estHit = monster.atk - this.effectiveDef(hunter) * mult * 0.5;
    if (estHit <= 0) return false;
    // Tank lens: live shield counts as HP, and Paladins hold the line longer
    // (danger threshold -2 hits, floor 2) so the anchor doesn't bounce off
    // fights it is built to soak.
    const shield = typeof hunter.shieldHp === 'number' && Number.isFinite(hunter.shieldHp) ? Math.max(0, hunter.shieldHp) : 0;
    const effectiveHp = (hunter.hp + shield + 0.35 * this.effectiveMaxHp(hunter) * hunter.elixirs) * mult;
    const bravery = hunter.charClass === 'Paladin' ? Math.max(2, this.agentConfig.dangerHits - 2) : this.agentConfig.dangerHits;
    return effectiveHp / estHit < bravery;
  }

  /** HP fraction that triggers a clinic retreat — Paladins hold to 15%. */
  private retreatHpFracFor(hunter: Hunter): number {
    if (hunter.charClass === 'Paladin') return Math.min(this.agentConfig.retreatHpFrac, 0.15);
    return this.agentConfig.retreatHpFrac;
  }

  /** True when the hunter could actually improve in town (gear or training). */
  private canImproveInTown(hunter: Hunter): boolean {
    return this.canAffordForgeUpgrade(hunter) || hunter.skills.some(s => s.level < s.maxLevel && s.exp >= s.expToNext);
  }

  /**
   * Paladin tank effect on smite cast: raises an absorb shield and (T2/T3)
   * taunts nearby beasts onto the Paladin. Shield scales +5% maxHp per
   * skill rank above 1 so Academy promotions thicken the bulwark.
   * Taunt radius 6, duration 4s (Aegis) / 5s (Judgement) — always shorter
   * than the skill CD so bosses can't be perma-locked.
   */
  private applyPaladinTankEffect(hunter: Hunter, skill: Skill) {
    const tierMatch = /-(\d+)\s*$/.exec(typeof skill.id === 'string' ? skill.id : '');
    const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
    const rankBonus = 0.05 * Math.max(0, (skill.level ?? 1) - 1);
    const maxHp = this.effectiveMaxHp(hunter);
    let shieldFrac = 0.30;
    let shieldSecs = 6;
    let tauntSecs = 0;
    if (tier === 2) {
      shieldFrac = 0.60;
      shieldSecs = 8;
      tauntSecs = 4;
    } else if (tier >= 3) {
      shieldFrac = 0.45;
      shieldSecs = 7;
      tauntSecs = 5;
    }
    const shield = Math.round(maxHp * (shieldFrac + rankBonus));
    hunter.shieldHp = Math.max(hunter.shieldHp ?? 0, shield);
    hunter.shieldTimer = Math.max(hunter.shieldTimer ?? 0, shieldSecs);
    this.addFloatingText(`🛡️ Aegis +${shield}`, hunter.gx, hunter.gy - 0.5, '#93c5fd', 12);
    if (tauntSecs > 0) {
      let taunted = 0;
      for (const m of this.monsters) {
        if (m.hp <= 0) continue;
        if (gridDistance(hunter.gx, hunter.gy, m.gx, m.gy) > 6) continue;
        m.tauntHunterId = hunter.id;
        m.tauntTimer = tauntSecs;
        m.state = 'COMBAT';
        m.targetHunterId = hunter.id;
        taunted++;
      }
      if (taunted > 0) {
        this.addFloatingText(`😡 Taunt! (${taunted})`, hunter.gx, hunter.gy - 1.1, '#f87171', 12);
        this.addLog('combat', `${hunter.name} taunts ${taunted} beast${taunted > 1 ? 's' : ''} with ${skill.name}!`, hunter.name);
      }
    }
  }

  private resolveHunterCombat(hunter: Hunter, monster: Monster, dt: number) {
    hunter.stateTimer -= dt;
    if (hunter.stateTimer > 0) return;

    // Reset swing timer (Swiftwind speeds up attacks, not movement)
    hunter.stateTimer = 1.0 / (1 + this.effectiveSpeed(hunter) * 10);
    hunter.isAttacking = true;
    hunter.attackAnimTimer = 0.35;

    // Cleric heal AI: if a heal skill is ready and a hurt ally is near,
    // mend them INSTEAD of attacking this tick (no damage to the monster,
    // no EXP — support tax, transaction-free).
    if (hunter.charClass === 'Cleric') {
      const nowMs = Date.now();
      const healSkill = hunter.skills.find(s => s.effectType === 'heal' && nowMs - s.lastUsedMs >= s.cooldownMs) ?? null;
      if (healSkill) {
        const party = this.agentConfig.partiesEnabled ? this.partyOf(hunter) : null;
        const partyIds = party ? new Set(this.partyMembers(hunter).map(m => m.id)) : null;
        let target: Hunter | null = null;
        let targetFrac = 0.75;
        const consider = (h: Hunter) => {
          if (h.hp <= 0) return;
          if (gridDistance(hunter.gx, hunter.gy, h.gx, h.gy) > 5) return;
          const frac = h.hp / Math.max(1, this.effectiveMaxHp(h));
          if (frac >= 0.75) return;
          if (!target || frac < targetFrac) { target = h; targetFrac = frac; }
        };
        // Party members first, then anyone else in range (including self).
        if (partyIds) for (const h of this.hunters) { if (partyIds.has(h.id)) consider(h); }
        if (!target) for (const h of this.hunters) { if (partyIds && partyIds.has(h.id)) continue; consider(h); }
        if (target) {
          const t: Hunter = target;
          healSkill.lastUsedMs = nowMs;
          const heal = Math.round(t.maxHp * 0.25 + hunter.atk * 0.8);
          t.hp = Math.min(this.effectiveMaxHp(t), t.hp + heal);
          this.addFloatingText(`+${heal}`, t.gx, t.gy - 0.5, '#4ade80', 12);
          this.skillVfxs.push({
            id: `vfx-heal-${Date.now()}-${Math.random()}`,
            type: 'heal',
            startX: t.gx,
            startY: t.gy,
            targetX: t.gx,
            targetY: t.gy,
            duration: 0.6,
            elapsed: 0,
            color: '#4ade80'
          });
          soundFx.playHeal();
          return;
        }
      }
      // No hurt ally in range: fall through to the normal (weak) attack path.
    }

    // Bard Encore AI: if a pure-buff encore is ready and an ally nearby lacks
    // the Encore buff, sing INSTEAD of attacking this tick (support tax).
    if (hunter.charClass === 'Bard') {
      const nowMsBard = Date.now();
      const encoreSkill = hunter.skills.find(s => s.effectType === 'encore' && (s.damageMultiplier ?? 0) === 0 && nowMsBard - s.lastUsedMs >= this.effectiveCooldownMs(hunter, s)) ?? null;
      if (encoreSkill) {
        const party = this.agentConfig.partiesEnabled ? this.partyOf(hunter) : null;
        const partyIds = party ? new Set(this.partyMembers(hunter).map(m => m.id)) : null;
        let needsSong = false;
        const checkNeeds = (h: Hunter) => {
          if (h.hp <= 0) return;
          if (gridDistance(hunter.gx, hunter.gy, h.gx, h.gy) > 5) return;
          if ((h.encoreTimer ?? 0) <= 0.5) needsSong = true;
        };
        if (partyIds) for (const h of this.hunters) { if (partyIds.has(h.id)) checkNeeds(h); if (needsSong) break; }
        if (!needsSong) for (const h of this.hunters) { if (partyIds && partyIds.has(h.id)) continue; checkNeeds(h); if (needsSong) break; }
        // Solo Bard with expired buff still sings for self.
        if (!needsSong && (hunter.encoreTimer ?? 0) <= 0.5) needsSong = true;
        if (needsSong) {
          encoreSkill.lastUsedMs = nowMsBard;
          const buffAtk = 0.20;
          const buffDur = 8;
          for (const h of this.hunters) {
            if (h.hp <= 0) continue;
            if (gridDistance(hunter.gx, hunter.gy, h.gx, h.gy) > 5) continue;
            // One Encore per hunter: strongest wins, refresh duration.
            if ((h.encoreBoost ?? 0) < buffAtk) h.encoreBoost = buffAtk;
            h.encoreTimer = Math.max(h.encoreTimer ?? 0, buffDur);
          }
          // Usage-based mastery for the anthem (no gray gating for support).
          if (encoreSkill.level < encoreSkill.maxLevel) {
            const curExp = typeof encoreSkill.exp === 'number' && Number.isFinite(encoreSkill.exp) ? encoreSkill.exp : 0;
            const need = typeof encoreSkill.expToNext === 'number' && Number.isFinite(encoreSkill.expToNext) ? encoreSkill.expToNext : SKILL_EXP_TO_NEXT;
            const gain = 2 + encoreSkill.cooldownMs / 1000;
            encoreSkill.exp = Math.min(need, curExp + gain);
            if (encoreSkill.exp >= need) {
              this.addFloatingText(`✨ ${encoreSkill.name} READY!`, hunter.gx, hunter.gy - 1.1, '#facc15', 11);
            }
          }
          this.skillVfxs.push({
            id: `vfx-encore-${Date.now()}-${Math.random()}`,
            type: 'encore',
            startX: hunter.gx,
            startY: hunter.gy,
            targetX: hunter.gx,
            targetY: hunter.gy,
            duration: 0.6,
            elapsed: 0,
            color: '#2dd4bf'
          });
          soundFx.playLute();
          this.addFloatingText(`🎵 ${encoreSkill.name}!`, hunter.gx, hunter.gy - 0.5, '#2dd4bf', 11);
          return;
        }
      }
      // No unbuffed ally in range: fall through to ballad/finale damage path.
    }

    // Check available skills for auto-cast (round-robin: oldest ready first
    // so 2nd/3rd skills actually get casts instead of skills[0] hogging).
    // Focus (Astral Veil) shortens every cooldown.
    const now = Date.now();
    let readySkill: Skill | null = null;
    for (const s of hunter.skills) {
      if (now - s.lastUsedMs >= this.effectiveCooldownMs(hunter, s) && (!readySkill || s.lastUsedMs < readySkill.lastUsedMs)) {
        readySkill = s;
      }
    }

    const deadeye = this.equippedEffect(hunter, 'deadeye');
    let isCrit = Math.random() < this.effectiveCritRate(hunter);
    const baseDamage = this.effectiveAtk(hunter) - (monster.def * 0.4);
    let damage = baseDamage;

    if (readySkill) {
      // Cast animated skill!
      readySkill.lastUsedMs = now;
      damage = baseDamage * readySkill.damageMultiplier;
      // Meteorfall (Solar Cataclysm): +35% on the skill portion only.
      const meteorfall = this.equippedEffect(hunter, 'meteorfall');
      if (meteorfall > 0) damage = baseDamage + (damage - baseDamage) * (1 + meteorfall);
      // Crescendo (Fateweaver Lute): Encore-buffed hunters deal +25% skill
      // damage when a crescendo Bard plays within 6 cells.
      if ((hunter.encoreTimer ?? 0) > 0) {
        let crescendo = 0;
        for (const h of this.hunters) {
          if (h.hp <= 0 || h.charClass !== 'Bard') continue;
          if (gridDistance(h.gx, h.gy, hunter.gx, hunter.gy) > 6) continue;
          const v = this.equippedEffect(h, 'crescendo');
          if (v > crescendo) crescendo = v;
        }
        if (crescendo > 0) damage = baseDamage + (damage - baseDamage) * (1 + crescendo);
      }

      // Usage-based mastery: flat + CD bonus (longer CD = more EXP).
      // Gray prey teaches nothing (matches 0 hunter EXP on gray).
      const isGrayTarget = !monster.isBoss && (hunter.level - monster.level >= this.agentConfig.grayGap);
      if (!isGrayTarget && readySkill.level < readySkill.maxLevel) {
        const curExp = typeof readySkill.exp === 'number' && Number.isFinite(readySkill.exp) ? readySkill.exp : 0;
        const need = typeof readySkill.expToNext === 'number' && Number.isFinite(readySkill.expToNext) ? readySkill.expToNext : SKILL_EXP_TO_NEXT;
        const gain = 2 + readySkill.cooldownMs / 1000;
        readySkill.exp = Math.min(need, curExp + gain);
        if (readySkill.exp >= need) {
          this.addFloatingText(`✨ ${readySkill.name} READY!`, hunter.gx, hunter.gy - 1.1, '#facc15', 11);
        }
      }

      // Spawn skill VFX animation
      this.skillVfxs.push({
        id: `vfx-${Date.now()}-${Math.random()}`,
        type: readySkill.effectType,
        startX: hunter.gx,
        startY: hunter.gy,
        targetX: monster.gx,
        targetY: monster.gy,
        duration: 0.5,
        elapsed: 0,
        color: readySkill.effectType === 'meteor' ? '#ea580c' : (readySkill.effectType === 'smite' ? '#facc15' : (readySkill.effectType === 'ballad' || readySkill.effectType === 'encore') ? '#2dd4bf' : '#38bdf8')
      });

      // Play matching audio
      if (readySkill.effectType === 'meteor') soundFx.playMagic();
      else if (readySkill.effectType === 'smite') soundFx.playSmite();
      else if (readySkill.effectType === 'multishot') soundFx.playArrow();
      else if (readySkill.effectType === 'ballad' || readySkill.effectType === 'encore') soundFx.playLute();
      else soundFx.playSlash();

      this.addFloatingText(`⚡ ${readySkill.name}!`, hunter.gx, hunter.gy - 0.5, '#38bdf8', 11);

      // Paladin tank kit: every smite cast raises the absorb shield; Aegis /
      // Judgement also taunt nearby beasts onto the Paladin.
      if (hunter.charClass === 'Paladin' && readySkill.effectType === 'smite') {
        this.applyPaladinTankEffect(hunter, readySkill);
      }
      // Golden Finale: damaging encore also kindles Gold Fever (+10% gold, 15s)
      // on nearby allies (including the Bard).
      if (readySkill.effectType === 'encore' && (readySkill.damageMultiplier ?? 0) > 0) {
        for (const h of this.hunters) {
          if (h.hp <= 0) continue;
          if (gridDistance(hunter.gx, hunter.gy, h.gx, h.gy) > 5) continue;
          h.goldFeverTimer = Math.max(h.goldFeverTimer ?? 0, 15);
        }
        this.addFloatingText(`🎵 Gold Fever!`, hunter.gx, hunter.gy - 1.1, '#fbbf24', 11);
      }
    } else {
      // Standard attack
      if (hunter.charClass === 'Ranger') soundFx.playArrow();
      else if (hunter.charClass === 'Sorcerer') soundFx.playMagic();
      else if (hunter.charClass === 'Bard') soundFx.playLute();
      else soundFx.playSlash();
    }

    if (isCrit) {
      damage *= deadeye > 0 ? 2.1 : 1.75;
    }
    // Execution (Kingsbane): +60% vs targets below 30% HP. Bossbane: +50% vs boss.
    const execution = this.equippedEffect(hunter, 'execution');
    if (execution > 0 && monster.maxHp > 0 && monster.hp / monster.maxHp < 0.3) {
      damage *= (1 + execution);
    }
    const bossbane = this.equippedEffect(hunter, 'bossbane');
    if (bossbane > 0 && monster.isBoss) {
      damage *= (1 + bossbane);
    }
    damage = Math.max(5, Math.round(damage));

    // Deal damage to monster
    monster.hp -= damage;
    // Lifesteal (Bloodlord): heal a slice of damage dealt.
    const lifesteal = this.equippedEffect(hunter, 'lifesteal');
    if (lifesteal > 0 && damage > 0 && hunter.hp > 0) {
      hunter.hp = Math.min(this.effectiveMaxHp(hunter), hunter.hp + damage * lifesteal);
    }
    this.addFloatingText(
      isCrit ? `CRIT! -${damage}` : `-${damage}`,
      monster.gx,
      monster.gy,
      isCrit ? '#ef4444' : '#f8fafc',
      isCrit ? 15 : 12,
      isCrit
    );

    // Monster Defeat
    if (monster.hp <= 0) {
      this.handleMonsterDefeat(hunter, monster);
    }
  }

  // --------------------------------------------------------------------------
  // Rarity loot rolls (Normal x1.0 / Uncommon x1.15 / Rare x1.35 / Epic x1.6).
  // Bosses: 35% epic (smart loot 70% killer class). Normals: Uncommon 6%
  // (wolf+), Rare 1.5% (ghoul/drake). Gray kills: no gear roll.
  // --------------------------------------------------------------------------

  private zoneGearTier(zone: 1 | 2 | 3): number {
    return zone === 1 ? 2 : (zone === 2 ? 3 : 4);
  }

  private classWeaponNoun(charClass: CharacterClass): string {
    if (charClass === 'Berserker') return 'Cleaver';
    if (charClass === 'Ranger') return 'Bow';
    if (charClass === 'Sorcerer') return 'Staff';
    if (charClass === 'Bard') return 'Lute';
    return 'Gavel';
  }

  private classArmorNoun(charClass: CharacterClass): string {
    if (charClass === 'Berserker') return 'Plate';
    if (charClass === 'Ranger') return 'Garb';
    if (charClass === 'Sorcerer') return 'Robe';
    if (charClass === 'Bard') return 'Cloak';
    return 'Aegis';
  }

  private buildStatGear(tier: number, rarity: EquipmentRarity, slot: 'weapon' | 'armor', forClass: CharacterClass, monster: Monster): ItemDrop {
    const mult = RARITY_STAT_MULT[rarity] ?? 1;
    const noun = slot === 'weapon' ? this.classWeaponNoun(forClass) : this.classArmorNoun(forClass);
    const name = `${rarity} ${this.getEquipmentPrefix(tier)} ${forClass} ${noun}`;
    const equipment: Equipment = slot === 'weapon'
      ? {
          id: `eq-wpn-${forClass}-${tier}-${rarity}-${Date.now().toString(36)}`,
          name, tier, type: 'weapon',
          atkBonus: Math.round((5 + (tier - 1) * 8) * mult),
          defBonus: 0, hpBonus: 0, rarity,
        }
      : {
          id: `eq-arm-${forClass}-${tier}-${rarity}-${Date.now().toString(36)}`,
          name, tier, type: 'armor',
          atkBonus: 0,
          defBonus: Math.round((3 + (tier - 1) * 4) * mult),
          hpBonus: Math.round((20 + (tier - 1) * 15) * mult),
          rarity,
        };
    return {
      id: `drop-gear-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: equipment.name,
      count: 1,
      value: gearSellPrice(tier, rarity),
      iconType: monster.drops[0]?.iconType ?? 'bone',
      equipment,
    };
  }

  private buildEpicGear(def: EpicDef, monster: Monster): ItemDrop {
    const tier = 5;
    const equipment: Equipment = def.slot === 'weapon'
      ? {
          id: `eq-epic-${Date.now().toString(36)}`,
          name: def.name, tier, type: 'weapon',
          atkBonus: Math.round((5 + (tier - 1) * 8) * RARITY_STAT_MULT.Epic),
          defBonus: 0, hpBonus: 0, rarity: 'Epic',
          requiredClass: def.reqClass, effectId: def.effectId, effectValue: def.effectValue,
        }
      : {
          id: `eq-epic-${Date.now().toString(36)}`,
          name: def.name, tier, type: 'armor',
          atkBonus: 0,
          defBonus: Math.round((3 + (tier - 1) * 4) * RARITY_STAT_MULT.Epic),
          hpBonus: Math.round((20 + (tier - 1) * 15) * RARITY_STAT_MULT.Epic),
          rarity: 'Epic', effectId: def.effectId, effectValue: def.effectValue,
        };
    return {
      id: `drop-epic-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: equipment.name,
      count: 1,
      value: gearSellPrice(tier, 'Epic'),
      iconType: monster.drops[0]?.iconType ?? 'magic_orb',
      equipment,
    };
  }

  private rollEquipmentDrop(monster: Monster, killer: Hunter): ItemDrop | null {
    // Gray kills: materials/gold only, no gear.
    if (!monster.isBoss && killer.level - monster.level >= this.agentConfig.grayGap) return null;
    if (monster.isBoss) {
      if (Math.random() >= 0.35) return null;
      // Smart loot: 70% killer-class pool (its weapon + all armors), else any epic.
      const classPool = EPIC_DEFS.filter(d => !d.reqClass || d.reqClass === killer.charClass);
      const pool = Math.random() < 0.7 && classPool.length > 0 ? classPool : EPIC_DEFS;
      const def = pool[Math.floor(Math.random() * pool.length)];
      return this.buildEpicGear(def, monster);
    }
    // Normal monsters: slime/goblin stay materials-only.
    if (monster.type === 'slime' || monster.type === 'goblin') return null;
    const canRare = monster.type === 'ghoul' || monster.type === 'drake';
    let rarity: EquipmentRarity | null = null;
    if (canRare && Math.random() < 0.015) rarity = 'Rare';
    else if (Math.random() < 0.06) rarity = 'Uncommon';
    if (!rarity) return null;
    const slot = Math.random() < 0.6 ? 'weapon' : 'armor';
    return this.buildStatGear(this.zoneGearTier(monster.zone), rarity, slot, killer.charClass, monster);
  }

  private gearScore(eq: Equipment): number {
    return eq.type === 'weapon' ? eq.atkBonus : eq.defBonus + eq.hpBonus / 10;
  }

  private equippedGearFor(hunter: Hunter, slot: 'weapon' | 'armor'): Equipment {
    return slot === 'weapon' ? hunter.weapon : hunter.armor;
  }

  /** Auto-equip a gear drop if better + class-lock passes. Old piece vendors at half. Returns true when equipped (drop consumed). */
  private tryAutoEquipGear(hunter: Hunter, drop: ItemDrop): boolean {
    const eq = drop.equipment;
    if (!eq || (eq.type !== 'weapon' && eq.type !== 'armor')) return false;
    if (eq.requiredClass && eq.requiredClass !== hunter.charClass) return false;
    const slot = eq.type;
    const current = this.equippedGearFor(hunter, slot);
    if (this.gearScore(eq) <= this.gearScore(current)) return false;
    // Vendor the old piece at half its sell value (shop gear counts as Common).
    const oldValue = Math.floor(gearSellPrice(current.tier, current.rarity ?? 'Common') / 2);
    if (oldValue > 0) hunter.gold += oldValue;
    if (slot === 'weapon') hunter.weapon = { ...eq };
    else hunter.armor = { ...eq };
    hunter.hp = Math.min(this.effectiveMaxHp(hunter), hunter.hp + Math.max(0, eq.hpBonus - current.hpBonus));
    this.addFloatingText(`⚔️ ${hunter.name} equipped ${eq.name}!`, hunter.gx, hunter.gy - 0.5, rarityHex(eq.rarity), 12);
    this.addLog('upgrade', `${hunter.name} equipped ${eq.rarity} ${eq.name}${oldValue > 0 ? ` (+${oldValue}g trade-in)` : ''}.`, hunter.name);
    return true;
  }

  private handleMonsterDefeat(hunter: Hunter, monster: Monster) {    this.totalMonstersDefeated++;
    hunter.killCount++;
    // Nursery kills don't feed the auto-director: zone-1 spawns only feel
    // half the dynamic swing (zoneDamp 0.5), so counting ~98% forest kills
    // drives survival >80% → buffs to the 3x cap that zone 2/3 feel fully.
    // On-level crypt fights then read as mulch (e.g. Lv8 vs ghoul at 3.2
    // hits-to-die < 6) and isTooHardFor pins everyone in the forest.
    if (monster.zone !== 1) {
      this.windowKills++;
      this.evaluateDirector();
    }

    if (monster.isBoss) {
      this.isBossActive = false;
      this.bossSpawnTimer = 90;
      this.addFloatingText('🏆 BOSS SLAIN!', monster.gx, monster.gy, '#fbbf24', 18);
      this.addLog('boss', `${hunter.name} defeated the Evil Lich Lord! The realm is temporarily purified.`, hunter.name);
    }

    // Graduated spoils: overleveled hunters earn no EXP but keep gold/drops
    // so gray farming funds Academy promotions without leveling. Bosses always
    // pay full rewards regardless of gap.
    // With gray gap G: diff <= G-3: full exp/drops/gold. diff == G-2: 50%
    // exp (rounded). diff == G-1: 25% exp (rounded). diff >= G (non-boss):
    // NO EXP — 0 exp, full drops/gold + town tax. Kills still count and the
    // monster is still removed. (G=3 reproduces the classic curve exactly.)
    // Gray rules apply FIRST to the totals; party sharing below
    // only ever splits those computed totals.
    const levelDiff = hunter.level - monster.level;
    const G = this.agentConfig.grayGap;
    let expTotal: number;
    let goldTotal: number;
    let dropTotals: ItemDrop[];
    if (monster.isBoss || levelDiff <= G - 3) {
      expTotal = monster.expReward;
      goldTotal = monster.goldReward;
      dropTotals = monster.drops;
    } else if (levelDiff === G - 2 || levelDiff === G - 1) {
      expTotal = Math.round(monster.expReward * (levelDiff === G - 2 ? 0.5 : 0.25));
      goldTotal = monster.goldReward;
      dropTotals = monster.drops;
    } else {
      expTotal = 0;
      goldTotal = monster.goldReward;
      dropTotals = monster.drops;
      this.addFloatingText(`No EXP — prey too weak (+${goldTotal}g)`, hunter.gx, hunter.gy, '#6b7280', 11);
    }

    // Rarity gear roll (extra drop on top of guaranteed materials; gray = none).
    const gearDrop = this.rollEquipmentDrop(monster, hunter);
    if (gearDrop) {
      dropTotals = [...dropTotals, gearDrop];
      if (gearDrop.equipment?.rarity === 'Epic') {
        this.addFloatingText(`💜 EPIC DROP: ${gearDrop.name}!`, monster.gx, monster.gy - 0.5, rarityHex('Epic'), 14);
        this.addLog('boss', `${hunter.name} looted EPIC ${gearDrop.name} from ${monster.name}!`, hunter.name);
      }
    }

    // Bard Gold Fever: killer with an active Golden Finale aura earns +10% gold.
    if ((hunter.goldFeverTimer ?? 0) > 0) {
      goldTotal = Math.round(goldTotal * 1.1);
    }

    if (dropTotals.length > 0 || goldTotal > 0 || expTotal > 0) {
      // Recipients: live party members within 6 cells of the kill
      // (including the killer). Solo hunters — or parties with nobody else
      // in range — use today's solo rules: killer takes all, loot to killer.
      let recipients: Hunter[] = [];
      const party = this.agentConfig.partiesEnabled ? this.partyOf(hunter) : null;
      if (party) {
        recipients = this.partyMembers(hunter)
          .filter(m => gridDistance(m.gx, m.gy, monster.gx, monster.gy) <= 6);
      }
      if (recipients.length <= 1) {
        // Distribute Rewards
        hunter.gold += goldTotal;
        this.townGold += Math.round(goldTotal * this.townTaxRate()); // Town tax

        // Collect Loot Drop (gear auto-equips when better; else bagged to sell)
        dropTotals.forEach(drop => {
          if (drop.equipment) {
            if (!this.tryAutoEquipGear(hunter, drop)) hunter.inventory.push({ ...drop });
          } else {
            hunter.inventory.push({ ...drop });
          }
        });

        if (expTotal > 0) {
          const diminished = levelDiff > G - 3 && !monster.isBoss;
          this.addFloatingText(diminished ? `+${expTotal} EXP (diminished)` : `+${expTotal} EXP`, hunter.gx, hunter.gy, '#a855f7', 12);
          this.gainExp(hunter, expTotal);
        }
      } else {
        // Shared rewards: shares = n+1 where n = recipients; the killer
        // takes 2 shares, each other recipient 1 share, of BOTH exp (via
        // gainExp each — 0-exp stays 0) and gold. Town tax is computed on
        // the gold total exactly as solo (before splitting). Integer
        // shares floor the others and hand the remainder to the killer so
        // the distributed sum always equals the computed total.
        const n = recipients.length;
        // Party bonus pool: conjured extra spoils so sharing doesn't tax
        // members 33-83% vs solo. Conservative: +15% EXP / +10% gold per
        // head beyond the killer, applied to post-gray totals before the
        // share split (town tax computed on the post-bonus total, as solo).
        // 0-EXP (gray) stays 0 — the multiplier can't resurrect gray kills.
        expTotal = Math.round(expTotal * (1 + 0.15 * (n - 1)));
        goldTotal = Math.round(goldTotal * (1 + 0.10 * (n - 1)));
        const otherExp = Math.floor(expTotal / (n + 1));
        const killerExp = expTotal - otherExp * (n - 1);
        const otherGold = Math.floor(goldTotal / (n + 1));
        const killerGold = goldTotal - otherGold * (n - 1);
        this.townGold += Math.round(goldTotal * this.townTaxRate()); // Town tax
        for (const r of recipients) {
          const isKiller = r.id === hunter.id;
          r.gold += isKiller ? killerGold : otherGold;
          const share = isKiller ? killerExp : otherExp;
          if (share > 0) this.gainExp(r, share);
        }
        if (killerExp > 0) {
          this.addFloatingText(`+${killerExp} EXP (party of ${n})`, hunter.gx, hunter.gy, '#a855f7', 12);
        }

        // Loot rotation: party.lootTurn indexes memberIds; each drop goes
        // to the next rotation member (in memberIds order from lootTurn)
        // who is in range AND has bag room. lootTurn advances past every
        // considered member (assigned or skipped, each at most once per
        // item); when nobody qualifies the killer takes it (overflow
        // allowed) so every drop always lands in exactly one inventory.
        for (const drop of dropTotals) {
          let placed = false;
          const size = party!.memberIds.length;
          if (size > 0) {
            const start = ((party!.lootTurn % size) + size) % size;
            for (let k = 0; k < size; k++) {
              const idx = (start + k) % size;
              party!.lootTurn = idx + 1;
              const m = this.hunters.find(h => h.id === party!.memberIds[idx]);
              if (!m) continue;
              if (gridDistance(m.gx, m.gy, monster.gx, monster.gy) <= 6 &&
                  m.inventory.length < m.maxInventorySlots) {
                if (drop.equipment) {
                  if (!this.tryAutoEquipGear(m, drop)) m.inventory.push({ ...drop });
                } else {
                  m.inventory.push({ ...drop });
                }
                placed = true;
                break;
              }
            }
          }
          if (!placed) {
            if (drop.equipment) {
              if (!this.tryAutoEquipGear(hunter, drop)) hunter.inventory.push({ ...drop });
            } else {
              hunter.inventory.push({ ...drop });
            }
          }
        }
      }
    }

    // Remove monster
    const index = this.monsters.indexOf(monster);
    if (index > -1) {
      this.monsters.splice(index, 1);
    }
    this.pathCache.delete(monster.id);

    // Gray kills now pay gold/drops (no EXP) to fund Academy promotions,
    // so hunters are allowed to stay for gold farming. Uphill pull is handled
    // by the soft transit utility (transitU=0.6 when fair pref-zone prey
    // exists) instead of a forced retarget here.
  }

  // --------------------------------------------------------------------------
  // 6. EXP, LEVEL UP & AUTO SKILL UPGRADE
  // --------------------------------------------------------------------------

  private gainExp(hunter: Hunter, amount: number) {
    hunter.exp += amount;
    if (hunter.exp >= hunter.expToNext) {
      hunter.exp -= hunter.expToNext;
      hunter.level++;
      hunter.expToNext = Math.round(hunter.expToNext * 1.45);

      // Stat boosts on level up (Paladin tanks scale HP/DEF harder, ATK slower)
      if (hunter.charClass === 'Paladin') {
        hunter.maxHp += 30;
        hunter.hp = this.effectiveMaxHp(hunter);
        hunter.atk += 2;
        hunter.def += 3;
      } else {
        hunter.maxHp += 20;
        hunter.hp = this.effectiveMaxHp(hunter);
        hunter.atk += 4;
        hunter.def += 2;
      }

      soundFx.playLevelUp();
      this.addFloatingText(`⭐ LEVEL UP! [Lv.${hunter.level}]`, hunter.gx, hunter.gy - 0.8, '#facc15', 15);
      this.skillVfxs.push({
        id: `vfx-levelup-${Date.now()}-${Math.random()}`,
        type: 'levelup',
        startX: hunter.gx,
        startY: hunter.gy,
        targetX: hunter.gx,
        targetY: hunter.gy,
        duration: 0.9,
        elapsed: 0,
        color: '#facc15'
      });
      this.addLog('combat', `${hunter.name} advanced to Level ${hunter.level}!`, hunter.name);

      // Check if unlocked a new tier skill (every 3 levels)
      if (hunter.level % 3 === 0 && hunter.skills.length < 3) {
        const nextSkill = this.createClassSkill(hunter.charClass, hunter.skills.length + 1);
        hunter.skills.push(nextSkill);
        this.addLog('skill', `${hunter.name} unlocked new ultimate skill: ${nextSkill.name}!`, hunter.name);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 7. HERO AUTO-SELL TO NPC & STORE AUTO-UPGRADES
  // --------------------------------------------------------------------------

  /**
   * Route a hunter straight to a building's door. A* pathfinding threads
   * the nearest region gate automatically, so no Town Gate detour is needed
   * (hunters used to muster at the gate first — a pre-walls leftover).
   */
  private routeToBuilding(hunter: Hunter, building: Building) {
    this.removeFromParty(hunter); // field-only parties end at town entry
    hunter.state = 'RETURNING_TO_TOWN';
    hunter.targetBuildingId = building.id;
    hunter.targetGx = building.doorGx;
    hunter.targetGy = building.doorGy;
    hunter.stateTimer = 0;
  }

  /** Nearest town gate (East or South) to a grid position. */
  private nearestGate(gx: number, gy: number): { gx: number; gy: number } {
    const dEast = Math.hypot(gx - TOWN_GATE_POS.gx, gy - TOWN_GATE_POS.gy);
    const dSouth = Math.hypot(gx - SOUTH_GATE_POS.gx, gy - SOUTH_GATE_POS.gy);
    return dSouth < dEast ? { ...SOUTH_GATE_POS } : { ...TOWN_GATE_POS };
  }

  /**
   * Map region: 0 = town/transit (gx<=39 && gy<=39, gates included) plus
   * the reserved expansion lands (northwest bands: town/transit-exempt,
   * no zone-fit pressure, no transit targeting),
   * 1 = forest (gx>39,gy<39), 2 = crypt (gx<39,gy>39), 3 = volcano
   * (gx>39,gy>39). Region walls sit on row/col 39.
   */
  private zoneOf(gx: number, gy: number): 0 | 1 | 2 | 3 {
    if (reserveAt(Math.floor(gx), Math.floor(gy)) !== null) return 0;
    if (gx <= 39 && gy <= 39) return 0;
    if (gx > 39 && gy < 39) return 1;
    if (gx < 39 && gy > 39) return 2;
    return 3;
  }

  /** Level-appropriate hunting zone: Lv11+ volcano, Lv6+ crypt, else forest. */
  public preferredZone(level: number): 1 | 2 | 3 {
    if (level >= 11) return 3;
    if (level >= 6) return 2;
    return 1;
  }

  /**
   * Transit to the town plaza with no building target. The RETURNING
   * null-target arrival fans out through evaluateTownNeeds so one town
   * visit covers every errand.
   */
  private returnToPlaza(hunter: Hunter) {
    this.removeFromParty(hunter); // field-only parties end at town entry
    hunter.state = 'RETURNING_TO_TOWN';
    hunter.targetBuildingId = null;
    hunter.targetGx = 29;
    hunter.targetGy = 29;
    hunter.stateTimer = 0;
  }

  /** March out: stage at the NEAREST town gate, then pick prey from there. */
  private marchOutToHunt(hunter: Hunter) {
    const gate = this.nearestGate(hunter.gx, hunter.gy);
    hunter.state = 'TRAVELING_TO_HUNT';
    hunter.targetGx = gate.gx;
    hunter.targetGy = gate.gy;
  }

  /** Leave town for the hunt: head straight at known prey via A*; only
   *  stage at the nearest gate when the field is completely empty. */
  private leaveForHunt(hunter: Hunter) {
    const fair = this.findBestMonsterForHunter(hunter);
    if (fair) {
      hunter.targetMonsterId = fair.id;
      hunter.state = 'HUNTING';
      hunter.targetGx = fair.gx;
      hunter.targetGy = fair.gy;
      return;
    }
    const desperate = this.findDesperateTarget(hunter);
    if (desperate) {
      hunter.targetMonsterId = desperate.id;
      hunter.state = 'HUNTING';
      hunter.targetGx = desperate.gx;
      hunter.targetGy = desperate.gy;
      return;
    }
    this.marchOutToHunt(hunter);
  }

  public returnToTownToSell(hunter: Hunter) {
    const tradingPost = this.buildings.find(b => b.type === 'TRADING_POST');
    if (!tradingPost) return;
    this.routeToBuilding(hunter, tradingPost);
  }

  public returnToAcademy(hunter: Hunter) {
    const academy = this.buildings.find(b => b.type === 'TRAINING_ACADEMY');
    if (!academy) return;
    this.routeToBuilding(hunter, academy);
  }

  public returnToBlacksmith(hunter: Hunter) {
    const blacksmith = this.buildings.find(b => b.type === 'BLACKSMITH');
    if (!blacksmith) return;
    this.routeToBuilding(hunter, blacksmith);
  }

  public returnToTavern(hunter: Hunter) {
    const tavern = this.buildings.find(b => b.type === 'TAVERN');
    if (!tavern) return;
    this.routeToBuilding(hunter, tavern);
    this.addFloatingText('🍺 Heading to Tavern (low mood)', hunter.gx, hunter.gy, '#fdba74', 11);
  }

  public retreatToTown(hunter: Hunter, reason: string) {
    const clinic = this.buildings.find(b => b.type === 'CLINIC');
    if (!clinic) return;
    this.routeToBuilding(hunter, clinic);
    this.addFloatingText(`🏃 Fleeing to Clinic (${reason})`, hunter.gx, hunter.gy, '#fda4af', 11);
  }

  // When hunter arrives at a designated building
  private executeBuildingVisit(hunter: Hunter, building: Building) {
    if (!building.currentVisitors.includes(hunter.id)) building.currentVisitors.push(hunter.id);

    if (building.type === 'TRADING_POST') {
      hunter.state = 'SELLING_LOOT';
      hunter.stateTimer = this.serviceTime(building);
      this.addFloatingText('💰 Appraising loot…', building.doorGx, building.doorGy - 0.5, '#fde047', 13);
    } else if (building.type === 'BLACKSMITH') {
      hunter.state = 'UPGRADING_GEAR';
      hunter.stateTimer = this.serviceTime(building);
      this.addFloatingText('⚒️ Forging gear…', building.doorGx, building.doorGy - 0.5, '#38bdf8', 13);
    } else if (building.type === 'TRAINING_ACADEMY') {
      hunter.state = 'LEARNING_SKILL';
      hunter.stateTimer = this.serviceTime(building);
      this.addFloatingText('📜 Training at Valor Academy…', building.doorGx, building.doorGy - 0.5, '#a855f7', 13);
    } else if (building.type === 'ALCHEMY_LAB') {
      hunter.state = 'BREWING_ELIXIR';
      hunter.stateTimer = this.serviceTime(building);
      this.addFloatingText('🧪 Brewing elixirs…', building.doorGx, building.doorGy - 0.5, '#4ade80', 13);
    } else if (building.type === 'CLINIC') {
      hunter.state = 'RECOVERING_CLINIC';
      hunter.stateTimer = this.serviceTime(building);
      this.addFloatingText('💚 Admitted to Mercy Clinic…', building.doorGx, building.doorGy - 0.5, '#4ade80', 13);
    } else if (building.type === 'TAVERN') {
      hunter.state = 'RESTING_TAVERN';
      hunter.stateTimer = this.serviceTime(building);
      this.addFloatingText('🍺 Settling in at Boar & Barrel…', building.doorGx, building.doorGy - 0.5, '#fdba74', 13);
    }
  }

  /**
   * Utility-AI need scorer: every town errand (plus the hunt itself)
   * returns a utility in [0,1]. Callers interrupt hunting only when a
   * need outscores the hunt baseline (cfg.huntBaseline) — proportionate
   * needs beat hard-priority chains, so a lone skill point (≤0.45) never
   * yanks a healthy hunter off the field; it batches into the next real
   * town trip.
   * Shop availability mirrors the door/purchase gates exactly (need +
   * gold + town-materials affordability), so a nonzero lab/forge score is
   * always actionable: materials are consumed at completion, so without
   * stock on hand the hunter would burn a full service for nothing and
   * loop straight back.
   */
  private scoreNeeds(hunter: Hunter): {
    sell: number; tavern: number; lab: number; forge: number;
    academy: number; clinic: number; transit: number; hunt: number;
  } {
    const bagU = hunter.inventory.length / Math.max(1, hunter.maxInventorySlots);
    const hpU = hunter.hp / Math.max(1, this.effectiveMaxHp(hunter));
    const moodU = (hunter.mood ?? 100) / 100;
    // town-shop availability (mirror door/purchase gates exactly)
    const lab = this.buildings.find(b => b.type === 'ALCHEMY_LAB');
    const forge = this.buildings.find(b => b.type === 'BLACKSMITH');
    const elixirNeed = Math.max(0, this.elixirCapacity() - hunter.elixirs);
    const labOk = lab && elixirNeed > 0 && hunter.gold >= (15 + lab.level * 5) && this.totalMaterials() >= 1;
    const tonicNeed = Math.max(0, this.tonicCapacity() - hunter.tonics);
    const tonicOk = lab && tonicNeed > 0 && hunter.gold >= (20 + lab.level * 5) && this.totalMaterials() >= 1;
    const forgeOk = forge && this.totalMaterials() >= 2 && this.canAffordForgeUpgrade(hunter);
    const tavernFrac = this.agentConfig.tavernMood / 100;
    return {
      sell: hunter.inventory.length >= hunter.maxInventorySlots ? 1.0 : bagU * bagU * 0.4,
      tavern: moodU < tavernFrac ? (tavernFrac - moodU) / tavernFrac : 0,            // town: <tavernMood goes, lower = more urgent
      lab: (labOk || tonicOk) ? 0.2 + 0.6 * Math.max(elixirNeed / Math.max(1, this.elixirCapacity()), tonicNeed / Math.max(1, this.tonicCapacity())) : 0,
      forge: forgeOk ? 0.5 : 0,
      academy: hunter.skills.some(s => s.level < s.maxLevel && (typeof s.exp === 'number' ? s.exp : 0) >= (typeof s.expToNext === 'number' ? s.expToNext : SKILL_EXP_TO_NEXT)) ? 0.45 : 0,  // NEVER beats a healthy hunt alone
      clinic: hpU < 0.7 ? (0.7 - hpU) / 0.7 : 0,
      transit: 0,   // filled by caller (field only)
      hunt: this.agentConfig.huntBaseline,    // baseline: needs must earn the interruption
    };
  }

  /**
   * Town arrival hub: one town visit chains every errand before marching
   * back out. Max-utility routing over scoreNeeds (transit/hunt N/A in
   * town — instead, a max below 0.12 means nothing is worth doing, so
   * march out). Tie-break order (deterministic): sell > clinic > tavern
   * > academy > forge > lab. Scores are 0 when unactionable, so the
   * winner is always valid by construction.
   */
  private evaluateTownNeeds(hunter: Hunter) {
    const s = this.scoreNeeds(hunter);
    // Strict > keeps the earlier (higher-priority) entry on ties.
    let best: 'sell' | 'clinic' | 'tavern' | 'academy' | 'forge' | 'lab' = 'sell';
    let bestU = s.sell;
    if (s.clinic > bestU) { best = 'clinic'; bestU = s.clinic; }
    if (s.tavern > bestU) { best = 'tavern'; bestU = s.tavern; }
    if (s.academy > bestU) { best = 'academy'; bestU = s.academy; }
    if (s.forge > bestU) { best = 'forge'; bestU = s.forge; }
    if (s.lab > bestU) { best = 'lab'; bestU = s.lab; }
    // All done in town -> March out through the nearest gate!
    if (bestU < 0.12) {
      this.leaveForHunt(hunter);
      return;
    }
    switch (best) {
      case 'sell':
        this.returnToTownToSell(hunter);
        break;
      case 'clinic': {
        const clinic = this.buildings.find(b => b.type === 'CLINIC');
        if (clinic) {
          hunter.targetBuildingId = clinic.id;
          hunter.targetGx = clinic.doorGx;
          hunter.targetGy = clinic.doorGy;
          hunter.state = 'RETURNING_TO_TOWN';
        } else {
          this.leaveForHunt(hunter);
        }
        break;
      }
      case 'tavern':
        this.returnToTavern(hunter);
        break;
      case 'academy':
        this.returnToAcademy(hunter);
        break;
      case 'forge':
        this.returnToBlacksmith(hunter);
        break;
      case 'lab': {
        const lab = this.buildings.find(b => b.type === 'ALCHEMY_LAB');
        if (lab) {
          this.routeToBuilding(hunter, lab);
        } else {
          this.leaveForHunt(hunter);
        }
        break;
      }
    }
  }

  // Completing a building visit
  private finishStoreInteraction(hunter: Hunter) {    const completedState = hunter.state;
    let serviceBuilding: Building | null = null;
    if (hunter.targetBuildingId) {
      serviceBuilding = this.buildings.find(item => item.id === hunter.targetBuildingId) ?? null;
      if (serviceBuilding) {
        serviceBuilding.currentVisitors = serviceBuilding.currentVisitors.filter(id => id !== hunter.id);
      }
    }

    hunter.targetBuildingId = null;

    if (serviceBuilding) {
      switch (completedState) {
        case 'SELLING_LOOT': {
          if (serviceBuilding.type !== 'TRADING_POST') break;
          // 1. Hero Auto Sells Loot to NPC
          let totalSaleGold = 0;
          hunter.inventory.forEach(item => {
            totalSaleGold += item.value * item.count;
          });

          // Bonus price based on Trading Post level
          totalSaleGold = Math.round(totalSaleGold * (1 + serviceBuilding.level * 0.1));

          if (totalSaleGold > 0) {
            for (const item of hunter.inventory) {
              if (!item.equipment) this.materialStock[item.iconType] += item.count;
            }
            hunter.gold += totalSaleGold;
            hunter.inventory = [];
            soundFx.playCoin();

            this.addFloatingText(`💰 Sold Loot: +${totalSaleGold}g`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fde047', 13);
            this.addLog('trade', `${hunter.name} sold monster loot to ${serviceBuilding.name} for ${totalSaleGold} gold.`, hunter.name);

            // NPC Store EXP & Auto Upgrade!
            this.recordStoreTransaction(serviceBuilding, Math.max(15, Math.round(totalSaleGold * 0.2)), totalSaleGold);
          }
          break;
        }
        case 'UPGRADING_GEAR': {
          if (serviceBuilding.type !== 'BLACKSMITH') break;
          // 2. Timed forge service: the smith hammers one upgrade at
          // completion — weapon first, armor once the weapon is maxed.
          // Gold AND town materials are checked at completion (never at
          // the door), like tavern/clinic. No charity freebie.
          let forged = false;
          if (hunter.weapon.tier < 5) {
            const upgradeCost = hunter.weapon.tier * 80;
            if (hunter.gold >= upgradeCost && this.totalMaterials() >= 2) {
              hunter.gold -= upgradeCost;
              this.takeMaterials(2);
              hunter.weapon.tier += 1;
              // Rarity-aware reforge: loot keeps its multiplier + effect, only the base moves.
              const wMult = RARITY_STAT_MULT[hunter.weapon.rarity ?? 'Common'] ?? 1;
              hunter.weapon.atkBonus = Math.round((5 + (hunter.weapon.tier - 1) * 8) * wMult);
              if ((hunter.weapon.rarity ?? 'Common') === 'Common' || hunter.weapon.name.includes(' Weapon')) {
                hunter.weapon.name = `${this.getEquipmentPrefix(hunter.weapon.tier)} ${hunter.charClass} Weapon`;
              }

              soundFx.playSlash();
              this.addFloatingText(`🔨 Bought Tier ${hunter.weapon.tier} weapon`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#38bdf8', 14);
              this.addLog('upgrade', `${hunter.name} bought a Tier ${hunter.weapon.tier} weapon from the ${serviceBuilding.name}!`, hunter.name);

              this.recordStoreTransaction(serviceBuilding, 30, upgradeCost);
              forged = true;
            } else if (hunter.gold >= upgradeCost) {
              this.addFloatingText('⚒️ Forge needs 2 materials', serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fca5a5', 12);
            } else {
              this.addFloatingText('Not enough gold for the forge', serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fca5a5', 12);
            }
          } else if (hunter.armor.tier < 5) {
            const upgradeCost = hunter.armor.tier * 60;
            if (hunter.gold >= upgradeCost && this.totalMaterials() >= 2) {
              hunter.gold -= upgradeCost;
              this.takeMaterials(2);
              hunter.armor.tier += 1;
              const aMult = RARITY_STAT_MULT[hunter.armor.rarity ?? 'Common'] ?? 1;
              hunter.armor.defBonus = Math.round((3 + (hunter.armor.tier - 1) * 4) * aMult);
              hunter.armor.hpBonus = Math.round((20 + (hunter.armor.tier - 1) * 15) * aMult);
              if ((hunter.armor.rarity ?? 'Common') === 'Common' || hunter.armor.name.includes(' Armor')) {
                hunter.armor.name = `${this.getEquipmentPrefix(hunter.armor.tier)} ${hunter.charClass} Armor`;
              }

              soundFx.playSlash();
              this.addFloatingText(`🔨 Bought Tier ${hunter.armor.tier} armor`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#38bdf8', 14);
              this.addLog('upgrade', `${hunter.name} bought a Tier ${hunter.armor.tier} armor from the ${serviceBuilding.name}!`, hunter.name);

              this.recordStoreTransaction(serviceBuilding, 30, upgradeCost);
              forged = true;
            } else if (hunter.gold >= upgradeCost) {
              this.addFloatingText('⚒️ Forge needs 2 materials', serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fca5a5', 12);
            } else {
              this.addFloatingText('Not enough gold for the forge', serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fca5a5', 12);
            }
          }
          if (forged && this.totalMaterials() >= 2 && this.canAffordForgeUpgrade(hunter)) {
            // Commission breather: another upgrade is already affordable,
            // so the hub would send the hunter straight back through the
            // door with no observable gap between timed holds. Step out
            // for a moment instead — the next commission re-queues through
            // the door like any other visit.
            hunter.state = 'WANDERING_TOWN';
            hunter.stateTimer = 2.5;
            return;
          }
          break;
        }
        case 'LEARNING_SKILL': {
          if (serviceBuilding.type !== 'TRAINING_ACADEMY') break;
          // 3. Usage-based promotion: one READY skill (exp >= expToNext) gains
          // +1 rank per visit for gold (checked at completion, no freebie).
          // Lowest rank first so 2nd/3rd skills catch up instead of skills[0]
          // hogging. More READY skills re-queue via town hub (forge pattern).
          const ready = hunter.skills
            .filter(s => s.level < s.maxLevel && (typeof s.exp === 'number' ? s.exp : 0) >= (typeof s.expToNext === 'number' ? s.expToNext : SKILL_EXP_TO_NEXT))
            .sort((a, b) => a.level - b.level);
          if (ready.length === 0) break;
          const skill = ready[0];
          const cost = 40 + 25 * skill.level;
          if (hunter.gold < cost) {
            this.addFloatingText(`📜 Need ${cost}g for ${skill.name}`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fca5a5', 12);
            break;
          }
          hunter.gold -= cost;
          skill.level += 1;
          skill.damageMultiplier += 0.3;
          skill.exp = 0;

          soundFx.playLevelUp();
          this.addFloatingText(`📜 Skill Upgraded: ${skill.name} (Lv.${skill.level})`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#a855f7', 13);
          this.skillVfxs.push({
            id: `vfx-skillup-${Date.now()}-${Math.random()}`,
            type: 'levelup',
            startX: serviceBuilding.doorGx,
            startY: serviceBuilding.doorGy,
            targetX: serviceBuilding.doorGx,
            targetY: serviceBuilding.doorGy,
            duration: 0.9,
            elapsed: 0,
            color: '#a855f7'
          });
          this.addLog('skill', `${hunter.name} upgraded ${skill.name} to Lv.${skill.level} at the Academy for ${cost}g.`, hunter.name);

          this.recordStoreTransaction(serviceBuilding, 25, cost);

          const moreReady = hunter.skills.some(s => s.level < s.maxLevel && s.exp >= s.expToNext && hunter.gold >= 40 + 25 * s.level);
          if (moreReady) {
            // Commission breather: another promotion is already affordable,
            // so step out briefly and let the hub re-queue the next visit.
            hunter.state = 'WANDERING_TOWN';
            hunter.stateTimer = 2.5;
            return;
          }
          break;
        }
        case 'BREWING_ELIXIR': {
          if (serviceBuilding.type !== 'ALCHEMY_LAB') break;
          // 4. Timed brewing service: the cauldron fills elixirs first, then
          // tonics, at completion — as many as gold + town materials allow.
          // Materials are checked at completion (never at the door), like
          // tavern/clinic. Broke/empty just informs; no charity freebie.
          let brewedElixir = 0;
          let brewedTonic = 0;
          {
            const capacity = this.elixirCapacity();
            const costPer = 15 + serviceBuilding.level * 5;
            while (hunter.elixirs < capacity && hunter.gold >= costPer && this.totalMaterials() >= 1) {
              hunter.gold -= costPer;
              this.takeMaterials(1);
              hunter.elixirs += 1;
              brewedElixir += 1;
            }
            if (brewedElixir > 0) {
              soundFx.playCoin();
              this.addFloatingText(`🧪 Brewed ${brewedElixir} elixir${brewedElixir > 1 ? 's' : ''}`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#4ade80', 13);
              this.addLog('trade', `${hunter.name} brewed ${brewedElixir} elixir${brewedElixir > 1 ? 's' : ''} at ${serviceBuilding.name}.`, hunter.name);
              this.recordStoreTransaction(serviceBuilding, 24, brewedElixir * costPer);
            }
          }
          {
            const capacity = this.tonicCapacity();
            const price = 20 + serviceBuilding.level * 5;
            while (hunter.tonics < capacity && hunter.gold >= price && this.totalMaterials() >= 1) {
              hunter.gold -= price;
              this.takeMaterials(1);
              hunter.tonics += 1;
              brewedTonic += 1;
            }
            if (brewedTonic > 0) {
              soundFx.playCoin();
              this.addFloatingText(`🥤 Brewed ${brewedTonic} tonic${brewedTonic > 1 ? 's' : ''}`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fb923c', 13);
              this.addLog('trade', `${hunter.name} brewed ${brewedTonic} tonic${brewedTonic > 1 ? 's' : ''} at ${serviceBuilding.name}.`, hunter.name);
              this.recordStoreTransaction(serviceBuilding, 24, brewedTonic * price);
            }
          }
          if (brewedElixir === 0 && brewedTonic === 0) {
            this.addFloatingText('Not enough gold or materials for brews', serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fca5a5', 12);
          }
          break;
        }
        case 'RECOVERING_CLINIC': {
          if (serviceBuilding.type !== 'CLINIC') break;
          // 4. Hero Recovers HP (progressive ticks already climbed the bar)
          hunter.hp = this.effectiveMaxHp(hunter);
          this.addFloatingText('💚 Fully Healed', serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#4ade80', 13);
          this.recordStoreTransaction(serviceBuilding, 20, 25);
          break;
        }
        case 'RESTING_TAVERN': {
          if (serviceBuilding.type !== 'TAVERN') break;
          // 5. Hero Drinks Away the Pain: mood restored, morale ATK buff granted.
          // Higher tavern level = stronger drinks that kick in faster.
          const drinkPower = 0.10 + serviceBuilding.level * 0.02; // +10% ATK, +2% per level
          const drinkDuration = 45 + serviceBuilding.level * 15; // seconds
          const mealPrice = 12 + serviceBuilding.level * 4;

          hunter.mood = 100;
          hunter.moraleBoost = drinkPower;
          hunter.moraleBoostTimer = drinkDuration;
          hunter.hp = Math.min(this.effectiveMaxHp(hunter), hunter.hp + Math.round(this.effectiveMaxHp(hunter) * 0.25));

          if (hunter.gold >= mealPrice) hunter.gold -= mealPrice;

          soundFx.playCoin();
          this.addFloatingText(`🍺 Feasting! Mood restored, +${Math.round(drinkPower * 100)}% ATK`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fdba74', 13);
          this.addLog('trade', `${hunter.name} feasted at ${serviceBuilding.name}: mood restored with a +${Math.round(drinkPower * 100)}% morale ATK boost!`, hunter.name);
          this.recordStoreTransaction(serviceBuilding, 22, mealPrice);
          break;
        }
        default:
          break;
      }
    }

    // Chain next autonomous action through the town errand hub:
    // one town visit covers every errand before marching back out.
    this.evaluateTownNeeds(hunter);
  }

  // NPC Store EXP & AUTO UPGRADE LOGIC
  public recordStoreTransaction(building: Building, expAmount: number, goldValue: number) {
    building.totalTransactions++;
    building.lifetimeGold += goldValue;
    building.exp += expAmount;
    this.checkStoreUpgrade(building);

    // Governance cut: every town transaction funds Sanctuary Hall a little
    if (building.type !== 'TOWN_HALL') {
      const hall = this.buildings.find(b => b.type === 'TOWN_HALL');
      if (hall && hall.level < hall.maxLevel) {
        hall.totalTransactions++;
        hall.exp += Math.max(1, Math.round(expAmount * 0.25));
        this.checkStoreUpgrade(hall);
      }
    }
  }

  private checkStoreUpgrade(building: Building) {
    // Check Auto Upgrade!
    if (building.exp >= building.expToNext && building.level < building.maxLevel) {
      building.exp -= building.expToNext;
      building.level++;
      building.expToNext = Math.round(building.expToNext * 1.6);

      soundFx.playBuildingUpgrade();
      this.addFloatingText(`✨ ${building.name} UPGRADED! (Lv.${building.level})`, building.doorGx, building.doorGy - 1.2, '#facc15', 16);
      this.addLog('upgrade', `Autonomous Store Upgrade: ${building.name} reached Level ${building.level}! New tiers unlocked.`);
    }
  }

  private canUpgradeGear(hunter: Hunter): boolean {
    return hunter.weapon.tier < 5 || hunter.armor.tier < 5;
  }

  /** True when the hunter could actually buy a forge upgrade right now. */
  private canAffordForgeUpgrade(hunter: Hunter): boolean {
    if (hunter.weapon.tier < 5) return hunter.gold >= hunter.weapon.tier * 80;
    if (hunter.armor.tier < 5) return hunter.gold >= hunter.armor.tier * 60;
    return false;
  }

  private getEquipmentPrefix(tier: number): string {
    const prefixes = ['Bronze', 'Iron', 'Steel', 'Mithril', 'Dragonforged'];
    return prefixes[Math.min(tier - 1, prefixes.length - 1)];
  }

  // --------------------------------------------------------------------------
  // 8. MONSTER AI
  // --------------------------------------------------------------------------

  private updateMonsterAI(monster: Monster, dt: number) {
    // Tick-driven animation: IDLE breathes slow, PATROL bobs, COMBAT snaps.
    if (typeof monster.animTick !== 'number' || !Number.isFinite(monster.animTick)) monster.animTick = 0;
    if (typeof monster.animFrame !== 'number' || !Number.isFinite(monster.animFrame)) monster.animFrame = 0;
    if (typeof monster.attackAnimTimer !== 'number' || !Number.isFinite(monster.attackAnimTimer)) monster.attackAnimTimer = 0;
    if (monster.attackAnimTimer > 0) monster.attackAnimTimer -= dt;
    const animRate = monster.state === 'COMBAT' ? 0.15 : (monster.state === 'PATROL' ? 0.22 : 0.35);
    monster.animTick += dt;
    if (monster.animTick >= animRate) {
      monster.animTick = 0;
      monster.animFrame = (monster.animFrame + 1) % 2;
    }
    // Paladin taunt lock ticks down; validated below. Init guards for old saves.
    if (typeof monster.tauntTimer !== 'number' || !Number.isFinite(monster.tauntTimer)) monster.tauntTimer = 0;
    if (typeof monster.tauntHunterId !== 'string' && monster.tauntHunterId !== null) monster.tauntHunterId = null;
    if (monster.tauntTimer > 0) monster.tauntTimer -= dt;
    if (monster.tauntTimer <= 0) {
      monster.tauntTimer = 0;
      monster.tauntHunterId = null;
    }
    const taunter = monster.tauntHunterId
      ? this.hunters.find(h => h.id === monster.tauntHunterId && h.hp > 0 &&
          (h.state === 'HUNTING' || h.state === 'FIGHTING'))
      : undefined;
    if (!taunter) {
      monster.tauntHunterId = null;
      if (monster.tauntTimer < 0) monster.tauntTimer = 0;
    } else if (gridDistance(monster.gx, monster.gy, taunter.gx, taunter.gy) > 9 ||
        this.zoneOf(taunter.gx, taunter.gy) !== monster.zone &&
        this.zoneOf(monster.gx, monster.gy) === monster.zone) {
      // Taunter kited too far or out of the hunting grounds: break the lock.
      monster.tauntHunterId = null;
      monster.tauntTimer = 0;
    }
    // Taunted monsters stick to the Paladin and skip nearest-prey switching.
    if (monster.tauntHunterId && taunter) {
      monster.state = 'COMBAT';
      monster.targetHunterId = taunter.id;
    }
    // Check if attacked by hunter or hunter nearby
    if (monster.state === 'IDLE' || monster.state === 'PATROL') {
      // Find nearest hunter
      let nearestHunter: Hunter | null = null;
      let minDist = 4.5;

      for (const h of this.hunters) {
        if (h.state === 'HUNTING' || h.state === 'FIGHTING') {
          const d = gridDistance(monster.gx, monster.gy, h.gx, h.gy);
          if (d < minDist) {
            minDist = d;
            nearestHunter = h;
          }
        }
      }

      if (nearestHunter) {
        monster.state = 'COMBAT';
        monster.targetHunterId = nearestHunter.id;
      } else {
        // No prey nearby: roam slowly inside the home zone
        this.updateMonsterRoam(monster, dt);
      }
    } else if (monster.state === 'COMBAT') {
      // Zone leash (root fix): a monster that has been kited outside its
      // home zone disengages at once — monsters never leave their hunting
      // grounds. Next ticks IDLE finds no town prey (town hunters are
      // RETURNING/shopping) and roam targets home bounds via existing A*.
      if (this.zoneOf(monster.gx, monster.gy) !== monster.zone) {
        monster.state = 'IDLE';
        monster.targetHunterId = null;
        monster.tauntHunterId = null;
        monster.tauntTimer = 0;
        return;
      }
      const hunter = this.hunters.find(h => h.id === monster.targetHunterId);
      if (!hunter || hunter.hp <= 0 || hunter.state === 'RETURNING_TO_TOWN') {
        monster.state = 'IDLE';
        monster.targetHunterId = null;
        monster.tauntHunterId = null;
        monster.tauntTimer = 0;
        return;
      }

      const dist = gridDistance(monster.gx, monster.gy, hunter.gx, hunter.gy);
      // Leash: don't chase prey across the region walls back into town
      if (dist > 9) {
        monster.state = 'IDLE';
        monster.targetHunterId = null;
        monster.tauntHunterId = null;
        monster.tauntTimer = 0;
        return;
      }
      if (dist > 1.2) {
        // Move towards hunter
        this.moveTowardsMonster(monster, hunter.gx, hunter.gy, 0.02 * 60 * dt);
      } else {
        // Attack hunter
        monster.attackCooldown -= dt;
        if (monster.attackCooldown <= 0) {
          monster.attackCooldown = 1.8;
          monster.attackAnimTimer = 0.35;
          const dmg = Math.max(3, Math.round(monster.atk - this.effectiveDef(hunter) * 0.5));
          // Paladin absorb shield soaks damage first (tank kit). A raised
          // shield also steadies morale: mood damage halved while it holds.
          const hadShield = (hunter.shieldHp ?? 0) > 0;
          const absorbed = Math.min(hadShield ? hunter.shieldHp : 0, dmg);
          if (absorbed > 0) {
            hunter.shieldHp -= absorbed;
            this.addFloatingText(`🛡️ -${absorbed}`, hunter.gx, hunter.gy - 0.5, '#93c5fd', 11);
          }
          hunter.hp -= (dmg - absorbed);
          // Martyr (Aegis): reflect a slice back + halve the mood damage.
          const martyr = this.equippedEffect(hunter, 'martyr');
          if (martyr > 0 && monster.hp > 0) {
            monster.hp -= Math.max(1, Math.round(dmg * martyr));
          }
          // Getting mauled ruins the mood (which in turn scales combat stats).
          // A raised shield + Martyr each halve the blow to morale.
          const moodHit = (5 + Math.random() * 3) * (martyr > 0 ? 0.5 : 1) * (hadShield ? 0.5 : 1);
          hunter.mood = Math.max(0, hunter.mood - moodHit);
          this.addFloatingText(`-${dmg}`, hunter.gx, hunter.gy, '#f43f5e', 11);

          if (monster.hp <= 0) {
            this.handleMonsterDefeat(hunter, monster);
            return;
          }

          if (hunter.hp <= 0) {
            // Hunter knocked down: Emergency rescue to Clinic
            this.handleHunterDefeat(hunter, monster);
          }
        }
      }
    }
  }

  /** Idle wandering: pause, pick a nearby point in the home zone, stroll to it. */
  private updateMonsterRoam(monster: Monster, dt: number) {
    const bounds = ZONE_ROAM_BOUNDS[monster.zone];
    // Bosses lumber rather than skitter
    const roamSpeed = (monster.isBoss ? 0.008 : 0.018) * 60 * dt;

    if (monster.roamPauseTimer > 0) {
      monster.roamPauseTimer -= dt;
      monster.state = 'IDLE';
      if (monster.roamPauseTimer <= 0) {
        // Pick a new stroll destination near the current position
        monster.targetGx = Math.min(bounds.maxGx, Math.max(bounds.minGx, monster.gx + (Math.random() - 0.5) * 9));
        monster.targetGy = Math.min(bounds.maxGy, Math.max(bounds.minGy, monster.gy + (Math.random() - 0.5) * 9));
        monster.state = 'PATROL';
      }
      return;
    }

    monster.state = 'PATROL';
    const reached = this.moveTowardsMonster(monster, monster.targetGx, monster.targetGy, roamSpeed);
    if (reached) {
      // Graze a moment before wandering on
      monster.roamPauseTimer = 1.0 + Math.random() * 2.5;
      monster.state = 'IDLE';
    }
  }

  private handleHunterDefeat(hunter: Hunter, monster: Monster) {
    // Party rescue: a live party member within 6 cells (the share radius)
    // steadies the fallen hunter — survive in place at 30% maxHp instead of
    // a clinic warp, once per 90s per hunter. Stays in the party; deaths
    // still count so the auto-director stays honest. A second knockdown
    // inside the cooldown falls through to the normal clinic trip.
    // (30% lands just under the 35% elixir threshold, so a carried brew is
    // auto-drunk next tick — rescue plus elixir, not rescue instead of it.)
    const party = this.partyOf(hunter);
    if (party) {
      const last = this.lastPartyRescue.get(hunter.id) ?? -Infinity;
      if (this.simTime - last >= 90) {
        const savior = this.partyMembers(hunter).find(m =>
          m.id !== hunter.id && m.hp > 0 &&
          gridDistance(m.gx, m.gy, hunter.gx, hunter.gy) <= 6);
        if (savior) {
          this.lastPartyRescue.set(hunter.id, this.simTime);
          hunter.hp = Math.round(this.effectiveMaxHp(hunter) * 0.3);
          hunter.deaths++;
          this.totalHunterDeaths++;
          this.windowDeaths++;
          this.evaluateDirector();
          hunter.targetMonsterId = null;
          this.addFloatingText(`🛡️ ${savior.name.split(' ')[0]} SAVES ${hunter.name.split(' ')[0]}!`, hunter.gx, hunter.gy, '#86efac', 13);
          this.addLog('combat', `${savior.name} steadied ${hunter.name} in the field — no clinic trip!`, hunter.name);
          return;
        }
      }
    }
    hunter.hp = 1;
    hunter.deaths++;
    hunter.shieldHp = 0;
    hunter.shieldTimer = 0;
    // A downed tank drops all taunt locks so beasts re-acquire live prey.
    for (const m of this.monsters) {
      if (m.tauntHunterId === hunter.id) {
        m.tauntHunterId = null;
        m.tauntTimer = 0;
      }
    }
    this.totalHunterDeaths++;
    this.windowDeaths++;
    this.evaluateDirector();
    this.removeFromParty(hunter); // knockdown ends field membership
    this.addFloatingText(`💀 ${hunter.name} RESCUED!`, hunter.gx, hunter.gy, '#ef4444', 14);
    this.addLog('combat', `${hunter.name} was defeated by ${monster.name} and rushed to Mercy Clinic for resuscitation!`, hunter.name);

    // Warp directly to Clinic for recovery
    const clinic = this.buildings.find(b => b.type === 'CLINIC');
    if (clinic) {
      hunter.gx = clinic.doorGx;
      hunter.gy = clinic.doorGy;
      hunter.state = 'RECOVERING_CLINIC';
      hunter.stateTimer = 4.0;
      hunter.targetMonsterId = null;
      hunter.targetBuildingId = clinic.id;
      if (!clinic.currentVisitors.includes(hunter.id)) clinic.currentVisitors.push(hunter.id);
    }
    // Predator satisfaction: a monster that downs its prey loses interest
    // instead of spawn-camping the 1-HP victim.
    monster.targetHunterId = null;
    monster.state = 'IDLE';
    monster.attackCooldown = 1.5;
  }

  /** Zone repopulation targets derived from the total population setting. */
  public populationTargets(): { z1: number; z2: number; z3: number } {
    const total = Math.max(3, Math.min(40, Math.round(this.monsterPopulation)));
    const z1 = Math.max(1, Math.round((total * 6) / 14));
    const z2 = Math.max(1, Math.round((total * 5) / 14));
    return { z1, z2, z3: Math.max(1, total - z1 - z2) };
  }

  private checkMonsterRepopulation() {
    const target = this.populationTargets();
    const z1Count = this.monsters.filter(m => m.zone === 1).length;
    if (z1Count < target.z1) {
      this.spawnMonster(1, Math.random() < 0.5 ? 'slime' : (Math.random() < 0.5 ? 'goblin' : 'wolf'));
    }

    const z2Count = this.monsters.filter(m => m.zone === 2).length;
    if (z2Count < target.z2) {
      const r = Math.random();
      this.spawnMonster(2, r < 0.4 ? 'skeleton' : (r < 0.75 ? 'ghoul' : 'wight'));
    }

    const z3Count = this.monsters.filter(m => m.zone === 3 && !m.isBoss).length;
    if (z3Count < target.z3) {
      this.spawnMonster(3, Math.random() < 0.7 ? 'drake' : 'golem');
    }
  }

  /** Set monster population 3-40 (total concurrent target). */
  public setPopulation(total: number) {
    if (!Number.isFinite(total)) return;
    const t = Math.max(3, Math.min(40, Math.round(total)));
    if (this.monsterPopulation === t) return;
    this.monsterPopulation = t;
    const target = this.populationTargets();
    this.addLog('upgrade', `Monster population set to ${t} (forest ${target.z1} / crypt ${target.z2} / volcano ${target.z3}).`);
    this.saveToLocalStorage();
  }

  /**
   * Auto-director: every 30 combat outcomes (or every 2 sim-minutes with
   * at least 10), compare rolling survival against the 70-80% target band
   * and scale future spawns. Buffs and nerfs compound but clamp at 0.4x-3x
   * so the world stays sane. The time-based fallback keeps the director
   * responsive even when kills dry up (e.g. hunters hiding from brutes).
   * The starvation drift covers the window going fully quiet (e.g. the
   * whole roster farming gray zone-1 prey, which never feeds the window):
   * with no evaluable outcomes for over 3 sim-minutes, beast power eases
   * 15% toward 1.0 so stat-walled zones can thaw instead of stalemating.
   */
  private evaluateDirector() {
    if (!this.autoDirector || this.hunters.length === 0) return;
    const total = this.windowKills + this.windowDeaths;
    const timeBased = this.simTime - this.lastDirectorEval > 120 && total >= 10;
    if (total < 30 && !timeBased) {
      // Starvation drift: neither the 30-outcome nor the time-based eval
      // can run (window starved). Ease both dynamics 15% toward 1.0 so a
      // freeze at high beast power always has a path down.
      if (this.simTime - this.lastDirectorEval > 180 && total < 10) {
        const prevHp = this.dynamicHp;
        const prevAtk = this.dynamicAtk;
        this.dynamicHp = 1 + (this.dynamicHp - 1) * 0.85;
        this.dynamicAtk = 1 + (this.dynamicAtk - 1) * 0.85;
        this.lastDirectorEval = this.simTime;
        // Log only on a meaningful move: avoids spam once settled near 1.0.
        if (Math.abs(this.dynamicHp - prevHp) > 0.02 || Math.abs(this.dynamicAtk - prevAtk) > 0.02) {
          this.addLog('boss', 'The wilds grow complacent with no worthy prey: beasts ease.');
        }
      }
      return;
    }
    this.lastDirectorEval = this.simTime;
    const survival = this.windowKills / total;
    this.windowKills = 0;
    this.windowDeaths = 0;

    if (survival > 0.80) {
      this.dynamicHp = Math.min(3, this.dynamicHp * 1.12);
      this.dynamicAtk = Math.min(3, this.dynamicAtk * 1.12);
      this.addFloatingText('👹 The darkness grows stronger...', 48, 28, '#ef4444', 14);
      this.addLog('boss', `The wilds adapt to easy prey: beasts +12% HP/ATK (rolling survival ${(survival * 100).toFixed(0)}%).`);
    } else if (survival < 0.70) {
      this.dynamicHp = Math.max(0.4, this.dynamicHp * 0.89);
      this.dynamicAtk = Math.max(0.4, this.dynamicAtk * 0.89);
      this.addFloatingText('🌤️ The realm breathes easier...', 29, 29, '#4ade80', 14);
      this.addLog('boss', `The wilds relent: beasts −11% HP/ATK (rolling survival ${(survival * 100).toFixed(0)}%).`);
    }
  }

  /**
   * Count of live party members (incl. self; solo = self only) for whom a
   * kill on this monster would pay positive EXP: boss always pays, else
   * member levelDiff (member.level - monster.level) < grayGap. Diminished
   * (G-2/G-1) still counts as paying — only fully gray (diff >= G) does not.
   */
  private earningCountFor(monster: Monster, hunter: Hunter): number {
    const party = this.agentConfig.partiesEnabled ? this.partyOf(hunter) : null;
    const members = party ? this.partyMembers(hunter) : [hunter];
    const list = members.length > 0 ? members : [hunter];
    const G = this.agentConfig.grayGap;
    let n = 0;
    for (const m of list) {
      if (monster.isBoss || m.level - monster.level < G) n++;
    }
    return n;
  }

  private findBestMonsterForHunter(hunter: Hunter, ignoreClaims = false): Monster | null {
    // Pick the best level-matched monster in the level-appropriate zone
    // (bands: forest 1-5, crypt 6-10, volcano 11-15; Lv11+ volcano, Lv6+
    // graveyard, else forest); best match anywhere as fallback.
    // Party leveling goal: the score subtracts 2.5 per live party member
    // (incl. self) for whom the kill would pay positive EXP (levelDiff <
    // grayGap, bosses always pay), so the group converges on prey the whole
    // party earns from instead of gray-for-one picks. Solo hunters use the
    // same term with self only — this CHANGES solo picks on purpose: gray
    // prey no longer ties with paying prey at equal level-match+distance,
    // the hunter now prefers prey that pays them (the gray-trap escape and
    // uphill transit utilities still handle the reverse direction).
    let preferredZone: 1 | 2 | 3 = 1;
    if (hunter.level >= 11) preferredZone = 3;
    else if (hunter.level >= 6) preferredZone = 2;

    const nearestIn = (list: Monster[]): Monster | null => {
      let best: Monster | null = null;
      let bestScore = Infinity;
      for (const m of list) {
        const d = gridDistance(hunter.gx, hunter.gy, m.gx, m.gy);
        // Level-matched scoring: prefer similar-level prey over pure
        // proximity, then spread hunters across prey by penalizing
        // already-claimed monsters so a lone nearby monster with several
        // claimants loses to a slightly farther unclaimed one. The
        // unpenalized lens (ignoreClaims) skips this spread pressure.
        // EXP-alignment: -2.5 per live party member (incl. self) who earns
        // positive EXP from this kill pulls the party toward shared-pay prey.
        let claimants = 0;
        if (!ignoreClaims) {
          for (const h of this.hunters) {
            if (h.id !== hunter.id && h.targetMonsterId === m.id) claimants++;
          }
        }
        const score = (Math.abs(m.level - hunter.level) * 3 + d) * (1 + 0.6 * claimants) - 2.5 * this.earningCountFor(m, hunter);
        if (score < bestScore) {
          bestScore = score;
          best = m;
        }
      }
      return best;
    };

    const candidates = this.monsters.filter(m => m.zone === preferredZone && m.hp > 0);
    const fairInZone = candidates.filter(m => !this.isTooHardFor(m, hunter));
    if (fairInZone.length > 0) return nearestIn(fairInZone);

    // Fallback to the best-matched fair fight anywhere (refuse suicide runs)
    const anyFair = this.monsters.filter(m => m.hp > 0 && !this.isTooHardFor(m, hunter));
    return anyFair.length > 0 ? nearestIn(anyFair) : null;
  }

  /**
   * Desperation pick: the least-dangerous living monster (highest hits-
   * to-die). Used when no fair fight exists and town can't help — a bad
   * fight beats pacing forever, and losses feed the director + clinic loop.
   */
  private findDesperateTarget(hunter: Hunter): Monster | null {
    let best: Monster | null = null;
    let bestScore = -Infinity;
    for (const m of this.monsters) {
      if (m.hp <= 0) continue;
      const estHit = m.atk - this.effectiveDef(hunter) * 0.5;
      const hitsToDie = estHit <= 0 ? 999 : hunter.hp / estHit; // hits-to-die
      // Spread hunters across prey: discount already-claimed monsters so
      // desperate picks don't all pile onto the same least-bad fight.
      let claimants = 0;
      for (const h of this.hunters) {
        if (h.id !== hunter.id && h.targetMonsterId === m.id) claimants++;
      }
      const score = hitsToDie / (1 + 0.6 * claimants);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }

  /** True when living monsters exist but all would mulch this hunter. */
  private onlyHardTargetsRemain(hunter: Hunter): boolean {
    return this.monsters.some(m => m.hp > 0) && this.findBestMonsterForHunter(hunter) === null;
  }

  // --------------------------------------------------------------------------
  // 9. MOVEMENT & HELPERS
  // --------------------------------------------------------------------------

  // Pathfinding cache (runtime only, never saved): entity id -> route
  private pathCache = new Map<string, { path: PathPoint[]; index: number; tx: number; ty: number; timer: number }>();

  /**
   * Step an entity toward a goal, following an A* route through region
   * gates. Returns the normalized step direction. Falls back to straight
   * steering when no route exists so nothing can freeze on a wall.
   */
  private steeringStep(key: string, gx: number, gy: number, targetX: number, targetY: number): { dx: number; dy: number } {
    const goalCx = Math.round(targetX);
    const goalCy = Math.round(targetY);
    let entry = this.pathCache.get(key);
    // Repath budget ~2x/sec per entity (goal-cell changes repath
    // immediately; the timer covers slow-drifting moving targets).
    if (entry) entry.timer -= 1 / 60;
    if (!entry || entry.tx !== goalCx || entry.ty !== goalCy || entry.timer <= 0) {
      entry = { path: findPath(gx, gy, targetX, targetY), index: 0, tx: goalCx, ty: goalCy, timer: 0.5 };
      this.pathCache.set(key, entry);
    }
    // Skip waypoints already reached (goals drift while chasing/roaming)
    while (entry.index < entry.path.length) {
      const wp = entry.path[entry.index];
      if (Math.hypot(wp.x - gx, wp.y - gy) > 0.3) break;
      entry.index++;
    }
    let sx = targetX - gx;
    let sy = targetY - gy;
    if (entry.index < entry.path.length) {
      const wp = entry.path[entry.index];
      sx = wp.x - gx;
      sy = wp.y - gy;
    }
    const len = Math.hypot(sx, sy) || 1;
    return { dx: sx / len, dy: sy / len };
  }

  private moveTowards(hunter: Hunter, targetX: number, targetY: number, speed: number): boolean {
    const dx = targetX - hunter.gx;
    const dy = targetY - hunter.gy;
    const dist = Math.hypot(dx, dy);

    if (dist <= speed || dist < 0.1) {
      hunter.gx = targetX;
      hunter.gy = targetY;
      return true;
    }

    const step = this.steeringStep(hunter.id, hunter.gx, hunter.gy, targetX, targetY);
    hunter.facing = getIsometricFacing(hunter.gx, hunter.gy, hunter.gx + step.dx, hunter.gy + step.dy);
    hunter.gx += step.dx * speed;
    hunter.gy += step.dy * speed;
    return false;
  }

  private moveTowardsMonster(monster: Monster, targetX: number, targetY: number, speed: number): boolean {
    const dx = targetX - monster.gx;
    const dy = targetY - monster.gy;
    const dist = Math.hypot(dx, dy);

    if (dist <= speed || dist < 0.1) {
      monster.gx = targetX;
      monster.gy = targetY;
      return true;
    }

    const step = this.steeringStep(monster.id, monster.gx, monster.gy, targetX, targetY);
    monster.facing = step.dx >= 0 ? 'SE' : 'SW';
    monster.gx += step.dx * speed;
    monster.gy += step.dy * speed;
    return false;
  }

  private updateVfx(dt: number) {
    // Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.elapsed += dt;
      ft.y += ft.vy * dt;
      ft.opacity = Math.max(0, 1 - (ft.elapsed / ft.duration));

      if (ft.elapsed >= ft.duration) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Skill VFXs
    for (let v = this.skillVfxs.length - 1; v >= 0; v--) {
      const sv = this.skillVfxs[v];
      sv.elapsed += dt;
      if (sv.elapsed >= sv.duration) {
        this.skillVfxs.splice(v, 1);
      }
    }
  }

  public addFloatingText(text: string, gx: number, gy: number, color: string = '#f8fafc', fontSize: number = 12, isCrit: boolean = false) {
    this.floatingTexts.push({
      id: `ft-${Date.now()}-${Math.random()}`,
      text,
      x: gx,
      y: gy,
      color,
      fontSize,
      opacity: 1,
      duration: isCrit ? 1.5 : 1.1,
      elapsed: 0,
      vy: -0.8,
      isCrit
    });
  }

  public addLog(type: GameLog['type'], message: string, hunterName?: string) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.logs.unshift({
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: timeStr,
      type,
      message,
      hunterName
    });

    if (this.logs.length > 100) {
      this.logs.pop();
    }
  }

  // --------------------------------------------------------------------------
  // 10. SAVE PERSISTENCE (localStorage)
  // --------------------------------------------------------------------------

  private toSnapshot() {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      townGold: this.townGold,
      totalMonstersDefeated: this.totalMonstersDefeated,
      totalSummonedHunters: this.totalSummonedHunters,
      totalHunterDeaths: this.totalHunterDeaths,
      difficulty: this.difficulty,
      monsterPopulation: this.monsterPopulation,
      autoDirector: this.autoDirector,
      agentConfig: { ...this.agentConfig },
      dynamicHp: this.dynamicHp,
      dynamicAtk: this.dynamicAtk,
      summonCountdown: this.summonCountdown,
      autoSummonInterval: this.autoSummonInterval,
      speedMultiplier: this.speedMultiplier,
      isPaused: this.isPaused,
      bossSpawnTimer: this.bossSpawnTimer,
      isBossActive: this.isBossActive,
      materialStock: this.materialStock,
      hunters: this.hunters,
      monsters: this.monsters,
      buildings: this.buildings,
      logs: this.logs.slice(0, 100),
    };
  }

  /** Persist the current town state. Called on an interval + page hide. */
  public saveToLocalStorage() {
    try {
      if (!this.saveEnabled) return;
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.toSnapshot()));
    } catch {
      // Storage full / private mode — game continues without saving
    }
  }

  /** Remove any saved town state. */
  public static clearSave() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(SAVE_KEY);
        window.localStorage.removeItem(LEGACY_SAVE_KEY);
      }
    } catch {
      // ignore
    }
  }

  /** Rebuild a simulation from a saved snapshot. Returns null if none/invalid. */
  public static loadFromLocalStorage(): GameSimulation | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const raw = window.localStorage.getItem(SAVE_KEY) ?? window.localStorage.getItem(LEGACY_SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || (data.version !== 1 && data.version !== 2 && data.version !== SAVE_VERSION)) return null;
      // Pre-shift (v1) saves store 0-39 coords: shift every persisted
      // coordinate +20/+20 on load. V2 saves load unshifted.
      const needsShift = data.version === 1;

      const sim = new GameSimulation(true);
      const num = (v: unknown, fallback: number) =>
        typeof v === 'number' && Number.isFinite(v) ? v : fallback;

      sim.townGold = num(data.townGold, 250);
      sim.totalMonstersDefeated = Math.max(0, Math.floor(num(data.totalMonstersDefeated, 0)));
      sim.totalSummonedHunters = Math.max(0, Math.floor(num(data.totalSummonedHunters, 0)));
      sim.totalHunterDeaths = Math.max(0, Math.floor(num(data.totalHunterDeaths, 0)));
      // Numeric settings with legacy preset migration (easy→2, normal→5,
      // hard→10; sparse→8, normal→14, swarming→28)
      if (typeof data.difficulty === 'number' && Number.isFinite(data.difficulty)) {
        sim.difficulty = Math.max(1, Math.min(10, Math.round(data.difficulty)));
      } else if (data.difficulty === 'easy') {
        sim.difficulty = 2;
      } else if (data.difficulty === 'hard') {
        sim.difficulty = 10;
      } else {
        sim.difficulty = 5;
      }
      if (typeof data.monsterPopulation === 'number' && Number.isFinite(data.monsterPopulation)) {
        sim.monsterPopulation = Math.max(3, Math.min(40, Math.round(data.monsterPopulation)));
      } else if (data.monsterDensity === 'sparse') {
        sim.monsterPopulation = 8;
      } else if (data.monsterDensity === 'swarming') {
        sim.monsterPopulation = 28;
      } else {
        sim.monsterPopulation = 14;
      }
      sim.autoDirector = data.autoDirector !== false;
      // Hunter-brain knobs: old saves without them get defaults; stored
      // values are re-clamped so foreign/hand-edited saves can't break AI.
      sim.agentConfig = clampAgentConfig({ ...DEFAULT_AGENT_CONFIG, ...(data.agentConfig ?? {}) });
      sim.dynamicHp = num(data.dynamicHp, 1);
      sim.dynamicAtk = num(data.dynamicAtk, 1);
      sim.summonCountdown = num(data.summonCountdown, sim.autoSummonInterval);
      sim.autoSummonInterval = num(data.autoSummonInterval, 30);
      sim.speedMultiplier = [1, 2, 4].includes(data.speedMultiplier) ? data.speedMultiplier : 1;
      sim.isPaused = data.isPaused === true;
      sim.bossSpawnTimer = num(data.bossSpawnTimer, 90);
      sim.isBossActive = data.isBossActive === true;

      // Town material stock (old saves without it migrate to zeros)
      sim.materialStock = GameSimulation.emptyStock();
      if (data.materialStock && typeof data.materialStock === 'object') {
        for (const k of Object.keys(sim.materialStock) as MaterialType[]) {
          const v = (data.materialStock as Record<string, unknown>)[k];
          sim.materialStock[k] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
        }
      }

      sim.hunters = Array.isArray(data.hunters) ? data.hunters : [];
      sim.buildings = Array.isArray(data.buildings) && data.buildings.length > 0
        ? data.buildings
        : JSON.parse(JSON.stringify(INITIAL_BUILDINGS));
      sim.logs = Array.isArray(data.logs) ? data.logs.slice(0, 100) : [];

      // V1→V2 grid migration: town relocated +20/+20, so every persisted
      // coordinate follows. Ids/logs/stocks/levels untouched.
      if (needsShift) {
        for (const h of sim.hunters) {
          if (typeof h.gx === 'number' && Number.isFinite(h.gx)) h.gx += SAVE_SHIFT;
          if (typeof h.gy === 'number' && Number.isFinite(h.gy)) h.gy += SAVE_SHIFT;
          if (typeof h.targetGx === 'number' && Number.isFinite(h.targetGx)) h.targetGx += SAVE_SHIFT;
          if (typeof h.targetGy === 'number' && Number.isFinite(h.targetGy)) h.targetGy += SAVE_SHIFT;
        }
        for (const b of sim.buildings) {
          if (typeof b.gx === 'number' && Number.isFinite(b.gx)) b.gx += SAVE_SHIFT;
          if (typeof b.gy === 'number' && Number.isFinite(b.gy)) b.gy += SAVE_SHIFT;
          if (typeof b.doorGx === 'number' && Number.isFinite(b.doorGx)) b.doorGx += SAVE_SHIFT;
          if (typeof b.doorGy === 'number' && Number.isFinite(b.doorGy)) b.doorGy += SAVE_SHIFT;
        }
        // Transient VFX aren't in fresh snapshots but may exist in
        // hand-crafted saves — shift them too when present.
        if (Array.isArray((data as { floatingTexts?: unknown }).floatingTexts)) {
          sim.floatingTexts = (data as { floatingTexts: FloatingText[] }).floatingTexts;
          for (const ft of sim.floatingTexts) {
            if (typeof ft.x === 'number' && Number.isFinite(ft.x)) ft.x += SAVE_SHIFT;
            if (typeof ft.y === 'number' && Number.isFinite(ft.y)) ft.y += SAVE_SHIFT;
          }
        }
        if (Array.isArray((data as { skillVfxs?: unknown }).skillVfxs)) {
          sim.skillVfxs = (data as { skillVfxs: SkillVFX[] }).skillVfxs;
          for (const sv of sim.skillVfxs) {
            if (typeof sv.startX === 'number' && Number.isFinite(sv.startX)) sv.startX += SAVE_SHIFT;
            if (typeof sv.startY === 'number' && Number.isFinite(sv.startY)) sv.startY += SAVE_SHIFT;
            if (typeof sv.targetX === 'number' && Number.isFinite(sv.targetX)) sv.targetX += SAVE_SHIFT;
            if (typeof sv.targetY === 'number' && Number.isFinite(sv.targetY)) sv.targetY += SAVE_SHIFT;
          }
        }
      }

      // Rescue pre-fix saves whose auto-director ran away to the 4x cap on
      // nursery kills (now excluded from the window): clamp stale values
      // above 2.0 so zone 2/3 stop reading as perma-too-hard. Placed after
      // the log restore so the recalibration notice isn't wiped. num()
      // above already sanitized non-finite inputs.
      if (sim.dynamicHp > 2 || sim.dynamicAtk > 2) {
        sim.dynamicHp = Math.min(sim.dynamicHp, 2);
        sim.dynamicAtk = Math.min(sim.dynamicAtk, 2);
        sim.addLog('boss', 'The wilds recalibrate: stale beast power from an old season fades (capped at ×2.0).');
      }

      // Restore monsters, migrating older saves and clamping roamers home
      sim.monsters = Array.isArray(data.monsters) ? data.monsters : [];
      if (needsShift) {
        for (const m of sim.monsters) {
          if (typeof m.gx === 'number' && Number.isFinite(m.gx)) m.gx += SAVE_SHIFT;
          if (typeof m.gy === 'number' && Number.isFinite(m.gy)) m.gy += SAVE_SHIFT;
          if (typeof m.targetGx === 'number' && Number.isFinite(m.targetGx)) m.targetGx += SAVE_SHIFT;
          if (typeof m.targetGy === 'number' && Number.isFinite(m.targetGy)) m.targetGy += SAVE_SHIFT;
        }
      }
      for (const m of sim.monsters) {
        if (typeof m.roamPauseTimer !== 'number' || !Number.isFinite(m.roamPauseTimer)) {
          m.roamPauseTimer = Math.random() * 2;
        }
        if (typeof m.animFrame !== 'number' || !Number.isFinite(m.animFrame)) m.animFrame = 0;
        if (typeof m.animTick !== 'number' || !Number.isFinite(m.animTick)) m.animTick = 0;
        if (typeof m.attackAnimTimer !== 'number' || !Number.isFinite(m.attackAnimTimer)) m.attackAnimTimer = 0;
        // Paladin tank kit is runtime-only: old saves load untaunted.
        m.tauntHunterId = null;
        m.tauntTimer = 0;
        const bounds = ZONE_ROAM_BOUNDS[m.zone as 1 | 2 | 3];
        if (bounds) {
          m.gx = Math.min(bounds.maxGx, Math.max(bounds.minGx, num(m.gx, bounds.minGx)));
          m.gy = Math.min(bounds.maxGy, Math.max(bounds.minGy, num(m.gy, bounds.minGy)));
          m.targetGx = Math.min(bounds.maxGx, Math.max(bounds.minGx, num(m.targetGx, m.gx)));
          m.targetGy = Math.min(bounds.maxGy, Math.max(bounds.minGy, num(m.targetGy, m.gy)));
        }
        if (m.state !== 'COMBAT' && m.state !== 'PATROL') m.state = 'IDLE';
        m.targetHunterId = null; // re-acquired live
      }
      // Hunters re-acquire live targets too (saved monster IDs may be stale)
      let rescued = 0;
      for (const h of sim.hunters) {
        h.targetMonsterId = null;
        // Field parties are runtime-only: they reform live, so every load
        // dissolves them (parties Map itself is never snapshotted).
        h.partyId = null;
        // Plaza LFP muster is transient too: old saves lack the cooldown,
        // and waiting seekers resume as plaza strollers (hub re-evaluates).
        if (typeof h.lfpCooldown !== 'number' || !Number.isFinite(h.lfpCooldown)) h.lfpCooldown = 0;
        // Paladin absorb shield is transient: old saves load unshielded.
        if (typeof h.shieldHp !== 'number' || !Number.isFinite(h.shieldHp)) h.shieldHp = 0;
        else h.shieldHp = 0;
        if (typeof h.shieldTimer !== 'number' || !Number.isFinite(h.shieldTimer)) h.shieldTimer = 0;
        else h.shieldTimer = 0;
        if (h.state === 'LOOKING_FOR_PARTY') {
          h.state = 'WANDERING_TOWN';
          h.stateTimer = 1.5;
          h.targetMonsterId = null;
          h.targetBuildingId = null;
        }
        // V3 migration: rarity system removed — strip label, keep live stats.
        // Future retrains via resetHunterStats() recompute from flat 1.0x baseline.
        if ('rarity' in (h as unknown as Record<string, unknown>)) delete (h as unknown as Record<string, unknown>).rarity;
        if (typeof h.isAttacking !== 'boolean') h.isAttacking = false;
        // Migrate saves from before the mood/morale system
        if (typeof h.mood !== 'number' || !Number.isFinite(h.mood)) h.mood = 100;
        if (typeof h.moraleBoost !== 'number' || !Number.isFinite(h.moraleBoost)) h.moraleBoost = 0;
        if (typeof h.moraleBoostTimer !== 'number' || !Number.isFinite(h.moraleBoostTimer)) h.moraleBoostTimer = 0;
        if (typeof h.elixirs !== 'number' || !Number.isFinite(h.elixirs)) h.elixirs = 0;
        if (typeof h.tonics !== 'number' || !Number.isFinite(h.tonics)) h.tonics = 0;
        if (typeof h.tonicBoost !== 'number' || !Number.isFinite(h.tonicBoost)) h.tonicBoost = 0;
        if (typeof h.tonicBoostTimer !== 'number' || !Number.isFinite(h.tonicBoostTimer)) h.tonicBoostTimer = 0;
        // Bard Encore / Gold Fever migration (old saves lack these buffs)
        if (typeof h.encoreBoost !== 'number' || !Number.isFinite(h.encoreBoost)) h.encoreBoost = 0;
        if (typeof h.encoreTimer !== 'number' || !Number.isFinite(h.encoreTimer)) h.encoreTimer = 0;
        if (typeof h.goldFeverTimer !== 'number' || !Number.isFinite(h.goldFeverTimer)) h.goldFeverTimer = 0;
        if (typeof h.deaths !== 'number' || !Number.isFinite(h.deaths)) h.deaths = 0;
        // Drop legacy generic skillPoints (now usage-based per-skill EXP).
        if ('skillPoints' in (h as unknown as Record<string, unknown>)) delete (h as unknown as Record<string, unknown>).skillPoints;
        // Migrate gear to rarity model (shop gear = Common; bagged gear keeps rolls).
        for (const slot of ['weapon', 'armor', 'accessory'] as const) {
          const eq = (h as unknown as Record<string, unknown>)[slot] as Equipment | undefined;
          if (eq && typeof eq === 'object') {
            if (typeof eq.rarity !== 'string') eq.rarity = 'Common';
            if (typeof eq.tier !== 'number' || !Number.isFinite(eq.tier)) eq.tier = 1;
          }
        }
        if (Array.isArray(h.inventory)) {
          for (const item of h.inventory) {
            if (item && typeof item === 'object' && item.equipment && typeof item.equipment === 'object') {
              if (typeof item.equipment.rarity !== 'string') item.equipment.rarity = 'Uncommon';
              if (typeof item.value !== 'number' || !Number.isFinite(item.value)) {
                item.value = gearSellPrice(item.equipment.tier ?? 1, item.equipment.rarity);
              }
            }
          }
        }
        // Clamp pre-existing over-leveled skills (old bug let level exceed
        // maxLevel, e.g. Rank 7/5). Upgrade path is already capped; this
        // migrates old saves on load. Damage is recomputed from the clamped
        // level to mirror createClassSkill tier base + 0.3 per level above 1
        // (academy upgrade adds +0.3 per level), so Dmg % matches Rank.
        if (Array.isArray(h.skills)) {
          for (const skill of h.skills) {
            if (!skill || typeof skill !== 'object') continue;
            // Migrate to usage-based EXP (SKILL_EXP_TO_NEXT to READY).
            // Old 100-threshold saves collapse: exp clamps into the new need.
            if (typeof skill.exp !== 'number' || !Number.isFinite(skill.exp)) skill.exp = 0;
            if (typeof skill.expToNext !== 'number' || !Number.isFinite(skill.expToNext) || skill.expToNext !== SKILL_EXP_TO_NEXT) skill.expToNext = SKILL_EXP_TO_NEXT;
            skill.exp = Math.max(0, Math.min(skill.expToNext, skill.exp));
            const max = (typeof skill.maxLevel === 'number' && Number.isFinite(skill.maxLevel))
              ? skill.maxLevel
              : 5;
            if (typeof skill.maxLevel !== 'number' || !Number.isFinite(skill.maxLevel)) skill.maxLevel = max;
            if (typeof skill.level !== 'number' || !Number.isFinite(skill.level)) continue;
            const clamped = Math.min(skill.level, max);
            if (clamped < skill.level) {
              const overflow = skill.level - clamped;
              skill.level = clamped;
              const tierMatch = /-(\d+)\s*$/.exec(typeof skill.id === 'string' ? skill.id : '');
              const tier = tierMatch ? parseInt(tierMatch[1], 10) : NaN;
              let base: number | null = null;
              if (Number.isFinite(tier)) {
                if (h.charClass === 'Berserker') base = 1.8 + tier * 0.4;
                else if (h.charClass === 'Ranger') base = 1.6 + tier * 0.35;
                else if (h.charClass === 'Sorcerer') base = 2.2 + tier * 0.5;
                else if (h.charClass === 'Paladin') base = tier === 2 ? 1.2 : 1.7 + tier * 0.35;
                else if (h.charClass === 'Cleric') base = 2.0 + tier * 0.4;
                else if (h.charClass === 'Bard') base = tier === 1 ? 1.4 + tier * 0.3 : tier === 2 ? 0 : 2.0 + tier * 0.4;
              }
              if (base !== null) {
                skill.damageMultiplier = base + 0.3 * (clamped - 1);
              } else if (typeof skill.damageMultiplier === 'number' && Number.isFinite(skill.damageMultiplier)) {
                skill.damageMultiplier -= 0.3 * overflow;
              }
            }
          }
        }
        if (!Number.isFinite(h.gx) || !Number.isFinite(h.gy) || h.gx < -2 || h.gx > 62 || h.gy < -2 || h.gy > 62) {
          h.gx = 29; h.gy = 29; // town plaza
          h.targetMonsterId = null; h.targetBuildingId = null;
          h.state = 'WANDERING_TOWN'; h.stateTimer = 1.5; // hub re-evaluates on expiry
          rescued++;
        }
      }
      if (rescued > 0) sim.addLog('summon', `Rescued ${rescued} hunter(s) stranded outside the world — recalled to town plaza.`);
      // Buildings drop stale visitor references; hunters re-register on visit
      // (legacy stock/cooldown save keys are ignored — no migration needed)
      for (const b of sim.buildings) {
        b.currentVisitors = [];
      }
      // If the boss flag survived without its boss, reset the timer
      if (sim.isBossActive && !sim.monsters.some(m => m.isBoss)) {
        sim.isBossActive = false;
        sim.bossSpawnTimer = 60;
      }
      return sim;
    } catch {
      return null;
    }
  }
}
