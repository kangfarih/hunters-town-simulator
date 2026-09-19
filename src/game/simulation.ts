import {
  Hunter, Monster, Building, FloatingText, SkillVFX, GameLog,
  CharacterClass, ItemDrop, Equipment, Skill,
  MaterialStock, MaterialType, EquipmentRarity, EquipmentEffectId,
  ActiveZone, ZoneKind, isSupportZone, zoneTickVfx, zoneCastVfx
} from './types';
import { gridDistance, getIsometricFacing } from './isometric';
import { findPath, PathPoint, reserveAt } from './pathfinding';
import { soundFx } from './audioSynth';
// Dungeon endgame (phases 1+2): map/instance data lives in ./dungeon;
// simulation owns entry checks, spawning, and the lockout tick.
import {
  dungeonAt, BOSS_DEFS, BOSS_ARENAS,
  defaultDungeonInstance, needRoll, dungeonBossIndex,
  DUNGEON_LOCKOUT_SECONDS, DUNGEON_EJECT,
  DUNGEON_CLEAR_BONUS_GOLD,
  DUNGEON_PORTAL, DUNGEON_STAGING, LOBBY_SEATS,
  lobbySeatFits, lobbySeatPositions,
} from './dungeon';
import type { DungeonInstance } from './dungeon';
// Modular data tables (pure: no simulation state). Simulation owns behavior;
// everything a designer tweaks lives in data/.
import {
  INITIAL_BUILDINGS as DATA_INITIAL_BUILDINGS,
  TOWN_GATE_POS as DATA_TOWN_GATE_POS,
  SOUTH_GATE_POS as DATA_SOUTH_GATE_POS,
  SUMMON_PORTAL_POS as DATA_SUMMON_PORTAL_POS,
  ZONE_ROAM_BOUNDS as DATA_ZONE_ROAM_BOUNDS,
  SAVE_KEY as DATA_SAVE_KEY,
  HUNTER_FIRST_NAMES as DATA_HUNTER_FIRST_NAMES,
  HUNTER_TITLES as DATA_HUNTER_TITLES,
  makeHunterName,
  DEFAULT_AGENT_CONFIG as DATA_DEFAULT_AGENT_CONFIG,
  clampAgentConfig as dataClampAgentConfig,
  partyColor as dataPartyColor,
  difficultyMultipliers as dataDifficultyMultipliers,
  PLAYABLE_CLASSES,
  CLASS_KITS,
  baseStatsFor as dataBaseStatsFor,
  classWeaponNoun as dataClassWeaponNoun,
  classArmorNoun as dataClassArmorNoun,
  SKILL_EXP_TO_NEXT as DATA_SKILL_EXP_TO_NEXT,
  skillExpToNext as dataSkillExpToNext,
  createClassSkill as dataCreateClassSkill,
  skillExpPerCast,
  skillTier,
  academyCostFor,
  readySkills,
  hasAffordableReadySkill,
  cheapestReadyCost,
  MONSTER_ARCHETYPES,
  monsterLabel as dataMonsterLabel,
  RARITY_STAT_MULT as DATA_RARITY_STAT_MULT,
  GEAR_SELL_MULT as DATA_GEAR_SELL_MULT,
  gearSellPrice as dataGearSellPrice,
  AUCTION_STOCK_CAP as DATA_AUCTION_STOCK_CAP,
  AUCTION_MAX_COPIES_PER_ITEM as DATA_AUCTION_MAX_COPIES_PER_ITEM,
  auctionItemKey as dataAuctionItemKey,
  isAuctionable as dataIsAuctionable,
  auctionBuyoutPrice as dataAuctionBuyoutPrice,
  auctionBuyerPrice as dataAuctionBuyerPrice,
  RARITY_HEX as DATA_RARITY_HEX,
  RARITY_TEXT_CLASS as DATA_RARITY_TEXT_CLASS,
  RARITY_BORDER_CLASS as DATA_RARITY_BORDER_CLASS,
  rarityHex as dataRarityHex,
  rarityTextClass as dataRarityTextClass,
  rarityBorderClass as dataRarityBorderClass,
  EPIC_DEFS as DATA_EPIC_DEFS,
  epicEffectDescription as dataEpicEffectDescription,
  equipmentDisplayName as dataEquipmentDisplayName,
  getEquipmentPrefix as dataGetEquipmentPrefix,
  zoneGearTier as dataZoneGearTier,
  buildingCapacity as dataBuildingCapacity,
  serviceTime as dataServiceTime,
} from './data';
import type { AgentConfig, Party, EpicDef, MonsterDensity } from './data';

// ---- Canonical data lives in ./data (pure tables + pure helpers).
// The consts below are stable re-exports so UI/renderer imports keep working
// while behavior is carved into systems. Do NOT add new tables here.
export const INITIAL_BUILDINGS: Building[] = DATA_INITIAL_BUILDINGS;

// World geometry + save key (canonical in ./data).
export const TOWN_GATE_POS = DATA_TOWN_GATE_POS;
export const SOUTH_GATE_POS = DATA_SOUTH_GATE_POS;
export const SUMMON_PORTAL_POS = DATA_SUMMON_PORTAL_POS;
export const ZONE_ROAM_BOUNDS = DATA_ZONE_ROAM_BOUNDS;

// Local save persistence
export const SAVE_KEY = DATA_SAVE_KEY;
const LEGACY_SAVE_KEY = 'evil-hunter-tycoon-save-v1';
const SAVE_VERSION = 4;
// Hunter level cap (dungeon gate): gainExp banks nothing at/above this.
export const HUNTER_LEVEL_CAP = 15;
// Grid shift applied when migrating pre-shift (v1) saves: every settled
// coordinate moves +20/+20 as town relocated NW→center.
const SAVE_SHIFT = 20;

// Hunter-brain tuning + parties (canonical in ./data/tuning).
export type { AgentConfig, Party };
export const DEFAULT_AGENT_CONFIG: AgentConfig = DATA_DEFAULT_AGENT_CONFIG;
export const partyColor = dataPartyColor;
export const clampAgentConfig = dataClampAgentConfig;

// Random Name Generation (canonical lists in ./data/names).
const HUNTER_FIRST_NAMES = DATA_HUNTER_FIRST_NAMES;
const HUNTER_TITLES = DATA_HUNTER_TITLES;

export type { MonsterDensity };
export const monsterLabel = dataMonsterLabel;

// Building service curves (canonical in ./data/buildings).
export const buildingCapacity = dataBuildingCapacity;
export const serviceTime = dataServiceTime;

// Class base stats (canonical kit in ./data/classes).
export const baseStatsFor = dataBaseStatsFor;

// (deleted: canonical kit in ./data/classes — see baseStatsFor re-export above.)

// Rarity loot + epics + skill-mastery threshold (canonical in ./data/loot, ./data/skills).
export const RARITY_STAT_MULT = DATA_RARITY_STAT_MULT;
export const GEAR_SELL_MULT = DATA_GEAR_SELL_MULT;
export const gearSellPrice = dataGearSellPrice;
export const AUCTION_STOCK_CAP = DATA_AUCTION_STOCK_CAP;
export const AUCTION_MAX_COPIES_PER_ITEM = DATA_AUCTION_MAX_COPIES_PER_ITEM;
export const auctionItemKey = dataAuctionItemKey;
export const isAuctionable = dataIsAuctionable;
export const auctionBuyoutPrice = dataAuctionBuyoutPrice;
export const auctionBuyerPrice = dataAuctionBuyerPrice;
export const RARITY_HEX = DATA_RARITY_HEX;
export const RARITY_TEXT_CLASS = DATA_RARITY_TEXT_CLASS;
export const RARITY_BORDER_CLASS = DATA_RARITY_BORDER_CLASS;
export const rarityHex = dataRarityHex;
export const rarityTextClass = dataRarityTextClass;
export const rarityBorderClass = dataRarityBorderClass;
export const SKILL_EXP_TO_NEXT = DATA_SKILL_EXP_TO_NEXT;
// DR cost side: rank-scaled need (30 * rank), canonical in ./data/skills.
export const skillExpToNext = dataSkillExpToNext;
export type { EpicDef };
export const EPIC_DEFS: EpicDef[] = DATA_EPIC_DEFS;
export const epicEffectDescription = dataEpicEffectDescription;
export const equipmentDisplayName = dataEquipmentDisplayName;

// --------------------------------------------------------------------------
// Skill mastery with diminishing returns (DR): cost scales (30 * rank),
// gain diminishes ((2 + cooldownSec) / (1 + 0.35*(rank-1)), 1-decimal).
// At rank 1 (~5.5-7 EXP/cast, need 30) that's still ~5 casts to READY —
// fast enough to see Rank 2-3 in a session, with Academy gold + trips
// still gating the climb to max.
// --------------------------------------------------------------------------

// (deleted: skill threshold + epics now canonical in ./data/skills, ./data/loot.)

export class GameSimulation {
  public hunters: Hunter[] = [];
  public monsters: Monster[] = [];
  public buildings: Building[] = [];
  public floatingTexts: FloatingText[] = [];
  public skillVfxs: SkillVFX[] = [];
  // Skill-zone revamp: persistent T2 battlefield zones (runtime-only, never saved).
  public activeZones: ActiveZone[] = [];
  public logs: GameLog[] = [];

  // Town material stock: loot sold at the Trading Post becomes forge/brew stock.
  public materialStock: MaterialStock = GameSimulation.emptyStock();

  // Auction House v1 (Merchant Bazaar extension): instant-buyout pool of
  // green/blue weapon/armor listed at the Trading Post. FIFO-capped.
  public auctionStock: Equipment[] = [];
  public auctionLifetimeListings: number = 0;
  public auctionLifetimeSales: number = 0;
  public auctionLifetimeFees: number = 0;

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
  // Whirl slow: per-hunter spin burst mirroring the renderer whirl (0.9s tail). // Whirl slow:
  private whirlSlow: Map<string, { burst: number; lastZoneId: string | null }> = new Map(); // Whirl slow:

  // Dungeon portal lobby seats: runtime-only (EXCLUDED from save
  // snapshots like parties; every entry dissolves on load and the lobby
  // reforms live). { hunterId, seatIndex } — one seat per hunter.
  public lobby: { hunterId: string; seatIndex: number }[] = [];

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

  // Dungeon instance (phase 2): mobs live in the normal monsters array
  // tagged zone 4; only this header is tracked here.
  public dungeon: DungeonInstance = defaultDungeonInstance();

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

