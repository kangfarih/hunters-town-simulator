import { 
  Hunter, Monster, Building, FloatingText, SkillVFX, GameLog, 
  CharacterClass, HunterRarity, ItemDrop, Equipment, Skill,
  MaterialStock, MaterialType
} from '../types';
import { gridDistance, getIsometricFacing } from './isometric';
import { findPath, PathPoint } from './pathfinding';
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
    gx: 8,
    gy: 4,
    width: 3,
    height: 3,
    doorGx: 9,
    doorGy: 6,
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
    gx: 4,
    gy: 8,
    width: 2,
    height: 2,
    doorGx: 5,
    doorGy: 10,
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
    gx: 12,
    gy: 8,
    width: 2,
    height: 2,
    doorGx: 12,
    doorGy: 10,
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
    gx: 4,
    gy: 13,
    width: 2,
    height: 2,
    doorGx: 5,
    doorGy: 15,
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
    gx: 12,
    gy: 13,
    width: 2,
    height: 2,
    doorGx: 12,
    doorGy: 15,
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
    gx: 8,
    gy: 11,
    width: 2,
    height: 2,
    doorGx: 8,
    doorGy: 13,
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
    gx: 8,
    gy: 15,
    width: 2,
    height: 2,
    doorGx: 8,
    doorGy: 17,
    description: 'Tends to wounded hunters and resurrects fallen warriors from fields.',
    serviceName: 'Emergency Healing',
    currentVisitors: [],
    upgradeEffect: 'Dramatically speeds up recovery time from field wounds.'
  }
];

// Town gates: East (Town Gate road) and South (Graveyard road)
export const TOWN_GATE_POS = { gx: 18, gy: 10 };
export const SOUTH_GATE_POS = { gx: 10, gy: 19 };
export const SUMMON_PORTAL_POS = { gx: 9, gy: 2 };

// Roam boundaries per hunting zone (monsters wander inside their home zone)
export const ZONE_ROAM_BOUNDS: Record<1 | 2 | 3, { minGx: number; maxGx: number; minGy: number; maxGy: number }> = {
  1: { minGx: 22, maxGx: 34, minGy: 2, maxGy: 16 }, // Whispering Forest
  2: { minGx: 2, maxGx: 16, minGy: 22, maxGy: 34 }, // Gloomy Graveyard
  3: { minGx: 22, maxGx: 36, minGy: 22, maxGy: 36 }, // Volcanic Ruins
};

// Local save persistence
export const SAVE_KEY = 'hunters-town-save-v1';
const LEGACY_SAVE_KEY = 'evil-hunter-tycoon-save-v1';
const SAVE_VERSION = 1;

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

