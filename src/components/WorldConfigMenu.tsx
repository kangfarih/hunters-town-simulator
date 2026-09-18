import React, { useEffect, useState } from 'react';
import { X, Settings, Skull, HeartPulse, Swords, RotateCcw, AlertTriangle, Bug, Gauge, Minus, Plus } from 'lucide-react';
import { GameSimulation, DEFAULT_AGENT_CONFIG } from '../game/simulation';

interface WorldConfigMenuProps {
  simulation: GameSimulation;
  onClose: () => void;
  onResetWorld: () => void;
}

const Stepper: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  accent: string;
  step?: number;
}> = ({ value, min, max, onChange, accent, step = 1 }) => (
  <div className="flex items-center gap-2">
    <button
      onClick={() => onChange(value - step)}
      disabled={value <= min}
      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
    >
      <Minus className="w-3.5 h-3.5" />
    </button>
    <span className={`flex-1 text-center text-lg font-black font-mono ${accent}`}>{value}</span>
    <button
      onClick={() => onChange(value + step)}
      disabled={value >= max}
      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  </div>
);

export const WorldConfigMenu: React.FC<WorldConfigMenuProps> = ({
  simulation,
  onClose,
  onResetWorld
}) => {
  // Re-read live simulation numbers while open
  const [, setTick] = useState(0);
  const [difficulty, setDifficultyState] = useState(simulation.difficulty);
  const [population, setPopulationState] = useState(simulation.monsterPopulation);
  const [autoDirector, setAutoDirectorState] = useState(simulation.autoDirector);
  const [retreatPct, setRetreatPct] = useState(Math.round(simulation.agentConfig.retreatHpFrac * 100));
  const [dangerHits, setDangerHits] = useState(simulation.agentConfig.dangerHits);
  const [grayGap, setGrayGap] = useState(simulation.agentConfig.grayGap);
  const [huntDrive, setHuntDrive] = useState(Math.round(simulation.agentConfig.huntBaseline * 100));
  const [tavernMood, setTavernMood] = useState(simulation.agentConfig.tavernMood);
  const [partiesEnabled, setPartiesEnabled] = useState(simulation.agentConfig.partiesEnabled !== false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      // Reflect outside changes (e.g. legacy saves) while open
      setDifficultyState(simulation.difficulty);
      setPopulationState(simulation.monsterPopulation);
      setAutoDirectorState(simulation.autoDirector);
      setRetreatPct(Math.round(simulation.agentConfig.retreatHpFrac * 100));
      setDangerHits(simulation.agentConfig.dangerHits);
      setGrayGap(simulation.agentConfig.grayGap);
      setHuntDrive(Math.round(simulation.agentConfig.huntBaseline * 100));
      setTavernMood(simulation.agentConfig.tavernMood);
      setPartiesEnabled(simulation.agentConfig.partiesEnabled !== false);
    }, 500);
    return () => clearInterval(interval);
  }, [simulation]);

  const handleSetDifficulty = (d: number) => {
    simulation.setDifficulty(d);
    setDifficultyState(simulation.difficulty);
  };

  const handleSetPopulation = (n: number) => {
    simulation.setPopulation(n);
    setPopulationState(simulation.monsterPopulation);
  };

  const handleToggleDirector = () => {
    simulation.autoDirector = !simulation.autoDirector;
    setAutoDirectorState(simulation.autoDirector);
    simulation.saveToLocalStorage();
  };

  const syncAgent = () => {
    setRetreatPct(Math.round(simulation.agentConfig.retreatHpFrac * 100));
    setDangerHits(simulation.agentConfig.dangerHits);
    setGrayGap(simulation.agentConfig.grayGap);
    setHuntDrive(Math.round(simulation.agentConfig.huntBaseline * 100));
    setTavernMood(simulation.agentConfig.tavernMood);
    setPartiesEnabled(simulation.agentConfig.partiesEnabled !== false);
  };

  const kills = simulation.totalMonstersDefeated;
  const deaths = simulation.totalHunterDeaths;
  const summoned = Math.max(1, simulation.totalSummonedHunters);
  const survivalRate = kills + deaths === 0 ? 100 : (kills / (kills + deaths)) * 100;
  const wipeRate = (deaths / summoned) * 100;
  const untouched = simulation.hunters.filter(h => (h.deaths ?? 0) === 0).length;

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80 text-slate-200 max-h-[calc(100vh-48px)] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 sticky top-0 bg-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-300" />
            <h3 className="text-sm font-bold text-white font-mono">World Config</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* Difficulty stepper */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Swords className="w-3.5 h-3.5 text-amber-400" /> Difficulty Level
            </h4>
            <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
              <Stepper value={difficulty} min={1} max={10} onChange={handleSetDifficulty} accent="text-amber-300" />
              <div className="text-[10px] text-slate-400 mt-1.5 text-center font-mono">
                {(() => {
                  const m = GameSimulation.difficultyMultipliers(difficulty);
                  return `Beasts HP ×${m.hp.toFixed(1)} · ATK ×${m.atk.toFixed(1)} · loot ×${m.reward.toFixed(1)}`;
                })()}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              1 = gentle, 5 = standard, 10 = brutal. Applies to newly spawned monsters. Saved.
            </p>
          </div>

          {/* Monster population stepper */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Bug className="w-3.5 h-3.5 text-emerald-400" /> Monster Population
            </h4>
            <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
              <Stepper value={population} min={3} max={40} onChange={handleSetPopulation} accent="text-emerald-300" />
              <div className="text-[10px] text-slate-400 mt-1.5 text-center font-mono">
                {(() => {
                  const t = simulation.populationTargets();
                  return `Forest ${t.z1} · Crypt ${t.z2} · Volcano ${t.z3}`;
                })()}
              </div>
            </div>
          </div>

          {/* Auto-director */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-purple-400" /> Auto Dynamic Adjustment
            </h4>
            <button
              onClick={handleToggleDirector}
              className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                autoDirector
                  ? 'border-purple-400/60 bg-purple-500/15 text-purple-200'
                  : 'border-slate-700 bg-slate-800/70 text-slate-400'
              }`}
            >
              <span className="text-xs font-bold">{autoDirector ? 'ON — holds survival near 75%' : 'OFF — static spawns only'}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${autoDirector ? 'bg-purple-500/30' : 'bg-slate-700'}`}>
                {autoDirector ? 'ACTIVE' : 'PAUSED'}
              </span>
            </button>
            <div className="mt-1.5 p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-[11px] font-mono text-slate-300 flex justify-between">
              <span>Beast power modifier</span>
              <span className={`font-bold ${simulation.dynamicAtk > 1.05 ? 'text-red-300' : simulation.dynamicAtk < 0.95 ? 'text-emerald-300' : 'text-slate-100'}`}>
                HP ×{simulation.dynamicHp.toFixed(2)} · ATK ×{simulation.dynamicAtk.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Survivability */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <HeartPulse className="w-3.5 h-3.5 text-emerald-400" /> Hunter Survivability
            </h4>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <div className="text-slate-400 text-[10px]">Survival rate</div>
                <div className={`text-lg font-bold ${survivalRate >= 90 ? 'text-emerald-300' : survivalRate >= 75 ? 'text-amber-300' : 'text-red-300'}`}>
                  {survivalRate.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-500">{kills} kills · {deaths} knockdowns</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <div className="text-slate-400 text-[10px] flex items-center gap-1">
                  <Skull className="w-3 h-3 text-red-400" /> Wipe rate
                </div>
                <div className={`text-lg font-bold ${wipeRate <= 10 ? 'text-emerald-300' : wipeRate <= 25 ? 'text-amber-300' : 'text-red-300'}`}>
                  {wipeRate.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-500">knockdowns per summoned hunter</div>
              </div>
            </div>
            <div className="mt-1.5 p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-[11px] text-slate-300 flex justify-between">
              <span>Untouched hunters (never downed)</span>
              <span className="font-mono font-bold text-slate-100">{untouched} / {simulation.hunters.length}</span>
            </div>
          </div>

          {/* Agent behavior */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Settings className="w-3.5 h-3.5 text-cyan-300" /> Agent Behavior
            </h4>
            <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                  <span>Retreat HP %</span><span className="font-mono text-cyan-300">{retreatPct}%</span>
                </div>
                <Stepper value={retreatPct} min={5} max={50} step={5} onChange={v => { simulation.updateAgentConfig({ retreatHpFrac: v / 100 }); syncAgent(); }} accent="text-cyan-300" />
                <p className="text-[10px] text-slate-500 mt-1">Flee to the clinic below this HP — higher = safer hunters.</p>
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                  <span>Bravery min-hits</span><span className="font-mono text-cyan-300">{dangerHits}</span>
                </div>
                <Stepper value={dangerHits} min={2} max={12} onChange={v => { simulation.updateAgentConfig({ dangerHits: v }); syncAgent(); }} accent="text-cyan-300" />
                <p className="text-[10px] text-slate-500 mt-1">Fights survivable for fewer hits read as too-hard — lower = braver.</p>
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                  <span>Gray gap</span><span className="font-mono text-cyan-300">{grayGap}</span>
                </div>
                <Stepper value={grayGap} min={2} max={6} onChange={v => { simulation.updateAgentConfig({ grayGap: v }); syncAgent(); }} accent="text-cyan-300" />
                <p className="text-[10px] text-slate-500 mt-1">Level gap at/above which kills pay nothing — higher = longer leveling tail.</p>
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                  <span>Hunt drive</span><span className="font-mono text-cyan-300">{huntDrive}</span>
                </div>
                <Stepper value={huntDrive} min={20} max={80} step={5} onChange={v => { simulation.updateAgentConfig({ huntBaseline: v / 100 }); syncAgent(); }} accent="text-cyan-300" />
                <p className="text-[10px] text-slate-500 mt-1">How much hunters love the field — higher = fewer town trips.</p>
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                  <span>Tavern mood</span><span className="font-mono text-cyan-300">{tavernMood}</span>
                </div>
                <Stepper value={tavernMood} min={10} max={100} step={5} onChange={v => { simulation.updateAgentConfig({ tavernMood: v }); syncAgent(); }} accent="text-cyan-300" />
                <p className="text-[10px] text-slate-500 mt-1">Mood below this sends hunters for a drink — lower = fewer tavern trips.</p>
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-300 mb-1">
                  <span>Field parties</span><span className="font-mono text-cyan-300">{partiesEnabled ? 'ON' : 'OFF'}</span>
                </div>
                <button
                  onClick={() => { simulation.updateAgentConfig({ partiesEnabled: !partiesEnabled }); syncAgent(); }}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    partiesEnabled
                      ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-700 bg-slate-800/70 text-slate-400'
                  }`}
                >
                  <span className="text-xs font-bold">{partiesEnabled ? 'ON — hunters team up, split spoils' : 'OFF — solo hunters only'}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${partiesEnabled ? 'bg-cyan-500/30' : 'bg-slate-700'}`}>
                    {partiesEnabled ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </button>
                <p className="text-[10px] text-slate-500 mt-1">Crowded or outmatched hunters form parties of up to 5 — OFF dissolves them live.</p>
              </div>
              <button
                onClick={() => { simulation.updateAgentConfig({ ...DEFAULT_AGENT_CONFIG }); syncAgent(); }}
                className="w-full py-2 rounded-xl bg-transparent hover:bg-cyan-500/10 border border-cyan-400/60 text-cyan-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset behavior to defaults
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Danger Zone
            </h4>
            <button
              onClick={() => simulation.resetHunterStats()}
              className="w-full py-2.5 rounded-xl bg-transparent hover:bg-amber-500/10 border border-amber-400/60 text-amber-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer mb-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retrain all hunters to Lv 1
            </button>
            <button
              onClick={onResetWorld}
              className="w-full py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/70 border border-red-500/40 text-red-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset World (erase save & restart)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
