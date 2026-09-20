import type { ItemDrop } from './loot';

export interface Monster {
  id: string;
  name: string;
  zone: 1 | 2 | 3 | 4;
  type: 'slime' | 'goblin' | 'wolf' | 'skeleton' | 'ghoul' | 'wight' | 'drake' | 'golem' | 'boss_thorn' | 'boss_revenant' | 'boss_lich' | 'boss_warden' | 'boss_hoarder' | 'boss_primus';
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

  // Optional roam anchor: when set, updateMonsterRoam picks stroll
  // destinations inside this box instead of the zone roam bounds.
  // Dungeon bosses use it to hold their arena (white floor).
  anchorGx?: number;
  anchorGy?: number;
  anchorRadius?: number;

  // Paladin taunt lock (transient, runtime-only): forces targetHunterId to the
  // taunting Paladin until tauntTimer (sim-seconds) expires. Cleared on leash,
  // knockdown, or invalid taunter.
  tauntHunterId: string | null;
  tauntTimer: number;

  isBoss?: boolean;
  animFrame: number;
  animTick: number; // accumulates dt to advance animFrame (tick-driven, not wall-clock)
  attackAnimTimer: number; // 0.35 -> 0 lunge window after a monster lands a hit
}

export type MonsterType = Monster['type'];
export type ZoneId = 1 | 2 | 3 | 4;
