import { 
  Application, Container, Sprite, Graphics, Text, TextStyle, Texture 
} from 'pixi.js';
import { GameSimulation, SUMMON_PORTAL_POS, monsterLabel } from './simulation';
import { 
  gridToScreen, screenToGrid, MAP_GRID_WIDTH, MAP_GRID_HEIGHT 
} from './isometric';
import { tavernSeatPositions, clinicBedPositions, forgeStationPositions, cauldronStationPositions, academyStationPositions, reserveAt, RESERVE_REGIONS, WALL_CELLS } from './pathfinding';
import { 
  createIsoTileTexture, createHunterFrame, createMonsterFrame, 
  createBuildingTexture, createSkillVfxTexture,
  createChairTexture, createTableTexture, createBedTexture,
  createAnvilTexture, createVatTexture, createTrainingDummyTexture
} from './pixelArtTextures';
import { CharacterClass, Hunter, Building } from '../types';

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
  private monsterSprites: Map<string, { sprite: Sprite; hpBar: Graphics; nameText?: Text }> = new Map();
  private buildingSprites: Map<string, { sprite: Sprite; levelText: Text; badge: Graphics }> = new Map();

  // Tavern furniture decor (chairs + tables around each TAVERN building)
  private chairTexture: Texture | null = null;
  private tableTexture: Texture | null = null;
  private tavernDecor: Map<string, { capacity: number; level: number; sprites: Sprite[] }> = new Map();

  // Clinic furniture decor (beds around each CLINIC building)
  private bedTexture: Texture | null = null;
  private clinicDecor: Map<string, { capacity: number; level: number; sprites: Sprite[] }> = new Map();

  // Forge service decor (anvils around each BLACKSMITH building)
  private anvilTexture: Texture | null = null;
  private forgeDecor: Map<string, { capacity: number; level: number; sprites: Sprite[] }> = new Map();

  // Cauldron service decor (brewing vats around each ALCHEMY_LAB building)
  private vatTexture: Texture | null = null;
  private cauldronDecor: Map<string, { capacity: number; level: number; sprites: Sprite[] }> = new Map();

  // Academy service decor (training dummies around each TRAINING_ACADEMY building)
  private dummyTexture: Texture | null = null;
  private academyDecor: Map<string, { capacity: number; level: number; sprites: Sprite[] }> = new Map();

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
    this.renderFrame();
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
    ['slash', 'meteor', 'whirlwind', 'smite', 'multishot', 'impact'].forEach(v => {
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

        // Reserved expansion land (freed northwest bands): dark placeholder,
        // skipping all existing region logic below.
        if (reserveAt(gx, gy) !== null) {
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

    // Region border palisades (static, once). Gate cells are absent from
    // WALL_CELLS by construction (isWallCell excludes them), so openings
    // render as plain gaps — no gate visuals of any kind.
    const wallGfx = new Graphics();
    for (const cell of WALL_CELLS) {
      const p = gridToScreen(cell.x, cell.y);
      // Ground shadow ellipse
      wallGfx.ellipse(p.x, p.y + 16, 20, 9).fill({ color: 0x000000, alpha: 0.3 });
      // Palisade log: dark outline, mid-brown body, light top edge
      wallGfx.rect(p.x - 10, p.y - 14, 20, 30).fill({ color: 0x3f2a18 });
      wallGfx.rect(p.x - 8, p.y - 12, 16, 26).fill({ color: 0x8b5a2b });
      wallGfx.rect(p.x - 8, p.y - 12, 16, 5).fill({ color: 0xd9a066 });
    }
    this.terrainContainer.addChild(wallGfx);
  }

  // --------------------------------------------------------------------------
  // RENDER FRAME (Depth Sorted Entities, VFX, UI)
  // --------------------------------------------------------------------------

  private renderFrame() {
    this.updateCameraFollow();

    // 1. Render Buildings
    this.renderBuildings();

    // 1b. Render Tavern Furniture (chairs + tables)
    this.renderTavernSeating();

    // 1c. Render Clinic Beds
    this.renderClinicBeds();

    // 1d. Render Forge Anvils
    this.renderForgeStations();

    // 1e. Render Cauldron Vats
    this.renderCauldronStations();

    // 1f. Render Academy Dummies
    this.renderAcademyStations();

    // 2. Render Hunters
    this.renderHunters();

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

      // Badge highlight if selected or active transactions
      bData.badge.clear();
      if (this.followTargetBuildingId === b.id) {
        bData.badge.circle(screenPos.x, screenPos.y + 12, 36).stroke({ color: 0xfacc15, width: 2 });
      }
      bData.badge.zIndex = bData.sprite.zIndex - 1;
    });
  }

  /**
   * Seat grid position for a resting hunter, or null when they have no seat.
   * Resting hunters (RESTING_TAVERN with that tavern as targetBuildingId,
   * sorted by id) sit on the tavern's seats; hunters beyond seat count
   * (shouldn't happen via the capacity gate) render at their sim position.
   */
  private seatFor(hunter: Hunter): { x: number; y: number } | null {
    if (hunter.state !== 'RESTING_TAVERN' || !hunter.targetBuildingId) return null;
    const tavern = this.simulation.buildings.find(
      b => b.id === hunter.targetBuildingId && b.type === 'TAVERN'
    );
    if (!tavern) return null;
    const capacity = this.simulation.buildingCapacity(tavern);
    const resters = this.simulation.hunters
      .filter(h => h.state === 'RESTING_TAVERN' && h.targetBuildingId === tavern.id)
      .map(h => h.id)
      .sort();
    const idx = resters.indexOf(hunter.id);
    if (idx < 0) return null;
    const seats = tavernSeatPositions(tavern.gx, tavern.gy, capacity);
    return idx < seats.length ? seats[idx] : null;
  }

  /**
   * Tavern furniture decor: one chair per buildingCapacity(tavern) seat plus
   * one round table per 2 chairs at the pair's midpoint. Cached per tavern
   * id + level, rebuilt when capacity changes.
   */
  private renderTavernSeating() {
    if (!this.chairTexture) this.chairTexture = createChairTexture();
    if (!this.tableTexture) this.tableTexture = createTableTexture();

    const activeTavernIds = new Set<string>();
    for (const b of this.simulation.buildings) {
      if (b.type !== 'TAVERN') continue;
      activeTavernIds.add(b.id);
      const capacity = this.simulation.buildingCapacity(b);
      const cached = this.tavernDecor.get(b.id);
      if (cached && cached.capacity === capacity && cached.level === b.level) continue;

      // Capacity changed (or first build): drop old sprites and rebuild.
      if (cached) {
        for (const s of cached.sprites) this.entitiesContainer.removeChild(s);
        this.tavernDecor.delete(b.id);
      }

      const seats = tavernSeatPositions(b.gx, b.gy, capacity);
      const sprites: Sprite[] = [];
      for (const seat of seats) {
        const p = gridToScreen(seat.x, seat.y);
        const chair = new Sprite(this.chairTexture);
        chair.anchor.set(0.5, 0.85);
        chair.x = p.x;
        chair.y = p.y;
        chair.zIndex = (seat.x + seat.y) * 100 + 12;
        this.entitiesContainer.addChild(chair);
        sprites.push(chair);
      }
      // One table per 2 chairs at the pair's midpoint seat position.
      for (let i = 0; i + 1 < seats.length; i += 2) {
        const midX = (seats[i].x + seats[i + 1].x) / 2;
        const midY = (seats[i].y + seats[i + 1].y) / 2;
        const p = gridToScreen(midX, midY);
        const table = new Sprite(this.tableTexture);
        table.anchor.set(0.5, 0.85);
        table.x = p.x;
        table.y = p.y;
        table.zIndex = (midX + midY) * 100 + 11;
        this.entitiesContainer.addChild(table);
        sprites.push(table);
      }
      this.tavernDecor.set(b.id, { capacity, level: b.level, sprites });
    }

    // Cleanup decor for removed taverns.
    for (const [id, cached] of this.tavernDecor.entries()) {
      if (!activeTavernIds.has(id)) {
        for (const s of cached.sprites) this.entitiesContainer.removeChild(s);
        this.tavernDecor.delete(id);
      }
    }
  }

  /**
   * Bed grid position for a recovering hunter, or null when they have no bed.
   * Recovering hunters (RECOVERING_CLINIC with that clinic as targetBuildingId,
   * sorted by id) lie in the clinic's beds; hunters beyond bed count
   * (shouldn't happen via the capacity gate) render at their sim position.
   */
  private bedFor(hunter: Hunter): { x: number; y: number } | null {
    if (hunter.state !== 'RECOVERING_CLINIC' || !hunter.targetBuildingId) return null;
    const clinic = this.simulation.buildings.find(
      b => b.id === hunter.targetBuildingId && b.type === 'CLINIC'
    );
    if (!clinic) return null;
    const capacity = this.simulation.buildingCapacity(clinic);
    const patients = this.simulation.hunters
      .filter(h => h.state === 'RECOVERING_CLINIC' && h.targetBuildingId === clinic.id)
      .map(h => h.id)
      .sort();
    const idx = patients.indexOf(hunter.id);
    if (idx < 0) return null;
    const beds = clinicBedPositions(clinic.gx, clinic.gy, capacity);
    return idx < beds.length ? beds[idx] : null;
  }

  /**
   * Clinic furniture decor: one bed per buildingCapacity(clinic). Cached
   * per clinic id + level, rebuilt when capacity changes.
   */
  private renderClinicBeds() {
    if (!this.bedTexture) this.bedTexture = createBedTexture();

    const activeClinicIds = new Set<string>();
    for (const b of this.simulation.buildings) {
      if (b.type !== 'CLINIC') continue;
      activeClinicIds.add(b.id);
      const capacity = this.simulation.buildingCapacity(b);
      const cached = this.clinicDecor.get(b.id);
      if (cached && cached.capacity === capacity && cached.level === b.level) continue;

      // Capacity changed (or first build): drop old sprites and rebuild.
      if (cached) {
        for (const s of cached.sprites) this.entitiesContainer.removeChild(s);
        this.clinicDecor.delete(b.id);
      }

      const beds = clinicBedPositions(b.gx, b.gy, capacity);
      const sprites: Sprite[] = [];
      for (const bed of beds) {
        const p = gridToScreen(bed.x, bed.y);
        const sprite = new Sprite(this.bedTexture);
        sprite.anchor.set(0.5, 0.85);
        sprite.x = p.x;
        sprite.y = p.y;
        sprite.zIndex = (bed.x + bed.y) * 100 + 12;
        this.entitiesContainer.addChild(sprite);
        sprites.push(sprite);
      }
      this.clinicDecor.set(b.id, { capacity, level: b.level, sprites });
    }

    // Cleanup decor for removed clinics.
    for (const [id, cached] of this.clinicDecor.entries()) {
      if (!activeClinicIds.has(id)) {
        for (const s of cached.sprites) this.entitiesContainer.removeChild(s);
        this.clinicDecor.delete(id);
      }
    }
  }

  /**
   * Anvil grid position for a smithing hunter, or null when they have none.
   * Smithing hunters (UPGRADING_GEAR with that forge as targetBuildingId,
   * sorted by id) work at the forge's stations; hunters beyond station count
   * (shouldn't happen via the capacity gate) render at their sim position.
   */
  private forgeStationFor(hunter: Hunter): { x: number; y: number } | null {
    if (hunter.state !== 'UPGRADING_GEAR' || !hunter.targetBuildingId) return null;
    const forge = this.simulation.buildings.find(
      b => b.id === hunter.targetBuildingId && b.type === 'BLACKSMITH'
    );
    if (!forge) return null;
    const capacity = this.simulation.buildingCapacity(forge);
    const smiths = this.simulation.hunters
      .filter(h => h.state === 'UPGRADING_GEAR' && h.targetBuildingId === forge.id)
      .map(h => h.id)
      .sort();
    const idx = smiths.indexOf(hunter.id);
    if (idx < 0) return null;
    const stations = forgeStationPositions(forge.gx, forge.gy, capacity);
    return idx < stations.length ? stations[idx] : null;
  }

  /**
   * Forge station decor: one anvil per buildingCapacity(forge). Cached
   * per forge id + level, rebuilt when capacity changes.
   */
  private renderForgeStations() {
    if (!this.anvilTexture) this.anvilTexture = createAnvilTexture();

    const activeForgeIds = new Set<string>();
    for (const b of this.simulation.buildings) {
      if (b.type !== 'BLACKSMITH') continue;
      activeForgeIds.add(b.id);
      const capacity = this.simulation.buildingCapacity(b);
      const cached = this.forgeDecor.get(b.id);
      if (cached && cached.capacity === capacity && cached.level === b.level) continue;

      // Capacity changed (or first build): drop old sprites and rebuild.
      if (cached) {
        for (const s of cached.sprites) this.entitiesContainer.removeChild(s);
        this.forgeDecor.delete(b.id);
      }

      const stations = forgeStationPositions(b.gx, b.gy, capacity);
      const sprites: Sprite[] = [];
      for (const station of stations) {
        const p = gridToScreen(station.x, station.y);
        const sprite = new Sprite(this.anvilTexture);
        sprite.anchor.set(0.5, 0.85);
        sprite.x = p.x;
        sprite.y = p.y;
        sprite.zIndex = (station.x + station.y) * 100 + 12;
        this.entitiesContainer.addChild(sprite);
        sprites.push(sprite);
      }
      this.forgeDecor.set(b.id, { capacity, level: b.level, sprites });
    }

    // Cleanup decor for removed forges.
    for (const [id, cached] of this.forgeDecor.entries()) {
      if (!activeForgeIds.has(id)) {
        for (const s of cached.sprites) this.entitiesContainer.removeChild(s);
        this.forgeDecor.delete(id);
      }
    }
  }

  /**
   * Vat grid position for a brewing hunter, or null when they have none.
   * Brewing hunters (BREWING_ELIXIR with that lab as targetBuildingId,
   * sorted by id) tend the lab's vats; hunters beyond station count
   * (shouldn't happen via the capacity gate) render at their sim position.
   */
  private cauldronStationFor(hunter: Hunter): { x: number; y: number } | null {
    if (hunter.state !== 'BREWING_ELIXIR' || !hunter.targetBuildingId) return null;
    const lab = this.simulation.buildings.find(
      b => b.id === hunter.targetBuildingId && b.type === 'ALCHEMY_LAB'
    );
    if (!lab) return null;
    const capacity = this.simulation.buildingCapacity(lab);
    const brewers = this.simulation.hunters
      .filter(h => h.state === 'BREWING_ELIXIR' && h.targetBuildingId === lab.id)
      .map(h => h.id)
      .sort();
    const idx = brewers.indexOf(hunter.id);
    if (idx < 0) return null;
    const stations = cauldronStationPositions(lab.gx, lab.gy, capacity);
    return idx < stations.length ? stations[idx] : null;
  }

  /**
   * Cauldron station decor: one vat per buildingCapacity(lab). Cached
   * per lab id + level, rebuilt when capacity changes.
   */
  private renderCauldronStations() {
    if (!this.vatTexture) this.vatTexture = createVatTexture();

    const activeLabIds = new Set<string>();
    for (const b of this.simulation.buildings) {
      if (b.type !== 'ALCHEMY_LAB') continue;
      activeLabIds.add(b.id);
      const capacity = this.simulation.buildingCapacity(b);
      const cached = this.cauldronDecor.get(b.id);
      if (cached && cached.capacity === capacity && cached.level === b.level) continue;

      // Capacity changed (or first build): drop old sprites and rebuild.
      if (cached) {
        for (const s of cached.sprites) this.entitiesContainer.removeChild(s);
        this.cauldronDecor.delete(b.id);
      }

      const stations = cauldronStationPositions(b.gx, b.gy, capacity);
      const sprites: Sprite[] = [];
      for (const station of stations) {
        const p = gridToScreen(station.x, station.y);
        const sprite = new Sprite(this.vatTexture);
        sprite.anchor.set(0.5, 0.85);
        sprite.x = p.x;
        sprite.y = p.y;
        sprite.zIndex = (station.x + station.y) * 100 + 12;
        this.entitiesContainer.addChild(sprite);
        sprites.push(sprite);
      }
      this.cauldronDecor.set(b.id, { capacity, level: b.level, sprites });
    }

    // Cleanup decor for removed labs.
    for (const [id, cached] of this.cauldronDecor.entries()) {
      if (!activeLabIds.has(id)) {
        for (const s of cached.sprites) this.entitiesContainer.removeChild(s);
        this.cauldronDecor.delete(id);
      }
    }
  }

  /**
   * Dummy grid position for a training hunter, or null when they have none.
   * Training hunters (LEARNING_SKILL with that academy as targetBuildingId,
   * sorted by id) drill at the academy's dummies; hunters beyond station count
   * (shouldn't happen via the capacity gate) render at their sim position.
   */
  private academyStationFor(hunter: Hunter): { x: number; y: number } | null {
    if (hunter.state !== 'LEARNING_SKILL' || !hunter.targetBuildingId) return null;
    const academy = this.simulation.buildings.find(
      b => b.id === hunter.targetBuildingId && b.type === 'TRAINING_ACADEMY'
    );
    if (!academy) return null;
    const capacity = this.simulation.buildingCapacity(academy);
    const trainees = this.simulation.hunters
      .filter(h => h.state === 'LEARNING_SKILL' && h.targetBuildingId === academy.id)
      .map(h => h.id)
      .sort();
    const idx = trainees.indexOf(hunter.id);
    if (idx < 0) return null;
    const stations = academyStationPositions(academy.gx, academy.gy, capacity);
    return idx < stations.length ? stations[idx] : null;
  }

  /**
   * Academy station decor: one dummy per buildingCapacity(academy). Cached
   * per academy id + level, rebuilt when capacity changes.
   */
  private renderAcademyStations() {
    if (!this.dummyTexture) this.dummyTexture = createTrainingDummyTexture();

    const activeAcademyIds = new Set<string>();
    for (const b of this.simulation.buildings) {
      if (b.type !== 'TRAINING_ACADEMY') continue;
      activeAcademyIds.add(b.id);
      const capacity = this.simulation.buildingCapacity(b);
      const cached = this.academyDecor.get(b.id);
      if (cached && cached.capacity === capacity && cached.level === b.level) continue;

      // Capacity changed (or first build): drop old sprites and rebuild.
      if (cached) {
        for (const s of cached.sprites) this.entitiesContainer.removeChild(s);
        this.academyDecor.delete(b.id);
      }

      const stations = academyStationPositions(b.gx, b.gy, capacity);
      const sprites: Sprite[] = [];
      for (const station of stations) {
        const p = gridToScreen(station.x, station.y);
        const sprite = new Sprite(this.dummyTexture);
        sprite.anchor.set(0.5, 0.85);
        sprite.x = p.x;
        sprite.y = p.y;
        sprite.zIndex = (station.x + station.y) * 100 + 12;
        this.entitiesContainer.addChild(sprite);
        sprites.push(sprite);
      }
      this.academyDecor.set(b.id, { capacity, level: b.level, sprites });
    }

    // Cleanup decor for removed academies.
    for (const [id, cached] of this.academyDecor.entries()) {
      if (!activeAcademyIds.has(id)) {
        for (const s of cached.sprites) this.entitiesContainer.removeChild(s);
        this.academyDecor.delete(id);
      }
    }
  }

  private renderHunters() {
    const activeHunterIds = new Set(this.simulation.hunters.map(h => h.id));

    // Cleanup dead/removed hunter sprites
    for (const [id, data] of this.hunterSprites.entries()) {
      if (!activeHunterIds.has(id)) {
        this.entitiesContainer.removeChild(data.sprite);
        this.entitiesContainer.removeChild(data.hpBar);
        this.entitiesContainer.removeChild(data.nameText);
        this.hunterSprites.delete(id);
      }
    }

    this.simulation.hunters.forEach(hunter => {
      let hData = this.hunterSprites.get(hunter.id);

      // Seated resters use their idle frame on the seat position;
      // clinic patients lie in their bed position (bed sprite beneath);
      // smiths work at their anvil, brewers at their vat, trainees at their dummy.
      const seat = this.seatFor(hunter);
      const bed = seat ? null : this.bedFor(hunter);
      const anvil = seat || bed ? null : this.forgeStationFor(hunter);
      const vat = seat || bed || anvil ? null : this.cauldronStationFor(hunter);
      const dummy = seat || bed || anvil || vat ? null : this.academyStationFor(hunter);
      const spot = seat ?? bed ?? anvil ?? vat ?? dummy;
      const px = spot ? spot.x : hunter.gx;
      const py = spot ? spot.y : hunter.gy;

      // Determine action for frame lookup
      let action: 'idle' | 'walk' | 'attack' | 'cast' = 'idle';
      if (!spot && hunter.isAttacking) {
        action = hunter.charClass === 'Sorcerer' ? 'cast' : 'attack';
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
          text: `[${hunter.rarity[0]}] ${hunter.name}`,
          style: new TextStyle({
            fontFamily: 'monospace',
            fontSize: 9,
            fill: this.getRarityColor(hunter.rarity),
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
      hData.hpBar.zIndex = hData.sprite.zIndex + 5;

      // Name & Level
      hData.nameText.text = `Lv.${hunter.level} ${hunter.name.split(' ')[0]}`;
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
      const texture = this.getMonsterTexture(m.type, Math.floor(Date.now() / 250) % 2);

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
      mData.sprite.scale.set(m.isBoss ? 1.5 : 1.0);
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
      const startScreen = gridToScreen(vfx.startX, vfx.startY);
      const targetScreen = gridToScreen(vfx.targetX, vfx.targetY);
      const dx = targetScreen.x - startScreen.x;
      const dy = targetScreen.y - startScreen.y;
      // Flight direction in screen space (canvas Y points down)
      const flightAngle = Math.atan2(dy, dx);

      // Per-effect pacing: arrows/slashes snap fast, pillars linger
      const pacing: Record<string, number> = {
        multishot: 0.65, slash: 0.7, impact: 0.8,
        meteor: 1.0, whirlwind: 1.0, smite: 1.15,
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
        // Arrows fly point-first along the flight path (texture points up,
        // so rotate up-vector onto the flight direction)
        const t = progress; // near-linear: arrows are fast
        sprite.x = startScreen.x + dx * t;
        sprite.y = startScreen.y + dy * t;
        sprite.rotation = flightAngle + Math.PI / 2;
        sprite.scale.set(0.9 + pop * 0.3);
      } else if (vfx.type === 'meteor') {
        // Fireball arcs from sky to target, swelling on impact
        const t = 1 - Math.pow(1 - progress, 2); // ease-out: fast launch
        sprite.x = startScreen.x + dx * t;
        sprite.y = startScreen.y + dy * t - Math.sin(progress * Math.PI) * 46;
        sprite.scale.set(0.8 + progress * 0.9);
      } else if (vfx.type === 'whirlwind') {
        // Melee cyclone stays on the caster, spins up and expands
        sprite.x = startScreen.x;
        sprite.y = startScreen.y - 10;
        sprite.rotation = progress * Math.PI * 4;
        sprite.scale.set(0.7 + pop * 1.1);
      } else if (vfx.type === 'smite') {
        // Holy pillar strikes the target and lingers with a flicker
        sprite.x = targetScreen.x;
        sprite.y = targetScreen.y - 18;
        sprite.scale.set(0.9 + pop * 0.3, 0.6 + progress * 0.9);
        sprite.alpha = fade * (0.75 + 0.25 * Math.sin(progress * 22));
      } else if (vfx.type === 'slash') {
        // Energy arc snaps across the gap, edge-on to its path
        const t = 1 - Math.pow(1 - progress, 2);
        sprite.x = startScreen.x + dx * t;
        sprite.y = startScreen.y + dy * t - 8;
        sprite.rotation = flightAngle;
        sprite.scale.set(0.9 + pop * 0.5);
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

  private getRarityColor(rarity: string): string {
    switch (rarity) {
      case 'Legendary': return '#f59e0b';
      case 'Heroic': return '#ef4444';
      case 'Superior': return '#a855f7';
      case 'Rare': return '#38bdf8';
      default: return '#cbd5e1';
    }
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
    this.monsterSprites.clear();
    this.buildingSprites.clear();
    for (const cached of this.tavernDecor.values()) {
      for (const s of cached.sprites) {
        try { s.destroy(); } catch { /* ignore */ }
      }
    }
    this.tavernDecor.clear();
    for (const cached of this.clinicDecor.values()) {
      for (const s of cached.sprites) {
        try { s.destroy(); } catch { /* ignore */ }
      }
    }
    this.clinicDecor.clear();
    for (const cached of this.forgeDecor.values()) {
      for (const s of cached.sprites) {
        try { s.destroy(); } catch { /* ignore */ }
      }
    }
    this.forgeDecor.clear();
    for (const cached of this.cauldronDecor.values()) {
      for (const s of cached.sprites) {
        try { s.destroy(); } catch { /* ignore */ }
      }
    }
    this.cauldronDecor.clear();
    for (const cached of this.academyDecor.values()) {
      for (const s of cached.sprites) {
        try { s.destroy(); } catch { /* ignore */ }
      }
    }
    this.academyDecor.clear();
    this.chairTexture = null;
    this.tableTexture = null;
    this.bedTexture = null;
    this.anvilTexture = null;
    this.vatTexture = null;
    this.dummyTexture = null;
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
