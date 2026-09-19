// Effects layer: skill-zone ground discs + flying skill sprites +
// floating combat text. Owns the VFX texture cache; nothing is pooled
// (all three renders rebuild their containers every frame).

import { Container, Sprite, Graphics, Text, TextStyle, Texture } from 'pixi.js';
import { gridToScreen } from '../isometric';
import type { GameSimulation } from '../simulation';
import { zoneColor } from '../types';
import { createSkillVfxTexture } from '../textures/vfx';

export class EffectsLayer {
  private textures: Map<string, Texture> = new Map();

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
        // Flickering ember core.
        const flicker = 0.6 + 0.4 * Math.abs(Math.sin(z.elapsed * 9 + 1));
        g.ellipse(p.x, cy, rx * 0.45, ry * 0.45).fill({ color: 0xfacc15, alpha: 0.35 * flicker * fade });
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
        ballad: 0.9, encore: 1.0,
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
