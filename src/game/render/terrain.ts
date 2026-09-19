// Static terrain layer: iso tile grid + portal marker + reserve labels +
// directional palisades. Built once per mount; owns its tile texture cache.

import { Container, Sprite, Graphics, Text, TextStyle, Texture } from 'pixi.js';
import { gridToScreen, MAP_GRID_WIDTH, MAP_GRID_HEIGHT } from '../isometric';
import { reserveAt, RESERVE_REGIONS, WALL_CELLS, isHubCell } from '../pathfinding';
import { SUMMON_PORTAL_POS } from '../simulation';
import { createIsoTileTexture } from '../textures/tiles';

export class TerrainLayer {
  private tileTextures: Record<string, Texture> = {};

  private tileTexture(type: 'town_cobble' | 'town_wood' | 'forest_grass' | 'graveyard_soil' | 'volcanic_rock' | 'stone_road' | 'reserve_dark'): Texture {
    return (this.tileTextures[type] ??= createIsoTileTexture(type));
  }

  /** Rebuild the whole static grid into container (clears first). */
  build(container: Container): void {
    container.removeChildren();

    for (let gx = 0; gx < MAP_GRID_WIDTH; gx++) {
      for (let gy = 0; gy < MAP_GRID_HEIGHT; gy++) {
        let tileType: 'town_cobble' | 'town_wood' | 'forest_grass' | 'graveyard_soil' | 'volcanic_rock' | 'stone_road' | 'reserve_dark' = 'forest_grass';

        // Central interchange plaza: stone hub where the palisades meet.
        // Special-cased before region mapping; all other mapping unchanged.
        if (isHubCell(gx, gy)) {
          tileType = 'stone_road';
        }
        // Reserved expansion land (freed northwest bands): dark placeholder,
        // skipping all existing region logic below.
        else if (reserveAt(gx, gy) !== null) {
          tileType = 'reserve_dark';
        }
        // Town Area: 20..38, 20..38
        else if (gx >= 20 && gx <= 38 && gy >= 20 && gy <= 38) {
          if (gx >= 26 && gx <= 32 && gy >= 26 && gy <= 34) {
            tileType = 'town_wood'; // Center wooden plaza
          } else {
            tileType = 'town_cobble'; // Cobblestone town
          }
        }
        // Road Connecting Town Gate to Field
        else if (gx >= 36 && gx <= 42 && gy >= 28 && gy <= 32) {
          tileType = 'stone_road';
        }
        // Zone 1: Whispering Forest (gx > 38, gy <= 38)
        else if (gx > 38 && gy <= 38) {
          tileType = 'forest_grass';
        }
        // Zone 2: Gloomy Graveyard (gx <= 38, gy > 38)
        else if (gx <= 38 && gy > 38) {
          tileType = 'graveyard_soil';
        }
        // Zone 3: Volcanic Crater (gx > 18, gy > 18)
        else {
          tileType = 'volcanic_rock';
        }

        const texture = this.tileTexture(tileType);
        if (texture) {
          const sprite = new Sprite(texture);
          const screenPos = gridToScreen(gx, gy);
          sprite.x = screenPos.x;
          sprite.y = screenPos.y;
          sprite.anchor.set(0.5, 0);
          container.addChild(sprite);
        }
      }
    }

    // Add Town Portal / Gate Markers
    const portalGfx = new Graphics();
    const portalPos = gridToScreen(SUMMON_PORTAL_POS.gx, SUMMON_PORTAL_POS.gy);
    portalGfx.circle(portalPos.x, portalPos.y + 16, 24).fill({ color: 0x6366f1, alpha: 0.35 });
    portalGfx.circle(portalPos.x, portalPos.y + 16, 16).fill({ color: 0x818cf8, alpha: 0.5 });
    portalGfx.circle(portalPos.x, portalPos.y + 16, 8).fill({ color: 0xc7d2fe, alpha: 0.8 });
    container.addChild(portalGfx);

    // Faint labels at each reserved region's center tile
    const reserveNumerals = ['I', 'II', 'III', 'IV', 'V'];
    RESERVE_REGIONS.forEach((region, i) => {
      const cx = Math.floor((region.minGx + region.maxGx) / 2);
      const cy = Math.floor((region.minGy + region.maxGy) / 2);
      const labelPos = gridToScreen(cx, cy);
      const label = new Text({
        text: `RESERVED ${reserveNumerals[i] ?? (i + 1)}`,
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: 12,
          fill: '#9ca3af',
          fontWeight: 'bold',
          stroke: { color: '#000000', width: 3 },
        }),
      });
      label.anchor.set(0.5, 0.5);
      label.x = labelPos.x;
      label.y = labelPos.y + 16;
      label.alpha = 0.6;
      container.addChild(label);
    });

    this.buildWalls(container);
  }

  // Directional palisades: thin wall SEGMENTS, not square blocks.
  // E-W runs (y==39: town-south + forest/volcano line) travel down-right
  // (32,16) and show their SW (dark) face; N-S runs (x==39: town-east +
  // graveyard/volcano line) travel down-left (-32,16) and show SE (lit).
  // Segments overlap 8px into neighbors for a continuous rampart; open
  // ends at gates/map edges get a taller gate post cap. Gate cells stay
  // gaps by construction. Sorted back-to-front.
  private buildWalls(container: Container): void {
    const sortedWalls = [...WALL_CELLS].sort((a, b) => (a.x + a.y) - (b.x + b.y));
    const wallSet = new Set(WALL_CELLS.map(c => `${c.x},${c.y}`));
    const WH = 24, HL = 20, TW = 6;
    for (const cell of sortedWalls) {
      const p = gridToScreen(cell.x, cell.y);
      const cx = p.x, cy = p.y + 16; // wall base center (diamond center)
      const g = new Graphics();
      const isEW = cell.y === 39;
      // Run direction (unit * HL) + south-pointing half-thickness normal
      const ux = (isEW ? 0.8944 : -0.8944) * HL;
      const uy = 0.4472 * HL;
      const nx = (isEW ? -0.4472 : 0.4472) * TW;
      const ny = 0.8944 * TW;
      // Top-strip corners: P1/P2 = front (south) edge, P3/P4 = back edge
      const P1 = { x: cx - ux + nx, y: cy - uy + ny - WH };
      const P2 = { x: cx + ux + nx, y: cy + uy + ny - WH };
      const P3 = { x: cx + ux - nx, y: cy + uy - ny - WH };
      const P4 = { x: cx - ux - nx, y: cy - uy - ny - WH };
      const F1 = { x: P1.x, y: P1.y + WH };
      const F2 = { x: P2.x, y: P2.y + WH };
      // Ground shadow stretched along the run
      g.ellipse(cx, cy + 4, 24, 8).fill({ color: 0x000000, alpha: 0.3 });
      // Front face (direction-shaded) + top strip
      const faceColor = isEW ? 0x6b4a26 : 0x8b5a2b;
      g.moveTo(P1.x, P1.y).lineTo(P2.x, P2.y).lineTo(F2.x, F2.y).lineTo(F1.x, F1.y).closePath()
        .fill({ color: faceColor });
      g.moveTo(P1.x, P1.y).lineTo(P2.x, P2.y).lineTo(P3.x, P3.y).lineTo(P4.x, P4.y).closePath()
        .fill({ color: 0xd9a066 });
      // Log seams: verticals on the face + cross-seams on the cap
      for (const t of [-0.5, 0, 0.5]) {
        const fx = P1.x + (P2.x - P1.x) * (t + 0.5);
        const fy = P1.y + (P2.y - P1.y) * (t + 0.5);
        g.moveTo(fx, fy).lineTo(fx, fy + WH).stroke({ color: 0x3f2a18, width: 1.2, alpha: 0.6 });
        const ax = P1.x + (P2.x - P1.x) * (t + 0.5);
        const ay = P1.y + (P2.y - P1.y) * (t + 0.5);
        const bx = P4.x + (P3.x - P4.x) * (t + 0.5);
        const by = P4.y + (P3.y - P4.y) * (t + 0.5);
        g.moveTo(ax, ay).lineTo(bx, by).stroke({ color: 0x3f2a18, width: 1, alpha: 0.5 });
      }
      // Palisade spikes along the ridge (3 tips leaning south)
      for (const t of [-0.55, 0, 0.55]) {
        const bx = cx + ux * 2 * t * 0.5 + nx * 0;
        const by = cy - WH + ny * 0 - 2;
        g.moveTo(bx - 5, by + 3).lineTo(bx, by - 6).lineTo(bx + 5, by + 3).closePath()
          .fill({ color: t < 0 ? 0x8b5a2b : 0xd9a066 });
      }
      // Outlines: front face + cap
      g.moveTo(P1.x, P1.y).lineTo(P2.x, P2.y).lineTo(F2.x, F2.y).lineTo(F1.x, F1.y).closePath()
        .stroke({ color: 0x2a1a0c, width: 1.5 });
      g.moveTo(P1.x, P1.y).lineTo(P2.x, P2.y).lineTo(P3.x, P3.y).lineTo(P4.x, P4.y).closePath()
        .stroke({ color: 0x2a1a0c, width: 1.2 });
      // Gate/map end posts: taller capped pier where the run breaks
      const hasPrev = wallSet.has(isEW ? `${cell.x - 1},${cell.y}` : `${cell.x},${cell.y - 1}`);
      const hasNext = wallSet.has(isEW ? `${cell.x + 1},${cell.y}` : `${cell.x},${cell.y + 1}`);
      const postAt = (sx: number, sy: number) => {
        // Mini iso pier: diamond cap + two faces, 8px taller + iron band
        const pw = 7, ph = 3.5, pwh = WH + 8;
        g.moveTo(sx - pw, sy - pwh).lineTo(sx, sy + ph - pwh)
          .lineTo(sx, sy + ph - pwh + pwh).lineTo(sx - pw, sy - pwh + pwh).closePath()
          .fill({ color: 0x4a2f16 });
        g.moveTo(sx + pw, sy - pwh).lineTo(sx, sy + ph - pwh)
          .lineTo(sx, sy + ph - pwh + pwh).lineTo(sx + pw, sy - pwh + pwh).closePath()
          .fill({ color: 0x7c5228 });
        g.moveTo(sx, sy - ph - pwh).lineTo(sx + pw, sy - pwh)
          .lineTo(sx, sy + ph - pwh).lineTo(sx - pw, sy - pwh).closePath()
          .fill({ color: 0xe8b64c });
        g.rect(sx - pw, sy - pwh + 10, pw * 2, 3).fill({ color: 0x374151 });
      };
      if (!hasPrev) postAt(cx - ux + nx, cy - uy + ny);
      if (!hasNext) postAt(cx + ux + nx, cy + uy + ny);
      container.addChild(g);
    }
  }
}
