// Hunter-brain tuning knobs (persisted, live-tunable from World Config)
// + runtime field-party shape. Pure: no simulation state.

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
  dangerHits: 7, // TTK tune: was 6
  grayGap: 3,
  huntBaseline: 0.5,
  tavernMood: 65,
  partiesEnabled: true,
};

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

// Hunter level cap (dungeon gate): gainExp banks nothing at/above this.
// Lives here (not simulation) so the hunter brain module can use it
// without a runtime import cycle back into simulation.
export const HUNTER_LEVEL_CAP = 15;

/** Spawn multipliers for a difficulty level 1-10 (5 = standard 1x). */
export function difficultyMultipliers(level: number): { hp: number; atk: number; def: number; reward: number } {
  const lv = Number.isFinite(level) ? Math.max(1, Math.min(10, Math.round(level))) : 5;
  return {
    hp: 0.5 + lv * 0.1,
    atk: 0.55 + lv * 0.09,
    def: 0.7 + lv * 0.06,
    reward: 0.7 + lv * 0.06,
  };
}
