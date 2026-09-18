import React, { useEffect, useRef, useState } from 'react';
import { PixiRenderer } from '../game/pixiRenderer';
import { GameSimulation } from '../game/simulation';
import { Hunter, Building } from '../types';

interface GameCanvasProps {
  simulation: GameSimulation;
  rendererRef: React.MutableRefObject<PixiRenderer | null>;
  onSelectHunter: (hunter: Hunter | null) => void;
  onSelectBuilding: (building: Building | null) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  simulation,
  rendererRef,
  onSelectHunter,
  onSelectBuilding
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const onSelectHunterRef = useRef(onSelectHunter);
  const onSelectBuildingRef = useRef(onSelectBuilding);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    onSelectHunterRef.current = onSelectHunter;
    onSelectBuildingRef.current = onSelectBuilding;
    if (rendererRef.current) {
      rendererRef.current.onSelectHunter = (h) => onSelectHunterRef.current(h);
      rendererRef.current.onSelectBuilding = (b) => onSelectBuildingRef.current(b);
    }
  }, [onSelectHunter, onSelectBuilding, rendererRef]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let isCancelled = false;
    let renderer: PixiRenderer | null = null;
    let canvas: HTMLCanvasElement | null = null;

    // Each mount gets its OWN canvas element. Two Pixi Applications must
    // never share one canvas/WebGL context — reuse across StrictMode or
    // HMR remounts caused black screens and teardown races. The deferred
    // creation below also collapses StrictMode's setup→cleanup→setup burst
    // so only the final mount instantiates Pixi at all.
    const frameId = requestAnimationFrame(() => {
      if (isCancelled || !wrapperRef.current) return;

      canvas = document.createElement('canvas');
      canvas.className = 'w-full h-full block cursor-grab active:cursor-grabbing outline-none';
      wrapperRef.current.appendChild(canvas);

      renderer = new PixiRenderer(simulation);
      rendererRef.current = renderer;

      renderer.onSelectHunter = (h) => onSelectHunterRef.current(h);
      renderer.onSelectBuilding = (b) => onSelectBuildingRef.current(b);

      renderer.init(canvas).catch(err => {
        if (!isCancelled) {
          console.error('PixiJS Initialization failed:', err);
          setInitError(err instanceof Error ? err.message : String(err));
        }
      });
    });

    // Keyboard Shortcuts (WASD / Arrow Keys for Spectator Panning)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!renderer?.app) return;
      const panSpeed = 35;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        renderer.cameraX += panSpeed;
        renderer.followTargetHunterId = null;
        renderer.followTargetBuildingId = null;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        renderer.cameraX -= panSpeed;
        renderer.followTargetHunterId = null;
        renderer.followTargetBuildingId = null;
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        renderer.cameraY += panSpeed;
        renderer.followTargetHunterId = null;
        renderer.followTargetBuildingId = null;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        renderer.cameraY -= panSpeed;
        renderer.followTargetHunterId = null;
        renderer.followTargetBuildingId = null;
      } else if (e.key === '+' || e.key === '=') {
        renderer.cameraZoom = Math.min(2.5, renderer.cameraZoom * 1.15);
      } else if (e.key === '-' || e.key === '_') {
        renderer.cameraZoom = Math.max(0.5, renderer.cameraZoom * 0.85);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      renderer?.destroy();
      // Remove our canvas node so the next mount starts pristine.
      // (destroy() preserves the element; React must not reuse it.)
      canvas?.remove();
      if (renderer && rendererRef.current === renderer) {
        rendererRef.current = null;
      }
    };
  }, [simulation, rendererRef]);

  return (
    <div ref={wrapperRef} className="absolute inset-0 overflow-hidden select-none bg-slate-950">
      {initError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-red-500/50 bg-slate-900/95 p-5 text-sm text-slate-200 shadow-2xl">
            <p className="font-bold text-red-400">3D canvas failed to start</p>
            <p className="mt-1 font-mono text-xs text-slate-400 break-words">{initError}</p>
            <p className="mt-2 text-xs text-slate-400">The simulation UI keeps running. Try reloading, or use a browser with WebGL enabled.</p>
          </div>
        </div>
      )}
    </div>
  );
};
