// Hunters layer: hero sprites + HP bars + name plates + whirlwind spin.
// Owns the hunter texture cache, the sprite pool, and the per-hunter
// whirl state. Yard-station spots come from src/game/objects.

import { Container, Sprite, Graphics, Text, TextStyle, Texture } from 'pixi.js';
import { gridToScreen, gridDistance } from '../isometric';
import { partyColor } from '../simulation';
import type { GameSimulation } from '../simulation';
import type { CharacterClass, Hunter } from '../../types';
import { stationSpotFor } from '../objects/yard';
import { createHunterFrame } from '../textures/hunters';

export interface HunterPick {
  pickHunter(h: Hunter): void;
}

export class HuntersLayer {
  private textures: Map<string, Texture> = new Map();
  private sprites: Map<string, { sprite: Sprite; hpBar: Graphics; nameText: Text }> = new Map();
  // Berserker whirl state per hunter: spin rotation accumulator + short
  // burst timer so the hunter keeps whirling briefly after leaving its storm.
  private whirl: Map<string, { rotation: number; burst: number; lastZoneId: string | null }> = new Map();

  private texture(charClass: CharacterClass, facing: 'SE' | 'SW', action: 'idle' | 'walk' | 'attack' | 'cast', frame: number): Texture {
    const key = `${charClass}-${facing}-${action}-${frame}`;
    let t = this.textures.get(key);
    if (!t) {
      t = createHunterFrame(charClass, facing, action, frame);
      this.textures.set(key, t);
    }
    return t;
  }

