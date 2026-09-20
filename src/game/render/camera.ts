// Camera rig: pan/zoom state + follow + mouse/zoom input. Follow targets
// stay on the renderer (public API written by the shell); the rig only
// holds x/y/zoom and the drag gesture. World transform is applied here so
// every layer renders in the same frame of reference.

import type { Application, Container } from 'pixi.js';
import { gridToScreen, screenToGrid, type GridPoint } from '../isometric';
import type { GameSimulation } from '../simulation';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  /** Set once a real (non-zero) screen size is reported. */
  anchored: boolean;
  dragging: boolean;
  dragStartX: number;
  dragStartY: number;
  lastX: number;
  lastY: number;
}

export function createCamera(): CameraState {
  return {
    x: 0, y: 0, zoom: 1.0,
    anchored: false,
    dragging: false,
    dragStartX: 0, dragStartY: 0, lastX: 0, lastY: 0,
  };
}

export function centerCameraOn(
  cam: CameraState, app: Application, world: Container, gx = 30, gy = 30
): void {
  const centerScreen = gridToScreen(gx, gy);
  cam.x = (app.screen.width / 2) - centerScreen.x * cam.zoom;
  cam.y = (app.screen.height / 2) - centerScreen.y * cam.zoom;
  world.position.set(cam.x, cam.y);
  cam.anchored = true;
}

export function updateCameraFollow(
  cam: CameraState,
  app: Application | null,
  world: Container,
  sim: GameSimulation,
  followHunterId: string | null,
  followBuildingId: string | null,
): void {
  if (!app) return;

  if (followHunterId) {
    const hunter = sim.hunters.find(h => h.id === followHunterId);
    if (hunter) {
      const screenPos = gridToScreen(hunter.gx, hunter.gy);
      const targetCamX = (app.screen.width / 2) - screenPos.x * cam.zoom;
      const targetCamY = (app.screen.height / 2) - screenPos.y * cam.zoom;
      cam.x += (targetCamX - cam.x) * 0.08;
      cam.y += (targetCamY - cam.y) * 0.08;
    }
  } else if (followBuildingId) {
    const building = sim.buildings.find(b => b.id === followBuildingId);
    if (building) {
      const screenPos = gridToScreen(building.gx, building.gy);
      const targetCamX = (app.screen.width / 2) - screenPos.x * cam.zoom;
      const targetCamY = (app.screen.height / 2) - screenPos.y * cam.zoom;
      cam.x += (targetCamX - cam.x) * 0.08;
      cam.y += (targetCamY - cam.y) * 0.08;
    }
  }

  world.position.set(cam.x, cam.y);
  world.scale.set(cam.zoom);
}

export interface CameraInput {
  /** Called on manual pan so the renderer can disengage auto-follow. */
  clearFollow(): void;
}

/** Pan (drag) + zoom-to-mouse (wheel). Returns a cleanup function. */
export function attachCameraInput(
  canvas: HTMLCanvasElement, cam: CameraState, input: CameraInput
): () => void {
  const onPointerDown = (e: PointerEvent) => {
    cam.dragging = true;
    cam.dragStartX = e.clientX;
    cam.dragStartY = e.clientY;
    cam.lastX = cam.x;
    cam.lastY = cam.y;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!cam.dragging) return;
    const dx = e.clientX - cam.dragStartX;
    const dy = e.clientY - cam.dragStartY;
    if (Math.hypot(dx, dy) > 4) {
      // Disengage auto-follow on manual pan
      input.clearFollow();
      cam.x = cam.lastX + dx;
      cam.y = cam.lastY + dy;
    }
  };

  const onPointerUp = () => {
    cam.dragging = false;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(2.5, Math.max(0.5, cam.zoom * zoomFactor));

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Zoom centered on mouse
    cam.x = mouseX - (mouseX - cam.x) * (newZoom / cam.zoom);
    cam.y = mouseY - (mouseY - cam.y) * (newZoom / cam.zoom);
    cam.zoom = newZoom;
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
  };
}

export function jumpCameraTo(
  cam: CameraState, app: Application | null, gx: number, gy: number
): void {
  if (!app) return;
  const screenPos = gridToScreen(gx, gy);
  cam.x = (app.screen.width / 2) - screenPos.x * cam.zoom;
  cam.y = (app.screen.height / 2) - screenPos.y * cam.zoom;
}

/**
 * Audio ear: grid position under the screen center. Inverse of
 * centerCameraOn/jumpCameraTo — world = (screen/2 - cam)/zoom, then iso unproject.
 */
export function getCameraFocusGrid(cam: CameraState, screenW: number, screenH: number): GridPoint {
  const zoom = cam.zoom || 1;
  const worldX = (screenW / 2 - cam.x) / zoom;
  const worldY = (screenH / 2 - cam.y) / zoom;
  return screenToGrid(worldX, worldY);
}
