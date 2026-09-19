// PixiRenderer: thin orchestrator over modular render layers.
//
// Layers (one module each, code + its own caches/pools):
//   render/camera.ts   — pan/zoom rig + follow + input
//   render/terrain.ts  — tile grid + portal + reserve labels + palisades
//   render/buildings.ts— building sprites + level labels + selection ring
//   render/hunters.ts  — hero sprites + HP + plates + whirl spin
//   render/monsters.ts — fiend sprites + HP + plates
//   render/effects.ts  — zones + skill VFX + floating text
//   objects/yard.ts    — chairs/tables/beds/anvils/vats/dummies
//
// Public surface is unchanged (App/GameCanvas rely on it): follow-target
// ids, cameraX/Y/Zoom fields, onSelect callbacks, init/destroy/jumpTo.

import {
  Application, Container
} from 'pixi.js';
import { GameSimulation } from './simulation';
import { Hunter, Building } from '../types';
import {
  createCamera, centerCameraOn, updateCameraFollow, attachCameraInput,
  jumpCameraTo, type CameraState,
} from './render/camera';
import { TerrainLayer } from './render/terrain';
import { BuildingsLayer } from './render/buildings';
import { HuntersLayer } from './render/hunters';
import { MonstersLayer } from './render/monsters';
import { EffectsLayer } from './render/effects';
import { clearYards, createYardState, renderYards, type YardState } from './objects/yard';

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

  // Camera rig (x/y/zoom exposed as accessors below — the shell reads and
  // writes them directly for keyboard pan/zoom).
  private cam: CameraState = createCamera();
  public get cameraX(): number { return this.cam.x; }
  public set cameraX(v: number) { this.cam.x = v; }
  public get cameraY(): number { return this.cam.y; }
  public set cameraY(v: number) { this.cam.y = v; }
  public get cameraZoom(): number { return this.cam.zoom; }
  public set cameraZoom(v: number) { this.cam.zoom = v; }
  public followTargetHunterId: string | null = null;
  public followTargetBuildingId: string | null = null;

  // Layers (each owns its textures + sprite pools)
  private terrain = new TerrainLayer();
  private buildings = new BuildingsLayer();
  private hunters = new HuntersLayer();
  private monsters = new MonstersLayer();
  private effects = new EffectsLayer();
  private yards: YardState = createYardState();

  // Interaction handlers
  public onSelectHunter?: (hunter: Hunter | null) => void;
  public onSelectBuilding?: (building: Building | null) => void;

  constructor(simulation: GameSimulation) {
    this.simulation = simulation;
  }

  private centerCameraOnTown() {
    if (!this.app) return;
    centerCameraOn(this.cam, this.app, this.worldContainer);
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

      // Static isometric terrain tiles (layer precaches its own textures)
      this.terrain.build(this.terrainContainer);

      // Center camera on town sanctuary (deferred until screen has real size)
      if (app.screen.width > 0 && app.screen.height > 0) {
        this.centerCameraOnTown();
      }

      // Camera pan & zoom input (cleanup pushed for destroy())
      this.teardownFns.push(attachCameraInput(canvas, this.cam, {
        clearFollow: () => {
          this.followTargetHunterId = null;
          this.followTargetBuildingId = null;
        },
      }));

      // Start main render ticker
      app.ticker.add(this.tickerHandler);
    })();

    await this.initPromise;
  }

  private tickerHandler = (ticker: any) => {
    if (this.isDestroyed || !this.app) return;
    // Late-anchor the camera once the canvas has a real size
    // (covers StrictMode remounts and resizes during boot).
    if (!this.cam.anchored && this.app.screen.width > 0 && this.app.screen.height > 0) {
      this.centerCameraOnTown();
    }
    const dt = ticker.deltaTime / 60;
    this.simulation.update(dt);
    this.renderFrame(dt);
  };

  // --------------------------------------------------------------------------
  // RENDER FRAME (depth-sorted layers, back to front)
  // --------------------------------------------------------------------------

  private renderFrame(dt: number) {
    if (!this.app) return;
    updateCameraFollow(
      this.cam, this.app, this.worldContainer, this.simulation,
      this.followTargetHunterId, this.followTargetBuildingId,
    );

    // 1. Buildings
    this.buildings.sync(this.entitiesContainer, this.simulation, this.followTargetBuildingId, {
      pickBuilding: (b) => {
        this.followTargetBuildingId = b.id;
        this.followTargetHunterId = null;
        if (this.onSelectBuilding) this.onSelectBuilding(b);
        if (this.onSelectHunter) this.onSelectHunter(null);
      },
    });

    // 1b-f. Building yards (one module per prop in src/game/objects/*).
    renderYards(this.yards, { container: this.entitiesContainer, sim: this.simulation });

    // 1g. Skill zones (ground discs below sprites)
    this.effects.renderZones(this.zoneContainer, this.simulation);

    // 2. Hunters
    this.hunters.sync(this.entitiesContainer, this.simulation, dt, this.followTargetHunterId, {
      pickHunter: (h) => {
        this.followTargetHunterId = h.id;
        this.followTargetBuildingId = null;
        if (this.onSelectHunter) this.onSelectHunter(h);
        if (this.onSelectBuilding) this.onSelectBuilding(null);
      },
    });

    // 3. Monsters
    this.monsters.sync(this.entitiesContainer, this.simulation);

    // 4. Skill VFX
    this.effects.renderSkillVfx(this.vfxContainer, this.simulation);

    // 5. Floating damage / text
    this.effects.renderFloatingTexts(this.overlayContainer, this.simulation);

    // Depth sort entities inside entitiesContainer
    this.entitiesContainer.children.sort((a, b) => a.zIndex - b.zIndex);
  }

  public jumpTo(gx: number, gy: number) {
    if (!this.app) return;
    this.followTargetHunterId = null;
    this.followTargetBuildingId = null;
    jumpCameraTo(this.cam, this.app, gx, gy);
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
    this.hunters.clear();
    this.monsters.clear();
    this.buildings.clear();
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
