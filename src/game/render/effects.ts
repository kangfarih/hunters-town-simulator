// Effects layer: skill-zone ground discs + flying skill sprites +
// floating combat text. Owns the VFX texture cache; nothing is pooled
// (all three renders rebuild their containers every frame).

import { Container, Sprite, Graphics, Text, TextStyle, Texture } from 'pixi.js';
import { gridToScreen } from '../isometric';
import type { GameSimulation } from '../simulation';
import { zoneColor } from '../types';
import { createSkillVfxTexture } from '../textures/vfx';
import { PixelParticleSystem } from './pixelParticles';

// Fixed volcanic vents (gx,gy) in the crater (gx>38, gy>38). Slow ambient
// fire + smoke so the volcano reads as alive even between Meteor casts.
const VOLCANO_VENTS = [
  { x: 45, y: 45 }, { x: 49, y: 46 }, { x: 46, y: 50 },
  { x: 52, y: 49 }, { x: 50, y: 53 }, { x: 44, y: 48 },
];

export class EffectsLayer {
  private textures: Map<string, Texture> = new Map();
  private particles = new PixelParticleSystem();
  private particlesReady = false;
  private seenBursts = new Set<string>();
  private fireAcc = new Map<string, number>();
  private smokeAcc = new Map<string, number>();
  private sparkAcc = new Map<string, number>();

  private texture(type: string): Texture {
    let t = this.textures.get(type);
    if (!t) {
      t = createSkillVfxTexture(type);
      this.textures.set(type, t);
    }
    return t;
  }

