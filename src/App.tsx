/**
 * Hunters Town - Idle Isometric RPG Web Clone
 * Autonomous Spectator & Omniscience Engine
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GameSimulation } from './game/simulation';
import { PixiRenderer } from './game/pixiRenderer';
import { GameCanvas } from './components/GameCanvas';
import { OmniscienceHeader } from './components/OmniscienceHeader';
import { HeroInspector } from './components/HeroInspector';
import { BuildingInspector } from './components/BuildingInspector';
import { HunterRosterDrawer } from './components/HunterRosterDrawer';
import { ChronicleLogDrawer } from './components/ChronicleLogDrawer';
import { WorldConfigMenu } from './components/WorldConfigMenu';
import { Hunter, Building } from './types';
import { ZoomIn, ZoomOut, RotateCcw, Info, Settings } from 'lucide-react';

export default function App() {
  // Initialize simulation engine once (restores saved town if present)
  const simulation = useMemo(() => GameSimulation.loadOrNew(), []);
  const rendererRef = useRef<PixiRenderer | null>(null);

  // Synchronized state for UI overlays
  const [townGold, setTownGold] = useState(simulation.townGold);
  const [totalMonstersDefeated, setTotalMonstersDefeated] = useState(simulation.totalMonstersDefeated);
  const [hunterCount, setHunterCount] = useState(simulation.hunters.length);
  const [maxHunters, setMaxHunters] = useState(simulation.maxHunters());
  const [summonCountdown, setSummonCountdown] = useState(simulation.summonCountdown);
  const [speedMultiplier, setSpeedMultiplier] = useState(simulation.speedMultiplier);
  const [isPaused, setIsPaused] = useState(simulation.isPaused);
  const [isBossActive, setIsBossActive] = useState(simulation.isBossActive);

  // Inspector targets
  const [selectedHunterId, setSelectedHunterId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [showWorldConfig, setShowWorldConfig] = useState(false);

  // Ticker for synchronizing React state with simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setTownGold(simulation.townGold);
      setTotalMonstersDefeated(simulation.totalMonstersDefeated);
      setHunterCount(simulation.hunters.length);
      setMaxHunters(simulation.maxHunters());
      setSummonCountdown(simulation.summonCountdown);
      setIsBossActive(simulation.isBossActive);
    }, 150);

    return () => clearInterval(interval);
  }, [simulation]);

  // Autosave town state: periodic snapshot + flush when tab hides/closes
  useEffect(() => {
    const saveInterval = setInterval(() => {
      simulation.saveToLocalStorage();
    }, 5000);

    const flushSave = () => simulation.saveToLocalStorage();
    const flushOnHide = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', flushOnHide);

    return () => {
      clearInterval(saveInterval);
      window.removeEventListener('pagehide', flushSave);
      document.removeEventListener('visibilitychange', flushOnHide);
    };
  }, [simulation]);

  const handleSelectHunter = useCallback((hunter: Hunter | null) => {
    if (hunter) {
      setSelectedHunterId(hunter.id);
      setSelectedBuildingId(null);
      setIsFollowing(true);
      if (rendererRef.current) {
        rendererRef.current.followTargetHunterId = hunter.id;
        rendererRef.current.followTargetBuildingId = null;
      }
    } else {
      setSelectedHunterId(null);
      setIsFollowing(false);
      if (rendererRef.current) {
        rendererRef.current.followTargetHunterId = null;
      }
    }
  }, []);

  const handleSelectBuilding = useCallback((building: Building | null) => {
    if (building) {
      setSelectedBuildingId(building.id);
      setSelectedHunterId(null);
      setIsFollowing(true);
      if (rendererRef.current) {
        rendererRef.current.followTargetBuildingId = building.id;
        rendererRef.current.followTargetHunterId = null;
      }
    } else {
      setSelectedBuildingId(null);
      setIsFollowing(false);
      if (rendererRef.current) {
        rendererRef.current.followTargetBuildingId = null;
      }
    }
  }, []);

  const handleToggleFollow = () => {
    if (!rendererRef.current) return;
    if (isFollowing) {
      setIsFollowing(false);
      rendererRef.current.followTargetHunterId = null;
      rendererRef.current.followTargetBuildingId = null;
    } else {
      setIsFollowing(true);
      if (selectedHunterId) {
        rendererRef.current.followTargetHunterId = selectedHunterId;
      } else if (selectedBuildingId) {
        rendererRef.current.followTargetBuildingId = selectedBuildingId;
      }
    }
  };

  const handleSetSpeed = (speed: number) => {
    simulation.speedMultiplier = speed;
    simulation.isPaused = false;
    setSpeedMultiplier(speed);
    setIsPaused(false);
  };

  const handleTogglePause = () => {
    simulation.isPaused = !simulation.isPaused;
    setIsPaused(simulation.isPaused);
  };

  const handleRushSummon = () => {
    simulation.summonCountdown = simulation.autoSummonInterval;
    const newHunter = simulation.summonHero();
    if (newHunter) {
      handleSelectHunter(newHunter);
    } else {
      simulation.addLog('summon', `Summon Portal fizzles: town is full (${simulation.hunters.length}/${simulation.maxHunters()})! Upgrade Sanctuary Hall for +2 slots.`);
    }
  };

  const handleJumpCamera = (zone: 'town' | 'forest' | 'graveyard' | 'volcano') => {
    if (!rendererRef.current) return;
    setIsFollowing(false);
    rendererRef.current.followTargetHunterId = null;
    rendererRef.current.followTargetBuildingId = null;

    if (zone === 'town') rendererRef.current.jumpTo(29, 29);
    else if (zone === 'forest') rendererRef.current.jumpTo(48, 28);
    else if (zone === 'graveyard') rendererRef.current.jumpTo(28, 48);
    else rendererRef.current.jumpTo(48, 48);
  };

  const handleZoom = (delta: number) => {
    if (!rendererRef.current) return;
    rendererRef.current.cameraZoom = Math.min(2.5, Math.max(0.5, rendererRef.current.cameraZoom + delta));
  };

  const handleResetCamera = () => {
    if (!rendererRef.current) return;
    rendererRef.current.cameraZoom = 1.0;
    rendererRef.current.jumpTo(29, 29);
  };

  const handleResetSave = () => {
    // Disable autosave FIRST: the pagehide flush during reload would
    // otherwise re-save the town right after we clear it.
    simulation.saveEnabled = false;
    GameSimulation.clearSave();
    window.location.reload();
  };

  // Find currently selected object instances
  const currentHunter = selectedHunterId 
    ? simulation.hunters.find(h => h.id === selectedHunterId) || null 
    : null;

  const currentBuilding = selectedBuildingId 
    ? simulation.buildings.find(b => b.id === selectedBuildingId) || null 
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 1. PixiJS 16-bit Isometric Game Canvas */}
      <GameCanvas
        simulation={simulation}
        rendererRef={rendererRef}
        onSelectHunter={handleSelectHunter}
        onSelectBuilding={handleSelectBuilding}
      />

      {/* 2. Omniscience Header & Real-time Status */}
      <OmniscienceHeader
        townGold={townGold}
        totalMonstersDefeated={totalMonstersDefeated}
        hunterCount={hunterCount}
        maxHunters={maxHunters}
        summonCountdown={summonCountdown}
        autoSummonInterval={simulation.autoSummonInterval}
        speedMultiplier={speedMultiplier}
        isPaused={isPaused}
        onSetSpeed={handleSetSpeed}
        onTogglePause={handleTogglePause}
        onRushSummon={handleRushSummon}
        onJumpCamera={handleJumpCamera}
        isBossActive={isBossActive}
      />

      {/* 3. Hero Character Sheet Inspector */}
      {currentHunter && (
        <HeroInspector
          hunter={currentHunter}
          onClose={() => setSelectedHunterId(null)}
          isFollowing={isFollowing}
          onToggleFollow={handleToggleFollow}
          partyMembers={currentHunter.partyId ? simulation.partyMembers(currentHunter).filter(h => h.id !== currentHunter.id) : []}
          isPartyLeader={simulation.isPartyLeader(currentHunter)}
        />
      )}

      {/* 4. NPC Store & Building Inspector */}
      {currentBuilding && (
        <BuildingInspector
          building={currentBuilding}
          hunters={simulation.hunters}
          onClose={() => setSelectedBuildingId(null)}
          isFollowing={isFollowing}
          onToggleFollow={handleToggleFollow}
          materialStock={simulation.materialStock}
        />
      )}

      {/* 5. Active Hunters Roster Drawer (Bottom Left) */}
      <HunterRosterDrawer
        hunters={simulation.hunters}
        selectedHunterId={selectedHunterId}
        onSelectHunter={handleSelectHunter}
        partyLeaderIds={new Set([...simulation.parties.values()].map(p => p.leaderId))}
      />

      {/* 6. Live Town Chronicle / Event Log (Bottom Right) */}
      <ChronicleLogDrawer logs={simulation.logs} />

      {/* 7. Floating Camera & Zoom Controls (Bottom Center) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/50 text-slate-300">
        <button
          onClick={() => handleZoom(0.2)}
          className="p-2 rounded-xl hover:bg-slate-800 hover:text-white transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(-0.2)}
          className="p-2 rounded-xl hover:bg-slate-800 hover:text-white transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetCamera}
          className="p-2 rounded-xl hover:bg-slate-800 hover:text-white transition-colors"
          title="Reset Camera (Center Town)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-5 bg-slate-700 mx-0.5" />
        <button
          onClick={() => setShowWorldConfig(!showWorldConfig)}
          className={`p-2 rounded-xl transition-colors ${showWorldConfig ? 'bg-cyan-500 text-slate-950' : 'hover:bg-slate-800 hover:text-white'}`}
          title="World Config (difficulty, survivability, reset)"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowHelpGuide(!showHelpGuide)}
          className={`p-2 rounded-xl transition-colors ${showHelpGuide ? 'bg-amber-500 text-slate-950' : 'hover:bg-slate-800 hover:text-white'}`}
          title="Spectator Guide"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* 8. World Config Menu */}
      {showWorldConfig && (
        <WorldConfigMenu
          simulation={simulation}
          onClose={() => setShowWorldConfig(false)}
          onResetWorld={handleResetSave}
        />
      )}

      {/* 8. Omniscience Spectator Quick Guide Modal */}
      {showHelpGuide && (
        <div className="absolute inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl shadow-black/80 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">👁️</span>
                <h3 className="text-base font-bold text-amber-300 font-mono">
                  Omniscience Spectator Guide
                </h3>
              </div>
              <button
                onClick={() => setShowHelpGuide(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <strong className="text-amber-300 block mb-0.5">1. Autonomous Hunter Lifecycle:</strong>
                Heroes auto-summon at the portal every 30s (up to the town cap: 4 + 2 per Sanctuary Hall level). New arrivals register at Sanctuary Hall — funding it raises the cap and the town tax rate. They march out through the region gates (palisade walls funnel every trip through guarded chokepoints), slay monsters, gain EXP, and collect valuable trophies. Overleveled kills earn diminished spoils, worthless beyond +2 levels — hunt at grade. Crowded or outmatched hunters form field parties of up to 5 (👥, leader ♛): members follow the leader's target, pool danger assessment, and split EXP/gold with rotating loot — parties dissolve on entering town or loading a save. Hunters hold the field until HP drops below 20%, bags fill, or they outgrow the zone. Every town arrival chains all errands (tavern, cauldron, forge, academy, clinic) before marching back out. Five dark reserved lands border the realm (north + west) for future expansion.
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <strong className="text-cyan-300 block mb-0.5">2. Auto Selling & NPC Store Upgrades:</strong>
                When full of loot, wounded, or out-leveled for their zone, hunters autonomously return to town. Each town visit chains every errand — sell loot at the Trading Post, forge gear at the Blacksmith, learn skills at the Academy, and heal in the Clinic — before marching back out. Taking hits ruins their Mood (0–100), which scales all combat stats — miserable hunters slink off to the Boar &amp; Barrel Tavern for drinks that restore Mood plus a temporary morale ATK buff. They also restock combat elixirs at the Elixir Cauldron, auto-gulped at low HP mid-fight. Every transaction awards Store EXP, automatically leveling up buildings to unlock higher tiers! Shops have limited customer slots plus craft/recovery timers that improve with level.
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <strong className="text-emerald-300 block mb-0.5">3. Camera & Tracking:</strong>
                Click on any hunter or building in the world (or in the bottom roster) to inspect their stats and lock the camera to track them. Drag or use WASD/Arrows to pan freely.
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <strong className="text-purple-300 block mb-0.5">4. Time Acceleration:</strong>
                Switch simulation speed between 1x, 2x, and 4x or pause anytime from the top bar. Progress auto-saves locally every few seconds — open World Config (gear icon) for difficulty, hunter survivability stats, and world reset.
              </div>
            </div>

            <button
              onClick={() => setShowHelpGuide(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-amber-500/20"
            >
              Back to Viewing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
