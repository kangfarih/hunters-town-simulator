import { 
  Application, Container, Sprite, Graphics, Text, TextStyle, Texture 
} from 'pixi.js';
import { GameSimulation, SUMMON_PORTAL_POS, monsterLabel, partyColor } from './simulation';
import { 
  gridToScreen, screenToGrid, gridDistance, MAP_GRID_WIDTH, MAP_GRID_HEIGHT 
} from './isometric';
import { reserveAt, RESERVE_REGIONS, WALL_CELLS, isHubCell } from './pathfinding';
import {
  createIsoTileTexture, createHunterFrame, createMonsterFrame,
  createBuildingTexture, createSkillVfxTexture,
} from './pixelArtTextures';
import { clearYards, createYardState, renderYards, stationSpotFor, type YardState } from './objects/yard';
import { CharacterClass, Hunter, Building } from '../types';
import { zoneColor } from './types';

export class PixiRenderer {
  public app: Application | null = null;
  public simulation: GameSimulation;
  
  // Lifecycle flags
  private isDestroyed: boolean = false;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private teardownFns: Array<() => void> = [];
  
  // Containers
  private worldContainer: Container = new Container();
  private terrainContainer: Container = new Container();
  private zoneContainer: Container = new Container();
  private entitiesContainer: Container = new Container();
  private vfxContainer: Container = new Container();
  private overlayContainer: Container = new Container();

  // Textures cache
  private tileTextures: Record<string, Texture> = {};
  private hunterTextures: Map<string, Texture> = new Map();
  private monsterTextures: Map<string, Texture> = new Map();
  private buildingTextures: Map<string, Texture> = new Map();
  private vfxTextures: Map<string, Texture> = new Map();

  // Camera state
  public cameraX: number = 0;
  public cameraY: number = 0;
  public cameraZoom: number = 1.0;
  public followTargetHunterId: string | null = null;
  public followTargetBuildingId: string | null = null;

  // Interaction handlers
  public onSelectHunter?: (hunter: Hunter | null) => void;
  public onSelectBuilding?: (building: Building | null) => void;

  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private lastCameraX: number = 0;
  private lastCameraY: number = 0;

  // Entity Sprite pools/maps to avoid recreating every frame
  private hunterSprites: Map<string, { sprite: Sprite; hpBar: Graphics; nameText: Text }> = new Map();
  // Berserker whirl state per hunter: spin rotation accumulator + short
  // burst timer so the hunter keeps whirling briefly after leaving its storm.
  private hunterWhirl: Map<string, { rotation: number; burst: number; lastZoneId: string | null }> = new Map();
  private monsterSprites: Map<string, { sprite: Sprite; hpBar: Graphics; nameText?: Text }> = new Map();
  private buildingSprites: Map<string, { sprite: Sprite; levelText: Text; badge: Graphics }> = new Map();

  // Building yard decor (chairs/tables, beds, anvils, vats, dummies).
  // Painter + tile layout + per-yard render live in src/game/objects/*
  // (one module per prop); the renderer only owns the per-instance caches.
  private yards: YardState = createYardState();

  // Camera anchor: set once the renderer reports a real (non-zero) screen size,
  // so the town stays centered even if layout wasn't ready during init.
  private cameraAnchored: boolean = false;

  constructor(simulation: GameSimulation) {
    this.simulation = simulation;
  }

  private centerCameraOnTown() {
    if (!this.app) return;
    const centerScreen = gridToScreen(30, 30);
    this.cameraX = (this.app.screen.width / 2) - centerScreen.x * this.cameraZoom;
    this.cameraY = (this.app.screen.height / 2) - centerScreen.y * this.cameraZoom;
    this.worldContainer.position.set(this.cameraX, this.cameraY);
    this.cameraAnchored = true;
  }

