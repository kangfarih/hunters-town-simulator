// Pooled square-pixel particle system: fire + smoke + embers + sparks.
// Everything is a tinted white square, integer-snapped, quantized colors.
// Caps keep 60fps: 400 fire + 200 smoke + 120 embers + 320 sparks max.
// Purely visual — no sim state, seeded jitter only.

import { Container, Sprite } from 'pixi.js';
import {
  EMBER_COLORS,
  fireColor,
  particleSquareTexture,
  smokeColor,
} from '../textures/particles';

export type PixelKind = 'fire' | 'smoke' | 'ember' | 'spark';

interface P {
  alive: boolean;
  kind: PixelKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grav: number;
  life: number;
  maxLife: number;
  size: 2 | 3 | 4;
  seed: number;
  wobble: number;
  sprite: Sprite;
}

const MAX = { fire: 400, smoke: 200, ember: 120, spark: 320 } as const;

function makeSprite(size: 2 | 3 | 4): Sprite {
  const s = new Sprite(particleSquareTexture(size));
  s.anchor.set(0.5, 0.5);
  s.visible = false;
  // Nearest-neighbor stays crisp when camera zooms.
  s.texture.source.scaleMode = 'nearest';
  return s;
}

export interface FireSpawnOpts {
  n?: number;
  spread?: number; // px horizontal spawn jitter
  up?: number; // base rise speed px/s
  life?: number; // base lifetime s
  size?: 2 | 3 | 4;
}

export interface SparkOpts {
  n?: number;
  colors: string | string[];
  speed?: number; // radial scatter px/s around base velocity
  vx?: number; // base velocity px/s
  vy?: number;
  gravity?: number; // px/s^2 (+ = falls, − = floats)
  life?: number;
  size?: 2 | 3;
  spread?: number; // px spawn jitter
}

export class PixelParticleSystem {
  private pool: P[] = [];
  private time = 0;
  /** Global wind drift px/s (+x = east). Matches campfire "Wind: On". */
  public wind = 6;

  attach(container: Container): void {
    if (this.pool.length > 0) return;
    (Object.keys(MAX) as PixelKind[]).forEach(kind => {
      for (let i = 0; i < MAX[kind]; i++) {
        const sprite = makeSprite(kind === 'smoke' ? 3 : 3);
        container.addChild(sprite);
        this.pool.push({
          alive: false, kind, x: 0, y: 0, vx: 0, vy: 0, grav: 0,
          life: 0, maxLife: 1, size: 3, seed: Math.random() * 1000,
          wobble: 2 + Math.random() * 4, sprite,
        });
      }
    });
  }

  clear(): void {
    for (const p of this.pool) {
      p.alive = false;
      p.sprite.visible = false;
    }
  }

