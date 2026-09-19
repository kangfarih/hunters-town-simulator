// Monsters layer: fiend sprites + HP bars + name plates. Owns the monster
// texture cache and the per-monster sprite pool.

import { Container, Sprite, Graphics, Text, TextStyle, Texture } from 'pixi.js';
import { gridToScreen } from '../isometric';
import { monsterLabel } from '../simulation';
import type { GameSimulation } from '../simulation';
import { createMonsterFrame } from '../textures/monsters';

export class MonstersLayer {
  private textures: Map<string, Texture> = new Map();
  private sprites: Map<string, { sprite: Sprite; hpBar: Graphics; nameText?: Text }> = new Map();

  private texture(type: string, frame: number): Texture {
    const key = `${type}-${frame}`;
    let t = this.textures.get(key);
    if (!t) {
      t = createMonsterFrame(type, frame);
      this.textures.set(key, t);
    }
    return t;
  }

  sync(container: Container, sim: GameSimulation): void {
    const activeMonsterIds = new Set(sim.monsters.map(m => m.id));

    // Cleanup dead monsters
    for (const [id, data] of this.sprites.entries()) {
      if (!activeMonsterIds.has(id)) {
        container.removeChild(data.sprite);
        container.removeChild(data.hpBar);
        if (data.nameText) container.removeChild(data.nameText);
        this.sprites.delete(id);
      }
    }

    sim.monsters.forEach(m => {
      let mData = this.sprites.get(m.id);
      const frame = typeof m.animFrame === 'number' && Number.isFinite(m.animFrame) ? Math.abs(Math.floor(m.animFrame)) % 2 : 0;
      const texture = this.texture(m.type, frame);

      if (!mData) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.85);

        const hpBar = new Graphics();
        const nameText = new Text({
          text: monsterLabel(m),
          style: new TextStyle({
            fontFamily: 'monospace',
            fontSize: m.isBoss ? 10 : 8,
            fill: m.isBoss ? '#ef4444' : '#e2e8f0',
            fontWeight: 'bold',
            stroke: { color: '#000000', width: m.isBoss ? 3 : 2 }
          })
        });
        nameText.anchor.set(0.5, 1);
        container.addChild(nameText);

        container.addChild(sprite);
        container.addChild(hpBar);

        mData = { sprite, hpBar, nameText };
        this.sprites.set(m.id, mData);
      } else {
        mData.sprite.texture = texture;
        if (!mData.nameText) {
          const nameText = new Text({
            text: monsterLabel(m),
            style: new TextStyle({
              fontFamily: 'monospace',
              fontSize: m.isBoss ? 10 : 8,
              fill: m.isBoss ? '#ef4444' : '#e2e8f0',
              fontWeight: 'bold',
              stroke: { color: '#000000', width: m.isBoss ? 3 : 2 }
            })
          });
          nameText.anchor.set(0.5, 1);
          container.addChild(nameText);
          mData.nameText = nameText;
        }
      }

      const screenPos = gridToScreen(m.gx, m.gy);
      mData.sprite.x = screenPos.x;
      mData.sprite.y = screenPos.y;
      const baseScale = m.isBoss ? 1.5 : 1.0;
      // Face left/right (monster art faces right; mirror for SW).
      const faceSign = m.facing === 'SW' ? -1 : 1;
      // Walk/idle bob: PATROL bobs, IDLE breathes subtly, COMBAT tenses.
      const bobY = m.state === 'PATROL' ? (frame === 1 ? -2 : 0) : (m.state === 'COMBAT' ? 1 : Math.sin(frame * Math.PI) * 0.5);
      mData.sprite.y += bobY;
      mData.sprite.scale.set(baseScale * faceSign, baseScale);
      // Attack lunge toward facing when attackAnimTimer is active.
      const atkT = typeof m.attackAnimTimer === 'number' && m.attackAnimTimer > 0
        ? Math.max(0, Math.min(1, m.attackAnimTimer / 0.35))
        : 0;
      if (atkT > 0) {
        const punch = Math.sin((1 - atkT) * Math.PI) * 8;
        mData.sprite.x += (m.facing === 'SW' ? -1 : 1) * punch;
        mData.sprite.scale.set(baseScale * faceSign * 1.08, baseScale * 0.94);
      }
      mData.sprite.zIndex = (m.gx + m.gy) * 100 + 15;

      // Monster HP Bar
      mData.hpBar.clear();
      const barW = m.isBoss ? 44 : 22;
      const barH = m.isBoss ? 5 : 3;
      const hpRatio = Math.max(0, Math.min(1, m.hp / m.maxHp));

      const barY = m.isBoss ? screenPos.y - 54 : screenPos.y - 36;
      mData.hpBar.rect(screenPos.x - barW / 2, barY, barW, barH).fill({ color: 0x1f2937 });
      mData.hpBar.rect(screenPos.x - barW / 2, barY, barW * hpRatio, barH).fill({ color: m.isBoss ? 0xa855f7 : 0xdc2626 });
      mData.hpBar.zIndex = mData.sprite.zIndex + 5;

      if (mData.nameText) {
        mData.nameText.text = monsterLabel(m);
        mData.nameText.x = screenPos.x;
        mData.nameText.y = barY - 2;
        mData.nameText.zIndex = mData.sprite.zIndex + 6;
      }
    });
  }

  /** Drop pooled sprites so a remount rebuilds cleanly. */
  clear(): void {
    this.sprites.clear();
  }
}
