// Hunter brain: autonomous decision-making for hunters (targeting, needs,
// parties, dungeon routing, and the per-tick state machine). Extracted
// from GameSimulation so behavior can be reasoned about in one place.
//
// Ownership rule: the brain DECIDES (reads world, sets hunter targets and
// states); the simulation ACTS (moves, fights, trades, saves) and OWNS all
// world state. The brain never mutates world collections directly — it goes
// through sim methods. Import direction is type-only toward simulation
// (no runtime cycle): values come from ./data, ./dungeon, ./isometric.

import type { GameSimulation } from './simulation';
import type { Hunter, Monster, Building } from './types';
import type { Party } from './data';
import { gridDistance } from './isometric';
import { soundFx } from './audioSynth';
import {
  HUNTER_LEVEL_CAP,
  TOWN_GATE_POS,
  SOUTH_GATE_POS,
  hasAffordableReadySkill,
  cheapestReadyCost,
} from './data';
import {
  DUNGEON_PORTAL,
  DUNGEON_STAGING,
  DUNGEON_EXIT,
  DUNGEON_EJECT,
  LOBBY_SEATS,
  lobbySeatFits,
  lobbySeatPositions,
} from './dungeon';

/**
 * HunterBrain: pure-ish decision layer over a GameSimulation. Constructed
 * once per sim (`sim.brain`); every method takes the acting hunter plus
 * tick dt and issues orders via sim primitives (moveTowards, routeTo…,
 * addLog, addFloatingText) and hunter state/target fields.
 */
export class HunterBrain {
  constructor(private sim: GameSimulation) {}

  // --------------------------------------------------------------------------
  // Targeting scoring: danger lens, party lenses, zone bands.
  // --------------------------------------------------------------------------

  /** Count of live party members (1 when solo). Never counts the missing. */
  livePartySize(hunter: Hunter): number {
    if (!hunter.partyId) return 1;
    const p = this.sim.parties.get(hunter.partyId);
    if (!p) return 1;
    let n = 0;
    for (const id of p.memberIds) {
      if (this.sim.hunters.some(h => h.id === id)) n++;
    }
    return Math.max(1, n);
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
  isTooHardFor(monster: Monster, hunter: Hunter, partySizeOverride?: number): boolean {
    if (monster.level > hunter.level + 4) return true;
    const size = partySizeOverride ?? (this.sim.agentConfig.partiesEnabled ? this.livePartySize(hunter) : 1);
    const mult = 1 + 0.25 * Math.max(0, size - 1);
    const estHit = monster.atk - this.sim.effectiveDef(hunter) * mult * 0.65; // TTK tune: 0.5->0.65
    if (estHit <= 0) return false;
    // Tank lens: live shield counts as HP, and Paladins hold the line longer
    // (danger threshold -2 hits, floor 2) so the anchor doesn't bounce off
    // fights it is built to soak.
    const shield = typeof hunter.shieldHp === 'number' && Number.isFinite(hunter.shieldHp) ? Math.max(0, hunter.shieldHp) : 0;
    const effectiveHp = (hunter.hp + shield + 0.35 * this.sim.effectiveMaxHp(hunter) * hunter.elixirs) * mult;
    const bravery = hunter.charClass === 'Paladin' ? Math.max(2, this.sim.agentConfig.dangerHits - 2) : this.sim.agentConfig.dangerHits;
    return effectiveHp / estHit < bravery;
  }

  /** HP fraction that triggers a clinic retreat — Paladins hold to 15%. */
  retreatHpFracFor(hunter: Hunter): number {
    if (hunter.charClass === 'Paladin') return Math.min(this.sim.agentConfig.retreatHpFrac, 0.15);
    return this.sim.agentConfig.retreatHpFrac;
  }

  /** True when the hunter could actually improve in town (gear or training). */
  canImproveInTown(hunter: Hunter): boolean {
    return this.sim.canAffordForgeUpgrade(hunter) || hunter.skills.some(s => s.level < s.maxLevel && s.exp >= s.expToNext);
  }

  /**
   * Count of live party members (incl. self; solo = self only) for whom a
   * kill on this monster would pay positive EXP: boss always pays, else
   * member levelDiff (member.level - monster.level) < grayGap. Diminished
   * (G-2/G-1) still counts as paying — only fully gray (diff >= G) does not.
   */
  earningCountFor(monster: Monster, hunter: Hunter): number {
    const party = this.sim.agentConfig.partiesEnabled ? this.sim.partyOf(hunter) : null;
    const members = party ? this.sim.partyMembers(hunter) : [hunter];
    const list = members.length > 0 ? members : [hunter];
    const G = this.sim.agentConfig.grayGap;
    let n = 0;
    for (const m of list) {
      if (monster.isBoss || m.level - monster.level < G) n++;
    }
    return n;
  }

  /**
   * Max-level boss focus: true when the hunter is capped, or when at
   * least half its live party (incl. self) is capped. Focused hunters
   * treat field bosses as party prey — the endgame goal once EXP stops.
   */
  bossFocusFor(hunter: Hunter): boolean {
    if (hunter.level >= HUNTER_LEVEL_CAP) return true;
    if (!this.sim.agentConfig.partiesEnabled) return false;
    const party = this.sim.partyOf(hunter);
    if (!party) return false;
    const members = this.sim.partyMembers(hunter);
    const list = members.length > 0 ? members : [hunter];
    const capped = list.filter(m => m.level >= HUNTER_LEVEL_CAP).length;
    return capped * 2 >= list.length && list.length > 0;
  }

  /** Level-appropriate hunting zone: Lv11+ volcano, Lv6+ crypt, else forest. */
  preferredZone(level: number): 1 | 2 | 3 {
    if (level >= 11) return 3;
    if (level >= 6) return 2;
    return 1;
  }

  // --------------------------------------------------------------------------
  // Prey selection: best-match targeting, desperation, dead-end detection.
  // --------------------------------------------------------------------------

  findBestMonsterForHunter(hunter: Hunter, ignoreClaims = false): Monster | null {
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
    // Max-level boss goal: capped hunters (or half-capped parties) subtract
    // 14 for field bosses and halve the travel distance, so endgame groups
    // raid live region bosses — even cross-zone — over gray volcano trash.
    // Dungeon mobs stay teleport-only.
    let zone: 1 | 2 | 3 = 1;
    if (hunter.level >= 11) zone = 3;
    else if (hunter.level >= 6) zone = 2;
    const bossFocus = this.bossFocusFor(hunter);

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
        // Boss-goal: -14 for field bosses under max-level focus, with
        // travel halved (d*0.5) — the march is the quest, so capped
        // groups raid live region bosses over grinding local gray trash.
        let claimants = 0;
        if (!ignoreClaims) {
          for (const h of this.sim.hunters) {
            if (h.id !== hunter.id && h.targetMonsterId === m.id) {
              // Party focus fire: packmates converging on shared prey exert
              // no spread pressure — the uncapped ×0.6 pile-up once exiled
              // the 5th delver onto a far boss (then party-follow dragged
              // the whole party past its boss, doing nothing). Solo hunters
              // still spread off everyone (partyId null never matches).
              if (h.partyId && h.partyId === hunter.partyId) continue;
              claimants++;
            }
          }
        }
        const isGoalBoss = bossFocus && m.isBoss && m.zone !== 4;
        const bossPull = isGoalBoss ? 14 : 0;
        const scoredD = isGoalBoss ? d * 0.5 : d;
        const score = (Math.abs(m.level - hunter.level) * 3 + scoredD) * (1 + 0.6 * claimants) - 2.5 * this.earningCountFor(m, hunter) - bossPull;
        if (score < bestScore) {
          bestScore = score;
          best = m;
        }
      }
      return best;
    };

