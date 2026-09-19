import type { Equipment } from './equipment';

export type CharacterClass = 'Berserker' | 'Ranger' | 'Sorcerer' | 'Paladin' | 'Cleric' | 'Bard';

export type HunterState =
  | 'SPAWNING'
  | 'REGISTERING'
  | 'WANDERING_TOWN'
  | 'LOOKING_FOR_PARTY'
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

export interface Hunter {
  id: string;
  name: string;
  charClass: CharacterClass;
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

  // Plaza LFP muster cooldown (sim-seconds): set to 90 after a 12s LFP
  // wait times out with no match, gating re-queue. Defaults 0.
  lfpCooldown: number;

  // Equipment & Inventory
  weapon: Equipment;
  armor: Equipment;
  accessory: Equipment;
  inventory: import('./loot').ItemDrop[];
  maxInventorySlots: number;

  // Skills (usage-based EXP: cast to gain EXP, promote at Academy)
  skills: import('./skill').Skill[];

  // Needs & morale (Hunters Town style)
  mood: number; // 0 - 100: drops when monsters land hits, scales ATK/DEF
  moraleBoost: number; // bonus ATK fraction from tavern drinks (0 = none)
  moraleBoostTimer: number; // seconds remaining on the morale buff
  elixirs: number; // alchemy brews auto-drunk in combat at low HP
  tonics: number; // carried buff tonics (+20% ATK for 60s, drunk at fight start)
  tonicBoost: number; // active tonic ATK fraction (0.20 while buffed, else 0)
  tonicBoostTimer: number; // seconds remaining on the tonic buff
  encoreBoost: number; // bonus ATK fraction from Bard Encore Anthem (0 = none)
  encoreTimer: number; // seconds remaining on the Encore buff
  goldFeverTimer: number; // seconds remaining on Bard Golden Finale loot buff
  deaths: number; // times knocked down and rescued by the clinic

  // Paladin tank kit (transient, never drives saves): absorb shield + taunt anchor.
  // shieldHp absorbs incoming monster damage first; shieldTimer ticks down in updateHunterAI.
  shieldHp: number;
  shieldTimer: number;

  // Visual animation timers
  animFrame: number;
  animTick: number;
  isAttacking: boolean;
  attackAnimTimer: number;
  killCount: number;
}