/** Lv-1 base stats for a class+rarity (rarity multiplier + trainee gear names). */
export function baseStatsFor(charClass: CharacterClass, rarity: HunterRarity): {
  maxHp: number; atk: number; def: number; critRate: number; speed: number;
  weaponName: string; armorName: string; accessoryName: string;
} {
  const rarityMultiplier: Record<HunterRarity, number> = {
    Normal: 1.0,
    Rare: 1.25,
    Superior: 1.55,
    Heroic: 2.0,
    Legendary: 2.7
  };
  const mult = rarityMultiplier[rarity];

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
    baseHp = 180;
    baseAtk = 20;
    baseDef = 16;
    baseCrit = 0.08;
    speed = 0.038;
  }

  return {
    maxHp: Math.round(baseHp * mult),
    atk: Math.round(baseAtk * mult),
    def: Math.round(baseDef * mult),
    critRate: baseCrit,
    speed,
    weaponName: `Trainee ${charClass === 'Berserker' ? 'Broadsword' : charClass === 'Ranger' ? 'Shortbow' : charClass === 'Sorcerer' ? 'Wooden Staff' : 'Mace'}`,
    armorName: 'Novice Leather Coat',
    accessoryName: 'Copper Ring',
  };
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
    this.summonHero('Berserker', 'Rare');
    this.summonHero('Ranger', 'Superior');

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

  public summonHero(forcedClass?: CharacterClass, forcedRarity?: HunterRarity): Hunter | null {
    // Town full: no more slots until Sanctuary Hall levels up
    if (this.hunters.length >= this.maxHunters()) {
      this.addFloatingText('🏠 Town full! Upgrade Sanctuary Hall for +2 slots', SUMMON_PORTAL_POS.gx, SUMMON_PORTAL_POS.gy, '#fca5a5', 12);
      return null;
    }
    const classes: CharacterClass[] = ['Berserker', 'Ranger', 'Sorcerer', 'Paladin'];
    const charClass = forcedClass || classes[Math.floor(Math.random() * classes.length)];

    // Rarity determination
    let rarity: HunterRarity = forcedRarity || 'Normal';
    if (!forcedRarity) {
      const roll = Math.random();
      if (roll < 0.03) rarity = 'Legendary';
      else if (roll < 0.12) rarity = 'Heroic';
      else if (roll < 0.30) rarity = 'Superior';
      else if (roll < 0.60) rarity = 'Rare';
      else rarity = 'Normal';
    }

    const base = baseStatsFor(charClass, rarity);

    const firstName = HUNTER_FIRST_NAMES[Math.floor(Math.random() * HUNTER_FIRST_NAMES.length)];
    const title = HUNTER_TITLES[Math.floor(Math.random() * HUNTER_TITLES.length)];
    const fullName = `${firstName} ${title}`;

    // Starting Skill
    const starterSkill = this.createClassSkill(charClass, 1);

    const hunter: Hunter = {
      id: `hunter-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: fullName,
      charClass,
      rarity,
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
      targetGx: 9,
      targetGy: 8,
      facing: 'SE',
      targetMonsterId: null,
      targetBuildingId: null,
      weapon: {
        id: `wpn-${charClass}`,
        name: base.weaponName,
        tier: 1,
        type: 'weapon',
        atkBonus: 5,
        defBonus: 0,
        hpBonus: 0
      },
      armor: {
        id: `arm-${charClass}`,
        name: base.armorName,
        tier: 1,
        type: 'armor',
        atkBonus: 0,
        defBonus: 3,
        hpBonus: 20
      },
      accessory: {
        id: 'acc-novice',
        name: base.accessoryName,
        tier: 1,
        type: 'accessory',
        atkBonus: 2,
        defBonus: 1,
        hpBonus: 10
      },
      inventory: [],
      maxInventorySlots: 12,
      skills: [starterSkill],
      skillPoints: 0,
      mood: 100,
      moraleBoost: 0,
      moraleBoostTimer: 0,
      elixirs: 1,
      tonics: 0,
      tonicBoost: 0,
      tonicBoostTimer: 0,
      deaths: 0,
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
    this.addFloatingText(`✨ SUMMON: [${rarity}] ${hunter.name}`, hunter.gx, hunter.gy, '#fde047', 14);
    this.addLog('summon', `Summon Portal called [${rarity}] ${hunter.charClass} ${hunter.name} into town!`, hunter.name);

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
        description: 'Strikes viciously in a wide arc dealing heavy physical damage.'
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
        description: 'Fires rapid enchanted arrows piercing monster defenses.'
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
        description: 'Summons a blazing arcane meteor blasting all surrounding beasts.'
      };
    } else {
      return {
        id: `skill-pala-${tier}`,
        name: tier === 1 ? 'Holy Smite' : (tier === 2 ? 'Radiant Aegis' : 'Judgement Pillar'),
        level: 1,
        maxLevel: 5,
        cooldownMs: 4500,
        lastUsedMs: 0,
        damageMultiplier: 1.7 + tier * 0.35,
        effectType: 'smite',
        description: 'Calls down divine wrath that damages foes and shields the hunter.'
      };
    }
  }

  /** Retrain all hunters to Lv 1 trainee state (keeps identity, deaths, position). */
  public resetHunterStats() {
    for (const h of this.hunters) {
      const base = baseStatsFor(h.charClass, h.rarity);
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
      h.inventory = [];
      h.skills = [this.createClassSkill(h.charClass, 1)];
      h.skillPoints = 0;
      h.killCount = 0;
      h.weapon = {
        id: `wpn-${h.charClass}`,
        name: base.weaponName,
        tier: 1,
        type: 'weapon',
        atkBonus: 5,
        defBonus: 0,
        hpBonus: 0
      };
      h.armor = {
        id: `arm-${h.charClass}`,
        name: base.armorName,
        tier: 1,
        type: 'armor',
        atkBonus: 0,
        defBonus: 3,
        hpBonus: 20
      };
      h.accessory = {
        id: 'acc-novice',
        name: base.accessoryName,
        tier: 1,
        type: 'accessory',
        atkBonus: 2,
        defBonus: 1,
        hpBonus: 10
      };
      h.isAttacking = false;
      h.attackAnimTimer = 0;
      h.animFrame = 0;
      h.animTick = 0;
      h.stateTimer = 0;
      h.targetMonsterId = null;
      h.targetBuildingId = null;
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
    // Zone 1: Whispering Forest (slimes, goblins, wolves)
    for (let i = 0; i < 8; i++) {
      this.spawnMonster(1, Math.random() < 0.5 ? 'slime' : (Math.random() < 0.5 ? 'goblin' : 'wolf'));
    }
    // Zone 2: Gloomy Graveyard (skeletons, ghouls)
    for (let i = 0; i < 6; i++) {
      this.spawnMonster(2, Math.random() < 0.6 ? 'skeleton' : 'ghoul');
    }
    // Zone 3: Volcanic Ruins (drakes)
    for (let i = 0; i < 4; i++) {
      this.spawnMonster(3, 'drake');
    }
  }

  public spawnMonster(zone: 1 | 2 | 3, type: Monster['type'], isBoss: boolean = false): Monster {
    let gx = 0;
    let gy = 0;

    if (zone === 1) {
      // Whispering Forest: gx 22..34, gy 2..16
      gx = 22 + Math.random() * 12;
      gy = 2 + Math.random() * 14;
    } else if (zone === 2) {
      // Gloomy Graveyard: gx 2..16, gy 22..34
      gx = 2 + Math.random() * 14;
      gy = 22 + Math.random() * 12;
    } else {
      // Volcanic Ruins: gx 22..36, gy 22..36
      gx = 22 + Math.random() * 14;
      gy = 22 + Math.random() * 14;
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

    // Auto-director scaling (compounds with difficulty, clamped 0.4x-4x).
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
      isBoss,
      animFrame: 0
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
          hunter.targetGx = hall ? hall.doorGx : 9;
          hunter.targetGy = hall ? hall.doorGy : 8;
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
            hunter.targetGx = 24 + Math.random() * 8;
            hunter.targetGy = 8 + Math.random() * 8;
          }
        }
        break;
      }

      case 'HUNTING': {
        // Check health first - if critical, auto retreat to town clinic!
        if (hunter.hp < this.effectiveMaxHp(hunter) * 0.20) {
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
              hunter.targetGx = 22 + Math.random() * 10;
              hunter.targetGy = 6 + Math.random() * 10;
              this.moveTowards(hunter, hunter.targetGx, hunter.targetGy, hunter.speed * 40 * dt);
              break;
            }
          }
          hunter.targetMonsterId = monster.id;
        }

        // Move towards monster
        const dist = gridDistance(hunter.gx, hunter.gy, monster.gx, monster.gy);
        const attackRange = (hunter.charClass === 'Ranger' || hunter.charClass === 'Sorcerer') ? 2.8 : 1.2;

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
          // Post-kill utility routing: needs must outscore the hunt (0.5)
          // to earn the interruption. Lab/forge/clinic never interrupt the
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
          // Ascending priority with >= so the later (higher-priority)
          // entry wins ties: transit < academy < sell; hunt is base.
          let best: 'sell' | 'academy' | 'transit' | 'hunt' = 'hunt';
          let bestU = 0.5;
          if (transitU >= bestU) { best = 'transit'; bestU = transitU; }
          if (s.academy >= bestU) { best = 'academy'; bestU = s.academy; }
          if (s.sell >= bestU) { best = 'sell'; bestU = s.sell; }
          if (best === 'sell') this.returnToTownToSell(hunter);
          else if (best === 'academy') this.returnToAcademy(hunter);
          else if (best === 'transit') this.returnToPlaza(hunter);
          else hunter.state = 'HUNTING';
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

  /** Effective attack after mood scaling and tavern morale + tonic buffs. */
  public effectiveAtk(hunter: Hunter): number {
    return (hunter.atk + hunter.weapon.atkBonus + hunter.accessory.atkBonus) * this.moodScale(hunter) * (1 + hunter.moraleBoost + hunter.tonicBoost);
  }

  /** Effective defense after mood scaling. */
  public effectiveDef(hunter: Hunter): number {
    return (hunter.def + hunter.armor.defBonus + hunter.accessory.defBonus) * this.moodScale(hunter);
  }

  /** Real max HP: base (level growth) + armor + accessory bonuses. Stored maxHp stays base-only. */
  public effectiveMaxHp(hunter: Hunter): number {
    return hunter.maxHp + hunter.armor.hpBonus + hunter.accessory.hpBonus;
  }

  /**
   * Danger assessment: true if the monster would mulch the hunter
   * (dead in under ~6 hits) or vastly out-levels them. Hunters refuse
   * such fights and go gear up in town instead — if they can afford to.
   */
  public isTooHardFor(monster: Monster, hunter: Hunter): boolean {
    if (monster.level > hunter.level + 4) return true;
    const estHit = monster.atk - this.effectiveDef(hunter) * 0.5;
    if (estHit <= 0) return false;
    return hunter.hp / estHit < 6;
  }

  /** True when the hunter could actually improve in town (gear or training). */
  private canImproveInTown(hunter: Hunter): boolean {
    return this.canAffordForgeUpgrade(hunter) || hunter.skillPoints > 0;
  }

  private resolveHunterCombat(hunter: Hunter, monster: Monster, dt: number) {
    hunter.stateTimer -= dt;
    if (hunter.stateTimer > 0) return;

    // Reset swing timer
    hunter.stateTimer = 1.0 / (1 + hunter.speed * 10);
    hunter.isAttacking = true;
    hunter.attackAnimTimer = 0.35;

    // Check available skills for auto-cast
    const now = Date.now();
    const readySkill = hunter.skills.find(s => now - s.lastUsedMs >= s.cooldownMs);

    let isCrit = Math.random() < hunter.critRate;
    let damage = this.effectiveAtk(hunter) - (monster.def * 0.4);

    if (readySkill) {
      // Cast animated skill!
      readySkill.lastUsedMs = now;
      damage *= readySkill.damageMultiplier;

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
        color: readySkill.effectType === 'meteor' ? '#ea580c' : (readySkill.effectType === 'smite' ? '#facc15' : '#38bdf8')
      });

      // Play matching audio
      if (readySkill.effectType === 'meteor') soundFx.playMagic();
      else if (readySkill.effectType === 'smite') soundFx.playSmite();
      else if (readySkill.effectType === 'multishot') soundFx.playArrow();
      else soundFx.playSlash();

      this.addFloatingText(`⚡ ${readySkill.name}!`, hunter.gx, hunter.gy - 0.5, '#38bdf8', 11);
    } else {
      // Standard attack
      if (hunter.charClass === 'Ranger') soundFx.playArrow();
      else if (hunter.charClass === 'Sorcerer') soundFx.playMagic();
      else soundFx.playSlash();
    }

    if (isCrit) {
      damage *= 1.75;
    }
    damage = Math.max(5, Math.round(damage));

    // Deal damage to monster
    monster.hp -= damage;
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

  private handleMonsterDefeat(hunter: Hunter, monster: Monster) {
    this.totalMonstersDefeated++;
    hunter.killCount++;
    // Nursery kills don't feed the auto-director: zone-1 spawns only feel
    // half the dynamic swing (zoneDamp 0.5), so counting ~98% forest kills
    // drives survival >80% → buffs to the 4x cap that zone 2/3 feel fully.
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

    // Distribute Rewards
    hunter.gold += monster.goldReward;
    this.townGold += Math.round(monster.goldReward * this.townTaxRate()); // Town tax

    // Collect Loot Drop
    monster.drops.forEach(drop => {
      hunter.inventory.push({ ...drop });
    });

    // Gray EXP: prey 5+ levels below the hunter teaches nothing (bosses
    // always count). Gold, loot, and town tax are untouched.
    if (monster.isBoss || hunter.level - monster.level < 5) {
      this.addFloatingText(`+${monster.expReward} EXP`, hunter.gx, hunter.gy, '#a855f7', 12);
      this.gainExp(hunter, monster.expReward);
    } else {
      this.addFloatingText('+0 EXP (prey too weak)', hunter.gx, hunter.gy, '#6b7280', 11);
    }

    // Remove monster
    const index = this.monsters.indexOf(monster);
    if (index > -1) {
      this.monsters.splice(index, 1);
    }
    this.pathCache.delete(monster.id);
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
      hunter.skillPoints++;

      // Stat boosts on level up
      hunter.maxHp += 20;
      hunter.hp = this.effectiveMaxHp(hunter);
      hunter.atk += 4;
      hunter.def += 2;

      soundFx.playLevelUp();
      this.addFloatingText(`⭐ LEVEL UP! [Lv.${hunter.level}]`, hunter.gx, hunter.gy - 0.8, '#facc15', 15);
      this.addLog('combat', `${hunter.name} advanced to Level ${hunter.level}! Gained +1 Skill Point.`, hunter.name);

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
   * Map region: 0 = town/transit (gx<=19 && gy<=19, gates included),
   * 1 = forest (gx>19,gy<19), 2 = crypt (gx<19,gy>19), 3 = volcano
   * (gx>19,gy>19). Region walls sit on row/col 19.
   */
  private zoneOf(gx: number, gy: number): 0 | 1 | 2 | 3 {
    if (gx <= 19 && gy <= 19) return 0;
    if (gx > 19 && gy < 19) return 1;
    if (gx < 19 && gy > 19) return 2;
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
    hunter.state = 'RETURNING_TO_TOWN';
    hunter.targetBuildingId = null;
    hunter.targetGx = 9;
    hunter.targetGy = 9;
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
    building.currentVisitors.push(hunter.id);

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
   * need outscores the hunt baseline (0.5) — proportionate needs beat
   * hard-priority chains, so a lone skill point (≤0.45) never yanks a
   * healthy hunter off the field; it batches into the next real town trip.
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
    return {
      sell: hunter.inventory.length >= hunter.maxInventorySlots ? 1.0 : bagU * bagU * 0.4,
      tavern: moodU < 0.65 ? (0.65 - moodU) / 0.65 : 0,            // town: <65 goes, lower = more urgent
      lab: (labOk || tonicOk) ? 0.2 + 0.6 * Math.max(elixirNeed / Math.max(1, this.elixirCapacity()), tonicNeed / Math.max(1, this.tonicCapacity())) : 0,
      forge: forgeOk ? 0.5 : 0,
      academy: hunter.skillPoints > 0 ? Math.min(0.45, 0.35 + 0.05 * hunter.skillPoints) : 0,  // NEVER beats a healthy hunt alone
      clinic: hpU < 0.7 ? (0.7 - hpU) / 0.7 : 0,
      transit: 0,   // filled by caller (field only)
      hunt: 0.5,    // baseline: needs must earn the interruption
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
              this.materialStock[item.iconType] += item.count;
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
              hunter.weapon.atkBonus += 8;
              hunter.weapon.name = `${this.getEquipmentPrefix(hunter.weapon.tier)} ${hunter.charClass} Weapon`;

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
              hunter.armor.defBonus += 4;
              hunter.armor.hpBonus += 15;
              hunter.armor.name = `${this.getEquipmentPrefix(hunter.armor.tier)} ${hunter.charClass} Armor`;

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
          // 3. Hero Auto Learns / Upgrades Skills (spends ALL banked points
          // in one visit: field-deferred training batches into this trip,
          // so one academy service always clears the backlog — no re-queue)
          if (hunter.skillPoints > 0 && hunter.skills.length > 0) {
            const skill = hunter.skills[0];
            if (skill.level >= skill.maxLevel) {
              // Already mastered: no upgrade and no store transaction.
              // Banked points are cleared so the town hub doesn't loop
              // straight back to the academy forever.
              hunter.skillPoints = 0;
              this.addFloatingText(`📜 ${skill.name} already mastered`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#a855f7', 13);
              break;
            }
            const spent = hunter.skillPoints;
            // Clamp to maxLevel so burst spending can't overshoot mastery.
            const use = Math.min(spent, skill.maxLevel - skill.level);
            skill.level += use;
            skill.damageMultiplier += 0.3 * use;
            hunter.skillPoints = 0;

            soundFx.playLevelUp();
            this.addFloatingText(`📜 Skill Upgraded: ${skill.name} (Lv.${skill.level})`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#a855f7', 13);
            this.addLog('skill', `${hunter.name} mastered ${skill.name} Lv.${skill.level} at the Academy.`, hunter.name);

            this.recordStoreTransaction(serviceBuilding, 25, 40);
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
      const hunter = this.hunters.find(h => h.id === monster.targetHunterId);
      if (!hunter || hunter.hp <= 0 || hunter.state === 'RETURNING_TO_TOWN') {
        monster.state = 'IDLE';
        monster.targetHunterId = null;
        return;
      }

      const dist = gridDistance(monster.gx, monster.gy, hunter.gx, hunter.gy);
      // Leash: don't chase prey across the region walls back into town
      if (dist > 9) {
        monster.state = 'IDLE';
        monster.targetHunterId = null;
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
          const dmg = Math.max(3, Math.round(monster.atk - this.effectiveDef(hunter) * 0.5));
          hunter.hp -= dmg;
          // Getting mauled ruins the mood (which in turn scales combat stats)
          hunter.mood = Math.max(0, hunter.mood - (5 + Math.random() * 3));
          this.addFloatingText(`-${dmg}`, hunter.gx, hunter.gy, '#f43f5e', 11);

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
    hunter.hp = 1;
    hunter.deaths++;
    this.totalHunterDeaths++;
    this.windowDeaths++;
    this.evaluateDirector();
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
      clinic.currentVisitors.push(hunter.id);
    }
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
      this.spawnMonster(2, Math.random() < 0.6 ? 'skeleton' : 'ghoul');
    }

    const z3Count = this.monsters.filter(m => m.zone === 3 && !m.isBoss).length;
    if (z3Count < target.z3) {
      this.spawnMonster(3, 'drake');
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
   * and scale future spawns. Buffs and nerfs compound but clamp at 0.4x-4x
   * so the world stays sane. The time-based fallback keeps the director
   * responsive even when kills dry up (e.g. hunters hiding from brutes).
   */
  private evaluateDirector() {
    if (!this.autoDirector || this.hunters.length === 0) return;
    const total = this.windowKills + this.windowDeaths;
    const timeBased = this.simTime - this.lastDirectorEval > 120 && total >= 10;
    if (total < 30 && !timeBased) return;
    this.lastDirectorEval = this.simTime;
    const survival = this.windowKills / total;
    this.windowKills = 0;
    this.windowDeaths = 0;

    if (survival > 0.80) {
      this.dynamicHp = Math.min(4, this.dynamicHp * 1.15);
      this.dynamicAtk = Math.min(4, this.dynamicAtk * 1.15);
      this.addFloatingText('👹 The darkness grows stronger...', 28, 8, '#ef4444', 14);
      this.addLog('boss', `The wilds adapt to easy prey: beasts +15% HP/ATK (rolling survival ${(survival * 100).toFixed(0)}%).`);
    } else if (survival < 0.70) {
      this.dynamicHp = Math.max(0.4, this.dynamicHp * 0.87);
      this.dynamicAtk = Math.max(0.4, this.dynamicAtk * 0.87);
      this.addFloatingText('🌤️ The realm breathes easier...', 9, 9, '#4ade80', 14);
      this.addLog('boss', `The wilds relent: beasts −13% HP/ATK (rolling survival ${(survival * 100).toFixed(0)}%).`);
    }
  }

  private findBestMonsterForHunter(hunter: Hunter): Monster | null {
    // Pick the best level-matched monster in the level-appropriate zone
    // (Lv11+ volcano, Lv6+ graveyard, else forest); best match anywhere as fallback.
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
        // claimants loses to a slightly farther unclaimed one.
        let claimants = 0;
        for (const h of this.hunters) {
          if (h.id !== hunter.id && h.targetMonsterId === m.id) claimants++;
        }
        const score = (Math.abs(m.level - hunter.level) * 3 + d) * (1 + 0.6 * claimants);
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
      if (!data || data.version !== SAVE_VERSION) return null;

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

      // Restore monsters, migrating older saves and clamping roamers home
      sim.monsters = Array.isArray(data.monsters) ? data.monsters : [];
      for (const m of sim.monsters) {
        if (typeof m.roamPauseTimer !== 'number' || !Number.isFinite(m.roamPauseTimer)) {
          m.roamPauseTimer = Math.random() * 2;
        }
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
        if (typeof h.isAttacking !== 'boolean') h.isAttacking = false;
        // Migrate saves from before the mood/morale system
        if (typeof h.mood !== 'number' || !Number.isFinite(h.mood)) h.mood = 100;
        if (typeof h.moraleBoost !== 'number' || !Number.isFinite(h.moraleBoost)) h.moraleBoost = 0;
        if (typeof h.moraleBoostTimer !== 'number' || !Number.isFinite(h.moraleBoostTimer)) h.moraleBoostTimer = 0;
        if (typeof h.elixirs !== 'number' || !Number.isFinite(h.elixirs)) h.elixirs = 0;
        if (typeof h.tonics !== 'number' || !Number.isFinite(h.tonics)) h.tonics = 0;
        if (typeof h.tonicBoost !== 'number' || !Number.isFinite(h.tonicBoost)) h.tonicBoost = 0;
        if (typeof h.tonicBoostTimer !== 'number' || !Number.isFinite(h.tonicBoostTimer)) h.tonicBoostTimer = 0;
        if (typeof h.deaths !== 'number' || !Number.isFinite(h.deaths)) h.deaths = 0;
        // Clamp pre-existing over-leveled skills (old bug let level exceed
        // maxLevel, e.g. Rank 7/5). Upgrade path is already capped; this
        // migrates old saves on load. Damage is recomputed from the clamped
        // level to mirror createClassSkill tier base + 0.3 per level above 1
        // (academy upgrade adds +0.3 per level), so Dmg % matches Rank.
        if (Array.isArray(h.skills)) {
          for (const skill of h.skills) {
            if (!skill || typeof skill !== 'object') continue;
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
                else if (h.charClass === 'Paladin') base = 1.7 + tier * 0.35;
              }
              if (base !== null) {
                skill.damageMultiplier = base + 0.3 * (clamped - 1);
              } else if (typeof skill.damageMultiplier === 'number' && Number.isFinite(skill.damageMultiplier)) {
                skill.damageMultiplier -= 0.3 * overflow;
              }
            }
          }
        }
        if (!Number.isFinite(h.gx) || !Number.isFinite(h.gy) || h.gx < -2 || h.gx > 42 || h.gy < -2 || h.gy > 42) {
          h.gx = 9; h.gy = 9; // town plaza
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