    const candidates = this.sim.monsters.filter(m => m.zone === zone && m.hp > 0);
    const fairInZone = candidates.filter(m => !this.isTooHardFor(m, hunter));
    // Vault lock: delvers inside the dungeon ONLY ever see interior prey.
    // Without this a delver whose boss reads too-hard solo-lens would be
    // handed a volcano target across the sealed wall — and with solid-wall
    // collision that means pushing stone forever instead of phasing (both
    // bad; the right answer is hold/wander inside until extraction).
    const inVault = this.sim.zoneOf(hunter.gx, hunter.gy) === 4;
    if (inVault) {
      const inside = this.sim.monsters.filter(m => m.zone === 4 && m.hp > 0 && !this.isTooHardFor(m, hunter));
      return nearestIn(inside); // null when empty (empty list → no pick)
    }
    // Boss-goal cross-zone pull: focused hunters also weigh live field
    // bosses anywhere (forest/crypt/volcano), so a capped volcano group
    // detours for a Revenant/Thornmother instead of grinding gray trash.
    if (bossFocus) {
      const seen = new Set(fairInZone.map(m => m.id));
      for (const m of this.sim.monsters) {
        if (m.hp <= 0 || !m.isBoss || m.zone === 4 || seen.has(m.id)) continue;
        if (this.isTooHardFor(m, hunter)) continue;
        seen.add(m.id);
        fairInZone.push(m);
      }
    }
    if (fairInZone.length > 0) return nearestIn(fairInZone);