  sync(container: Container, sim: GameSimulation, dt: number, followId: string | null, pick: HunterPick): void {
    const activeHunterIds = new Set(sim.hunters.map(h => h.id));
    // Leader ids derived once per frame from runtime parties (not per hunter).
    const leaderIds = new Set([...sim.parties.values()].map(p => p.leaderId));

    // Cleanup dead/removed hunter sprites
    for (const [id, data] of this.sprites.entries()) {
      if (!activeHunterIds.has(id)) {
        container.removeChild(data.sprite);
        container.removeChild(data.hpBar);
        container.removeChild(data.nameText);
        this.sprites.delete(id);
        this.whirl.delete(id);
      }
    }

    sim.hunters.forEach(hunter => {
      let hData = this.sprites.get(hunter.id);

      // Yard stations (chairs/beds/anvils/vats/dummies in src/game/objects):
      // sitters stand slightly SOUTH of their furniture so the iso prop
      // peeks behind them instead of hiding inside the hunter sprite.
      const spot = stationSpotFor(sim, hunter);
      const px = spot ? spot.x + 0.15 : hunter.gx;
      const py = spot ? spot.y + 0.15 : hunter.gy;

      // Determine action for frame lookup
      let action: 'idle' | 'walk' | 'attack' | 'cast' = 'idle';
      if (!spot && hunter.isAttacking) {
        action = (hunter.charClass === 'Sorcerer' || hunter.charClass === 'Cleric' || hunter.charClass === 'Bard') ? 'cast' : 'attack';
      } else if (!spot && (hunter.state === 'HUNTING' || hunter.state === 'TRAVELING_TO_HUNT' || hunter.state === 'RETURNING_TO_TOWN' || hunter.state === 'SPAWNING' || hunter.state === 'REGISTERING')) {
        action = 'walk';
      }

      const texture = this.texture(hunter.charClass, hunter.facing === 'NW' ? 'SW' : (hunter.facing === 'NE' ? 'SE' : hunter.facing), action, hunter.animFrame);

      if (!hData) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.85);
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';
        sprite.on('pointerdown', () => {
          pick.pickHunter(hunter);
        });

        const hpBar = new Graphics();
        const nameText = new Text({
          text: `${hunter.name}`,
          style: new TextStyle({
            fontFamily: 'monospace',
            fontSize: 9,
            fill: '#cbd5e1',
            fontWeight: 'bold',
            stroke: { color: '#000000', width: 2 }
          })
        });
        nameText.anchor.set(0.5, 1);

        container.addChild(sprite);
        container.addChild(hpBar);
        container.addChild(nameText);

        hData = { sprite, hpBar, nameText };
        this.sprites.set(hunter.id, hData);
      } else {
        hData.sprite.texture = texture;
      }

      const screenPos = gridToScreen(px, py);
      hData.sprite.x = screenPos.x;
      hData.sprite.y = screenPos.y;
      hData.sprite.zIndex = (px + py) * 100 + 20;

      // Attack lunge: punch a few pixels toward the facing, then recoil.
      // attackAnimTimer counts 0.35 -> 0, so punch peaks mid-swing.
      // (Seated/bedded hunters never attack, so no lunge off their spot.)
      if (!spot && hunter.isAttacking) {
        const swingT = Math.max(0, Math.min(1, hunter.attackAnimTimer / 0.35));
        const punch = Math.sin((1 - swingT) * Math.PI) * 9;
        const dirX = (hunter.facing === 'SE' || hunter.facing === 'NE') ? 1 : -1;
        const dirY = (hunter.facing === 'SE' || hunter.facing === 'SW') ? 0.5 : -0.5;
        hData.sprite.x += dirX * punch;
        hData.sprite.y += dirY * punch;
      }

      // Whirlwind: spin the warrior sprite + orbiting dust particles around
      // the warrior itself (no ground circle, no cyclone ring sprite).
      // Facing stays texture-driven (frame lookup above), so rotation is a
      // pure overlay — always reset to 0 when the whirl ends.
      const ownStorms = sim.activeZones.filter(
        z => z.kind === 'storm' && z.sourceId === hunter.id
      );
      const hasStorm = ownStorms.length > 0;
      const newestStormId = hasStorm ? ownStorms[ownStorms.length - 1].id : null;
      let w = this.whirl.get(hunter.id);
      if (!w) {
        w = { rotation: 0, burst: 0, lastZoneId: null };
        this.whirl.set(hunter.id, w);
      }
      // Fresh cast (new zone id) grants a ~0.9s spin burst so the whirl reads
      // even if the caster never steps into the storm (storms pin to target).
      if (newestStormId && newestStormId !== w.lastZoneId) {
        w.burst = 0.9;
        w.lastZoneId = newestStormId;
      }
      if (!hasStorm) {
        w.lastZoneId = null;
      }
      const insideOwnStorm = hasStorm && ownStorms.some(
        z => gridDistance(hunter.gx, hunter.gy, z.x, z.y) <= z.radius + 0.75
      );
      // While inside, keep the burst topped up so leaving mid-storm still
      // gets a short tail spin; otherwise let the cast burst decay.
      if (insideOwnStorm) {
        w.burst = 0.9;
      } else if (w.burst > 0) {
        w.burst = Math.max(0, w.burst - dt);
      }
      const whirling = hasStorm && (insideOwnStorm || w.burst > 0);
      if (whirling) {
        w.rotation += 11 * dt;
        hData.sprite.rotation = w.rotation;
        hData.sprite.scale.set(1.12);
      } else {
        if (w.rotation !== 0) {
          w.rotation = 0;
          hData.sprite.rotation = 0;
          hData.sprite.scale.set(1);
        }
        if (!hasStorm && w.burst <= 0) {
          this.whirl.delete(hunter.id);
        }
      }

      // Update HP bar
      hData.hpBar.clear();
      const barW = 26;
      const barH = 3;
      const hpRatio = Math.max(0, Math.min(1, hunter.hp / sim.effectiveMaxHp(hunter)));

      // Selection highlight ring if followed
      if (followId === hunter.id) {
        hData.hpBar.ellipse(screenPos.x, screenPos.y, 16, 8).stroke({ color: 0xfde047, width: 2 });
      }

      // HP background
      hData.hpBar.rect(screenPos.x - barW / 2, screenPos.y - 42, barW, barH).fill({ color: 0x1f2937 });
      // HP fill
      const hpColor = hpRatio > 0.5 ? 0x22c55e : (hpRatio > 0.25 ? 0xeab308 : 0xef4444);
      hData.hpBar.rect(screenPos.x - barW / 2, screenPos.y - 42, barW * hpRatio, barH).fill({ color: hpColor });
      // Whirlwind particles: small dust motes orbiting the warrior.
      // Dots only — no circle/ring strokes.
      if (whirling) {
        const fade = Math.min(1, w.burst > 0 ? w.burst / 0.9 + 0.3 : 1);
        for (let m = 0; m < 7; m++) {
          const orbit = w.rotation * 1.4 + m * (Math.PI * 2 / 7);
          const ox = screenPos.x + Math.cos(orbit) * 16;
          const oy = screenPos.y - 12 + Math.sin(orbit) * 8 - ((m * 13) % 5);
          hData.hpBar.circle(ox, oy, m % 2 === 0 ? 2.2 : 1.6).fill({
            color: m % 3 === 0 ? 0xf8fafc : m % 3 === 1 ? 0xd6c9a8 : 0x94a3b8,
            alpha: 0.75 * Math.min(1, fade),
          });
        }
      }
      hData.hpBar.zIndex = hData.sprite.zIndex + 5;

      // Name & Level (party icon prefix beside the name; LFP 🔍 takes
      // precedence while seeking, lobby 🌀 while awaiting the Vault;
      // boss/monster labels untouched)
      // LFP seekers render the idle frame: LOOKING_FOR_PARTY is deliberately
      // absent from the walk-action condition above — they wait at the plaza.
      // DUNGEON_LOBBY likewise idles (seated waiters pin to their chairs via
      // stationSpotFor; walkers-to-portal hold the idle frame like LFP).
      const partyIcon = hunter.state === 'LOOKING_FOR_PARTY' ? '🔍 ' : hunter.state === 'DUNGEON_LOBBY' ? '🌀 ' : leaderIds.has(hunter.id) ? '♛ ' : hunter.partyId ? '👥 ' : '';
      hData.nameText.text = `${partyIcon}Lv.${hunter.level} ${hunter.name.split(' ')[0]}`;
      hData.nameText.style.fill = partyColor(hunter.partyId) ?? '#cbd5e1';
      hData.nameText.x = screenPos.x;
      hData.nameText.y = screenPos.y - 44;
      hData.nameText.zIndex = hData.sprite.zIndex + 6;
    });
  }

  /** Drop pooled sprites so a remount rebuilds cleanly. */
  clear(): void {
    this.sprites.clear();
    this.whirl.clear();
  }
}
