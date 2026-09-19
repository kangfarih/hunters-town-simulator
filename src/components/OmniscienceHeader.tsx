import React from 'react';
import { 
  Coins, Skull, Users, Play, Pause, FastForward, 
  Volume2, VolumeX, Eye, Compass, Zap, Flame, Shield, TreePine, Sparkles 
} from 'lucide-react';
import { soundFx } from '../game/audioSynth';
import type { DungeonState } from '../game/dungeon';

interface OmniscienceHeaderProps {
  townGold: number;
  totalMonstersDefeated: number;
  hunterCount: number;
  maxHunters: number;
  summonCountdown: number;
  autoSummonInterval: number;
  speedMultiplier: number;
  isPaused: boolean;
  onSetSpeed: (speed: number) => void;
  onTogglePause: () => void;
  onRushSummon: () => void;
  onJumpCamera: (zone: 'town' | 'forest' | 'graveyard' | 'volcano') => void;
  isBossActive: boolean;
  dungeonState?: DungeonState;
  dungeonBossesDown?: number;
  dungeonLockoutSecs?: number;
  dungeonMembers?: number;
}

export const OmniscienceHeader: React.FC<OmniscienceHeaderProps> = ({
  townGold,
  totalMonstersDefeated,
  hunterCount,
  maxHunters,
  summonCountdown,
  autoSummonInterval,
  speedMultiplier,
  isPaused,
  onSetSpeed,
  onTogglePause,
  onRushSummon,
  onJumpCamera,
  isBossActive,
  dungeonState,
  dungeonBossesDown = 0,
  dungeonLockoutSecs = 0,
  dungeonMembers = 0
}) => {
  const [isMuted, setIsMuted] = React.useState(soundFx.isMuted);

  const toggleSound = () => {
    soundFx.isMuted = !soundFx.isMuted;
    setIsMuted(soundFx.isMuted);
  };

  const summonProgress = Math.max(0, Math.min(100, ((autoSummonInterval - summonCountdown) / autoSummonInterval) * 100));

  return (
    <header className="absolute top-3 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
      {/* Left: Town Title & Core Economy Stats */}
      <div className="flex items-center gap-3 pointer-events-auto bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-amber-500/30 shadow-xl shadow-black/40">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700/60">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-white shadow-md font-black text-sm">
            HT
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider text-amber-300 uppercase leading-tight font-mono">
              Hunters Town
            </h1>
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Eye className="w-3 h-3 text-cyan-400" /> Omniscience Mode
            </span>
          </div>
        </div>

        {/* Town Gold */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-amber-300 font-mono">
            {townGold.toLocaleString()}g
          </span>
        </div>

        {/* Monster Kills */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50">
          <Skull className="w-4 h-4 text-red-400" />
          <span className="text-xs font-bold text-red-300 font-mono">
            {totalMonstersDefeated} Slain
          </span>
        </div>

        {/* Active Hunters */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50" title={`Town capacity: ${maxHunters} (upgrade Sanctuary Hall for +2 slots)`}>
          <Users className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-emerald-300 font-mono">
            {hunterCount}/{maxHunters} Hunters
          </span>
        </div>
      </div>

      {/* Center: 30-Second Auto Summon Portal Tracker */}
      <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-indigo-500/30 shadow-xl flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded-full bg-indigo-950 flex items-center justify-center border border-indigo-400/60 overflow-hidden">
            <div 
              className="absolute inset-0 bg-indigo-500/30 transition-all duration-300"
              style={{ height: `${summonProgress}%` }}
            />
            <Sparkles className="w-4 h-4 text-indigo-300 animate-pulse relative z-10" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-indigo-200">Auto Summon</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/80 text-indigo-300 font-mono">
                {Math.ceil(summonCountdown)}s
              </span>
            </div>
            {/* Mini Progress Bar */}
            <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1 border border-slate-700/60">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-200"
                style={{ width: `${summonProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Rush Summon Button */}
        <button
          onClick={onRushSummon}
          className="px-2.5 py-1 text-xs font-bold text-indigo-100 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1 shadow-md shadow-indigo-600/30"
          title="Instantly summon a new Hunter"
        >
          <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
          Rush
        </button>
      </div>

      {/* Right: Camera Jump Presets & Simulation Controls */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Dungeon Vault Status Chip */}
        {dungeonState !== undefined && (
          <div
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold font-mono border shadow-lg ${
              dungeonState === 'active'
                ? 'bg-purple-950/90 text-purple-200 border-purple-500/50 shadow-purple-900/40'
                : dungeonState === 'cleared'
                  ? 'bg-amber-950/90 text-amber-200 border-amber-500/50 shadow-amber-900/40'
                  : 'bg-slate-900/90 text-slate-300 border-slate-700/60 shadow-black/40'
            }`}
            title={
              dungeonState === 'dormant'
                ? 'The Vault is sealed. A full party of 5 level-15 hunters may descend.'
                : dungeonState === 'active'
                  ? 'Delvers are inside the Vault fighting the three bosses.'
                  : dungeonState === 'lockout'
                    ? 'The Vault gate is shut. It re-opens when the timer expires.'
                    : 'The Vault is cleared! The gate re-opens when the timer expires.'
            }
          >
            {dungeonState === 'dormant' && (
              <span>🗝️ Vault: sealed — full Lv.15 party of 5</span>
            )}
            {dungeonState === 'active' && (
              <span>🗝️ Vault: Bosses {dungeonBossesDown}/3 · {dungeonMembers} inside</span>
            )}
            {dungeonState === 'lockout' && (
              <span>🗝️ Vault resets in {dungeonLockoutSecs}s</span>
            )}
            {dungeonState === 'cleared' && (
              <span>🎉 Vault cleared!</span>
            )}
          </div>
        )}
        {/* Boss Alert Pulse */}
        {isBossActive && (
          <button
            onClick={() => onJumpCamera('volcano')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-600/90 text-white text-xs font-black animate-pulse border border-red-400 shadow-lg shadow-red-600/50 cursor-pointer"
          >
            <Flame className="w-4 h-4 text-amber-300" />
            LICH BOSS ACTIVE!
          </button>
        )}

        {/* Camera Jump Bar */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={() => onJumpCamera('town')}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
            title="Sanctuary Town"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            Town
          </button>
          <button
            onClick={() => onJumpCamera('forest')}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
            title="Whispering Forest (Slimes & Goblins)"
          >
            <TreePine className="w-3.5 h-3.5 text-emerald-400" />
            Forest
          </button>
          <button
            onClick={() => onJumpCamera('graveyard')}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
            title="Gloomy Graveyard (Skeletons & Ghouls)"
          >
            <Skull className="w-3.5 h-3.5 text-purple-400" />
            Crypt
          </button>
          <button
            onClick={() => onJumpCamera('volcano')}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
            title="Volcanic Ruins (Drakes & Boss)"
          >
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            Volcano
          </button>
        </div>

        {/* Speed & Pause */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={onTogglePause}
            className={`p-1.5 rounded-lg transition-colors ${isPaused ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
          </button>

          {[1, 2, 4].map(spd => (
            <button
              key={spd}
              onClick={() => onSetSpeed(spd)}
              className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                speedMultiplier === spd && !isPaused
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Sound Toggle */}
        <button
          onClick={toggleSound}
          className="p-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title={isMuted ? 'Unmute Chiptune FX' : 'Mute Sound'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>
    </header>
  );
};
