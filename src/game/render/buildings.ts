// Buildings layer: iso building sprites + level labels + iso selection
// ring. Owns the building texture cache and the per-building sprite pool.

import { Container, Sprite, Graphics, Text, TextStyle, Texture } from 'pixi.js';
import { gridToScreen } from '../isometric';
import type { GameSimulation } from '../simulation';
import type { Building } from '../../types';
import { createBuildingTexture } from '../textures/buildings/index';

export interface BuildingPick {
  pickBuilding(b: Building): void;
}

export class BuildingsLayer {
  private textures: Map<string, Texture> = new Map();
  private sprites: Map<string, { sprite: Sprite; levelText: Text; badge: Graphics }> = new Map();

  private texture(type: Building['type'], level: number): Texture {
    const key = `${type}-${level}`;
    let t = this.textures.get(key);
    if (!t) {
      t = createBuildingTexture(type, level);
      this.textures.set(key, t);
    }
    return t;
  }

  sync(container: Container, sim: GameSimulation, selectedId: string | null, pick: BuildingPick): void {
    sim.buildings.forEach(b => {
      let bData = this.sprites.get(b.id);
      const texture = this.texture(b.type, b.level);

      if (!bData) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.75);
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';
        sprite.on('pointerdown', () => {
          pick.pickBuilding(b);
        });

        const badge = new Graphics();
        const levelText = new Text({
          text: `Lv.${b.level}`,
          style: new TextStyle({
            fontFamily: 'monospace',
            fontSize: 10,
            fill: '#fde047',
            fontWeight: 'bold',
            stroke: { color: '#000000', width: 2 }
          })
        });
        levelText.anchor.set(0.5, 1);

        container.addChild(sprite);
        container.addChild(badge);
        container.addChild(levelText);

        bData = { sprite, levelText, badge };
        this.sprites.set(b.id, bData);
      } else {
        bData.sprite.texture = texture;
      }

      const screenPos = gridToScreen(b.gx, b.gy);
      bData.sprite.x = screenPos.x;
      bData.sprite.y = screenPos.y;
      bData.sprite.zIndex = (b.gx + b.gy) * 100 + 10;

      // Update level badge and transaction indicator
      bData.levelText.text = `${b.name} Lv.${b.level}`;
      bData.levelText.x = screenPos.x;
      bData.levelText.y = screenPos.y - 70;
      bData.levelText.zIndex = bData.sprite.zIndex + 5;

      // Iso selection ring: diamond-hugging double ellipse on the ground
      // plane (2:1), sized to the 88px platform + margin. Never a circle.
      bData.badge.clear();
      if (selectedId === b.id) {
        const pulse = 1 + Math.sin(performance.now() / 350) * 0.03;
        bData.badge.ellipse(screenPos.x, screenPos.y + 16, 50 * pulse, 24 * pulse)
          .stroke({ color: 0xfacc15, width: 2.5 });
        bData.badge.ellipse(screenPos.x, screenPos.y + 16, 43 * pulse, 20 * pulse)
          .stroke({ color: 0xffffff, width: 1, alpha: 0.65 });
        // Corner ticks on the diamond axes sell the iso snap
        for (const [dx, dy] of [[50, 0], [-50, 0], [0, 24], [0, -24]] as const) {
          bData.badge.circle(screenPos.x + dx * pulse, screenPos.y + 16 + dy * pulse, 2)
            .fill({ color: 0xfacc15 });
        }
      }
      bData.badge.zIndex = bData.sprite.zIndex - 1;
    });
  }

  /** Drop pooled sprites so a remount rebuilds cleanly. */
  clear(): void {
    this.sprites.clear();
  }
}
