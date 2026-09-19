// Yard orchestrator: per-renderer decor caches + one call to render all
// five building yards + one call to resolve a hunter's station spot.
// The renderer owns a YardState (per instance — never module-global, so
// StrictMode remounts can't leak sprites across containers) and delegates.

import type { Container, Sprite } from 'pixi.js';
import type { GameSimulation } from '../simulation';
import type { Hunter } from '../types';
import { renderTavernYard, seatFor, type DecorCache } from './chair';
import { renderClinicYard, bedFor } from './bed';
import { renderForgeYard, forgeStationFor } from './anvil';
import { renderLabYard, cauldronStationFor } from './vat';
import { renderAcademyYard, academyStationFor } from './dummy';

export type { DecorCache };

export interface YardState {
  tavern: DecorCache;
  clinic: DecorCache;
  forge: DecorCache;
  lab: DecorCache;
  academy: DecorCache;
}

/** Fresh per-renderer yard caches. Call once in the renderer constructor. */
export function createYardState(): YardState {
  return {
    tavern: new Map(),
    clinic: new Map(),
    forge: new Map(),
    lab: new Map(),
    academy: new Map(),
  };
}

export interface YardDeps {
  container: Container;
  sim: GameSimulation;
}

/** Render all five yards (chairs/tables, beds, anvils, vats, dummies). */
export function renderYards(state: YardState, deps: YardDeps): void {
  renderTavernYard(state.tavern, deps.container, deps.sim);
  renderClinicYard(state.clinic, deps.container, deps.sim);
  renderForgeYard(state.forge, deps.container, deps.sim);
  renderLabYard(state.lab, deps.container, deps.sim);
  renderAcademyYard(state.academy, deps.container, deps.sim);
}

/**
 * Tear down all yard sprites (remount-safe): destroy pooled sprites and
 * clear every per-yard cache so the next mount rebuilds cleanly.
 */
export function clearYards(state: YardState): void {
  const caches: DecorCache[] = [state.tavern, state.clinic, state.forge, state.lab, state.academy];
  for (const cache of caches) {
    for (const cached of cache.values()) {
      for (const s of cached.sprites) {
        try { (s as Sprite).destroy(); } catch { /* ignore */ }
      }
    }
    cache.clear();
  }
}

/**
 * Station spot for a hunter across all yards (tavern > clinic > forge >
 * lab > academy priority, matching render order), or null when free.
 * Callers offset slightly south (+0.15) so the prop peeks behind the sprite.
 */
export function stationSpotFor(
  sim: GameSimulation, hunter: Hunter
): { x: number; y: number } | null {
  return (
    seatFor(sim, hunter) ??
    bedFor(sim, hunter) ??
    forgeStationFor(sim, hunter) ??
    cauldronStationFor(sim, hunter) ??
    academyStationFor(sim, hunter)
  );
}