  /** Spawn multipliers for a difficulty level 1-10 (5 = standard 1x). Canonical in ./data/tuning. */
  public static difficultyMultipliers(level: number): { hp: number; atk: number; def: number; reward: number } {
    return dataDifficultyMultipliers(level);
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
    const charClass = forcedClass || PLAYABLE_CLASSES[Math.floor(Math.random() * PLAYABLE_CLASSES.length)];

    const base = baseStatsFor(charClass);

    const fullName = makeHunterName(this.hunters.map(h => h.name));

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

  /** Build a fresh Lv-1 class skill (canonical templates in ./data/classes). */
  private createClassSkill(charClass: CharacterClass, tier: number): Skill {
    return dataCreateClassSkill(charClass, tier);
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

  public spawnMonster(zone: 1 | 2 | 3 | 4, type: Monster['type'], isBoss: boolean = false, at?: { x: number; y: number }): Monster {
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
    } else if (zone === 4) {
      // Dungeon Depths (unseeded fallback): interior of the west strip
      gx = 2 + Math.random() * 15;
      gy = 22 + Math.random() * 35;
    } else {
      // Volcanic Ruins: gx 42..56, gy 42..56
      gx = 42 + Math.random() * 14;
      gy = 42 + Math.random() * 14;
    }

    // Explicit placement (dungeon stocking): pin the spawn point.
    if (at) {
      gx = at.x;
      gy = at.y;
    }

    // Base stats come from the monster roster (./data/monsters) — to add a
    // monster, add an archetype row there; scaling below stays untouched.
    const arch = MONSTER_ARCHETYPES[type];
    let name = arch.name;
    let level = arch.level;
    let hp = arch.hp;
    let atk = arch.atk;
    let def = arch.def;
    let expReward = arch.expReward;
    let goldReward = arch.goldReward;
    let dropName = arch.dropName;
    let dropIcon: ItemDrop['iconType'] = arch.dropIcon;
    if (arch.isBoss) isBoss = true;

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

    // 2b. Dungeon lockout/clear: the gate re-opens when the timer expires
    // (a cleared instance just sits on its timer until then — no wipe
    // eject while cleared; fresh seed on next entry).
    if (this.dungeon.state === 'lockout' || this.dungeon.state === 'cleared') {
      this.dungeon.lockoutTimer -= effectiveDt;
      if (this.dungeon.lockoutTimer <= 0) {
        this.dungeon.lockoutTimer = 0;
        this.dungeon.state = 'dormant';
        this.addLog('boss', 'The dungeon gate grinds open once more — the depths await new delvers.');
      }
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
        if (h.state === 'DUNGEON_LOBBY') {
          this.releaseLobbySeat(h);
          this.leaveForHunt(h);
        }
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

    // 3a. Portal lobby: a full house of role-fitting seat-holders descends.
    this.tickLobbyTeleport();

    // 3b. Update skill zones (T2): ticks after hunters move, before monsters act.
    this.updateZones(effectiveDt);

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

    // 4b. Dungeon wipe/eject (phase 4): full delver loss while active.
    this.checkDungeonWipe();

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
  // DUNGEON INSTANCE (phase 2: entry check + stocking; travel wiring lands
  // in phase 3, so callers invoke this helper explicitly — AI untouched)
  // --------------------------------------------------------------------------

  /**
   * Dungeon entry check: null = admitted, else the reason string.
   * Requires a live 5-stack of max-level hunters while the gate is dormant.
   * On admit the instance activates, seeds, and stocks trash + boss
   * stand-ins (real boss kits land in phase 3).
   */
  public tryEnterDungeon(partyId: string): string | null {
    const party = this.parties.get(partyId);
    if (!party) return `No such party (${partyId}) — the gate admits formed parties only.`;
    const live = party.memberIds
      .map(id => this.hunters.find(h => h.id === id))
      .filter((h): h is Hunter => h !== undefined && h.hp > 0);
    if (live.length !== 5) {
      return `The dungeon gate demands exactly 5 live delvers (found ${live.length}).`;
    }
    const low = live.find(h => h.level < HUNTER_LEVEL_CAP);
    if (low) {
      return `All delvers must be level ${HUNTER_LEVEL_CAP} (${low.name} is level ${low.level}).`;
    }
    if (this.dungeon.state !== 'dormant') {
      return `The dungeon gate is ${this.dungeon.state} — entry refused.`;
    }
    // Admit: activate, seed, snapshot the delvers, and stock the bosses.
    // No trash packs — the dungeon is 3 bosses holding their arenas.
    this.dungeon.seed = Date.now();
    this.dungeon.state = 'active';
    this.dungeon.bossesDown = [false, false, false];
    this.dungeon.partyIds = live.map(h => h.id);
    for (const def of BOSS_DEFS) {
      const boss = this.spawnMonster(4, def.type, true, BOSS_ARENAS[def.arena]);
      boss.name = def.name;
      boss.level = def.level;
      // Pin the boss to its arena (white floor): roam targets stay inside
      // this box, so it never wanders the lanes.
      boss.anchorGx = BOSS_ARENAS[def.arena].x;
      boss.anchorGy = BOSS_ARENAS[def.arena].y;
      boss.anchorRadius = 2.5;
    }
    const names = live.map(h => h.name.split(' ')[0]).join(', ');
    this.addLog('boss', `${names} descended into the dungeon depths!`);
    return null;
  }

  /**
   * Dungeon portal hook (wired — one-line call from the town-hub leave
   * path in evaluateTownNeeds): an idle max-level hunter with nothing
   * better to do gathers at the town portal instead of the field while
   * the instance is dormant. Returns true when routed lobby-side. Inert
   * otherwise (underleveled, dungeon busy, re-queue cooling down, parties
   * off) — normal and no-freeze flows never qualify.
   */
  private maybeEnterLobby(hunter: Hunter): boolean {
    if (!this.agentConfig.partiesEnabled) return false;
    if (hunter.level < HUNTER_LEVEL_CAP) return false;
    if (this.dungeon.state !== 'dormant') return false;
    if ((hunter.lfpCooldown ?? 0) > 0) return false;
    this.removeFromParty(hunter); // field-only parties end at the portal
    hunter.state = 'DUNGEON_LOBBY';
    hunter.targetMonsterId = null;
    hunter.targetBuildingId = null;
    hunter.targetGx = DUNGEON_PORTAL.x;
    hunter.targetGy = DUNGEON_PORTAL.y;
    hunter.stateTimer = 90; // lobby wait budget (sim-seconds)
    this.addFloatingText('🌀 Awaiting the Vault!', hunter.gx, hunter.gy, '#c4b5fd', 11);
    return true;
  }

  /** Live lobby entry for a hunter, if seated. */
  private lobbySeatOf(hunterId: string): { hunterId: string; seatIndex: number } | null {
    return this.lobby.find(e => e.hunterId === hunterId) ?? null;
  }

  /** Release a hunter's lobby seat (no-op when not seated). */
  private releaseLobbySeat(hunter: Hunter) {
    const i = this.lobby.findIndex(e => e.hunterId === hunter.id);
    if (i >= 0) this.lobby.splice(i, 1);
  }

  /**
   * Claim the first free seat whose role fits the hunter's class (tank
   * seat → Paladin/Berserker, heal seat → Cleric, any seats → anyone; one
   * seat per hunter). Returns the seat index, or null when nothing fits —
   * e.g. a roster with no tank class leaves the tank seat empty by design
   * (no crash; the party just never fills).
   */
  private claimLobbySeat(hunter: Hunter): number | null {
    const existing = this.lobbySeatOf(hunter.id);
    if (existing) return existing.seatIndex;
    const taken = new Set(this.lobby.map(e => e.seatIndex));
    for (let i = 0; i < LOBBY_SEATS.length; i++) {
      if (taken.has(i)) continue;
      if (!lobbySeatFits(LOBBY_SEATS[i].role, hunter.charClass)) continue;
      this.lobby.push({ hunterId: hunter.id, seatIndex: i });
      return i;
    }
    return null;
  }

  /**
   * Portal-lobby full-house check (tick, after the hunter loop): when all
   * 5 seats are held by live role-fitting DUNGEON_LOBBY hunters, form them
   * into a party (leader = highest level) and admit via tryEnterDungeon —
   * teleporting to the dungeon staging ONLY on admit. A refusal dissolves
   * the just-formed party and leaves everyone seated (DON'T teleport).
   */
  private tickLobbyTeleport() {
    if (!this.agentConfig.partiesEnabled) return;
    if (this.dungeon.state !== 'dormant') return;
    if (this.lobby.length !== LOBBY_SEATS.length) return;
    const seated: Hunter[] = [];
    for (let i = 0; i < LOBBY_SEATS.length; i++) {
      const e = this.lobby.find(x => x.seatIndex === i);
      const h = e ? this.hunters.find(hh => hh.id === e.hunterId) : undefined;
      if (!h || h.hp <= 0 || h.state !== 'DUNGEON_LOBBY') return;
      if (!lobbySeatFits(LOBBY_SEATS[i].role, h.charClass)) return;
      seated.push(h);
    }
    const leader = seated.reduce((a, b) => (b.level > a.level ? b : a));
    const id = `party-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.parties.set(id, { id, leaderId: leader.id, memberIds: seated.map(h => h.id), lootTurn: 0 });
    for (const h of seated) h.partyId = id;
    if (this.tryEnterDungeon(id) !== null) {
      this.disbandParty(id);
      return;
    }
    this.lobby = this.lobby.filter(e => !seated.some(h => h.id === e.hunterId));
    seated.forEach((h, i) => {
      h.gx = DUNGEON_STAGING.x + (i % 3) - 1;
      h.gy = DUNGEON_STAGING.y + Math.floor(i / 3);
      h.targetBuildingId = null;
      let best: Monster | null = null;
      let bestDist = Infinity;
      for (const mob of this.monsters) {
        if (mob.hp <= 0 || mob.zone !== 4) continue;
        const d = gridDistance(h.gx, h.gy, mob.gx, mob.gy);
        if (d < bestDist) { bestDist = d; best = mob; }
      }
      if (best) {
        h.targetMonsterId = best.id;
        h.targetGx = best.gx;
        h.targetGy = best.gy;
      } else {
        h.targetMonsterId = null;
        h.targetGx = DUNGEON_STAGING.x;
        h.targetGy = DUNGEON_STAGING.y;
      }
      h.state = 'HUNTING';
    });
    this.addFloatingText('🌀 The party descends!', DUNGEON_STAGING.x, DUNGEON_STAGING.y, '#c4b5fd', 16);
  }

  /**
   * Dungeon boss kill (phase 3+4): marks bossesDown, pays the guaranteed
   * epic via need-roll (handled by the caller), and triggers the clear —
   * state→cleared, celebration, town bonus, re-entry timer. The world-boss
   * (lich) path is separate and untouched.
   */
  private onDungeonBossDown(hunter: Hunter, monster: Monster) {
    const idx = dungeonBossIndex(monster.type);
    if (idx >= 0 && idx < 3) this.dungeon.bossesDown[idx] = true;
    const down = this.dungeon.bossesDown.filter(Boolean).length;
    this.addFloatingText('🏆 DUNGEON BOSS SLAIN!', monster.gx, monster.gy, '#fbbf24', 18);
    this.addLog('boss', `${hunter.name} slew ${monster.name}! (${down}/3)`, hunter.name);
    if (this.dungeon.state === 'active' && this.dungeon.bossesDown.every(Boolean)) {
      this.dungeon.state = 'cleared';
      this.dungeon.lockoutTimer = DUNGEON_LOCKOUT_SECONDS;
      this.townGold += DUNGEON_CLEAR_BONUS_GOLD;
      this.addFloatingText('🎉 DUNGEON CLEARED!', monster.gx, monster.gy - 1, '#facc15', 18);
      this.addLog('boss', `The dungeon is CLEARED! The town feasts — +${DUNGEON_CLEAR_BONUS_GOLD}g to the treasury.`);
    }
  }

  /**
   * Wipe detection (phase 4, tick): dungeon active with ≥1 entered party
   * inside, and every tracked delver down-or-absent (knocked-down clinic
   * cases count as down; missing hunters count as absent) → eject: live
   * members to the plaza, zone-4 mobs cleared, state→lockout on the
   * standard timer, banner + log. No cooldown beyond the lockout.
   */
  private checkDungeonWipe() {
    if (this.dungeon.state !== 'active') return;
    const ids = this.dungeon.partyIds ?? [];
    if (ids.length === 0) return;
    const members = ids.map(id => this.hunters.find(h => h.id === id));
    const down = (h: Hunter | undefined) => !h || h.hp <= 0 || h.state === 'RECOVERING_CLINIC';
    if (!members.every(down)) return;
    for (const h of members) {
      if (!h || h.hp <= 0) continue;
      for (const b of this.buildings) {
        b.currentVisitors = b.currentVisitors.filter(id => id !== h.id);
      }
      h.gx = DUNGEON_EJECT.x;
      h.gy = DUNGEON_EJECT.y;
      h.targetMonsterId = null;
      h.targetBuildingId = null;
      h.state = 'WANDERING_TOWN';
      h.stateTimer = 1.5;
    }
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      if (this.monsters[i].zone === 4) {
        this.pathCache.delete(this.monsters[i].id);
        this.monsters.splice(i, 1);
      }
    }
    this.dungeon.state = 'lockout';
    this.dungeon.lockoutTimer = DUNGEON_LOCKOUT_SECONDS;
    this.addFloatingText('💀 PARTY WIPED!', DUNGEON_EJECT.x, DUNGEON_EJECT.y, '#ef4444', 16);
    this.addLog('boss', 'Party wiped in the dungeon depths — survivors crawl back to the plaza. The gate slams shut.');
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

    this.syncWhirlSlow(hunter, dt); // Whirl slow:

    // Field parties are field-only: any town state dissolves membership.
    if (hunter.partyId && (hunter.state === 'RETURNING_TO_TOWN' ||
        hunter.state === 'SELLING_LOOT' || hunter.state === 'UPGRADING_GEAR' ||
        hunter.state === 'LEARNING_SKILL' || hunter.state === 'BREWING_ELIXIR' ||
        hunter.state === 'RECOVERING_CLINIC' || hunter.state === 'RESTING_TAVERN' ||
        hunter.state === 'WANDERING_TOWN' || hunter.state === 'LOOKING_FOR_PARTY' ||
        hunter.state === 'DUNGEON_LOBBY')) {
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
        const arrived = this.moveTowards(hunter, hunter.targetGx, hunter.targetGy, this.effectiveMoveSpeed(hunter) * 60 * dt) // Whirl slow:
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
        const reachedGate = this.moveTowards(hunter, hunter.targetGx, hunter.targetGy, this.effectiveMoveSpeed(hunter) * 60 * dt) // Whirl slow:
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
              this.moveTowards(hunter, hunter.targetGx, hunter.targetGy, this.effectiveMoveSpeed(hunter) * 40 * dt); // Whirl slow:
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
          this.moveTowards(hunter, monster.gx, monster.gy, this.effectiveMoveSpeed(hunter) * 60 * dt); // Whirl slow:
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
        const reached = this.moveTowards(hunter, hunter.targetGx, hunter.targetGy, this.effectiveMoveSpeed(hunter) * 60 * dt) // Whirl slow:
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
                } else if (building.type === 'TRAINING_ACADEMY') {
                  // Broke hunters with a READY skill would burn a full timed
                  // service for nothing, then scoreNeeds would send them
                  // straight back (academy death-loop: never hunts, never
                  // earns). Bounce to the hub so they go earn gold first.
                  if (!hasAffordableReadySkill(hunter)) {
                    const need = cheapestReadyCost(hunter);
                    this.addFloatingText(Number.isFinite(need) ? `📜 Need ${need}g for training` : `📜 No skill ready for training`, hunter.gx, hunter.gy, '#fca5a5', 11);
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

      case 'DUNGEON_LOBBY': {
        // Town portal lobby: walk to the violet portal, claim the first
        // role-fitting seat on arrival (tank → Paladin/Berserker, heal →
        // Cleric, any → anyone; one seat per hunter), then sit out the 90s
        // wait budget. A full house teleports via tickLobbyTeleport; on
        // expiry march out SOLO and start the 120s re-queue cooldown
        // (re-uses the LFP cooldown field — no new fields).
        const seats = lobbySeatPositions();
        let entry = this.lobbySeatOf(hunter.id);
        const dest = entry ? seats[entry.seatIndex]! : DUNGEON_PORTAL;
        this.moveTowards(hunter, dest.x, dest.y, this.effectiveMoveSpeed(hunter) * 60 * dt); // Whirl slow:
        if (!entry && gridDistance(hunter.gx, hunter.gy, DUNGEON_PORTAL.x, DUNGEON_PORTAL.y) < 0.8) {
          if (this.claimLobbySeat(hunter) !== null) {
            this.addFloatingText('🪑 Taking a seat…', hunter.gx, hunter.gy, '#c4b5fd', 11);
          }
        }
        hunter.stateTimer -= dt;
        if (hunter.stateTimer <= 0) {
          this.releaseLobbySeat(hunter);
          hunter.lfpCooldown = 120;
          this.addFloatingText('🚶 Portal party never formed — hunting solo', hunter.gx, hunter.gy, '#94a3b8', 11);
          this.leaveForHunt(hunter);
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
        this.moveTowards(hunter, 29, 29, this.effectiveMoveSpeed(hunter) * 60 * dt); // Whirl slow:
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

  /** Mood multiplier: miserable hunters fight at 85%, ecstatic ones at 115%. */ // TTK tune: was 75%/125%
  public moodScale(hunter: Hunter): number {
    const mood = Math.max(0, Math.min(100, hunter.mood));
    return 0.85 + (mood / 100) * 0.3; // TTK tune: was 0.75 + (mood/100)*0.5 (band 0.75-1.25 -> 0.85-1.15)
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

  /** Effective attack speed after Swiftwind (Windstalker). Movement resolves via effectiveMoveSpeed. */
  public effectiveSpeed(hunter: Hunter): number {
    return hunter.speed + this.equippedEffect(hunter, 'swiftwind');
  }

  /** Whirl slow: sync the spin-burst mirror (same inside-own-storm / 0.9s burst window as the renderer spin). // Whirl slow: */
  private syncWhirlSlow(hunter: Hunter, dt: number): void { // Whirl slow:
    const ownStorms = this.activeZones.filter(z => z.kind === 'storm' && z.sourceId === hunter.id); // Whirl slow:
    const hasStorm = ownStorms.length > 0; // Whirl slow:
    const newestStormId = hasStorm ? ownStorms[ownStorms.length - 1].id : null; // Whirl slow:
    let w = this.whirlSlow.get(hunter.id); // Whirl slow:
    if (!w) { w = { burst: 0, lastZoneId: null }; this.whirlSlow.set(hunter.id, w); } // Whirl slow:
    if (newestStormId && newestStormId !== w.lastZoneId) { w.burst = 0.9; w.lastZoneId = newestStormId; } // Whirl slow:
    if (!hasStorm) { w.lastZoneId = null; } // Whirl slow:
    const insideOwnStorm = hasStorm && ownStorms.some(z => gridDistance(hunter.gx, hunter.gy, z.x, z.y) <= z.radius + 0.75); // Whirl slow:
    if (insideOwnStorm) { w.burst = 0.9; } else if (w.burst > 0) { w.burst = Math.max(0, w.burst - dt); } // Whirl slow:
    if (!hasStorm && w.burst <= 0) { this.whirlSlow.delete(hunter.id); } // Whirl slow:
  }

  /** Whirl slow: true under the exact spin condition (own storm live + inside it or inside the 0.9s burst tail). // Whirl slow: */
  public isWhirling(hunter: Hunter): boolean { // Whirl slow:
    const ownStorms = this.activeZones.filter(z => z.kind === 'storm' && z.sourceId === hunter.id); // Whirl slow:
    if (ownStorms.length === 0) return false; // Whirl slow:
    const w = this.whirlSlow.get(hunter.id); // Whirl slow:
    const burst = w ? w.burst : 0; // Whirl slow:
    const inside = ownStorms.some(z => gridDistance(hunter.gx, hunter.gy, z.x, z.y) <= z.radius + 0.75); // Whirl slow:
    return inside || burst > 0; // Whirl slow:
  }

  /** Whirl slow: movement speed resolves here (x0.7 while whirling). Town states never slow so it can't persist off-field. // Whirl slow: */
  public effectiveMoveSpeed(hunter: Hunter): number { // Whirl slow:
    switch (hunter.state) { // Whirl slow:
      case 'WANDERING_TOWN': case 'LOOKING_FOR_PARTY': case 'DUNGEON_LOBBY': case 'SELLING_LOOT': case 'UPGRADING_GEAR': // Whirl slow:
      case 'LEARNING_SKILL': case 'BREWING_ELIXIR': case 'RECOVERING_CLINIC': case 'RESTING_TAVERN': // Whirl slow:
      case 'SPAWNING': case 'REGISTERING': return hunter.speed; // Whirl slow:
      default: break; // Whirl slow:
    }
    return this.isWhirling(hunter) ? hunter.speed * 0.7 : hunter.speed; // Whirl slow:
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
    const estHit = monster.atk - this.effectiveDef(hunter) * mult * 0.65; // TTK tune: 0.5->0.65
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
   * Paladin tank effect on T1/T3 smite casts: raises an absorb shield and
   * (T3 Judgement) taunts nearby beasts onto the Paladin. Shield scales +5%
   * maxHp per skill rank above 1 so Academy promotions thicken the bulwark.
   * Taunt radius 6, duration 5s (Judgement) — always shorter than the skill
   * CD so bosses can't be perma-locked. (T2 Consecrated Aura routes to
   * castT2Zone before reaching here, so there is no tier-2 branch.)
   */
  private applyPaladinTankEffect(hunter: Hunter, skill: Skill) {
    const tierMatch = /-(\d+)\s*$/.exec(typeof skill.id === 'string' ? skill.id : '');
    const tier = tierMatch ? parseInt(tierMatch[1], 10) : 1;
    const rankBonus = 0.05 * Math.max(0, (skill.level ?? 1) - 1);
    const maxHp = this.effectiveMaxHp(hunter);
    let shieldFrac = 0.30;
    let shieldSecs = 6;
    let tauntSecs = 0;
    if (tier >= 3) {
      shieldFrac = 0.45;
      shieldSecs = 7;
      tauntSecs = 5;
    }
    const shield = Math.round(maxHp * (shieldFrac + rankBonus));
    hunter.shieldHp = Math.max(hunter.shieldHp ?? 0, shield);
    hunter.shieldTimer = Math.max(hunter.shieldTimer ?? 0, shieldSecs);
    this.addFloatingText(`🛡️ Aegis +${shield}`, hunter.gx, hunter.gy - 0.5, '#93c5fd', 12);
    if (tauntSecs > 0) {
      this.tauntMonsters(hunter, tauntSecs, skill.name);
    }
  }

  /**
   * Taunt nearby beasts (radius 6) onto the hunter for `secs` sim-seconds.
   * Shared by Paladin smites and the Consecrated Aura T2 zone cast.
   */
  private tauntMonsters(hunter: Hunter, secs: number, skillName: string) {
    let taunted = 0;
    for (const m of this.monsters) {
      if (m.hp <= 0) continue;
      if (gridDistance(hunter.gx, hunter.gy, m.gx, m.gy) > 6) continue;
      m.tauntHunterId = hunter.id;
      m.tauntTimer = secs;
      m.state = 'COMBAT';
      m.targetHunterId = hunter.id;
      taunted++;
    }
    if (taunted > 0) {
      this.addFloatingText(`😡 Taunt! (${taunted})`, hunter.gx, hunter.gy - 1.1, '#f87171', 12);
      this.addLog('combat', `${hunter.name} taunts ${taunted} beast${taunted > 1 ? 's' : ''} with ${skillName}!`, hunter.name);
    }
  }

  /**
   * Usage-based skill mastery with DR gain side (rank-diminished per-cast EXP).
   * Callers apply gray gating (damage) or skip it (support).
   */
  private grantSkillMastery(hunter: Hunter, skill: Skill) {
    if (skill.level >= skill.maxLevel) return;
    const curExp = typeof skill.exp === 'number' && Number.isFinite(skill.exp) ? skill.exp : 0;
    const need = typeof skill.expToNext === 'number' && Number.isFinite(skill.expToNext) ? skill.expToNext : SKILL_EXP_TO_NEXT;
    // DR gain side: higher ranks earn less per cast (support casts ungated here too).
    skill.exp = Math.min(need, curExp + skillExpPerCast(skill.cooldownMs, skill.level));
    if (skill.exp >= need) {
      this.addFloatingText(`✨ ${skill.name} READY!`, hunter.gx, hunter.gy - 1.1, '#facc15', 11);
    }
  }

  /** Gray prey teaches nothing (matches 0 hunter EXP on gray kills). */
  private isGrayPrey(hunter: Hunter, monster: Monster): boolean {
    return !monster.isBoss && (hunter.level - monster.level >= this.agentConfig.grayGap);
  }

  // --------------------------------------------------------------------------
  // Skill zones (T2 revamp): persistent battlefield objects created by tier-2
  // casts. Damage zones pin to the ground at the target; support auras follow
  // the caster and die early if the caster goes down. Cap ~6 concurrent zones
  // (oldest expires first). Every zone duration stays below its skill CD.
  // --------------------------------------------------------------------------

  /** Tier-2 zone cast: lays the ActiveZone and plays the cast presentation. */
  private castT2Zone(hunter: Hunter, skill: Skill, target: Monster | null) {
    const now = Date.now();
    skill.lastUsedMs = now;
    const level = typeof skill.level === 'number' && Number.isFinite(skill.level) ? skill.level : 1;
    const tpl = CLASS_KITS[hunter.charClass]?.skillTemplates[1];
    const cfg = tpl?.zone;
    const kind: ZoneKind = cfg?.kind ?? 'burn';
    const radius = cfg?.radius ?? 3;
    const duration = (cfg?.durationSec ?? 5) + 0.5 * Math.max(0, level - 1);
    const atkRef = this.effectiveAtk(hunter);

    // Anchor: support auras follow the caster; damage zones pin to the
    // target's ground (fall back to the caster when no live target).
    let x = hunter.gx;
    let y = hunter.gy;
    let followHunterId: string | undefined;
    if (isSupportZone(kind)) {
      followHunterId = hunter.id;
    } else if (target && target.hp > 0) {
      x = target.gx;
      y = target.gy;
    }

    // Cap concurrent zones (~6, oldest expires first).
    if (this.activeZones.length >= 6) this.activeZones.shift();
    this.activeZones.push({
      id: `zone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      kind, x, y, radius, duration,
      elapsed: 0,
      tickTimer: 0,
      atkRef,
      sourceId: hunter.id,
      followHunterId,
      level,
      tickFrac: cfg?.tickFrac ?? 0.3,
      hotMaxFrac: cfg?.hotMaxFrac ?? 0,
      masteryEarned: false,
    });

    // Support zones earn mastery on the cast (no gray gating for support,
    // like the old mend/anthem paths). Damage zones earn it on the first
    // tick that bites non-gray prey (see tickZone).
    if (isSupportZone(kind)) this.grantSkillMastery(hunter, skill);

    // Cast presentation: existing cast frame + cast text + zone-appropriate FX.
    hunter.isAttacking = true;
    hunter.attackAnimTimer = 0.35;
    this.addFloatingText(`⚡ ${skill.name}!`, hunter.gx, hunter.gy - 0.5, '#38bdf8', 11);
    this.skillVfxs.push({
      id: `vfx-zone-${Date.now()}-${Math.random()}`,
      type: zoneCastVfx(kind),
      startX: x,
      startY: y,
      targetX: x,
      targetY: y,
      duration: 0.6,
      elapsed: 0,
      color: '#38bdf8',
    });
    const fx = skill.effectType;
    if (fx === 'meteor') soundFx.playMagic();
    else if (fx === 'smite') soundFx.playSmite();
    else if (fx === 'multishot') soundFx.playArrow();
    else if (fx === 'ballad' || fx === 'encore') soundFx.playLute();
    else if (fx === 'heal' || fx === 'holy_burst') soundFx.playHeal();
    else soundFx.playSlash();

    // Consecrated Aura taunts on cast (Paladin tank pattern, 4s < 11s CD).
    if (kind === 'consecration') this.tauntMonsters(hunter, 4, skill.name);
  }

  /** Tick all zones: expiry, aura re-anchor, 1s damage/heal ticks. */
  private updateZones(dt: number) {
    if (this.activeZones.length === 0) return;
    const tickedKinds = new Set<ZoneKind>();
    for (let i = this.activeZones.length - 1; i >= 0; i--) {
      const z = this.activeZones[i];
      z.elapsed += dt;
      if (z.elapsed >= z.duration) {
        this.activeZones.splice(i, 1);
        continue;
      }
      if (z.followHunterId) {
        const caster = this.hunters.find(h => h.id === z.followHunterId);
        // Support auras die with the caster. handleHunterDefeat restores hp
        // (1 + clinic warp, or 30% max on party rescue) before zones tick,
        // so an hp<=0 check never observes the knockdown — guard on the
        // clinic-warp state instead. The party-rescue path is covered by the
        // kill-on-knockdown splice in handleHunterDefeat; this check is
        // belt-and-braces for warped casters.
        if (!caster || caster.hp <= 0 || caster.state === 'RECOVERING_CLINIC') {
          this.activeZones.splice(i, 1);
          continue;
        }
        z.x = caster.gx;
        z.y = caster.gy;
      }
      z.tickTimer += dt;
      // Catch-up ticks: a large dt (hitch/tab-switch) may span several 1s
      // boundaries — drain the accumulator instead of dropping ticks.
      while (z.tickTimer >= 1) {
        z.tickTimer -= 1;
        if (this.tickZone(z)) tickedKinds.add(z.kind);
        // tickZone removes the zone when its source is gone — stop ticking it.
        if (!this.activeZones.includes(z)) break;
      }
    }
    // One quiet blip per ticking kind per global tick.
    for (const kind of tickedKinds) soundFx.playZoneTick(kind);
  }

  /**
   * One 1s zone tick. DoT = max(3, atkRef*frac), no crit, gray-gated skill
   * mastery; HoT clamped to effectiveMaxHp. Kill credit flows through the
   * sourceId hunter into handleMonsterDefeat. Floating texts throttled to
   * ~5 per tick per zone. Returns true when the tick bit something (audio).
   */
  private tickZone(z: ActiveZone): boolean {
    const src = this.hunters.find(h => h.id === z.sourceId);
    if (!src) {
      const idx = this.activeZones.indexOf(z);
      if (idx > -1) this.activeZones.splice(idx, 1);
      return false;
    }
    const rankScale = 1 + 0.1 * Math.max(0, z.level - 1);
    const vfxType = zoneTickVfx(z.kind);
    let bit = false;

    if (z.kind === 'radiance' || z.kind === 'hymn') {
      const allies = this.hunters.filter(h => h.hp > 0 && gridDistance(z.x, z.y, h.gx, h.gy) <= z.radius);
      let shown = 0;
      for (const h of allies) {
        const maxHp = this.effectiveMaxHp(h);
        const amt = Math.max(1, Math.round(maxHp * z.hotMaxFrac * rankScale + z.atkRef * z.tickFrac * rankScale));
        h.hp = Math.min(maxHp, h.hp + amt);
        // Resonant Hymn refreshes Encore (+20% ATK) on everyone inside.
        if (z.kind === 'hymn') {
          if ((h.encoreBoost ?? 0) < 0.20) h.encoreBoost = 0.20;
          h.encoreTimer = Math.max(h.encoreTimer ?? 0, 8);
        }
        if (shown < 5) {
          this.addFloatingText(`+${amt}`, h.gx, h.gy - 0.5, z.kind === 'hymn' ? '#2dd4bf' : '#4ade80', 11);
          shown++;
        }
        bit = true;
      }
      if (allies.length > 5) {
        this.addFloatingText(`+heal x${allies.length}`, z.x, z.y - 0.5, '#4ade80', 11);
      }
    } else {
      // DoT (storm/arrows/burn/consecration): bite every live monster inside.
      const dmg = Math.max(3, Math.round(z.atkRef * z.tickFrac * rankScale));
      const victims = this.monsters.filter(m => m.hp > 0 && gridDistance(z.x, z.y, m.gx, m.gy) <= z.radius);
      if (!z.masteryEarned && victims.some(m => !this.isGrayPrey(src, m))) {
        const t2 = src.skills.find(s => skillTier(s) === 2) ?? src.skills[1];
        if (t2) {
          this.grantSkillMastery(src, t2);
          z.masteryEarned = true;
        }
      }
      let shown = 0;
      for (const m of [...victims]) {
        if (m.hp <= 0) continue;
        m.hp -= dmg;
        if (m.state !== 'COMBAT') m.state = 'COMBAT';
        if (!m.targetHunterId) m.targetHunterId = z.sourceId;
        if (shown < 5) {
          this.addFloatingText(`-${dmg}`, m.gx, m.gy, '#f8fafc', 11);
          shown++;
        }
        bit = true;
        if (m.hp <= 0) this.handleMonsterDefeat(src, m);
      }
      if (victims.length > 5) {
        this.addFloatingText(`-${dmg} x${victims.length}`, z.x, z.y - 0.5, '#cbd5e1', 11);
      }
      // Consecrated Aura also steadies allies: small shield refresh each tick.
      if (z.kind === 'consecration') {
        const allies = this.hunters.filter(h => h.hp > 0 && gridDistance(z.x, z.y, h.gx, h.gy) <= z.radius);
        for (const h of allies) {
          const amt = Math.max(1, Math.round(this.effectiveMaxHp(h) * 0.02 * rankScale));
          h.shieldHp = Math.max(h.shieldHp ?? 0, amt);
          h.shieldTimer = Math.max(h.shieldTimer ?? 0, 3);
          bit = true;
        }
      }
    }

    // Per-tick mini-burst reusing the short SkillVFX vocabulary.
    if (bit) {
      this.skillVfxs.push({
        id: `vfx-ztick-${Date.now()}-${Math.random()}`,
        type: vfxType,
        startX: z.x,
        startY: z.y,
        targetX: z.x,
        targetY: z.y,
        duration: 0.3,
        elapsed: 0,
        color: '#f8fafc',
      });
    }
    return bit;
  }

  private resolveHunterCombat(hunter: Hunter, monster: Monster, dt: number) {
    hunter.stateTimer -= dt;
    if (hunter.stateTimer > 0) return;

    // Reset swing timer (Swiftwind speeds up attacks, not movement)
    hunter.stateTimer = 1.0 / (1 + this.effectiveSpeed(hunter) * 10);
    hunter.isAttacking = true;
    hunter.attackAnimTimer = 0.35;

    // Cleric support AI (skill-zone revamp): T3 Renewing Dawn party burst
    // when >=3 hurt allies or anyone critical (<40%), else T2 Soothing
    // Radiance aura when >=2 hurt in r5, else T1 Mend Wounds on the most
    // wounded ally <75% in r5. Heal formulas scale on skill.damageMultiplier
    // so Academy promotions thicken every mend (dead-stat bug fixed).
    if (hunter.charClass === 'Cleric') {
      const nowMs = Date.now();
      const cdReady = (s: Skill) => nowMs - s.lastUsedMs >= this.effectiveCooldownMs(hunter, s);
      const t1 = hunter.skills.find(s => skillTier(s) === 1 && s.effectType === 'heal' && cdReady(s)) ?? null;
      const t2 = hunter.skills.find(s => skillTier(s) === 2 && cdReady(s)) ?? null;
      const t3 = hunter.skills.find(s => skillTier(s) === 3 && s.effectType === 'holy_burst' && cdReady(s)) ?? null;
      const hpFrac = (h: Hunter) => h.hp / Math.max(1, this.effectiveMaxHp(h));
      const allies5 = this.hunters.filter(h => h.hp > 0 && gridDistance(hunter.gx, hunter.gy, h.gx, h.gy) <= 5);
      const allies6 = this.hunters.filter(h => h.hp > 0 && gridDistance(hunter.gx, hunter.gy, h.gx, h.gy) <= 6);
      const hurt5 = allies5.filter(h => hpFrac(h) < 0.75);
      const hurt6 = allies6.filter(h => hpFrac(h) < 0.75);
      const critical = allies6.some(h => hpFrac(h) < 0.40);
      if (t3 && (hurt6.length >= 3 || critical)) {
        // T3: holy burst healing the party in r6 (~30% maxHp + 1.0 ATK),
        // scaled by damageMultiplier (base 2.0 → +0.3/rank ≈ +15%/rank).
        t3.lastUsedMs = nowMs;
        const casterAtk = this.effectiveAtk(hunter);
        for (const h of allies6) {
          const maxHp = this.effectiveMaxHp(h);
          const heal = Math.round((maxHp * 0.30 + casterAtk * 1.0) * (t3.damageMultiplier / 2.0));
          h.hp = Math.min(maxHp, h.hp + heal);
          this.addFloatingText(`+${heal}`, h.gx, h.gy - 0.5, '#4ade80', 12);
        }
        // Usage-based mastery for the burst (no gray gating for support).
        this.grantSkillMastery(hunter, t3);
        this.skillVfxs.push({
          id: `vfx-dawn-${Date.now()}-${Math.random()}`,
          type: 'holy_burst',
          startX: hunter.gx,
          startY: hunter.gy,
          targetX: hunter.gx,
          targetY: hunter.gy,
          duration: 0.6,
          elapsed: 0,
          color: '#facc15'
        });
        soundFx.playHeal();
        this.addFloatingText(`⚡ ${t3.name}!`, hunter.gx, hunter.gy - 0.5, '#38bdf8', 11);
        return;
      }
      if (t2 && hurt5.length >= 2) {
        this.castT2Zone(hunter, t2, null);
        return;
      }
      if (t1 && hurt5.length > 0) {
        // T1: single-target mend on the most wounded ally in r5
        // (30% maxHp + 1.0 ATK, scaled by damageMultiplier, base 1.0). // TTK tune: was 25% + 0.8
        let target = hurt5[0];
        for (const h of hurt5) if (hpFrac(h) < hpFrac(target)) target = h;
        t1.lastUsedMs = nowMs;
        const maxHp = this.effectiveMaxHp(target);
        const heal = Math.round((maxHp * 0.30 + this.effectiveAtk(hunter) * 1.0) * t1.damageMultiplier); // TTK tune: was 0.25 maxHp + 0.8 ATK
        target.hp = Math.min(maxHp, target.hp + heal);
        // Usage-based mastery for the mend (no gray gating for support).
        this.grantSkillMastery(hunter, t1);
        this.addFloatingText(`+${heal}`, target.gx, target.gy - 0.5, '#4ade80', 12);
        this.skillVfxs.push({
          id: `vfx-heal-${Date.now()}-${Math.random()}`,
          type: 'heal',
          startX: target.gx,
          startY: target.gy,
          targetX: target.gx,
          targetY: target.gy,
          duration: 0.6,
          elapsed: 0,
          color: '#4ade80'
        });
        soundFx.playHeal();
        return;
      }
      // No hurt ally in range: fall through to the normal (weak) attack path.
    }

    // Bard support AI: T2 Resonant Hymn aura when the party is clustered
    // (>=1 ally within r5) and someone's Encore is expiring (<=3s left).
    // The hymn zone itself refreshes Encore inside, closing the loop.
    // T1/T3 flow into the damage path below (ballad + damaging finale).
    if (hunter.charClass === 'Bard') {
      const nowMsBard = Date.now();
      const hymn = hunter.skills.find(s => skillTier(s) === 2 && nowMsBard - s.lastUsedMs >= this.effectiveCooldownMs(hunter, s)) ?? null;
      if (hymn) {
        const allies5 = this.hunters.filter(h => h.hp > 0 && h.id !== hunter.id && gridDistance(hunter.gx, hunter.gy, h.gx, h.gy) <= 5);
        const expiring = (hunter.encoreTimer ?? 0) <= 3 || allies5.some(h => (h.encoreTimer ?? 0) <= 3);
        // Solo self-cast: a lone Bard (no allies in r5) may still anchor the
        // hymn on themselves to refresh their own expiring Encore.
        if ((allies5.length >= 1 || (hunter.encoreTimer ?? 0) <= 3) && expiring) {
          this.castT2Zone(hunter, hymn, null);
          return;
        }
      }
      // No clustered + expiring moment: fall through to ballad/finale damage path.
    }

    // Check available skills for auto-cast (round-robin: oldest ready first
    // so 2nd/3rd skills actually get casts instead of skills[0] hogging).
    // Focus (Astral Veil) shortens every cooldown.
    const now = Date.now();
    let readySkill: Skill | null = null;
    for (const s of hunter.skills) {
      // Pure-support casts never ride the damage path: Cleric mends/bursts
      // fire from the support branch, and Cleric/Bard T2 auras are AI-gated
      // there too. Other classes' T2 zones route to castT2Zone below.
      if (s.effectType === 'heal' || s.effectType === 'holy_burst') continue;
      if (skillTier(s) === 2 && (hunter.charClass === 'Cleric' || hunter.charClass === 'Bard')) continue;
      if (now - s.lastUsedMs >= this.effectiveCooldownMs(hunter, s) && (!readySkill || s.lastUsedMs < readySkill.lastUsedMs)) {
        readySkill = s;
      }
    }

    const deadeye = this.equippedEffect(hunter, 'deadeye');
    let isCrit = Math.random() < this.effectiveCritRate(hunter);
    const baseDamage = this.effectiveAtk(hunter) - (monster.def * 0.4);
    let damage = baseDamage;

    if (readySkill) {
      // Tier-2 zone casts (all classes): lay the ActiveZone instead of striking.
      if (skillTier(readySkill) === 2) {
        this.castT2Zone(hunter, readySkill, monster);
        return;
      }
      // Cast animated skill!
      readySkill.lastUsedMs = now;
      // Piercing Comet (Ranger T3): DEF pierce via a reduced monster-def factor.
      const skillBase = hunter.charClass === 'Ranger' && skillTier(readySkill) === 3
        ? this.effectiveAtk(hunter) - (monster.def * 0.1)
        : baseDamage;
      damage = skillBase * readySkill.damageMultiplier;
      // Meteorfall (Solar Cataclysm): +35% on the skill portion only.
      const meteorfall = this.equippedEffect(hunter, 'meteorfall');
      if (meteorfall > 0) damage = skillBase + (damage - skillBase) * (1 + meteorfall);
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
        if (crescendo > 0) damage = skillBase + (damage - skillBase) * (1 + crescendo);
      }

      // Usage-based mastery with DR gain side (rank-diminished per-cast EXP).
      // Gray prey teaches nothing (matches 0 hunter EXP on gray).
      const isGrayTarget = !monster.isBoss && (hunter.level - monster.level >= this.agentConfig.grayGap);
      if (!isGrayTarget && readySkill.level < readySkill.maxLevel) {
        const curExp = typeof readySkill.exp === 'number' && Number.isFinite(readySkill.exp) ? readySkill.exp : 0;
        const need = typeof readySkill.expToNext === 'number' && Number.isFinite(readySkill.expToNext) ? readySkill.expToNext : SKILL_EXP_TO_NEXT;
        // DR gain side: same divisor as grantSkillMastery; gray stays 0 gain.
        const gain = skillExpPerCast(readySkill.cooldownMs, readySkill.level);
        readySkill.exp = Math.min(need, curExp + gain);
        if (readySkill.exp >= need) {
          this.addFloatingText(`✨ ${readySkill.name} READY!`, hunter.gx, hunter.gy - 1.1, '#facc15', 11);
        }
      }

      // Spawn skill VFX animation. Quick Shot (multishot) fires a sequential
      // volley: 3 arrows staggered ~100ms apart along the flight path via
      // short-lived VFX with elapsed spawn-delay offsets — not one burst.
      if (readySkill.effectType === 'multishot') {
        const vfxColor = '#38bdf8';
        for (let volley = 0; volley < 3; volley++) {
          this.skillVfxs.push({
            id: `vfx-${Date.now()}-${Math.random()}-vol${volley}`,
            type: readySkill.effectType,
            startX: hunter.gx,
            startY: hunter.gy,
            targetX: monster.gx,
            targetY: monster.gy,
            duration: 0.5,
            elapsed: -0.1 * volley,
            color: vfxColor,
          });
        }
      } else {
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
      }

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
      // Standard attack: melee classes lunge (no VFX), ranged classes fire
      // a class-typed projectile so damage at range reads visually.
      const rangedVfx: SkillVFX['type'] | null =
        hunter.charClass === 'Ranger' ? 'multishot'
        : hunter.charClass === 'Sorcerer' ? 'meteor'
        : hunter.charClass === 'Bard' ? 'ballad'
        : hunter.charClass === 'Cleric' ? 'smite'
        : null;
      if (rangedVfx) {
        this.skillVfxs.push({
          id: `vfx-atk-${Date.now()}-${Math.random()}`,
          type: rangedVfx,
          startX: hunter.gx,
          startY: hunter.gy,
          targetX: monster.gx,
          targetY: monster.gy,
          duration: 0.5,
          elapsed: 0,
          color: rangedVfx === 'meteor' ? '#ea580c' : rangedVfx === 'smite' ? '#facc15' : rangedVfx === 'ballad' ? '#2dd4bf' : '#38bdf8',
        });
      }
      if (hunter.charClass === 'Ranger') soundFx.playArrow();
      else if (hunter.charClass === 'Sorcerer') soundFx.playMagic();
      else if (hunter.charClass === 'Bard') soundFx.playLute();
      else soundFx.playSlash();
    }

    if (isCrit) {
      damage *= deadeye > 0 ? 1.8 : 1.5; // TTK tune: was 2.1 : 1.75
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
  // Bosses: 35% epic (smart loot 70% killer class). Normals: Uncommon 40%
  // (wolf+), Rare 10% (ghoul/drake). Gray kills: no gear roll.
  // --------------------------------------------------------------------------

  private zoneGearTier(zone: 1 | 2 | 3 | 4): number {
    return dataZoneGearTier(zone);
  }

  private classWeaponNoun(charClass: CharacterClass): string {
    return dataClassWeaponNoun(charClass);
  }

  private classArmorNoun(charClass: CharacterClass): string {
    return dataClassArmorNoun(charClass);
  }

  private buildStatGear(tier: number, rarity: EquipmentRarity, slot: 'weapon' | 'armor', forClass: CharacterClass, monster: Monster): ItemDrop {
    const mult = RARITY_STAT_MULT[rarity] ?? 1;
    const noun = slot === 'weapon' ? this.classWeaponNoun(forClass) : this.classArmorNoun(forClass);
    // Base name only — rarity is stored separately and added at display time
    // via equipmentDisplayName(). (Embedding it here caused "Uncommon Uncommon ...".)
    const name = `${this.getEquipmentPrefix(tier)} ${forClass} ${noun}`;
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
      if (monster.zone === 4) {
        // Dungeon bosses: ALWAYS exactly 1 epic of RANDOM class
        // (bypasses the 35% roll and the killer-class smart loot).
        const def = EPIC_DEFS[Math.floor(Math.random() * EPIC_DEFS.length)];
        return this.buildEpicGear(def, monster);
      }
      if (Math.random() >= 0.35) return null;
      // Smart loot: 70% killer-class pool (its weapon + all armors), else any epic.
      // (Dungeon bosses return above with a guaranteed random-class epic.)
      const classPool = EPIC_DEFS.filter(d => !d.reqClass || d.reqClass === killer.charClass);
      const pool = Math.random() < 0.7 && classPool.length > 0 ? classPool : EPIC_DEFS;
      const def = pool[Math.floor(Math.random() * pool.length)];
      return this.buildEpicGear(def, monster);
    }
    // Normal monsters: slime/goblin stay materials-only.
    if (monster.type === 'slime' || monster.type === 'goblin') return null;
    const canRare = monster.type === 'ghoul' || monster.type === 'drake';
    let rarity: EquipmentRarity | null = null;
    if (canRare && Math.random() < 0.10) rarity = 'Rare';
    else if (Math.random() < 0.40) rarity = 'Uncommon';
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
    const displayName = dataEquipmentDisplayName(eq.rarity, eq.name);
    this.addFloatingText(`⚔️ ${hunter.name} equipped ${displayName}!`, hunter.gx, hunter.gy - 0.5, rarityHex(eq.rarity), 12);
    this.addLog('upgrade', `${hunter.name} equipped ${displayName}${oldValue > 0 ? ` (+${oldValue}g trade-in)` : ''}.`, hunter.name);
    return true;
  }

  /**
   * Auction House buyer: weapon-first cheapest affordable upgrade from the
   * pool. Prices recompute from item tier/rarity + bazaar level so the fee
   * stays consistent; the fee funds townGold. Old gear trades in (Common)
   * or relists when auctionable. Returns true when a purchase happened.
   */
  public tryBuyAuctionUpgrade(hunter: Hunter, bazaar: Building): boolean {
    if (this.auctionStock.length === 0) return false;
    for (const slot of ['weapon', 'armor'] as const) {
      const current = this.equippedGearFor(hunter, slot);
      const currentScore = this.gearScore(current);
      let bestIdx = -1;
      let bestPrice = Infinity;
      let bestBuyout = 0;
      for (let i = 0; i < this.auctionStock.length; i++) {
        const item = this.auctionStock[i];
        if (item.type !== slot) continue;
        if (item.requiredClass && item.requiredClass !== hunter.charClass) continue;
        if (this.gearScore(item) <= currentScore) continue;
        const buyout = dataAuctionBuyoutPrice(item.tier, item.rarity ?? 'Common', bazaar.level);
        const price = dataAuctionBuyerPrice(buyout, item.tier);
        if (hunter.gold < price) continue;
        if (price < bestPrice) {
          bestPrice = price;
          bestBuyout = buyout;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) continue;
      const [bought] = this.auctionStock.splice(bestIdx, 1);
      if (!bought) continue;
      hunter.gold -= bestPrice;
      // Old gear: Common vendors at half; auctionable green/blue relists.
      const old = { ...current };
      if ((old.rarity ?? 'Common') === 'Common') {
        const tradeIn = Math.floor(dataGearSellPrice(old.tier, old.rarity ?? 'Common') / 2);
        if (tradeIn > 0) hunter.gold += tradeIn;
      } else if (dataIsAuctionable(old)) {
        const copies = this.auctionStock.filter(s => dataAuctionItemKey(s) === dataAuctionItemKey(old)).length;
        if (copies < DATA_AUCTION_MAX_COPIES_PER_ITEM && this.auctionStock.length < DATA_AUCTION_STOCK_CAP) {
          this.auctionStock.push(old);
        } else {
          const tradeIn = Math.floor(dataGearSellPrice(old.tier, old.rarity ?? 'Common') / 2);
          if (tradeIn > 0) hunter.gold += tradeIn;
        }
      }
      if (slot === 'weapon') hunter.weapon = { ...bought };
      else hunter.armor = { ...bought };
      hunter.hp = Math.min(this.effectiveMaxHp(hunter), hunter.hp + Math.max(0, bought.hpBonus - current.hpBonus));
      const fee = bestPrice - bestBuyout;
      this.auctionLifetimeSales++;
      this.auctionLifetimeFees += fee;
      this.townGold += fee;
      this.recordStoreTransaction(bazaar, 20, bestPrice);
      soundFx.playCoin();
      const displayName = dataEquipmentDisplayName(bought.rarity, bought.name);
      this.addFloatingText(`💎 Bought ${displayName} for ${bestPrice}g`, bazaar.doorGx, bazaar.doorGy - 0.5, '#60a5fa', 13);
      this.addLog('trade', `${hunter.name} bought ${displayName} on Auction House for ${bestPrice}g`, hunter.name);
      return true;
    }
    return false;
  }

  private handleMonsterDefeat(hunter: Hunter, monster: Monster) {    this.totalMonstersDefeated++;
    hunter.killCount++;
    // Death burst: soul wisp blooms where the monster fell (bosses linger).
    this.skillVfxs.push({
      id: `death-${Date.now()}-${Math.random()}`,
      type: 'death',
      startX: monster.gx,
      startY: monster.gy,
      targetX: monster.gx,
      targetY: monster.gy,
      duration: monster.isBoss ? 0.9 : 0.5,
      elapsed: 0,
      color: monster.isBoss ? '#a855f7' : '#a78bfa',
    });
    // Nursery + dungeon kills don't feed the auto-director: zone-1 spawns only feel
    // half the dynamic swing (zoneDamp 0.5), so counting ~98% forest kills
    // drives survival >80% → buffs to the 3x cap that zone 2/3 feel fully.
    // On-level crypt fights then read as mulch (e.g. Lv8 vs ghoul at 3.2
    // hits-to-die < 6) and isTooHardFor pins everyone in the forest.
    // Zone-4 dungeon kills are instanced endgame content — same exclusion.
    if (monster.zone !== 1 && monster.zone !== 4) {
      this.windowKills++;
      this.evaluateDirector();
    }

    if (monster.isBoss) {
      if (monster.zone === 4) {
        this.onDungeonBossDown(hunter, monster);
      } else {
        this.isBossActive = false;
        this.bossSpawnTimer = 90;
        this.addFloatingText('🏆 BOSS SLAIN!', monster.gx, monster.gy, '#fbbf24', 18);
        this.addLog('boss', `${hunter.name} defeated the Evil Lich Lord! The realm is temporarily purified.`, hunter.name);
      }
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
    // Dungeon-boss epics resolve here via need-roll (winner force-equipped,
    // else vended into the split below) so the normal pipeline never sees them.
    let gearDrop = this.rollEquipmentDrop(monster, hunter);
    if (monster.isBoss && monster.zone === 4 && gearDrop && gearDrop.equipment) {
      const epic = gearDrop.equipment;
      const party = this.agentConfig.partiesEnabled ? this.partyOf(hunter) : null;
      const inParty = party ? this.partyMembers(hunter).filter(m => m.hp > 0) : [hunter];
      const candidates = inParty.length > 0 ? inParty : [hunter];
      const winnerId = needRoll(
        candidates.map(m => ({ id: m.id, name: m.name, charClass: m.charClass })),
        epic.requiredClass ?? undefined,
      );
      const winner = candidates.find(m => m.id === winnerId) ?? null;
      const epicName = dataEquipmentDisplayName(epic.rarity, epic.name);
      if (winner) {
        // Need win: force-equip/grant to the winner (old piece trades in at half).
        const slot = epic.type === 'armor' ? 'armor' : 'weapon';
        const current = slot === 'weapon' ? winner.weapon : winner.armor;
        const oldValue = Math.floor(gearSellPrice(current.tier, current.rarity ?? 'Common') / 2);
        if (oldValue > 0) winner.gold += oldValue;
        if (slot === 'weapon') winner.weapon = { ...epic };
        else winner.armor = { ...epic };
        winner.hp = Math.min(this.effectiveMaxHp(winner), winner.hp + Math.max(0, (epic.hpBonus ?? 0) - (current.hpBonus ?? 0)));
        this.addFloatingText(`🎲 ${winner.name} won ${epicName} (need)!`, monster.gx, monster.gy - 0.5, rarityHex('Epic'), 14);
        this.addLog('boss', `${winner.name} won ${epicName} (need) from ${monster.name}!`, winner.name);
      } else {
        // No matching class: vendor for gold, folded into the split below
        // like a normal sale (existing sell-value helper).
        const sale = dataGearSellPrice(epic.tier, epic.rarity ?? 'Common');
        goldTotal += sale;
        this.addFloatingText(`💰 No need — ${epicName} vended +${sale}g`, monster.gx, monster.gy - 0.5, '#fde047', 13);
        this.addLog('boss', `No delver needed ${epicName} — vended for ${sale}g split among the party.`);
      }
      gearDrop = null;
    }
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
    // Level cap 15 (dungeon gate): capped hunters bank nothing. Hunters
    // already above the cap keep their stats and gain nothing either.
    if (hunter.level >= HUNTER_LEVEL_CAP) {
      hunter.exp = 0;
      return;
    }
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
   * Map region: 4 = dungeon depths (west strip, checked FIRST so it wins
   * over the overlapping reserves below),
   * 0 = town/transit (gx<=39 && gy<=39, gates included) plus
   * the reserved expansion lands (northwest bands: town/transit-exempt,
   * no zone-fit pressure, no transit targeting),
   * 1 = forest (gx>39,gy<39), 2 = crypt (gx<39,gy>39), 3 = volcano
   * (gx>39,gy>39). Region walls sit on row/col 39 (+ the west palisade).
   */
  private zoneOf(gx: number, gy: number): 0 | 1 | 2 | 3 | 4 {
    if (dungeonAt(gx, gy)) return 4;
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
      academy: hasAffordableReadySkill(hunter) ? 0.45 : 0,  // NEVER beats a healthy hunt alone; 0 when broke (no academy death-loop)
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
    // (portal lobby hook first: an idle max-level hunter gathers instead)
    if (bestU < 0.12) {
      if (this.maybeEnterLobby(hunter)) return;
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
          // 1. Hero Auto Sells Loot to NPC — auctionable green/blue
          // weapon/armor lists on the Auction House (instant buyout) instead.
          let auctionGold = 0;
          let normalGold = 0;
          let overflowGold = 0;
          const normalItems = hunter.inventory.filter(item => !(item.equipment && dataIsAuctionable(item.equipment)));
          for (const item of hunter.inventory) {
            const eq = item.equipment;
            if (!eq || !dataIsAuctionable(eq)) continue;
            const copies = this.auctionStock.filter(s => dataAuctionItemKey(s) === dataAuctionItemKey(eq)).length;
            if (copies >= DATA_AUCTION_MAX_COPIES_PER_ITEM) {
              const salvage = dataAuctionBuyoutPrice(eq.tier, eq.rarity ?? 'Common', serviceBuilding.level);
              overflowGold += salvage;
              this.addLog('trade', `${hunter.name}'s ${dataEquipmentDisplayName(eq.rarity, eq.name)} overflow-salvaged (cap ×${DATA_AUCTION_MAX_COPIES_PER_ITEM}) for ${salvage}g`, hunter.name);
              continue;
            }
            const buyout = dataAuctionBuyoutPrice(eq.tier, eq.rarity ?? 'Common', serviceBuilding.level);
            if (this.auctionStock.length >= DATA_AUCTION_STOCK_CAP) {
              const evicted = this.auctionStock.shift();
              if (evicted) {
                const salvage = dataGearSellPrice(evicted.tier, evicted.rarity ?? 'Common');
                this.townGold += salvage;
                this.addLog('trade', `Auction House full: oldest ${dataEquipmentDisplayName(evicted.rarity, evicted.name)} salvaged for ${salvage}g.`);
              }
            }
            this.auctionStock.push({ ...eq });
            hunter.gold += buyout;
            auctionGold += buyout;
            this.auctionLifetimeListings++;
            this.addLog('trade', `${hunter.name} listed ${dataEquipmentDisplayName(eq.rarity, eq.name)} on Auction House for ${buyout}g`, hunter.name);
            this.addFloatingText(`🏷️ Listed ${dataEquipmentDisplayName(eq.rarity, eq.name)} for ${buyout}g`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#4ade80', 12);
          }

          // Bonus price based on Trading Post level (normal loot only)
          normalGold = normalItems.reduce((sum, item) => sum + item.value * item.count, 0);
          normalGold = Math.round(normalGold * (1 + serviceBuilding.level * 0.1)) + overflowGold;

          const totalSaleGold = auctionGold + normalGold;
          if (totalSaleGold > 0) {
            for (const item of normalItems) {
              if (!item.equipment) this.materialStock[item.iconType] += item.count;
            }
            hunter.gold += normalGold;
            hunter.inventory = [];
            soundFx.playCoin();

            this.addFloatingText(`💰 Sold Loot: +${totalSaleGold}g`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fde047', 13);
            this.addLog('trade', `${hunter.name} sold monster loot to ${serviceBuilding.name} for ${totalSaleGold} gold.`, hunter.name);

            // NPC Store EXP & Auto Upgrade!
            this.recordStoreTransaction(serviceBuilding, Math.max(15, Math.round(totalSaleGold * 0.2)), totalSaleGold);
          } else {
            hunter.inventory = [];
          }
          // Spend the fresh gold on an auction upgrade when one is affordable.
          this.tryBuyAuctionUpgrade(hunter, serviceBuilding);
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
          // Broke hunters never reach here (academy door guard bounces them),
          // so a failed cost check just ends the visit — the hub routes them
          // to earn gold instead of looping the Academy.
          const ready = readySkills(hunter);
          if (ready.length === 0) break;
          const skill = ready[0];
          const cost = academyCostFor(skill.level);
          if (hunter.gold < cost) {
            this.addFloatingText(`📜 Need ${cost}g for ${skill.name}`, serviceBuilding.doorGx, serviceBuilding.doorGy - 0.5, '#fca5a5', 12);
            break;
          }
          hunter.gold -= cost;
          skill.level += 1;
          skill.damageMultiplier += 0.3;
          skill.exp = 0;
          // DR cost side: the new rank needs 30 * rank for its next READY.
          skill.expToNext = dataSkillExpToNext(skill.level);

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

          const moreReady = hasAffordableReadySkill(hunter);
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
    return dataGetEquipmentPrefix(tier);
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
      // Anchor leash: dungeon bosses never leave their arena
      if (monster.anchorGx != null && monster.anchorGy != null && monster.anchorRadius != null) {
        if (gridDistance(monster.gx, monster.gy, monster.anchorGx, monster.anchorGy) > monster.anchorRadius + 2) {
          monster.state = 'IDLE';
          monster.targetHunterId = null;
          monster.tauntHunterId = null;
          monster.tauntTimer = 0;
          return;
        }
      }
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
          monster.attackCooldown = 2.2; // TTK tune: was 1.8 (spawn initial 1.5 untouched)
          monster.attackAnimTimer = 0.35;
          const dmg = Math.max(3, Math.round(monster.atk - this.effectiveDef(hunter) * 0.65)); // TTK tune: 0.5->0.65
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
          const moodHit = (3 + Math.random() * 2) * (martyr > 0 ? 0.5 : 1) * (hadShield ? 0.5 : 1); // TTK tune: was 5+rand*3
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

  /** Idle wandering: pause, pick a nearby point in the home zone, stroll to it.
   *  Dungeon bosses use their anchor box (arena) instead of zone bounds. */
  private updateMonsterRoam(monster: Monster, dt: number) {
    const hasAnchor = monster.anchorRadius != null;
    const bounds = hasAnchor
      ? { minGx: monster.anchorGx! - monster.anchorRadius!, maxGx: monster.anchorGx! + monster.anchorRadius!, minGy: monster.anchorGy! - monster.anchorRadius!, maxGy: monster.anchorGy! + monster.anchorRadius! }
      : ZONE_ROAM_BOUNDS[monster.zone];
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
    // Knockdown kills the caster's support auras (consecration/radiance/
    // hymn) on ANY knockdown path — clinic warp AND party rescue. Choice:
    // even though a rescued hunter stays in the field at 30% maxHp (and
    // deaths++ still counts), the aura uptime ends and must be recast;
    // otherwise the aura would linger after a rescue or follow the caster
    // to the clinic (updateZones runs after defeat, when hp is already
    // restored, so it can never catch the knockdown itself). Ground-fixed
    // damage zones persist — kill credit still flows via sourceId.
    if (this.activeZones.length > 0) {
      this.activeZones = this.activeZones.filter(z => z.followHunterId !== hunter.id);
    }
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

    // Fallback to the best-matched fair fight anywhere (refuse suicide runs).
    // Zone-4 dungeon mobs are excluded for hunters outside the vault — entry
    // is teleport-only, so no one may route themselves at the sealed wall.
    // Delvers already inside keep full access and prefer interior prey.
    const inDungeon = this.zoneOf(hunter.gx, hunter.gy) === 4;
    if (inDungeon) {
      const inside = this.monsters.filter(m => m.zone === 4 && m.hp > 0 && !this.isTooHardFor(m, hunter));
      if (inside.length > 0) return nearestIn(inside);
    }
    const anyFair = this.monsters.filter(m => m.hp > 0 && !this.isTooHardFor(m, hunter) && (inDungeon || m.zone !== 4));
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
    const inDungeon = this.zoneOf(hunter.gx, hunter.gy) === 4;
    for (const m of this.monsters) {
      if (m.hp <= 0) continue;
      // Teleport-only entry: outsiders never desperation-pick vault mobs.
      if (m.zone === 4 && !inDungeon) continue;
      const estHit = m.atk - this.effectiveDef(hunter) * 0.65; // TTK tune: 0.5->0.65
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
      dungeon: {
        seed: this.dungeon.seed,
        state: this.dungeon.state,
        lockoutTimer: this.dungeon.lockoutTimer,
        bossesDown: [...this.dungeon.bossesDown],
        partyIds: [...(this.dungeon.partyIds ?? [])],
      },
      materialStock: this.materialStock,
      auctionStock: this.auctionStock,
      auctionLifetimeListings: this.auctionLifetimeListings,
      auctionLifetimeSales: this.auctionLifetimeSales,
      auctionLifetimeFees: this.auctionLifetimeFees,
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
      if (!data || (data.version !== 1 && data.version !== 2 && data.version !== 3 && data.version !== SAVE_VERSION)) return null;
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

      // Dungeon instance (v4+; older saves migrate to dormant/unseeded).
      // The portal lobby is runtime-only like parties: fresh sims start
      // empty, so loads always clear it (seated waiters resume as plaza
      // strollers below and the hub re-evaluates).
      sim.lobby = [];
      sim.dungeon = defaultDungeonInstance();
      if (data.dungeon && typeof data.dungeon === 'object') {
        const d = data.dungeon as Partial<DungeonInstance>;
        sim.dungeon.seed = num(d.seed, 0);
        sim.dungeon.state = (d.state === 'active' || d.state === 'cleared' || d.state === 'lockout')
          ? d.state
          : 'dormant';
        sim.dungeon.lockoutTimer = Math.max(0, num(d.lockoutTimer, 0));
        sim.dungeon.bossesDown = [0, 1, 2].map(i =>
          Array.isArray(d.bossesDown) && d.bossesDown[i] === true) as [boolean, boolean, boolean];
        sim.dungeon.partyIds = Array.isArray(d.partyIds)
          ? (d.partyIds as unknown[]).filter((id): id is string => typeof id === 'string')
          : [];
      }

      // Town material stock (old saves without it migrate to zeros)
      sim.materialStock = GameSimulation.emptyStock();
      if (data.materialStock && typeof data.materialStock === 'object') {
        for (const k of Object.keys(sim.materialStock) as MaterialType[]) {
          const v = (data.materialStock as Record<string, unknown>)[k];
          sim.materialStock[k] = typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
        }
      }

      // Auction House v1 (old saves without it migrate to empty/zero)
      sim.auctionStock = Array.isArray(data.auctionStock) ? data.auctionStock : [];
      sim.auctionLifetimeListings = num(data.auctionLifetimeListings, 0);
      sim.auctionLifetimeSales = num(data.auctionLifetimeSales, 0);
      sim.auctionLifetimeFees = num(data.auctionLifetimeFees, 0);

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
        // Anchor defaults for dungeon bosses (migration)
        if (m.zone === 4 && m.isBoss && m.anchorGx == null) {
          m.anchorGx = m.gx;
          m.anchorGy = m.gy;
          m.anchorRadius = 2.5;
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
      // Pre-existing saves may hold duplicate hunter names (old random gen
      // never checked the roster) — rename repeats so every name is unique.
      const seenNames = new Set<string>();
      for (const h of sim.hunters) {
        if (typeof h.name === 'string' && h.name.trim() && !seenNames.has(h.name.trim())) {
          seenNames.add(h.name.trim());
        } else {
          h.name = makeHunterName(seenNames);
          seenNames.add(h.name);
        }
        h.targetMonsterId = null;
        // Field parties are runtime-only: they reform live, so every load
        // dissolves them (parties Map itself is never snapshotted).
        h.partyId = null;
        // Plaza LFP muster + portal lobby are transient too: old saves lack
        // the cooldown, and waiting seekers resume as plaza strollers (hub
        // re-evaluates).
        if (typeof h.lfpCooldown !== 'number' || !Number.isFinite(h.lfpCooldown)) h.lfpCooldown = 0;
        // Paladin absorb shield is transient: old saves load unshielded.
        if (typeof h.shieldHp !== 'number' || !Number.isFinite(h.shieldHp)) h.shieldHp = 0;
        else h.shieldHp = 0;
        if (typeof h.shieldTimer !== 'number' || !Number.isFinite(h.shieldTimer)) h.shieldTimer = 0;
        else h.shieldTimer = 0;
        if (h.state === 'LOOKING_FOR_PARTY' || h.state === 'DUNGEON_LOBBY') {
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
        // Also strip legacy embedded rarity prefixes ("Uncommon Iron ...")
        // — names are now stored bare, rarity added at display time.
        for (const slot of ['weapon', 'armor', 'accessory'] as const) {
          const eq = (h as unknown as Record<string, unknown>)[slot] as Equipment | undefined;
          if (eq && typeof eq === 'object') {
            if (typeof eq.rarity !== 'string') eq.rarity = 'Common';
            if (typeof eq.tier !== 'number' || !Number.isFinite(eq.tier)) eq.tier = 1;
            if (typeof eq.name === 'string') eq.name = eq.name.replace(/^(Common|Uncommon|Rare|Epic)\s+/i, '');
          }
        }
        if (Array.isArray(h.inventory)) {
          for (const item of h.inventory) {
            if (item && typeof item === 'object' && item.equipment && typeof item.equipment === 'object') {
              if (typeof item.equipment.rarity !== 'string') item.equipment.rarity = 'Uncommon';
              if (typeof item.equipment.name === 'string') {
                const clean = item.equipment.name.replace(/^(Common|Uncommon|Rare|Epic)\s+/i, '');
                item.equipment.name = clean;
                if (typeof item.name === 'string') item.name = clean;
              }
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
            // Migrate to usage-based EXP (rank-scaled need to READY).
            // Old 100-threshold saves collapse: exp clamps into the new need.
            if (typeof skill.exp !== 'number' || !Number.isFinite(skill.exp)) skill.exp = 0;
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
            // Skill-zone revamp migration: refresh stale cooldowns, names,
            // effect types, and descriptions to the canonical revamp table.
            // Damage rescales from rank (base + 0.3/rank, the Academy
            // promotion step) so earned promotions survive the rebalance.
            const revTierMatch = /-(\d+)\s*$/.exec(typeof skill.id === 'string' ? skill.id : '');
            const revTier = revTierMatch ? parseInt(revTierMatch[1], 10) : NaN;
            if (Number.isFinite(revTier)) {
              const canon = dataCreateClassSkill(h.charClass, Math.max(1, Math.min(3, revTier)));
              skill.name = canon.name;
              skill.cooldownMs = canon.cooldownMs;
              skill.effectType = canon.effectType;
              skill.description = canon.description;
              const rank = typeof skill.level === 'number' && Number.isFinite(skill.level) ? skill.level : 1;
              skill.damageMultiplier = canon.damageMultiplier + 0.3 * Math.max(0, rank - 1);
              if (typeof skill.lastUsedMs !== 'number' || !Number.isFinite(skill.lastUsedMs)) skill.lastUsedMs = 0;
            }
            // DR cost side: recompute need from the (clamped) rank, not a flat reset.
            skill.expToNext = dataSkillExpToNext(skill.level);
            skill.exp = Math.max(0, Math.min(skill.expToNext, skill.exp));
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

/**
 * T2 zone/aura blurb for the inspector (replaces the plain Dmg% on the
 * tier-2 row): `Zone 4s · ~40%/s · r3` or `Aura 5s · HoT ~6%/s · follows`.
 */
export function skillZoneBlurb(charClass: CharacterClass, skill: Skill): string | null {
  if (skillTier(skill) !== 2) return null;
  const zone = CLASS_KITS[charClass]?.skillTemplates[1]?.zone;
  if (!zone) return null;
  if (zone.kind === 'radiance' || zone.kind === 'hymn') {
    const pct = Math.round((zone.hotMaxFrac ?? 0) * 100);
    const extra = zone.kind === 'hymn' ? ' + Encore' : '';
    return `Aura ${zone.durationSec}s · HoT ~${pct}%/s${extra} · follows`;
  }
  const pct = Math.round(zone.tickFrac * 100);
  if (zone.kind === 'consecration') {
    return `Aura ${zone.durationSec}s · ~${pct}%/s + shield · follows`;
  }
  return `Zone ${zone.durationSec}s · ~${pct}%/s · r${zone.radius}`;
}