  /**
   * Skill-zone layer (below sprites): soft ground discs + kind motifs.
   * Berserker storm has no ground visual — damage still ticks at the anchor
   * but the whirlwind particles orbit the warrior itself (see hunters layer).
   * Ranger arrows rain DOWN vertically (falling shafts, fading on impact).
   * Fixed zones sit static with a pulse; auras ride the caster (sim already
   * re-anchors x/y). Everything fades out over the last 1s.
   */
  renderZones(container: Container, sim: GameSimulation): void {
    container.removeChildren();
    const zones = sim.activeZones;
    if (!zones || zones.length === 0) return;

    for (const z of zones) {
      // Whirlwind storm: no ground visual — particles orbit the warrior
      // itself (see hunters layer). Damage still ticks at the zone anchor.
      if (z.kind === 'storm') continue;
      const p = gridToScreen(z.x, z.y);
      const color = zoneColor(z.kind);
      const fade = Math.min(1, Math.max(0, (z.duration - z.elapsed) / 1));
      if (fade <= 0) continue;
      const pulse = 0.5 + 0.5 * Math.sin(z.elapsed * 4);
      // Iso footprint: a cell spans 32px horizontally, 16px vertically.
      const rx = z.radius * 32;
      const ry = z.radius * 16;
      const g = new Graphics();
      const cy = p.y + 10;

      // Soft ground fill (no ring strokes): layered translucent discs give
      // a radial feel; kind motifs carry the readout.
      g.ellipse(p.x, cy, rx, ry).fill({ color, alpha: (0.14 + 0.06 * pulse) * fade });
      g.ellipse(p.x, cy, rx * 0.66, ry * 0.66).fill({ color, alpha: (0.10 + 0.05 * pulse) * fade });

      if (z.kind === 'burn') {
        // Strict-square ember ground: small 2px squares scattered EVENLY
        // across the whole ellipse (not a center cluster). Deterministic
        // golden-ratio spread + 12fps flicker. No ellipses/gradients.
        const flick = Math.floor(z.elapsed * 12) % 2 === 0 ? 1 : 0.72;
        const coreColors = ['#ffffff', '#fef08a', '#facc15', '#fb923c', '#ea580c'];
        const EMBER_N = 18;
        for (let i = 0; i < EMBER_N; i++) {
          // Even coverage: golden-ratio lattice across the disc.
          const u = ((i * 0.61803398875 + 0.13) % 1 + 1) % 1;
          const v = ((i * 0.38196601125 + 0.29) % 1 + 1) % 1;
          const ex = (u * 2 - 1) * rx * 0.8;
          const ey = (v * 2 - 1) * ry * 0.8;
          const sx = p.x + ex;
          // Slight 12fps shimmer so squares twinkle without moving.
          const shimmer = Math.sin(i * 12.9898 + Math.floor(z.elapsed * 12) * 0.9) > 0 ? 0 : 1;
          const sy = cy - 2 + ey - shimmer;
          g.rect(Math.round(sx), Math.round(sy), 2, 2).fill({
            color: coreColors[(i + Math.floor(z.elapsed * 12)) % coreColors.length],
            alpha: 0.9 * flick * fade,
          });
        }
        // Meteor shower: a few small fire rocks rain DOWN above random
        // points inside the radius while the zone lives (mirrors the
        // arrows rain). Head color cools as it falls; fades on impact.
        const SHOWER_N = 5;
        for (let i = 0; i < SHOWER_N; i++) {
          const u = ((i * 0.61803398875 + 0.13) % 1 + 1) % 1;
          const ax = p.x + (u * 2 - 1) * rx * 0.7;
          const fall = ((z.elapsed * 0.9 + i * 0.37) % 1 + 1) % 1;
          const ay = cy - 64 + fall * 66; // sky -> ground
          const impactFade = fall > 0.88 ? Math.max(0, (1 - fall) / 0.12) : 1;
          const alpha = 0.95 * impactFade * fade;
          if (alpha <= 0.01) continue;
          const head = fall < 0.4 ? '#7c2d12' : fall < 0.7 ? '#ea580c' : '#facc15';
          // Trail above the head + hot core.
          g.rect(Math.round(ax) - 1, Math.round(ay) - 12, 2, 8).fill({ color: 0xea580c, alpha: alpha * 0.7 });
          g.rect(Math.round(ax) - 2, Math.round(ay) - 2, 4, 4).fill({ color: head, alpha });
          g.rect(Math.round(ax) - 1, Math.round(ay) - 1, 2, 2).fill({ color: 0xffffff, alpha });
          if (fall > 0.88) {
            // Impact flash squares on the ground.
            g.rect(Math.round(ax) - 4, Math.round(cy), 3, 3).fill({ color: 0xfacc15, alpha: alpha * 0.8 });
            g.rect(Math.round(ax) + 2, Math.round(cy) - 2, 2, 2).fill({ color: 0xfb923c, alpha: alpha * 0.8 });
          }
        }
      } else if (z.kind === 'arrows') {
        // Rain of Arrows: shafts fall straight DOWN above random points
        // inside the radius and fade on ground impact, continuously while
        // the zone lives. No horizontal flight, no rim blink.
        const FALL_N = 7;
        for (let i = 0; i < FALL_N; i++) {
          const u = ((i * 0.61803398875) % 1 + 1) % 1; // deterministic spread
          const ax = p.x + (u * 2 - 1) * rx * 0.75;
          const fall = ((z.elapsed * 1.4 + i * 0.23) % 1 + 1) % 1;
          const ay = cy - 52 + fall * 54; // sky -> ground
          const impactFade = fall > 0.85 ? Math.max(0, (1 - fall) / 0.15) : 1;
          const alpha = 0.9 * impactFade * fade;
          if (alpha <= 0.01) continue;
          // Shaft + down-pointing head.
          g.rect(ax - 1, ay - 9, 2, 8).fill({ color: 0xd9f99d, alpha });
          g.rect(ax - 2, ay - 2, 4, 3).fill({ color: 0x22c55e, alpha });
        }
      } else if (z.kind === 'consecration') {
        // Holy cross marker at the anchor.
        g.rect(p.x - 2, cy - 14, 4, 28).fill({ color: 0xffffff, alpha: 0.55 * fade });
        g.rect(p.x - 9, cy - 7, 18, 4).fill({ color: 0xffffff, alpha: 0.55 * fade });
      } else if (z.kind === 'radiance' || z.kind === 'hymn') {
        // Rising motes (heal): three dots looping upward.
        for (let k = 0; k < 3; k++) {
          const rise = ((z.elapsed * 22 + k * 14) % 30) / 30;
          const mx = p.x + (k - 1) * rx * 0.3;
          const my = cy - 4 - rise * 26;
          g.circle(mx, my, 2.5).fill({ color: 0xffffff, alpha: (1 - rise) * 0.8 * fade });
        }
        if (z.kind === 'hymn') {
          // Bard orbit: three notes circling the aura.
          for (let k = 0; k < 3; k++) {
            const ang = z.elapsed * 2 + (k / 3) * Math.PI * 2;
            const ox = p.x + Math.cos(ang) * rx * 0.6;
            const oy = cy + Math.sin(ang) * ry * 0.6 - 6;
            g.circle(ox, oy, 3).fill({ color: 0xfbbf24, alpha: 0.9 * fade });
          }
        }
      }

      g.zIndex = (z.x + z.y) * 100 + 5;
      container.addChild(g);
    }
  }