  public async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.isDestroyed || this.initPromise) return;

    const app = new Application();
    this.app = app;

    this.initPromise = (async () => {
      await app.init({
        canvas,
        resizeTo: canvas.parentElement || window,
        backgroundColor: 0x090714,
        resolution: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
        autoDensity: true,
        antialias: false, // Crisp retro pixels
      });

      // If destroy() was called while init was awaiting, tear down fully
      // (including the ticker) so no orphaned animation loop survives.
      if (this.isDestroyed || this.app !== app) {
        this.destroyApp(app);
        return;
      }

      this.isInitialized = true;

      // Build scene graph
      this.worldContainer.addChild(this.terrainContainer);
      this.worldContainer.addChild(this.zoneContainer);
      this.worldContainer.addChild(this.entitiesContainer);
      this.worldContainer.addChild(this.vfxContainer);
      this.worldContainer.addChild(this.overlayContainer);
      app.stage.addChild(this.worldContainer);

      // Generate static textures
      this.initTextures();

      // Render static isometric terrain tiles
      this.renderTerrainGrid();

      // Center camera on town sanctuary (deferred until screen has real size)
      if (app.screen.width > 0 && app.screen.height > 0) {
        this.centerCameraOnTown();
      }

      // Setup input listeners for camera pan & zoom
      this.setupInteractions(canvas);

      // Start main render ticker
      app.ticker.add(this.tickerHandler);
    })();

    await this.initPromise;
  }

  private tickerHandler = (ticker: any) => {
    if (this.isDestroyed || !this.app) return;
    // Late-anchor the camera once the canvas has a real size
    // (covers StrictMode remounts and resizes during boot).
    if (!this.cameraAnchored && this.app.screen.width > 0 && this.app.screen.height > 0) {
      this.centerCameraOnTown();
    }
    const dt = ticker.deltaTime / 60;
    this.simulation.update(dt);
    this.renderFrame(dt);
  };

  private initTextures() {
    this.tileTextures['town_cobble'] = createIsoTileTexture('town_cobble');
    this.tileTextures['town_wood'] = createIsoTileTexture('town_wood');
    this.tileTextures['forest_grass'] = createIsoTileTexture('forest_grass');
    this.tileTextures['graveyard_soil'] = createIsoTileTexture('graveyard_soil');
    this.tileTextures['volcanic_rock'] = createIsoTileTexture('volcanic_rock');
    this.tileTextures['stone_road'] = createIsoTileTexture('stone_road');
    this.tileTextures['reserve_dark'] = createIsoTileTexture('reserve_dark');

    // Pre-cache building textures
    this.simulation.buildings.forEach(b => {
      const key = `${b.type}-${b.level}`;
      this.buildingTextures.set(key, createBuildingTexture(b.type, b.level));
    });

    // Pre-cache VFX textures
    ['slash', 'meteor', 'whirlwind', 'smite', 'multishot', 'heal', 'holy_burst', 'ballad', 'encore', 'impact', 'levelup'].forEach(v => {
      this.vfxTextures.set(v, createSkillVfxTexture(v));
    });
  }

  private getHunterTexture(charClass: CharacterClass, facing: 'SE' | 'SW', action: 'idle' | 'walk' | 'attack' | 'cast', frame: number): Texture {
    const key = `${charClass}-${facing}-${action}-${frame}`;
    if (!this.hunterTextures.has(key)) {
      this.hunterTextures.set(key, createHunterFrame(charClass, facing, action, frame));
    }
    return this.hunterTextures.get(key)!;
  }

  private getMonsterTexture(type: string, frame: number): Texture {
    const key = `${type}-${frame}`;
    if (!this.monsterTextures.has(key)) {
      this.monsterTextures.set(key, createMonsterFrame(type, frame));
    }
    return this.monsterTextures.get(key)!;
  }

  // --------------------------------------------------------------------------
  // TERRAIN GENERATION
  // --------------------------------------------------------------------------

  private renderTerrainGrid() {
    this.terrainContainer.removeChildren();

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

        const texture = this.tileTextures[tileType];
        if (texture) {
          const sprite = new Sprite(texture);
          const screenPos = gridToScreen(gx, gy);
          sprite.x = screenPos.x;
          sprite.y = screenPos.y;
          sprite.anchor.set(0.5, 0);
          this.terrainContainer.addChild(sprite);
        }
      }
    }

    // Add Town Portal / Gate Markers
    const portalGfx = new Graphics();
    const portalPos = gridToScreen(SUMMON_PORTAL_POS.gx, SUMMON_PORTAL_POS.gy);
    portalGfx.circle(portalPos.x, portalPos.y + 16, 24).fill({ color: 0x6366f1, alpha: 0.35 });
    portalGfx.circle(portalPos.x, portalPos.y + 16, 16).fill({ color: 0x818cf8, alpha: 0.5 });
    portalGfx.circle(portalPos.x, portalPos.y + 16, 8).fill({ color: 0xc7d2fe, alpha: 0.8 });
    this.terrainContainer.addChild(portalGfx);

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
      this.terrainContainer.addChild(label);
    });

    // Directional palisades: thin wall SEGMENTS, not square blocks.
    // E-W runs (y==39: town-south + forest/volcano line) travel down-right
    // (32,16) and show their SW (dark) face; N-S runs (x==39: town-east +
    // graveyard/volcano line) travel down-left (-32,16) and show SE (lit).
    // Segments overlap 8px into neighbors for a continuous rampart; open
    // ends at gates/map edges get a taller gate post cap. Gate cells stay
    // gaps by construction. Sorted back-to-front.
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
      this.terrainContainer.addChild(g);
    }
  }

  // --------------------------------------------------------------------------
  // RENDER FRAME (Depth Sorted Entities, VFX, UI)
  // --------------------------------------------------------------------------

  private renderFrame(dt: number) {
    this.updateCameraFollow();

    // 1. Render Buildings
    this.renderBuildings();

    // 1b-f. Building yards (one module per prop in src/game/objects/*).
    renderYards(this.yards, { container: this.entitiesContainer, sim: this.simulation });

    // 1g. Render Skill Zones (ground discs below sprites)
    this.renderZones();

    // 2. Render Hunters
    this.renderHunters(dt);

    // 3. Render Monsters
    this.renderMonsters();

    // 4. Render Skill VFX
    this.renderSkillVfx();

    // 5. Render Floating Damage / Text
    this.renderFloatingTexts();

    // Depth sort entities inside entitiesContainer
    this.entitiesContainer.children.sort((a, b) => a.zIndex - b.zIndex);
  }

  private renderBuildings() {
    this.simulation.buildings.forEach(b => {
      let bData = this.buildingSprites.get(b.id);
      const key = `${b.type}-${b.level}`;
      let texture = this.buildingTextures.get(key);
      if (!texture) {
        texture = createBuildingTexture(b.type, b.level);
        this.buildingTextures.set(key, texture);
      }

      if (!bData) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.75);
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';
        sprite.on('pointerdown', () => {
          this.followTargetBuildingId = b.id;
          this.followTargetHunterId = null;
          if (this.onSelectBuilding) this.onSelectBuilding(b);
          if (this.onSelectHunter) this.onSelectHunter(null);
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

        this.entitiesContainer.addChild(sprite);
        this.entitiesContainer.addChild(badge);
        this.entitiesContainer.addChild(levelText);

        bData = { sprite, levelText, badge };
        this.buildingSprites.set(b.id, bData);
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
      if (this.followTargetBuildingId === b.id) {
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

  // Yard spot resolvers + decor renders live in src/game/objects/*
  // (chair/bed/anvil/vat/dummy, orchestrated by objects/yard.ts).

  /**
   * Skill-zone layer (below sprites): soft ground discs + kind motifs.
   * Berserker storm has no ground visual — damage still ticks at the anchor
   * but the whirlwind particles orbit the warrior itself (see renderHunters).
   * Ranger arrows rain DOWN vertically (falling shafts, fading on impact).
   * Fixed zones sit static with a pulse; auras ride the caster (sim already
   * re-anchors x/y). Everything fades out over the last 1s.
   */
  private renderZones() {
    this.zoneContainer.removeChildren();
    const zones = this.simulation.activeZones;
    if (!zones || zones.length === 0) return;

    for (const z of zones) {
      // Whirlwind storm: no ground visual — particles orbit the warrior
      // itself (see renderHunters). Damage still ticks at the zone anchor.
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
      this.zoneContainer.addChild(g);
    }
  }

  private renderHunters(dt: number) {
    const activeHunterIds = new Set(this.simulation.hunters.map(h => h.id));
    // Leader ids derived once per frame from runtime parties (not per hunter).
    const leaderIds = new Set([...this.simulation.parties.values()].map(p => p.leaderId));

    // Cleanup dead/removed hunter sprites
    for (const [id, data] of this.hunterSprites.entries()) {
      if (!activeHunterIds.has(id)) {
        this.entitiesContainer.removeChild(data.sprite);
        this.entitiesContainer.removeChild(data.hpBar);
        this.entitiesContainer.removeChild(data.nameText);
        this.hunterSprites.delete(id);
        this.hunterWhirl.delete(id);
      }
    }

    this.simulation.hunters.forEach(hunter => {
      let hData = this.hunterSprites.get(hunter.id);

      // Yard stations (chairs/beds/anvils/vats/dummies in src/game/objects):
      // sitters stand slightly SOUTH of their furniture so the iso prop
      // peeks behind them instead of hiding inside the hunter sprite.
      const spot = stationSpotFor(this.simulation, hunter);
      const px = spot ? spot.x + 0.15 : hunter.gx;
      const py = spot ? spot.y + 0.15 : hunter.gy;

      // Determine action for frame lookup
      let action: 'idle' | 'walk' | 'attack' | 'cast' = 'idle';
      if (!spot && hunter.isAttacking) {
        action = (hunter.charClass === 'Sorcerer' || hunter.charClass === 'Cleric' || hunter.charClass === 'Bard') ? 'cast' : 'attack';
      } else if (!spot && (hunter.state === 'HUNTING' || hunter.state === 'TRAVELING_TO_HUNT' || hunter.state === 'RETURNING_TO_TOWN' || hunter.state === 'SPAWNING' || hunter.state === 'REGISTERING')) {
        action = 'walk';
      }

      const texture = this.getHunterTexture(hunter.charClass, hunter.facing === 'NW' ? 'SW' : (hunter.facing === 'NE' ? 'SE' : hunter.facing), action, hunter.animFrame);

      if (!hData) {
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.85);
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';
        sprite.on('pointerdown', () => {
          this.followTargetHunterId = hunter.id;
          this.followTargetBuildingId = null;
          if (this.onSelectHunter) this.onSelectHunter(hunter);
          if (this.onSelectBuilding) this.onSelectBuilding(null);
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

        this.entitiesContainer.addChild(sprite);
        this.entitiesContainer.addChild(hpBar);
        this.entitiesContainer.addChild(nameText);

        hData = { sprite, hpBar, nameText };
        this.hunterSprites.set(hunter.id, hData);
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
      const ownStorms = this.simulation.activeZones.filter(
        z => z.kind === 'storm' && z.sourceId === hunter.id
      );
      const hasStorm = ownStorms.length > 0;
      const newestStormId = hasStorm ? ownStorms[ownStorms.length - 1].id : null;
      let whirl = this.hunterWhirl.get(hunter.id);
      if (!whirl) {
        whirl = { rotation: 0, burst: 0, lastZoneId: null };
        this.hunterWhirl.set(hunter.id, whirl);
      }
      // Fresh cast (new zone id) grants a ~0.9s spin burst so the whirl reads
      // even if the caster never steps into the storm (storms pin to target).
      if (newestStormId && newestStormId !== whirl.lastZoneId) {
        whirl.burst = 0.9;
        whirl.lastZoneId = newestStormId;
      }
      if (!hasStorm) {
        whirl.lastZoneId = null;
      }
      const insideOwnStorm = hasStorm && ownStorms.some(
        z => gridDistance(hunter.gx, hunter.gy, z.x, z.y) <= z.radius + 0.75
      );
      // While inside, keep the burst topped up so leaving mid-storm still
      // gets a short tail spin; otherwise let the cast burst decay.
      if (insideOwnStorm) {
        whirl.burst = 0.9;
      } else if (whirl.burst > 0) {
        whirl.burst = Math.max(0, whirl.burst - dt);
      }
      const whirling = hasStorm && (insideOwnStorm || whirl.burst > 0);
      if (whirling) {
        whirl.rotation += 11 * dt;
        hData.sprite.rotation = whirl.rotation;
        hData.sprite.scale.set(1.12);
      } else {
        if (whirl.rotation !== 0) {
          whirl.rotation = 0;
          hData.sprite.rotation = 0;
          hData.sprite.scale.set(1);
        }
        if (!hasStorm && whirl.burst <= 0) {
          this.hunterWhirl.delete(hunter.id);
        }
      }

      // Update HP bar
      hData.hpBar.clear();
      const barW = 26;
      const barH = 3;
      const hpRatio = Math.max(0, Math.min(1, hunter.hp / this.simulation.effectiveMaxHp(hunter)));
      
      // Selection highlight ring if followed
      if (this.followTargetHunterId === hunter.id) {
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
        const fade = Math.min(1, whirl.burst > 0 ? whirl.burst / 0.9 + 0.3 : 1);
        for (let m = 0; m < 7; m++) {
          const orbit = whirl.rotation * 1.4 + m * (Math.PI * 2 / 7);
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
      // precedence while seeking; boss/monster labels untouched)
      // LFP seekers render the idle frame: LOOKING_FOR_PARTY is deliberately
      // absent from the walk-action condition above — they wait at the plaza.
      const partyIcon = hunter.state === 'LOOKING_FOR_PARTY' ? '🔍 ' : leaderIds.has(hunter.id) ? '♛ ' : hunter.partyId ? '👥 ' : '';
      hData.nameText.text = `${partyIcon}Lv.${hunter.level} ${hunter.name.split(' ')[0]}`;
      hData.nameText.style.fill = partyColor(hunter.partyId) ?? '#cbd5e1';
      hData.nameText.x = screenPos.x;
      hData.nameText.y = screenPos.y - 44;
      hData.nameText.zIndex = hData.sprite.zIndex + 6;
    });
  }

  private renderMonsters() {
    const activeMonsterIds = new Set(this.simulation.monsters.map(m => m.id));

    // Cleanup dead monsters
    for (const [id, data] of this.monsterSprites.entries()) {
      if (!activeMonsterIds.has(id)) {
        this.entitiesContainer.removeChild(data.sprite);
        this.entitiesContainer.removeChild(data.hpBar);
        if (data.nameText) this.entitiesContainer.removeChild(data.nameText);
        this.monsterSprites.delete(id);
      }
    }

    this.simulation.monsters.forEach(m => {
      let mData = this.monsterSprites.get(m.id);
      const frame = typeof m.animFrame === 'number' && Number.isFinite(m.animFrame) ? Math.abs(Math.floor(m.animFrame)) % 2 : 0;
      const texture = this.getMonsterTexture(m.type, frame);

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
        this.entitiesContainer.addChild(nameText);

        this.entitiesContainer.addChild(sprite);
        this.entitiesContainer.addChild(hpBar);

        mData = { sprite, hpBar, nameText };
        this.monsterSprites.set(m.id, mData);
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
          this.entitiesContainer.addChild(nameText);
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

  private renderSkillVfx() {
    this.vfxContainer.removeChildren();

    this.simulation.skillVfxs.forEach(vfx => {
      // Staggered volley chains spawn with negative elapsed as a spawn
      // delay — pending arrows stay hidden until their offset elapses.
      // Whirlwind circle sprite removed — the warrior spin + orbiting
      // particles in renderHunters carry the effect.
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

      const texture = this.vfxTextures.get(vfx.type) || this.vfxTextures.get('slash')!;
      const sprite = new Sprite(texture);
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

      this.vfxContainer.addChild(sprite);
    });
  }

  private renderFloatingTexts() {
    this.overlayContainer.removeChildren();

    this.simulation.floatingTexts.forEach(ft => {
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
      this.overlayContainer.addChild(t);
    });
  }

  private updateCameraFollow() {
    if (!this.app) return;

    if (this.followTargetHunterId) {
      const hunter = this.simulation.hunters.find(h => h.id === this.followTargetHunterId);
      if (hunter) {
        const screenPos = gridToScreen(hunter.gx, hunter.gy);
        const targetCamX = (this.app.screen.width / 2) - screenPos.x * this.cameraZoom;
        const targetCamY = (this.app.screen.height / 2) - screenPos.y * this.cameraZoom;
        this.cameraX += (targetCamX - this.cameraX) * 0.08;
        this.cameraY += (targetCamY - this.cameraY) * 0.08;
      }
    } else if (this.followTargetBuildingId) {
      const building = this.simulation.buildings.find(b => b.id === this.followTargetBuildingId);
      if (building) {
        const screenPos = gridToScreen(building.gx, building.gy);
        const targetCamX = (this.app.screen.width / 2) - screenPos.x * this.cameraZoom;
        const targetCamY = (this.app.screen.height / 2) - screenPos.y * this.cameraZoom;
        this.cameraX += (targetCamX - this.cameraX) * 0.08;
        this.cameraY += (targetCamY - this.cameraY) * 0.08;
      }
    }

    this.worldContainer.position.set(this.cameraX, this.cameraY);
    this.worldContainer.scale.set(this.cameraZoom);
  }

  private setupInteractions(canvas: HTMLCanvasElement) {
    const onPointerDown = (e: PointerEvent) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.lastCameraX = this.cameraX;
      this.lastCameraY = this.cameraY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.hypot(dx, dy) > 4) {
        // Disengage auto-follow on manual pan
        this.followTargetHunterId = null;
        this.followTargetBuildingId = null;
        this.cameraX = this.lastCameraX + dx;
        this.cameraY = this.lastCameraY + dy;
      }
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(2.5, Math.max(0.5, this.cameraZoom * zoomFactor));

      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // Zoom centered on mouse
      this.cameraX = mouseX - (mouseX - this.cameraX) * (newZoom / this.cameraZoom);
      this.cameraY = mouseY - (mouseY - this.cameraY) * (newZoom / this.cameraZoom);
      this.cameraZoom = newZoom;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    this.teardownFns.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    });
  }

  public jumpTo(gx: number, gy: number) {
    if (!this.app) return;
    this.followTargetHunterId = null;
    this.followTargetBuildingId = null;
    const screenPos = gridToScreen(gx, gy);
    this.cameraX = (this.app.screen.width / 2) - screenPos.x * this.cameraZoom;
    this.cameraY = (this.app.screen.height / 2) - screenPos.y * this.cameraZoom;
  }

  /** Fully tear down a Pixi Application: stop its ticker first so no
   *  orphaned requestAnimationFrame loop can survive, then destroy.
   *  NOTE: the canvas element itself is always preserved (removeView=false)
   *  because React owns it — removing it breaks remounts (StrictMode/HMR)
   *  by leaving the next renderer attached to a detached node. */
  private destroyApp(appInstance: Application | null) {
    if (!appInstance) return;
    try {
      appInstance.ticker?.remove(this.tickerHandler);
    } catch { /* ignore */ }
    try {
      appInstance.stop?.();
    } catch { /* ignore */ }
    try {
      appInstance.destroy(false, { children: true, texture: false });
    } catch (err) {
      console.warn('Safe PixiJS cleanup warning:', err);
    }
    // Clear pooled sprite maps so a remount rebuilds cleanly.
    this.hunterSprites.clear();
    this.hunterWhirl.clear();
    this.monsterSprites.clear();
    this.buildingSprites.clear();
    clearYards(this.yards);
  }

  public destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // Teardown interaction listeners
    this.teardownFns.forEach(fn => {
      try { fn(); } catch {}
    });
    this.teardownFns = [];

    const appInstance = this.app;
    this.app = null;

    if (appInstance) {
      if (this.isInitialized) {
        // Init completed: destroy synchronously.
        this.destroyApp(appInstance);
      } else {
        // Init still in flight (StrictMode remount): wait for it, then destroy.
        // The init continuation also checks isDestroyed and tears down,
        // but this belt-and-braces path covers rejection ordering.
        this.initPromise
          ?.then(() => this.destroyApp(appInstance))
          .catch(() => this.destroyApp(appInstance));
      }
    }
    this.initPromise = null;
  }
}