    // Fallback to the best-matched fair fight anywhere (refuse suicide runs).
    // Vault hunters returned above; outsiders never route at vault mobs —
    // entry is teleport-only, so no one may target across the sealed wall.
    const anyFair = this.sim.monsters.filter(m => m.hp > 0 && !this.isTooHardFor(m, hunter) && m.zone !== 4);
    return anyFair.length > 0 ? nearestIn(anyFair) : null;
  }

  /**
   * Desperation pick: the least-dangerous living monster (highest hits-
   * to-die). Used when no fair fight exists and town can't help — a bad
   * fight beats pacing forever, and losses feed the director + clinic loop.
   */
  findDesperateTarget(hunter: Hunter): Monster | null {
    let best: Monster | null = null;
    let bestScore = -Infinity;
    const inDungeon = this.sim.zoneOf(hunter.gx, hunter.gy) === 4;
    for (const m of this.sim.monsters) {
      if (m.hp <= 0) continue;
      // Teleport-only entry: outsiders never desperation-pick vault mobs,
      // and delvers never desperation-pick OUT (solid walls — no path).
      if (m.zone === 4 && !inDungeon) continue;
      if (m.zone !== 4 && inDungeon) continue;
      const estHit = m.atk - this.sim.effectiveDef(hunter) * 0.65; // TTK tune: 0.5->0.65
      const hitsToDie = estHit <= 0 ? 999 : hunter.hp / estHit; // hits-to-die
      // Spread hunters across prey: discount already-claimed monsters so
      // desperate picks don't all pile onto the same least-bad fight.
      let claimants = 0;
      for (const h of this.sim.hunters) {
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
  onlyHardTargetsRemain(hunter: Hunter): boolean {
    return this.sim.monsters.some(m => m.hp > 0) && this.findBestMonsterForHunter(hunter) === null;
  }

  // --------------------------------------------------------------------------
  // Movement intent: where the hunter wants to go next (orders, not steps).
  // The sim owns the actual stepping (A* + wall collision).
  // --------------------------------------------------------------------------

  /**
   * Route a hunter straight to a building's door. A* pathfinding threads
   * the nearest region gate automatically, so no Town Gate detour is needed
   * (hunters used to muster at the gate first — a pre-walls leftover).
   */
  routeToBuilding(hunter: Hunter, building: Building) {
    this.sim.removeFromParty(hunter); // field-only parties end at town entry
    hunter.state = 'RETURNING_TO_TOWN';
    hunter.targetBuildingId = building.id;
    hunter.targetGx = building.doorGx;
    hunter.targetGy = building.doorGy;
    hunter.stateTimer = 0;
  }

  /** Nearest town gate (East or South) to a grid position. */
  nearestGate(gx: number, gy: number): { gx: number; gy: number } {
    const dEast = Math.hypot(gx - TOWN_GATE_POS.gx, gy - TOWN_GATE_POS.gy);
    const dSouth = Math.hypot(gx - SOUTH_GATE_POS.gx, gy - SOUTH_GATE_POS.gy);
    return dSouth < dEast ? { ...SOUTH_GATE_POS } : { ...TOWN_GATE_POS };
  }

  /**
   * Transit to the town plaza with no building target. The RETURNING
   * null-target arrival fans out through evaluateTownNeeds so one town
   * visit covers every errand.
   */
  returnToPlaza(hunter: Hunter) {
    this.sim.removeFromParty(hunter); // field-only parties end at town entry
    hunter.state = 'RETURNING_TO_TOWN';
    hunter.targetBuildingId = null;
    hunter.targetGx = 29;
    hunter.targetGy = 29;
    hunter.stateTimer = 0;
  }

  /** March out: stage at the NEAREST town gate, then pick prey from there. */
  marchOutToHunt(hunter: Hunter) {
    const gate = this.nearestGate(hunter.gx, hunter.gy);
    hunter.state = 'TRAVELING_TO_HUNT';
    hunter.targetGx = gate.gx;
    hunter.targetGy = gate.gy;
  }

  /** Leave town for the hunt: head straight at known prey via A*; only
   *  stage at the nearest gate when the field is completely empty. */
  leaveForHunt(hunter: Hunter) {
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
    // Vault hold: no prey at all inside — wander the interior, never march
    // out through the sealed wall (extraction runs via the exit portal).
    if (this.sim.zoneOf(hunter.gx, hunter.gy) === 4) {
      hunter.targetMonsterId = null;
      hunter.state = 'HUNTING';
      hunter.targetGx = 2 + Math.random() * 15;
      hunter.targetGy = 24 + Math.random() * 31;
      return;
    }
    this.marchOutToHunt(hunter);
  }

  returnToTownToSell(hunter: Hunter) {
    const tradingPost = this.sim.buildings.find(b => b.type === 'TRADING_POST');
    if (!tradingPost) return;
    this.routeToBuilding(hunter, tradingPost);
  }

  returnToAcademy(hunter: Hunter) {
    const academy = this.sim.buildings.find(b => b.type === 'TRAINING_ACADEMY');
    if (!academy) return;
    this.routeToBuilding(hunter, academy);
  }

  returnToBlacksmith(hunter: Hunter) {
    const blacksmith = this.sim.buildings.find(b => b.type === 'BLACKSMITH');
    if (!blacksmith) return;
    this.routeToBuilding(hunter, blacksmith);
  }

  returnToTavern(hunter: Hunter) {
    const tavern = this.sim.buildings.find(b => b.type === 'TAVERN');
    if (!tavern) return;
    this.routeToBuilding(hunter, tavern);
    this.sim.addFloatingText('🍺 Heading to Tavern (low mood)', hunter.gx, hunter.gy, '#fdba74', 11);
  }

  retreatToTown(hunter: Hunter, reason: string) {
    const clinic = this.sim.buildings.find(b => b.type === 'CLINIC');
    if (!clinic) return;
    this.routeToBuilding(hunter, clinic);
    this.sim.addFloatingText(`🏃 Fleeing to Clinic (${reason})`, hunter.gx, hunter.gy, '#fda4af', 11);
  }

  // --------------------------------------------------------------------------
  // Needs: utility scoring (town hub) — every errand returns [0,1].
  // --------------------------------------------------------------------------

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
  scoreNeeds(hunter: Hunter): {
    sell: number; tavern: number; lab: number; forge: number;
    academy: number; clinic: number; transit: number; hunt: number;
  } {
    const bagU = hunter.inventory.length / Math.max(1, hunter.maxInventorySlots);
    const hpU = hunter.hp / Math.max(1, this.sim.effectiveMaxHp(hunter));
    const moodU = (hunter.mood ?? 100) / 100;
    // town-shop availability (mirror door/purchase gates exactly)
    const lab = this.sim.buildings.find(b => b.type === 'ALCHEMY_LAB');
    const forge = this.sim.buildings.find(b => b.type === 'BLACKSMITH');
    const elixirNeed = Math.max(0, this.sim.elixirCapacity() - hunter.elixirs);
    const labOk = lab && elixirNeed > 0 && hunter.gold >= (15 + lab.level * 5) && this.sim.totalMaterials() >= 1;
    const tonicNeed = Math.max(0, this.sim.tonicCapacity() - hunter.tonics);
    const tonicOk = lab && tonicNeed > 0 && hunter.gold >= (20 + lab.level * 5) && this.sim.totalMaterials() >= 1;
    const forgeOk = forge && this.sim.totalMaterials() >= 2 && this.sim.canAffordForgeUpgrade(hunter);
    const tavernFrac = this.sim.agentConfig.tavernMood / 100;
    return {
      sell: hunter.inventory.length >= hunter.maxInventorySlots ? 1.0 : bagU * bagU * 0.4,
      tavern: moodU < tavernFrac ? (tavernFrac - moodU) / tavernFrac : 0,            // town: <tavernMood goes, lower = more urgent
      lab: (labOk || tonicOk) ? 0.2 + 0.6 * Math.max(elixirNeed / Math.max(1, this.sim.elixirCapacity()), tonicNeed / Math.max(1, this.sim.tonicCapacity())) : 0,
      forge: forgeOk ? 0.5 : 0,
      academy: hasAffordableReadySkill(hunter) ? 0.45 : 0,  // NEVER beats a healthy hunt alone; 0 when broke (no academy death-loop)
      clinic: hpU < 0.7 ? (0.7 - hpU) / 0.7 : 0,
      transit: 0,   // filled by caller (field only)
      hunt: this.sim.agentConfig.huntBaseline,    // baseline: needs must earn the interruption
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
  evaluateTownNeeds(hunter: Hunter) {
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
        const clinic = this.sim.buildings.find(b => b.type === 'CLINIC');
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
        const lab = this.sim.buildings.find(b => b.type === 'ALCHEMY_LAB');
        if (lab) {
          this.routeToBuilding(hunter, lab);
        } else {
          this.leaveForHunt(hunter);
        }
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Parties: LFP muster + matching. The brain forms parties; the sim owns
  // membership CRUD (partyOf/partyMembers/removeFromParty/disbandParty)
  // because combat and knockdown share it.
  // --------------------------------------------------------------------------

  /**
   * Crowding trigger: hunters-per-fair-monster in the hunter's zone above
   * 1.5 (counts HUNTING/FIGHTING hunters vs alive fair-for-them monsters).
   */
  isCrowdedFor(hunter: Hunter): boolean {
    const z = this.sim.zoneOf(hunter.gx, hunter.gy);
    if (z < 1) return false;
    let hunters = 0;
    for (const o of this.sim.hunters) {
      if ((o.state === 'HUNTING' || o.state === 'FIGHTING') && this.sim.zoneOf(o.gx, o.gy) === z) hunters++;
    }
    let fair = 0;
    for (const m of this.sim.monsters) {
      if (m.hp > 0 && m.zone === z && !this.isTooHardFor(m, hunter)) fair++;
    }
    return fair > 0 && hunters / fair > 1.5;
  }

  /**
   * Ambition trigger: the best pref-zone prey is too hard solo (danger
   * recomputed WITHOUT the party bonus) but fair WITH a full party bonus.
   */
  isAmbitiousFor(hunter: Hunter): boolean {
    const pref = this.preferredZone(hunter.level);
    let best: Monster | null = null;
    let bestDist = Infinity;
    for (const m of this.sim.monsters) {
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
  runPartyFormation() {
    if (!this.sim.agentConfig.partiesEnabled) return;
    // 0. Reroute motivated solo field hunters to the plaza muster.
    // Motivation is snapshotted for all seekers BEFORE rerouting, so the
    // first departure can't un-crowd the zone for the rest of the pack.
    // Vault delvers never muster: the gate is sealed and walls are solid,
    // so a plaza reroute would march them at stone for 12s. Shed parties
    // (knockdown warp-outs) hold their boss via holdDelver instead.
    const seekers = this.sim.hunters.filter(h =>
      h.partyId == null && (h.state === 'HUNTING' || h.state === 'FIGHTING' || h.state === 'TRAVELING_TO_HUNT') &&
      this.sim.zoneOf(h.gx, h.gy) !== 4);
    const motivated = seekers.filter(h => (h.lfpCooldown ?? 0) <= 0 && (this.isCrowdedFor(h) || this.isAmbitiousFor(h)));
    for (const s of motivated) {
      if (gridDistance(s.gx, s.gy, 29, 29) < 1.5) continue; // already at plaza
      s.state = 'LOOKING_FOR_PARTY';
      s.targetMonsterId = null;
      s.targetBuildingId = null;
      s.targetGx = 29;
      s.targetGy = 29;
      s.stateTimer = 12; // LFP wait budget (sim-seconds)
      this.sim.addFloatingText('🔍 Seeking party!', s.gx, s.gy, '#67e8f9', 11);
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
  matchLfpSeekers() {
    // Candidates: arrived plaza LFP waiters plus motivated solo field
    // hunters already standing at the plaza (routing skips them, but they
    // are physically at the muster and must never stick unmatched).
    const atPlaza = (h: Hunter) => gridDistance(h.gx, h.gy, 29, 29) <= 3;
    const lfp = this.sim.hunters.filter(h => h.state === 'LOOKING_FOR_PARTY' && h.partyId == null && atPlaza(h));
    const atPlazaMotivated = this.sim.hunters.filter(h =>
      h.partyId == null &&
      (h.state === 'HUNTING' || h.state === 'FIGHTING' || h.state === 'TRAVELING_TO_HUNT') &&
      atPlaza(h) &&
      (this.isCrowdedFor(h) || this.isAmbitiousFor(h)));
    const pool = [...lfp, ...atPlazaMotivated];
    if (pool.length === 0) return;
    const unplaced = new Set(pool.map(h => h.id));

    // 1. Fill existing parties first (same preferredZone, leader level ±4, cap 5).
    for (const p of this.sim.parties.values()) {
      const live = p.memberIds
        .map(id => this.sim.hunters.find(h => h.id === id))
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
        this.sim.parties.set(id, { id, leaderId: leader.id, memberIds: ordered.map(h => h.id), lootTurn: 0 });
        for (const m of ordered) m.partyId = id;
        const names = ordered.map(h => h.name.split(' ')[0]);
        this.sim.addLog('combat', `${names.slice(0, 2).join(', ')} formed a party (${ordered.length})!`, leader.name);
        for (const m of ordered) this.leaveForHunt(m);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Dungeon routing: lobby muster, delver hold, exit portal. The sim owns
  // the instance itself (entry checks, spawning, wipe, lockout).
  // --------------------------------------------------------------------------

  /**
   * Dungeon portal hook (wired — one-line call from the town-hub leave
   * path in evaluateTownNeeds): an idle max-level hunter with nothing
   * better to do gathers at the town portal instead of the field while
   * the instance is dormant. Returns true when routed lobby-side. Inert
   * otherwise (underleveled, dungeon busy, re-queue cooling down, parties
   * off) — normal and no-freeze flows never qualify.
   */
  maybeEnterLobby(hunter: Hunter): boolean {
    if (!this.sim.agentConfig.partiesEnabled) return false;
    if (hunter.level < HUNTER_LEVEL_CAP) return false;
    if (this.sim.dungeon.state !== 'dormant') return false;
    if ((hunter.lfpCooldown ?? 0) > 0) return false;
    this.sim.removeFromParty(hunter); // field-only parties end at the portal
    hunter.state = 'DUNGEON_LOBBY';
    hunter.targetMonsterId = null;
    hunter.targetBuildingId = null;
    hunter.targetGx = DUNGEON_PORTAL.x;
    hunter.targetGy = DUNGEON_PORTAL.y;
    hunter.stateTimer = 90; // lobby wait budget (sim-seconds)
    this.sim.addFloatingText('🌀 Awaiting the Vault!', hunter.gx, hunter.gy, '#c4b5fd', 11);
    return true;
  }

  /** Live lobby entry for a hunter, if seated. */
  lobbySeatOf(hunterId: string): { hunterId: string; seatIndex: number } | null {
    return this.sim.lobby.find(e => e.hunterId === hunterId) ?? null;
  }

  /** Release a hunter's lobby seat (no-op when not seated). */
  releaseLobbySeat(hunter: Hunter) {
    const i = this.sim.lobby.findIndex(e => e.hunterId === hunter.id);
    if (i >= 0) this.sim.lobby.splice(i, 1);
  }

  /**
   * Claim the first free seat (all seats open — any class fits; one seat
   * per hunter). Returns the seat index, or null when the lobby is full.
   */
  claimLobbySeat(hunter: Hunter): number | null {
    const existing = this.lobbySeatOf(hunter.id);
    if (existing) return existing.seatIndex;
    const taken = new Set(this.sim.lobby.map(e => e.seatIndex));
    for (let i = 0; i < LOBBY_SEATS.length; i++) {
      if (taken.has(i)) continue;
      if (!lobbySeatFits(LOBBY_SEATS[i].role, hunter.charClass)) continue;
      this.sim.lobby.push({ hunterId: hunter.id, seatIndex: i });
      return i;
    }
    return null;
  }

  /**
   * Portal-lobby full-house check (tick, after the hunter loop): when all
   * 5 seats are held by live DUNGEON_LOBBY hunters, form them into a party
   * (leader = highest level) and admit via tryEnterDungeon — teleporting
   * to the dungeon staging ONLY on admit. A refusal dissolves the
   * just-formed party and leaves everyone seated (DON'T teleport).
   */
  tickLobbyTeleport() {
    if (!this.sim.agentConfig.partiesEnabled) return;
    if (this.sim.dungeon.state !== 'dormant') return;
    if (this.sim.lobby.length !== LOBBY_SEATS.length) return;
    const seated: Hunter[] = [];
    for (let i = 0; i < LOBBY_SEATS.length; i++) {
      const e = this.sim.lobby.find(x => x.seatIndex === i);
      const h = e ? this.sim.hunters.find(hh => hh.id === e.hunterId) : undefined;
      if (!h || h.hp <= 0 || h.state !== 'DUNGEON_LOBBY') return;
      if (!lobbySeatFits(LOBBY_SEATS[i].role, h.charClass)) return;
      seated.push(h);
    }
    const leader = seated.reduce((a, b) => (b.level > a.level ? b : a));
    const id = `party-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.sim.parties.set(id, { id, leaderId: leader.id, memberIds: seated.map(h => h.id), lootTurn: 0 });
    for (const h of seated) h.partyId = id;
    if (this.sim.tryEnterDungeon(id) !== null) {
      this.sim.disbandParty(id);
      return;
    }
    this.sim.lobby = this.sim.lobby.filter(e => !seated.some(h => h.id === e.hunterId));
    seated.forEach((h, i) => {
      h.gx = DUNGEON_STAGING.x + (i % 3) - 1;
      h.gy = DUNGEON_STAGING.y + Math.floor(i / 3);
      h.targetBuildingId = null;
      let best: Monster | null = null;
      let bestDist = Infinity;
      for (const mob of this.sim.monsters) {
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
      h.stateTimer = 0; // drop the leftover lobby wait budget (swing gate)
    });
    this.sim.addFloatingText('🌀 The party descends!', DUNGEON_STAGING.x, DUNGEON_STAGING.y, '#c4b5fd', 16);
  }

  /**
   * Delver hold (dungeon fix): a tracked delver standing in the vault
   * while its run is live never takes errands — boss loot rides in bags
   * until extraction. Retargets the nearest live zone-4 boss and holds
   * HUNTING. Returns true when it held (caller breaks for the tick).
   * Wired into FIGHTING post-kill and HUNTING no-target routing: without
   * it the first boss's loot triggers sell/forge trips that phase through
   * the sealed wall, stranding the run at 1/3 with the gate `active`
   * forever (teleport-only entry, no way back in).
   */
  holdDelverInVault(hunter: Hunter): boolean {
    if (this.sim.dungeon.state !== 'active') return false;
    if (!(this.sim.dungeon.partyIds ?? []).includes(hunter.id)) return false;
    if (this.sim.zoneOf(hunter.gx, hunter.gy) !== 4) return false;
    let best: Monster | null = null;
    let bestDist = Infinity;
    for (const mob of this.sim.monsters) {
      if (mob.hp <= 0 || mob.zone !== 4) continue;
      const d = gridDistance(hunter.gx, hunter.gy, mob.gx, mob.gy);
      if (d < bestDist) { bestDist = d; best = mob; }
    }
    if (!best) return false;
    hunter.targetMonsterId = best.id;
    hunter.targetGx = best.gx;
    hunter.targetGy = best.gy;
    hunter.state = 'HUNTING';
    hunter.stateTimer = 0; // no stale wait budgets ride into the run
    return true;
  }

  /**
   * Dungeon exit portal: while the run is NOT live (cleared / lockout /
   * dormant), any hunter still standing in the vault walks to DUNGEON_EXIT
   * and warps to the town plaza (WANDERING_TOWN fans out into errands via
   * the hub, same as the wipe eject). This is the only way out — the
   * walk-in gate is sealed and walls are solid — so without it cleared
   * delvers would march home straight through the west palisade.
   * Party membership is left alone (town states dissolve it next tick).
   */
  updateDungeonExit(hunter: Hunter, dt: number) {
    const arrived = this.sim.moveTowards(hunter, DUNGEON_EXIT.x, DUNGEON_EXIT.y, this.sim.effectiveMoveSpeed(hunter) * 60 * dt)
      || gridDistance(hunter.gx, hunter.gy, DUNGEON_EXIT.x, DUNGEON_EXIT.y) < 0.8;
    if (!arrived) return;
    hunter.gx = DUNGEON_EJECT.x;
    hunter.gy = DUNGEON_EJECT.y;
    hunter.targetMonsterId = null;
    hunter.targetBuildingId = null;
    hunter.state = 'WANDERING_TOWN';
    hunter.stateTimer = 1.5;
    this.sim.addFloatingText('🌀 Portal home!', DUNGEON_EJECT.x, DUNGEON_EJECT.y, '#fbbf24', 12);
  }

  /** Whirl slow: sync the spin-burst mirror (same inside-own-storm / 0.9s burst window as the renderer spin). // Whirl slow: */
  syncWhirlSlow(hunter: Hunter, dt: number): void { // Whirl slow:
    const ownStorms = this.sim.activeZones.filter(z => z.kind === 'storm' && z.sourceId === hunter.id); // Whirl slow:
    const hasStorm = ownStorms.length > 0; // Whirl slow:
    const newestStormId = hasStorm ? ownStorms[ownStorms.length - 1].id : null; // Whirl slow:
    let w = this.sim.whirlSlow.get(hunter.id); // Whirl slow:
    if (!w) { w = { burst: 0, lastZoneId: null }; this.sim.whirlSlow.set(hunter.id, w); } // Whirl slow:
    if (newestStormId && newestStormId !== w.lastZoneId) { w.burst = 0.9; w.lastZoneId = newestStormId; } // Whirl slow:
    if (!hasStorm) { w.lastZoneId = null; } // Whirl slow:
    const insideOwnStorm = hasStorm && ownStorms.some(z => gridDistance(hunter.gx, hunter.gy, z.x, z.y) <= z.radius + 0.75); // Whirl slow:
    if (insideOwnStorm) { w.burst = 0.9; } else if (w.burst > 0) { w.burst = Math.max(0, w.burst - dt); } // Whirl slow:
    if (!hasStorm && w.burst <= 0) { this.sim.whirlSlow.delete(hunter.id); } // Whirl slow:
  }

  // --------------------------------------------------------------------------
  // Per-tick hunter AI: buff ticks, party bookkeeping, then the state machine.
  // --------------------------------------------------------------------------

  updateHunterAI(hunter: Hunter, dt: number) {
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
      this.sim.removeFromParty(hunter);
    }

    // Party follow: non-leader members adopt the live leader's target.
    // Members run all own logic (movement/combat/HP-retreat/knockdown)
    // normally against it; pooled danger math covers fairness, and the
    // HP retreat + knockdown paths above/below still fire on their own.
    if (this.sim.agentConfig.partiesEnabled && hunter.partyId) {
      const party = this.sim.parties.get(hunter.partyId);
      if (party && party.leaderId !== hunter.id) {
        const leader = this.sim.hunters.find(h => h.id === party.leaderId);
        if (leader && leader.targetMonsterId) {
          const prey = this.sim.monsters.find(m => m.id === leader.targetMonsterId);
          if (prey && prey.hp > 0) {
            // Exile guard: never adopt a target across the map. Parties
            // fight shoulder-to-shoulder; a distant leader pick keeps the
            // member's own target instead of marching it past live prey.
            if (gridDistance(hunter.gx, hunter.gy, prey.gx, prey.gy) <= 12) {
              hunter.targetMonsterId = prey.id;
              hunter.targetGx = prey.gx;
              hunter.targetGy = prey.gy;
            }
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

    // Dungeon exit portal (above all states): a hunter standing in the
    // vault while its run is over walks out and warps home. Catches every
    // state, so post-clear errand routing can never march through the wall.
    if (this.sim.zoneOf(hunter.gx, hunter.gy) === 4 && this.sim.dungeon.state !== 'active') {
      this.updateDungeonExit(hunter, dt);
      return;
    }

    // Hunter State Machine
    switch (hunter.state) {
      case 'SPAWNING': {
        hunter.stateTimer -= dt;
        if (hunter.stateTimer <= 0) {
          // New arrivals register at Sanctuary Hall before their first hunt
          const hall = this.sim.buildings.find(b => b.type === 'TOWN_HALL');
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
        const arrived = this.sim.moveTowards(hunter, hunter.targetGx, hunter.targetGy, this.sim.effectiveMoveSpeed(hunter) * 60 * dt) // Whirl slow:
          || gridDistance(hunter.gx, hunter.gy, hunter.targetGx, hunter.targetGy) < 0.8;
        if (arrived) {
          const hall = this.sim.buildings.find(b => b.type === 'TOWN_HALL');
          if (hall) {
            this.sim.recordStoreTransaction(hall, 12, 0);
            this.sim.addFloatingText(`📋 ${hunter.name} registered!`, hunter.gx, hunter.gy - 0.5, '#fde047', 11);
          }
          this.leaveForHunt(hunter);
        }
        break;
      }

      case 'TRAVELING_TO_HUNT': {
        // Move towards the nearest town gate, then choose hunting field.
        // Proximity counts as arrival (see REGISTERING: separation jitter).
        const reachedGate = this.sim.moveTowards(hunter, hunter.targetGx, hunter.targetGy, this.sim.effectiveMoveSpeed(hunter) * 60 * dt) // Whirl slow:
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
            this.sim.addFloatingText('⚠️ Too dangerous — gearing up!', hunter.gx, hunter.gy, '#fca5a5', 11);
            this.returnToTownToSell(hunter);
          } else if (desperate) {
            // Nothing fair and town can't help: take the least-bad fight
            hunter.targetMonsterId = desperate.id;
            hunter.state = 'HUNTING';
            hunter.targetGx = desperate.gx;
            hunter.targetGy = desperate.gy;
          } else {
            // Wander in field (vault-local for delvers — never at the wall).
            if (this.sim.zoneOf(hunter.gx, hunter.gy) === 4) {
              hunter.targetGx = 2 + Math.random() * 15;
              hunter.targetGy = 24 + Math.random() * 31;
            } else {
              hunter.targetGx = 44 + Math.random() * 8;
              hunter.targetGy = 28 + Math.random() * 8;
            }
          }
        }
        break;
      }

      case 'HUNTING': {
        // Check health first - if critical, auto retreat to town clinic!
        // (Paladin tanks hold the line to 15% before bailing.)
        // Vault hold: no clinic retreats mid-run (sealed gate + solid
        // walls = no path out) — elixirs, party rescue, and wipe-eject
        // cover survival. Falls through to normal hunting logic.
        if (hunter.hp < this.sim.effectiveMaxHp(hunter) * this.retreatHpFracFor(hunter)) {
          if (this.sim.zoneOf(hunter.gx, hunter.gy) !== 4) {
            this.retreatToTown(hunter, 'low HP');
            break;
          }
        }

        // Full bags first: sell before anything else so one town trip
        // covers every errand (repairs, drinks, brews, training).
        // Vault hold: loot rides in bags until extraction (holdDelver).
        if (hunter.inventory.length >= hunter.maxInventorySlots) {
          if (this.sim.zoneOf(hunter.gx, hunter.gy) !== 4) {
            this.returnToTownToSell(hunter);
            break;
          }
        }

        // Outgrown zone: transit to town only when SETTLING for local prey —
        // never while marching through to better-zone prey. A hunter crossing
        // the forest en route to a volcano target keeps walking; only a hunter
        // whose target is local (or missing) bounces back via the plaza.
        const z = this.sim.zoneOf(hunter.gx, hunter.gy);
        const pref = this.preferredZone(hunter.level);
        if (z >= 1 && pref > z) {
          const best = this.findBestMonsterForHunter(hunter);
          if (best && best.zone === pref) {
            const cur = hunter.targetMonsterId ? this.sim.monsters.find(m => m.id === hunter.targetMonsterId) : undefined;
            if (!cur || cur.zone < pref) { this.returnToPlaza(hunter); break; }
            // else: already headed to the better zone — keep walking
          }
        }

        // Track target monster
        let monster: Monster | null | undefined = this.sim.monsters.find(m => m.id === hunter.targetMonsterId);
        if (!monster || monster.hp <= 0) {
          // Find next monster
          monster = this.findBestMonsterForHunter(hunter);
          if (!monster) {
            // Delver hold: mid-run delvers stay on interior bosses even
            // when the fair-fight search comes up empty — leaving strands
            // the run, while staying either clears it or wipes into the
            // designed lockout reset (checkDungeonWipe).
            if (this.holdDelverInVault(hunter)) break;
            // Everything left alive is too dangerous: gear up if possible,
            // otherwise take the least-bad fight instead of pacing forever
            if (this.onlyHardTargetsRemain(hunter) && this.canImproveInTown(hunter)) {
              this.sim.addFloatingText('⚠️ Too dangerous — gearing up!', hunter.gx, hunter.gy, '#fca5a5', 11);
              this.returnToTownToSell(hunter);
              break;
            }
            monster = this.findDesperateTarget(hunter);
            if (!monster) {
              // Field truly empty: idle wander (vault-local for delvers —
              // forest coordinates would march them at the sealed wall).
              if (this.sim.zoneOf(hunter.gx, hunter.gy) === 4) {
                hunter.targetGx = 2 + Math.random() * 15;
                hunter.targetGy = 24 + Math.random() * 31;
              } else {
                hunter.targetGx = 42 + Math.random() * 10;
                hunter.targetGy = 26 + Math.random() * 10;
              }
              this.sim.moveTowards(hunter, hunter.targetGx, hunter.targetGy, this.sim.effectiveMoveSpeed(hunter) * 40 * dt); // Whirl slow:
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
          // Fresh swing timer: stateTimer is reused across states (lobby 90s
          // budget, LFP 12s, town waits) and the attack gate burns it down
          // in silence — without this, delvers who waited in the lobby open
          // a dungeon run with up to 90s of damage-free swings.
          hunter.stateTimer = 0;
        } else {
          this.sim.moveTowards(hunter, monster.gx, monster.gy, this.sim.effectiveMoveSpeed(hunter) * 60 * dt); // Whirl slow:
        }
        break;
      }

      case 'FIGHTING': {
        const monster = this.sim.monsters.find(m => m.id === hunter.targetMonsterId);
        if (!monster || monster.hp <= 0) {
          hunter.targetMonsterId = null;
          // Delver hold: boss loot never triggers errands mid-run — the
          // party stays on interior bosses until clear/extraction.
          if (this.holdDelverInVault(hunter)) break;
          // Post-kill utility routing: needs must outscore the hunt
          // (cfg.huntBaseline) to earn the interruption. Lab/forge/clinic never interrupt the
          // field (restock via town trips; clinic-critical is the HP<20%
          // hard retreat in HUNTING). Bags-full falls out of sell=1.0
          // naturally; sell always wins ties via the >= chain below.
          const s = this.scoreNeeds(hunter);
          // transit scored here: out-leveled + fair better-zone prey → 0.6
          let transitU = 0;
          const z = this.sim.zoneOf(hunter.gx, hunter.gy);
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
          let bestU = this.sim.agentConfig.huntBaseline;
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
            const inPref = this.sim.monsters.filter(m => m.zone === pref && m.hp > 0);
            const targets = this.sim.populationTargets();
            const atTarget = inPref.length >= (pref === 1 ? targets.z1 : pref === 2 ? targets.z2 : targets.z3);
            const fairPref = inPref.filter(m => !this.isTooHardFor(m, hunter));
            if (fairPref.length === 0 && atTarget && hunter.hp < this.sim.effectiveMaxHp(hunter) * 0.7) {
              const fallback = this.findBestMonsterForHunter(hunter);
              if (!fallback || (!fallback.isBoss && hunter.level - fallback.level >= this.sim.agentConfig.grayGap)) {
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
        if (hunter.hp < this.sim.effectiveMaxHp(hunter) * 0.35 && hunter.elixirs > 0) {
          hunter.elixirs--;
          const heal = Math.round(this.sim.effectiveMaxHp(hunter) * 0.35);
          hunter.hp = Math.min(this.sim.effectiveMaxHp(hunter), hunter.hp + heal);
          soundFx.playCoin(hunter.gx, hunter.gy);
          this.sim.addFloatingText(`🧪 Elixir! +${heal} HP`, hunter.gx, hunter.gy - 0.5, '#4ade80', 12);
        }

        // Swig a buff tonic at the start of a fight (+20% ATK for 60s)
        if (hunter.tonics > 0 && hunter.tonicBoostTimer <= 0) {
          hunter.tonics--;
          hunter.tonicBoost = 0.20;
          hunter.tonicBoostTimer = 60;
          this.sim.addFloatingText(`🥤 Tonic! +20% ATK`, hunter.gx, hunter.gy - 0.5, '#fb923c', 12);
        }

        // Auto Attack & Skill Execution
        this.sim.resolveHunterCombat(hunter, monster, dt);
        break;
      }

      case 'RETURNING_TO_TOWN': {
        // Move towards town gate first. Proximity counts as arrival (see
        // REGISTERING: separation jitter); targetGx/Gy is the building door
        // when building-targeted, so this matches the < 0.8 door check.
        const reached = this.sim.moveTowards(hunter, hunter.targetGx, hunter.targetGy, this.sim.effectiveMoveSpeed(hunter) * 60 * dt) // Whirl slow:
          || gridDistance(hunter.gx, hunter.gy, hunter.targetGx, hunter.targetGy) < 0.8;
        if (reached) {
          // Head to designated target building
          if (hunter.targetBuildingId) {
            const building = this.sim.buildings.find(b => b.id === hunter.targetBuildingId);
            if (building) {
              hunter.targetGx = building.doorGx;
              hunter.targetGy = building.doorGy;
              // Once reached building door:
              if (gridDistance(hunter.gx, hunter.gy, building.doorGx, building.doorGy) < 0.8) {
                if (hunter.stateTimer > 0) { hunter.stateTimer -= dt; break; } // queue wait tick
                const occupants = building.currentVisitors.length;
                if (occupants >= this.sim.buildingCapacity(building)) {
                  hunter.stateTimer = 1.5;
                  if (Math.random() < 0.3) this.sim.addFloatingText(`⌛ Queued for ${building.name}`, hunter.gx, hunter.gy, '#cbd5e1', 11);
                  break;
                }
                if (building.type === 'BLACKSMITH') {
                  const canBuyWeapon = hunter.weapon.tier < 5 && hunter.gold >= hunter.weapon.tier * 80;
                  const canBuyArmor = hunter.weapon.tier >= 5 && hunter.armor.tier < 5 && hunter.gold >= hunter.armor.tier * 60;
                  if (!canBuyWeapon && !canBuyArmor) {
                    this.sim.addFloatingText(`💸 Can't afford the forge`, hunter.gx, hunter.gy, '#fca5a5', 11);
                    hunter.targetBuildingId = null;
                    hunter.state = 'WANDERING_TOWN';
                    hunter.stateTimer = 2;
                    break;
                  }
                } else if (building.type === 'ALCHEMY_LAB') {
                    const elixirNeed = Math.max(0, this.sim.elixirCapacity() - hunter.elixirs);
                    const elixirCostPer = 15 + building.level * 5;
                    const tonicNeed = Math.max(0, this.sim.tonicCapacity() - hunter.tonics);
                    const tonicPrice = 20 + building.level * 5;
                    const canBuyElixir = elixirNeed > 0 && hunter.gold >= elixirCostPer;
                    const canBuyTonic = tonicNeed > 0 && hunter.gold >= tonicPrice;
                    if (!canBuyElixir && !canBuyTonic) {
                      this.sim.addFloatingText(`💸 Can't afford elixirs`, hunter.gx, hunter.gy, '#fca5a5', 11);
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
                    this.sim.addFloatingText(Number.isFinite(need) ? `📜 Need ${need}g for training` : `📜 No skill ready for training`, hunter.gx, hunter.gy, '#fca5a5', 11);
                    hunter.targetBuildingId = null;
                    hunter.state = 'WANDERING_TOWN';
                    hunter.stateTimer = 2;
                    break;
                  }
                }
                this.sim.executeBuildingVisit(hunter, building);
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
        const svc = hunter.targetBuildingId ? this.sim.buildings.find(x => x.id === hunter.targetBuildingId) ?? null : null;
        const st = svc ? Math.max(1, this.sim.serviceTime(svc)) : 3;
        if (hunter.state === 'RECOVERING_CLINIC') {
          hunter.hp = Math.min(this.sim.effectiveMaxHp(hunter), hunter.hp + this.sim.effectiveMaxHp(hunter) * dt / st);
        }
        if (hunter.state === 'RESTING_TAVERN') {
          hunter.mood = Math.min(100, hunter.mood + 100 * dt / st);
        }
        // Timed interaction with store
        hunter.stateTimer -= dt;
        if (hunter.stateTimer <= 0) {
          this.sim.finishStoreInteraction(hunter);
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
        // free seat on arrival (all seats open — any class), then sit out
        // the 90s wait budget. A full house teleports via
        // tickLobbyTeleport; on expiry march out SOLO and start the 120s
        // re-queue cooldown (re-uses the LFP cooldown field — no new fields).
        const seats = lobbySeatPositions();
        let entry = this.lobbySeatOf(hunter.id);
        const dest = entry ? seats[entry.seatIndex]! : DUNGEON_PORTAL;
        this.sim.moveTowards(hunter, dest.x, dest.y, this.sim.effectiveMoveSpeed(hunter) * 60 * dt); // Whirl slow:
        if (!entry && gridDistance(hunter.gx, hunter.gy, DUNGEON_PORTAL.x, DUNGEON_PORTAL.y) < 0.8) {
          if (this.claimLobbySeat(hunter) !== null) {
            this.sim.addFloatingText('🪑 Taking a seat…', hunter.gx, hunter.gy, '#c4b5fd', 11);
          }
        }
        hunter.stateTimer -= dt;
        if (hunter.stateTimer <= 0) {
          this.releaseLobbySeat(hunter);
          hunter.lfpCooldown = 120;
          this.sim.addFloatingText('🚶 Portal party never formed — hunting solo', hunter.gx, hunter.gy, '#94a3b8', 11);
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
        this.sim.moveTowards(hunter, 29, 29, this.sim.effectiveMoveSpeed(hunter) * 60 * dt); // Whirl slow:
        hunter.stateTimer -= dt;
        if (hunter.stateTimer <= 0) {
          hunter.lfpCooldown = 90;
          this.sim.addFloatingText('🚶 No party found — hunting solo', hunter.gx, hunter.gy, '#94a3b8', 11);
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

  // -- End HunterBrain (methods appended above this line during extraction)
}