  renderSkillVfx(container: Container, sim: GameSimulation): void {
    container.removeChildren();

    sim.skillVfxs.forEach(vfx => {
      // Staggered volley chains spawn with negative elapsed as a spawn
      // delay — pending arrows stay hidden until their offset elapses.
      // Whirlwind circle sprite removed — the warrior spin + orbiting
      // particles in the hunters layer carry the effect.
      if (vfx.elapsed < 0 || vfx.type === 'whirlwind') return;
      const startScreen = gridToScreen(vfx.startX, vfx.startY);
      const targetScreen = gridToScreen(vfx.targetX, vfx.targetY);
      const dx = targetScreen.x - startScreen.x;
      const dy = targetScreen.y - startScreen.y;
      // Flight direction in screen space (canvas Y points down)
      const flightAngle = Math.atan2(dy, dx);

      // Per-effect pacing: arrows/slashes snap fast, pillars linger
      const pacing: Record<string, number> = {
        multishot: 0.65, slash: 0.7, impact: 0.8, heal: 1.0,
        meteor: 1.0, smite: 1.15, holy_burst: 1.15, levelup: 1.2,
        ballad: 0.9, encore: 1.0, death: 1.0,
      };
      const visualDuration = vfx.duration * (pacing[vfx.type] ?? 1.0);
      const progress = Math.min(1, vfx.elapsed / visualDuration);
      const fade = 1 - progress * progress; // snappy fade-out
      const pop = Math.sin(Math.min(1, progress * 3) * Math.PI * 0.5); // fast scale-in

      // Lazily cached per type (the old initTextures pre-cache did this up
      // front; same pixels, first frame included).
      const sprite = new Sprite(this.texture(vfx.type));
      sprite.anchor.set(0.5, 0.5);
      sprite.alpha = fade;

      if (vfx.type === 'multishot') {
        // Zone ticks/casts pin start==target: arrows rain DOWN vertically
        // (texture points up, so PI faces them down) instead of flying
        // sideways. Direct casts fly point-first along the flight path.
        const travel = Math.hypot(dx, dy);
        if (travel < 2) {
          sprite.x = targetScreen.x;
          sprite.y = targetScreen.y - 12 - progress * 8;
          sprite.rotation = Math.PI;
          sprite.scale.set(0.9 + pop * 0.3);
        } else {
          const t = progress; // near-linear: arrows are fast
          sprite.x = startScreen.x + dx * t;
          sprite.y = startScreen.y + dy * t;
          sprite.rotation = flightAngle + Math.PI / 2;
          sprite.scale.set(0.9 + pop * 0.3);
        }
      } else if (vfx.type === 'meteor') {
        // Fireball arcs from sky to target, swelling on impact
        const t = 1 - Math.pow(1 - progress, 2); // ease-out: fast launch
        sprite.x = startScreen.x + dx * t;
        sprite.y = startScreen.y + dy * t - Math.sin(progress * Math.PI) * 46;
        sprite.scale.set(0.8 + progress * 0.9);
      } else if (vfx.type === 'smite') {
        // Holy pillar strikes the target and lingers with a flicker
        sprite.x = targetScreen.x;
        sprite.y = targetScreen.y - 18;
        sprite.scale.set(0.9 + pop * 0.3, 0.6 + progress * 0.9);
        sprite.alpha = fade * (0.75 + 0.25 * Math.sin(progress * 22));
      } else if (vfx.type === 'holy_burst') {
        // Renewing Dawn: gold pillar blooms on the caster with a green ring
        sprite.x = startScreen.x;
        sprite.y = startScreen.y - 20 - progress * 10;
        sprite.scale.set(0.9 + pop * 0.5, 0.7 + progress * 0.9);
        sprite.alpha = fade * (0.8 + 0.2 * Math.sin(progress * 16));
      } else if (vfx.type === 'slash') {
        // Energy arc snaps across the gap, edge-on to its path
        const t = 1 - Math.pow(1 - progress, 2);
        sprite.x = startScreen.x + dx * t;
        sprite.y = startScreen.y + dy * t - 8;
        sprite.rotation = flightAngle;
        sprite.scale.set(0.9 + pop * 0.5);
      } else if (vfx.type === 'heal') {
        // Healing bloom erupts on the target and drifts upward, no travel
        sprite.x = targetScreen.x;
        sprite.y = targetScreen.y - 14 - progress * 10;
        const s = 0.6 + pop * 0.8;
        sprite.scale.set(s);
      } else if (vfx.type === 'ballad' || vfx.type === 'encore') {
        // Bard music blooms on the caster and drifts upward with a shimmer
        sprite.x = startScreen.x;
        sprite.y = startScreen.y - 16 - progress * 12;
        const s = 0.7 + pop * 0.7;
        sprite.scale.set(s);
        sprite.alpha = fade * (0.8 + 0.2 * Math.sin(progress * 14));
      } else if (vfx.type === 'levelup') {
        // Level-up pillar erupts from the hunter and rises, ring expanding
        sprite.x = startScreen.x;
        sprite.y = startScreen.y - 26 - progress * 22;
        const s = 0.7 + pop * 0.9;
        sprite.scale.set(s, 0.8 + progress * 0.8);
        sprite.alpha = fade * (0.8 + 0.2 * Math.sin(progress * 18));
      } else if (vfx.type === 'death') {
        // Soul wisp rises where the monster fell — no ring, no bloom.
        // Gentle pop only; the pooled spark trail carries the burst.
        // Bosses pass a longer duration, which reads as bigger.
        sprite.x = targetScreen.x;
        sprite.y = targetScreen.y - 12 - progress * 14;
        const s = 0.7 + pop * 0.35;
        sprite.scale.set(s);
      } else {
        // Impact burst blooms exactly on the target
        sprite.x = targetScreen.x;
        sprite.y = targetScreen.y - 10;
        const s = 0.5 + progress * 1.5;
        sprite.scale.set(s);
      }

      container.addChild(sprite);
    });
  }

