// Monster roster: one archetype row per monster type. To add a monster,
// add a row here (and its sprite in art/) — spawn scaling, drops, and AI
// stay untouched in simulation.

import type { ItemDrop } from '../types';
import type { Monster, MonsterType } from '../types';

export type { MonsterType };
export type MonsterDensity = 'sparse' | 'normal' | 'swarming'; // legacy preset, migrated to monsterPopulation on load

export interface MonsterArchetype {
  type: MonsterType;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  expReward: number;
  goldReward: number;
  dropName: string;
  dropIcon: ItemDrop['iconType'];
  isBoss?: boolean;
}

export const MONSTER_ARCHETYPES: Record<MonsterType, MonsterArchetype> = {
  slime: {
    type: 'slime',
    name: 'Emerald Slime',
    level: 1,
    hp: 78, // TTK tune: 60->78 (+30%)
    atk: 14,
    def: 3,
    expReward: 16,
    goldReward: 9,
    dropName: 'Slime Essence',
    dropIcon: 'magic_orb',
  },
  goblin: {
    type: 'goblin',
    name: 'Goblin Scavenger',
    level: 3,
    hp: 124, // TTK tune: 95->124 (+30%)
    atk: 22,
    def: 4,
    expReward: 25,
    goldReward: 16,
    dropName: 'Goblin Horn',
    dropIcon: 'horn',
  },
  wolf: {
    type: 'wolf',
    name: 'Shadow Wolf',
    level: 5,
    hp: 250, // TTK tune: 144->250
    atk: 33,
    def: 6,
    expReward: 38,
    goldReward: 23,
    dropName: 'Dire Wolf Pelt',
    dropIcon: 'pelt',
  },
  skeleton: {
    type: 'skeleton',
    name: 'Undead Skeleton',
    level: 6,
    hp: 331, // TTK tune: 190->331 (same x1.744 ratio as ghoul 258->450)
    atk: 38,
    def: 10,
    expReward: 50,
    goldReward: 31,
    dropName: 'Curse Bone',
    dropIcon: 'bone',
  },
  ghoul: {
    type: 'ghoul',
    name: 'Graveyard Ghoul',
    level: 8,
    hp: 450, // TTK tune: 258->450
    atk: 47,
    def: 12,
    expReward: 73,
    goldReward: 45,
    dropName: 'Venom Fang',
    dropIcon: 'fang',
  },
  wight: {
    type: 'wight',
    name: 'Grave Wight',
    level: 9,
    hp: 520, // TTK tune: 300->520
    atk: 55,
    def: 14,
    expReward: 90,
    goldReward: 55,
    dropName: 'Wight Shard',
    dropIcon: 'bone',
  },
  drake: {
    type: 'drake',
    name: 'Magma Drake',
    level: 12,
    hp: 800, // TTK tune: 477->800
    atk: 78,
    def: 23,
    expReward: 150,
    goldReward: 107,
    dropName: 'Dragon Scale',
    dropIcon: 'dragon_scale',
  },
  golem: {
    type: 'golem',
    name: 'Magma Golem',
    level: 14,
    hp: 1100, // TTK tune: 650->1100
    atk: 95,
    def: 28,
    expReward: 220,
    goldReward: 150,
    dropName: 'Magma Core',
    dropIcon: 'dragon_scale',
  },
  boss_lich: {
    type: 'boss_lich',
    name: '☠ EVIL LICH LORD ☠',
    level: 15,
    hp: 2600, // TTK tune: 1500->2600
    atk: 95,
    def: 28,
    expReward: 450,
    goldReward: 350,
    dropName: 'Dark Nether Orb',
    dropIcon: 'magic_orb',
    isBoss: true,
  },
  // Dungeon trash (zone 4): exact phase-3 stat blocks. Difficulty +
  // director scaling apply via the shared spawn path in simulation.
  vault_husk: {
    type: 'vault_husk',
    name: 'Vault Husk',
    level: 13,
    hp: 520,
    atk: 85,
    def: 24,
    expReward: 170,
    goldReward: 120,
    dropName: 'Husk Bone',
    dropIcon: 'bone',
  },
  rune_warden: {
    type: 'rune_warden',
    name: 'Rune Warden',
    level: 14,
    hp: 640,
    atk: 95,
    def: 28,
    expReward: 210,
    goldReward: 150,
    dropName: 'Cracked Rune',
    dropIcon: 'magic_orb',
  },
  vault_lord: {
    type: 'vault_lord',
    name: 'Vault Lord',
    level: 15,
    hp: 800,
    atk: 105,
    def: 32,
    expReward: 280,
    goldReward: 200,
    dropName: 'Vault Sigil',
    dropIcon: 'dragon_scale',
  },
  // Dungeon bosses (zone 4, isBoss): exact phase-3 stat blocks. EXP/gold
  // scale up from the Lich baseline by tier; the epic itself is the prize.
  boss_warden: {
    type: 'boss_warden',
    name: 'Crypt Warden',
    level: 15,
    hp: 1800,
    atk: 110,
    def: 32,
    expReward: 500,
    goldReward: 400,
    dropName: "Warden's Seal",
    dropIcon: 'magic_orb',
    isBoss: true,
  },
  boss_hoarder: {
    type: 'boss_hoarder',
    name: 'Hoarder of the Deep',
    level: 16,
    hp: 2400,
    atk: 125,
    def: 36,
    expReward: 650,
    goldReward: 550,
    dropName: 'Hoarder Cache',
    dropIcon: 'dragon_scale',
    isBoss: true,
  },
  boss_primus: {
    type: 'boss_primus',
    name: 'Dungeon Primus',
    level: 17,
    hp: 3200,
    atk: 145,
    def: 42,
    expReward: 850,
    goldReward: 750,
    dropName: 'Primus Crown',
    dropIcon: 'magic_orb',
    isBoss: true,
  },
};

/** Display label for any monster: `Lv.{level} {name}`. Pure (no DOM). */
export function monsterLabel(m: Monster): string {
  return `Lv.${m.level} ${m.name}`;
}