  get aliveCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.alive) n++;
    return n;
  }

  private next(kind: PixelKind): P | null {
    // First dead slot of this kind (pool is kind-grouped, linear scan ok).
    for (const p of this.pool) {
      if (p.kind === kind && !p.alive) return p;
    }
    return null;
  }

  /** Campfire-style fire: spawn low, rise fast, shrink + cool. */
  spawnFire(x: number, y: number, opts: FireSpawnOpts = {}): void {
    const n = opts.n ?? 1;
    for (let i = 0; i < n; i++) {
      const p = this.next('fire');
      if (!p) return;
      const spread = opts.spread ?? 7;
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 2 * spread;
      p.y = y + (Math.random() - 0.5) * 4;
      p.vx = (Math.random() - 0.5) * 14;
      p.vy = -((opts.up ?? 38) * (0.7 + Math.random() * 0.6));
      p.maxLife = (opts.life ?? 0.75) * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = opts.size ?? (Math.random() < 0.35 ? 4 : 3);
      p.sprite.texture = particleSquareTexture(p.size);
      p.sprite.visible = true;
    }
  }

  /** Smoke spawns at the fire top, rises slow, grows, pales. */
  spawnSmoke(x: number, y: number, n = 1, spread = 6): void {
    for (let i = 0; i < n; i++) {
      const p = this.next('smoke');
      if (!p) return;
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 2 * spread;
      p.y = y - 10 - Math.random() * 6;
      p.vx = (Math.random() - 0.5) * 8;
      p.vy = -(13 + Math.random() * 9);
      p.maxLife = 1.6 + Math.random() * 1.2;
      p.life = p.maxLife;
      p.size = 2;
      p.sprite.texture = particleSquareTexture(2);
      p.sprite.visible = true;
    }
  }

  /** Hot sparks: fast, short, red-orange, pop above the flames. */
  spawnEmberBurst(x: number, y: number, n = 6, power = 60): void {
    for (let i = 0; i < n; i++) {
      const p = this.next('ember');
      if (!p) return;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = power * (0.5 + Math.random() * 0.9);
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y - 4;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.grav = 60;
      p.maxLife = 0.5 + Math.random() * 0.5;
      p.life = p.maxLife;
      p.size = 2;
      p.sprite.texture = particleSquareTexture(2);
      p.sprite.visible = true;
      p.sprite.tint = EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0];
    }
  }

  /** Generic square spark for non-fire skills: holy, heal, music, dust. */
  spawnSpark(x: number, y: number, opts: SparkOpts): void {
    const n = opts.n ?? 1;
    const colors = Array.isArray(opts.colors) ? opts.colors : [opts.colors];
    for (let i = 0; i < n; i++) {
      const p = this.next('spark');
      if (!p) return;
      const spread = opts.spread ?? 6;
      const speed = opts.speed ?? 30;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.9);
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 2 * spread;
      p.y = y + (Math.random() - 0.5) * 2 * spread * 0.5;
      p.vx = (opts.vx ?? 0) + Math.cos(a) * sp;
      p.vy = (opts.vy ?? 0) + Math.sin(a) * sp;
      p.grav = opts.gravity ?? 0;
      p.maxLife = (opts.life ?? 0.7) * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = opts.size ?? 2;
      p.sprite.texture = particleSquareTexture(p.size);
      p.sprite.visible = true;
      p.sprite.tint = colors[(Math.random() * colors.length) | 0];
      p.sprite.alpha = 1;
    }
  }

  update(dt: number): void {
    if (dt <= 0) return;
    // Clamp tab-switch spikes so particles don't teleport.
    const step = Math.min(dt, 0.05);
    this.time += step;
    const t = this.time;
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= step;
      if (p.life <= 0) {
        p.alive = false;
        p.sprite.visible = false;
        continue;
      }
      const lifeT = p.life / p.maxLife; // 1 -> 0
      if (p.kind === 'fire') {
        p.vx += Math.sin(t * 9 + p.seed) * 26 * step;
        p.x += (p.vx + this.wind * 0.25) * step;
        p.y += p.vy * step;
        p.vy *= 1 - 0.4 * step; // flames ease as they cool
        // Quantized shrink 4 -> 3 -> 2, color steps down the ramp.
        const want: 2 | 3 | 4 = lifeT > 0.55 ? (p.size === 4 ? 4 : 3) : lifeT > 0.25 ? 2 : 2;
        if (want !== p.size) {
          // Only swap texture on step change (cheap, cached).
          p.size = want === 4 ? 4 : want === 3 ? 3 : 2;
          p.sprite.texture = particleSquareTexture(p.size);
        }
        // 12fps-ish color stepping: quantize lifeT to 8 steps.
        const q = Math.floor(lifeT * 8) / 8;
        p.sprite.tint = fireColor(q === 1 ? 0.999 : q, p.seed);
        p.sprite.alpha = lifeT < 0.25 ? 0.65 : 1;
      } else if (p.kind === 'smoke') {
        p.x += (p.vx + this.wind + Math.sin(t * 2.2 + p.seed) * p.wobble) * step;
        p.y += p.vy * step;
        const q = Math.floor(lifeT * 4) / 4;
        p.sprite.tint = smokeColor(q === 1 ? 0.999 : q);
        // Grow 2 -> 3 -> 4 as it disperses.
        const want: 2 | 3 | 4 = lifeT > 0.6 ? 2 : lifeT > 0.3 ? 3 : 4;
        if (want !== p.size) {
          p.size = want;
          p.sprite.texture = particleSquareTexture(p.size);
        }
        p.sprite.alpha = lifeT > 0.7 ? 0.75 : lifeT > 0.4 ? 0.5 : 0.3;
      } else if (p.kind === 'ember') {
        // Embers: gravity pulls back down slightly, flicker alpha.
        p.vy += p.grav * step;
        p.x += (p.vx + this.wind * 0.5) * step;
        p.y += p.vy * step;
        p.sprite.alpha = (t * 12 + p.seed) % 2 < 1 ? 1 : 0.45;
      } else {
        // Generic sparks: caller-defined gravity, quantized fade-out.
        p.vy += p.grav * step;
        p.x += (p.vx + this.wind * 0.5) * step;
        p.y += p.vy * step;
        p.sprite.alpha = lifeT > 0.6 ? 1 : lifeT > 0.3 ? 0.7 : 0.4;
      }
      // Integer snap = crisp squares like the campfire reference.
      p.sprite.x = Math.round(p.x);
      p.sprite.y = Math.round(p.y);
    }
  }
}