  renderParticles(container: Container, sim: GameSimulation, dt: number): void {
    if (!this.particlesReady) {
      this.particles.attach(container);
      this.particlesReady = true;
    }
    if (dt <= 0) return;

    // Prune bookkeeping for dead zones/vfx so maps stay bounded.
    for (const id of [...this.fireAcc.keys()]) {
      if (!sim.activeZones.some(z => z.id === id)) {
        this.fireAcc.delete(id);
        this.smokeAcc.delete(id);
        this.sparkAcc.delete(id);
      }
    }
    for (const id of [...this.seenBursts]) {
      if (!sim.skillVfxs.some(v => v.id === id)) this.seenBursts.delete(id);
    }

    // 1. Zones: continuous square-particle emitters at each anchor.
    // Burn = campfire fire/smoke; other kinds get their own palette so
    // every skill family reads in pixels, not just fire.
    for (const z of sim.activeZones) {
      const fade = Math.min(1, Math.max(0, (z.duration - z.elapsed) / 1));
      if (fade <= 0) continue;
      const p = gridToScreen(z.x, z.y);
      const bx = p.x;
      const by = p.y + 8;
      if (z.kind === 'burn') {
        // Burn flames: small 2px squares scattered EVENLY over the whole
        // ellipse (uniform disc pick per spawn), not a center pile.
        // rx/ry match the ground disc above (r*32 / r*16).
        const rxPx = z.radius * 32;
        const ryPx = z.radius * 16;
        const pickInDisc = () => {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 0.8; // uniform area fill
          return {
            x: bx + Math.cos(a) * r * rxPx,
            y: by + Math.sin(a) * r * ryPx,
          };
        };
        const scale = Math.min(1.6, 0.7 + z.radius * 0.35);
        if (!this.seenBursts.has(`zone-${z.id}`)) {
          this.seenBursts.add(`zone-${z.id}`);
          // Ignition pops spread across the area, not one center burst.
          for (let k = 0; k < 5; k++) {
            const s = pickInDisc();
            this.particles.spawnEmberBurst(s.x, s.y, 3, 60 * scale);
          }
        }
        const fa = (this.fireAcc.get(z.id) ?? 0) + dt * 30 * scale * (0.35 + 0.65 * fade);
        const fn = Math.floor(fa);
        this.fireAcc.set(z.id, fa - fn);
        for (let i = 0; i < fn; i++) {
          const s = pickInDisc();
          this.particles.spawnFire(s.x, s.y, { n: 1, spread: 2, up: 38, life: 0.65, size: 2 });
        }
        const sa = (this.smokeAcc.get(z.id) ?? 0) + dt * 7 * fade;
        const sn = Math.floor(sa);
        this.smokeAcc.set(z.id, sa - sn);
        for (let i = 0; i < sn; i++) {
          const s = pickInDisc();
          this.particles.spawnSmoke(s.x, s.y - 2, 1, 3);
        }
        continue;
      }
      // --- Non-fire zones: rate-limited spark emitters, random offsets. ---
      const rxPx = Math.max(10, z.radius * 32 * 0.6);
      const acc = (this.sparkAcc.get(z.id) ?? 0);
      const scatter = () => bx + (Math.random() - 0.5) * 2 * rxPx;
      if (z.kind === 'storm') {
        // Cyclone dust orbits the CASTER (storms pin to the target's
        // ground, but the warrior is the visual center). Tangential
        // velocity on an iso-flattened ring + slight outward drift.
        // A weak gray puff lingers at the anchor so the damage zone
        // still reads on the ground.
        const caster = sim.hunters.find(h => h.id === z.sourceId);
        const na = acc + dt * 20 * fade;
        const nn = Math.floor(na);
        this.sparkAcc.set(z.id, na - nn);
        const dust = ['#e2e8f0', '#94a3b8', '#38bdf8', '#f8fafc'];
        for (let i = 0; i < nn; i++) {
          if (caster) {
            const cp = gridToScreen(caster.gx, caster.gy);
            const a = Math.random() * Math.PI * 2;
            const r = 13 + Math.random() * 6;
            const ex = cp.x + Math.cos(a) * r;
            const ey = cp.y - 14 + Math.sin(a) * r * 0.55;
            // Tangent (counter-clockwise) + outward drift.
            const tx = -Math.sin(a) * 95 + Math.cos(a) * 14;
            const ty = Math.cos(a) * 95 * 0.55 + Math.sin(a) * 8;
            this.particles.spawnSpark(ex, ey, {
              colors: dust, speed: 8, vx: tx, vy: ty,
              gravity: 0, life: 0.55, spread: 1, size: 2,
            });
          } else {
            this.particles.spawnSpark(scatter(), by - 6 - Math.random() * 14, {
              colors: dust, speed: 30, vy: -6, gravity: 0, life: 0.6, spread: 4,
            });
          }
        }
        // Weak anchor puff so the ground zone reads.
        if (Math.random() < dt * 5 * fade) {
          this.particles.spawnSpark(scatter(), by - 4, {
            colors: ['#94a3b8', '#64748b'], speed: 12, vy: -10,
            gravity: 0, life: 0.7, spread: 6,
          });
        }
      } else if (z.kind === 'arrows') {
        // Arrow impacts: green/white ground pops that fall back down.
        const na = acc + dt * 12 * fade;
        const nn = Math.floor(na);
        this.sparkAcc.set(z.id, na - nn);
        for (let i = 0; i < nn; i++) {
          this.particles.spawnSpark(scatter(), by - 2, {
            colors: ['#d9f99d', '#4ade80', '#f8fafc'],
            speed: 26, vy: -34, gravity: 160, life: 0.55, spread: 4,
          });
        }
      } else if (z.kind === 'consecration') {
        // Holy sparks sinking onto the aura, gold/white.
        const na = acc + dt * 12 * fade;
        const nn = Math.floor(na);
        this.sparkAcc.set(z.id, na - nn);
        for (let i = 0; i < nn; i++) {
          this.particles.spawnSpark(scatter(), by - 34, {
            colors: ['#ffffff', '#fef08a', '#facc15'],
            speed: 8, vy: 44, gravity: 0, life: 0.7, spread: 4,
          });
        }
      } else if (z.kind === 'radiance' || z.kind === 'hymn') {
        // Healing motes floating up; hymn adds gold notes.
        const colors = z.kind === 'hymn'
          ? ['#f8fafc', '#4ade80', '#fbbf24', '#2dd4bf']
          : ['#f8fafc', '#4ade80', '#d4a017'];
        const na = acc + dt * 10 * fade;
        const nn = Math.floor(na);
        this.sparkAcc.set(z.id, na - nn);
        for (let i = 0; i < nn; i++) {
          this.particles.spawnSpark(scatter(), by - 4, {
            colors, speed: 8, vy: -30, gravity: -14, life: 0.9, spread: 6,
          });
        }
      }
    }

    // 2. Skill VFX: trails while flying + one burst on arrival.
    // Meteor keeps its fire trail; every other family gets square sparks
    // in its own palette so no skill is particles-free.
    for (const vfx of sim.skillVfxs) {
      if (vfx.elapsed < 0) continue;
      const s = gridToScreen(vfx.startX, vfx.startY);
      const t = gridToScreen(vfx.targetX, vfx.targetY);
      const burst = (key: string): boolean => {
        if (this.seenBursts.has(key)) return false;
        this.seenBursts.add(key);
        return true;
      };
      if (vfx.type === 'meteor') {
        const progress = Math.min(1, vfx.elapsed / (vfx.duration * 1.0));
        const te = 1 - Math.pow(1 - progress, 2);
        const px = s.x + (t.x - s.x) * te;
        const py = s.y + (t.y - s.y) * te - Math.sin(progress * Math.PI) * 46;
        const pinned = Math.hypot(t.x - s.x, t.y - s.y) < 2;
        // Zone-tick meteors pin start==target (short pops): lighter trail.
        this.particles.spawnFire(px, py, { n: pinned ? 1 : 2, spread: 3, up: 12, life: 0.45, size: 3 });
        if (Math.random() < 0.35) this.particles.spawnSmoke(px, py, 1, 3);
        if (progress > 0.72 && burst(vfx.id)) {
          this.particles.spawnFire(t.x, t.y + 8, { n: 8, spread: 9, up: 55, life: 0.7 });
          this.particles.spawnEmberBurst(t.x, t.y + 8, 10, 85);
          this.particles.spawnSmoke(t.x, t.y + 4, 4, 8);
        }
      } else if (vfx.type === 'impact') {
        if (!burst(vfx.id)) continue;
        this.particles.spawnFire(t.x, t.y - 2, { n: 5, spread: 7, up: 48, life: 0.55 });
        this.particles.spawnEmberBurst(t.x, t.y - 2, 7, 75);
        this.particles.spawnSmoke(t.x, t.y - 4, 3, 6);
      } else if (vfx.type === 'slash') {
        const progress = Math.min(1, vfx.elapsed / (vfx.duration * 0.7));
        const te = 1 - Math.pow(1 - progress, 2);
        const px = s.x + (t.x - s.x) * te;
        const py = s.y + (t.y - s.y) * te - 8;
        this.particles.spawnSpark(px, py, {
          n: 2, colors: ['#f8fafc', '#ef4444', '#fca5a5'],
          speed: 40, life: 0.4, spread: 3,
        });
        if (progress > 0.7 && burst(vfx.id)) {
          this.particles.spawnSpark(t.x, t.y - 8, {
            n: 6, colors: ['#f8fafc', '#ef4444'], speed: 70, life: 0.45, spread: 4,
          });
        }
      } else if (vfx.type === 'multishot') {
        const travel = Math.hypot(t.x - s.x, t.y - s.y);
        const progress = Math.min(1, vfx.elapsed / (vfx.duration * 0.65));
        if (travel < 2) {
          // Zone rain: green sparks pattering onto the ground.
          this.particles.spawnSpark(t.x, t.y - 12 - progress * 8, {
            n: 1, colors: ['#d9f99d', '#22c55e', '#f8fafc'],
            speed: 6, vy: 70, gravity: 0, life: 0.4, spread: 8,
          });
        } else {
          const px = s.x + (t.x - s.x) * progress;
          const py = s.y + (t.y - s.y) * progress;
          this.particles.spawnSpark(px, py, {
            n: 1, colors: ['#d9f99d', '#22c55e'], speed: 14, life: 0.35, spread: 2,
          });
          if (progress > 0.8 && burst(vfx.id)) {
            this.particles.spawnSpark(t.x, t.y - 6, {
              n: 5, colors: ['#d9f99d', '#22c55e', '#f8fafc'],
              speed: 55, vy: -20, gravity: 140, life: 0.5, spread: 3,
            });
          }
        }
      } else if (vfx.type === 'smite') {
        // Holy pillar: gold sparks sinking down the beam.
        this.particles.spawnSpark(t.x, t.y - 18, {
          n: 2, colors: ['#ffffff', '#fef08a', '#facc15'],
          speed: 10, vy: 52, gravity: 0, life: 0.55, spread: 5,
        });
        if (burst(`smite-${vfx.id}`)) {
          this.particles.spawnSpark(t.x, t.y - 10, {
            n: 8, colors: ['#ffffff', '#facc15'], speed: 65, life: 0.5, spread: 4,
          });
        }
      } else if (vfx.type === 'heal') {
        this.particles.spawnSpark(t.x, t.y - 14, {
          n: 2, colors: ['#f8fafc', '#4ade80', '#d4a017'],
          speed: 10, vy: -32, gravity: -12, life: 0.8, spread: 5,
        });
      } else if (vfx.type === 'holy_burst') {
        this.particles.spawnSpark(s.x, s.y - 20, {
          n: 2, colors: ['#ffffff', '#facc15', '#4ade80'],
          speed: 12, vy: -34, gravity: -12, life: 0.8, spread: 6,
        });
        if (burst(vfx.id)) {
          this.particles.spawnSpark(s.x, s.y - 20, {
            n: 10, colors: ['#ffffff', '#facc15', '#4ade80'], speed: 70, life: 0.6, spread: 4,
          });
        }
      } else if (vfx.type === 'ballad' || vfx.type === 'encore') {
        this.particles.spawnSpark(s.x, s.y - 16, {
          n: 2, colors: ['#fbbf24', '#2dd4bf', '#fef3c7'],
          speed: 10, vy: -28, gravity: -10, life: 0.85, spread: 6,
        });
      } else if (vfx.type === 'levelup') {
        if (burst(vfx.id)) {
          this.particles.spawnSpark(s.x, s.y - 26, {
            n: 12, colors: ['#fef9c3', '#facc15', '#22d3ee'], speed: 75, life: 0.7, spread: 4,
          });
        } else {
          this.particles.spawnSpark(s.x, s.y - 26, {
            n: 1, colors: ['#fef9c3', '#facc15'], speed: 8, vy: -36, gravity: -10, life: 0.7, spread: 4,
          });
        }
      } else if (vfx.type === 'death') {
        // Soul escaping: pale wisp sparks rise continuously, one ring-pop
        // on arrival. Boss kills (longer duration) read bigger via scale.
        this.particles.spawnSpark(t.x, t.y - 12, {
          n: 2, colors: ['#f5f3ff', '#c4b5fd', '#a78bfa'],
          speed: 10, vy: -38, gravity: -12, life: 0.8, spread: 5,
        });
        if (burst(vfx.id)) {
          this.particles.spawnSpark(t.x, t.y - 10, {
            n: 8, colors: ['#f5f3ff', '#a78bfa', '#6d6b8f'],
            speed: 60, life: 0.5, spread: 5,
          });
        }
      }
    }

    // 3. Ambient: volcano vents (slow) + forge fire + tavern chimney smoke.
    // Kept sparse on purpose — 6 vents * ~3/s is ~18 live fire max.
    for (let i = 0; i < VOLCANO_VENTS.length; i++) {
      const v = VOLCANO_VENTS[i];
      const p = gridToScreen(v.x, v.y);
      // Stagger vents so they don't pulse in sync.
      if ((v.x * 7 + v.y * 13 + Math.floor(performance.now() / 120)) % 9 === 0) {
        this.particles.spawnFire(p.x, p.y + 10, { n: 1, spread: 5, up: 26, life: 0.9, size: 2 });
      }
      if ((v.x * 5 + v.y * 11 + Math.floor(performance.now() / 400)) % 11 === 0) {
        this.particles.spawnSmoke(p.x, p.y + 8, 1, 5);
      }
    }
    for (const b of sim.buildings) {
      if (b.type === 'BLACKSMITH') {
        const p = gridToScreen(b.gx, b.gy);
        if (Math.random() < dt * 14) {
          this.particles.spawnFire(p.x + 10, p.y - 40, { n: 1, spread: 3, up: 34, life: 0.6, size: 2 });
        }
        if (Math.random() < dt * 4) this.particles.spawnSmoke(p.x + 10, p.y - 42, 1, 3);
      } else if (b.type === 'TAVERN') {
        const p = gridToScreen(b.gx, b.gy);
        if (Math.random() < dt * 2.5) this.particles.spawnSmoke(p.x - 8, p.y - 56, 1, 2);
      }
    }

    this.particles.update(dt);
  }

  /** Drop particle pool so a remount rebuilds cleanly. */
  clearParticles(): void {
    this.particles.clear();
    this.particles = new PixelParticleSystem();
    this.particlesReady = false;
    this.seenBursts.clear();
    this.fireAcc.clear();
    this.smokeAcc.clear();
    this.sparkAcc.clear();
  }

  renderFloatingTexts(container: Container, sim: GameSimulation): void {
    container.removeChildren();

    sim.floatingTexts.forEach(ft => {
      const screenPos = gridToScreen(ft.x, ft.y);
      const t = new Text({
        text: ft.text,
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: ft.fontSize,
          fill: ft.color,
          fontWeight: ft.isCrit ? '900' : 'bold',
          stroke: { color: '#000000', width: 2 }
        })
      });
      t.anchor.set(0.5, 0.5);
      t.x = screenPos.x;
      t.y = screenPos.y - 20;
      t.alpha = ft.opacity;
      container.addChild(t);
    });
  }
}
