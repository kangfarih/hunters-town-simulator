import React from 'react';
import {
  X, Building as BuildingIcon, Sparkles, TrendingUp,
  Coins, Users, CheckCircle2, Eye, ShieldCheck
} from 'lucide-react';
import { Building, Hunter, MaterialStock } from '../types';
import { buildingCapacity, serviceTime } from '../game/simulation';

interface BuildingInspectorProps {
  building: Building;
  hunters: Hunter[];
  onClose: () => void;
  isFollowing: boolean;
  onToggleFollow: () => void;
  materialStock?: MaterialStock;
}

const MATERIAL_EMOJI: { key: keyof MaterialStock; emoji: string; label: string }[] = [
  { key: 'bone', emoji: '🦴', label: 'bone' },
  { key: 'pelt', emoji: '🐺', label: 'pelt' },
  { key: 'horn', emoji: '🦏', label: 'horn' },
  { key: 'fang', emoji: '🦷', label: 'fang' },
  { key: 'magic_orb', emoji: '🔮', label: 'magic_orb' },
  { key: 'dragon_scale', emoji: '🐉', label: 'dragon_scale' },
];

export const BuildingInspector: React.FC<BuildingInspectorProps> = ({
  building,
  hunters,
  onClose,
  isFollowing,
  onToggleFollow,
  materialStock
}) => {
  const expPercent = Math.max(0, Math.min(100, (building.exp / building.expToNext) * 100));

  const visitingHunters = hunters.filter(h => building.currentVisitors.includes(h.id));

  return (
    <div className="absolute right-3 top-20 bottom-3 w-84 max-w-[calc(100vw-24px)] z-20 flex flex-col bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/60 overflow-hidden text-slate-200 pointer-events-auto font-sans">
      {/* Header */}
      <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 border-b border-slate-700/60 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border-2 border-amber-400/60 flex items-center justify-center text-amber-300 text-2xl shadow-lg shadow-amber-500/10">
            {building.type === 'TOWN_HALL' ? '🏰' : 
             building.type === 'BLACKSMITH' ? '🔨' : 
             building.type === 'ALCHEMY_LAB' ? '🧪' : 
             building.type === 'TAVERN' ? '🍺' : 
             building.type === 'TRAINING_ACADEMY' ? '🥋' : 
             building.type === 'TRADING_POST' ? '⚖️' : '🏥'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black font-mono">
                LV.{building.level} / {building.maxLevel}
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Autonomous Store
              </span>
            </div>
            <h2 className="text-sm font-bold text-white mt-0.5 truncate">
              {building.name}
            </h2>
          </div>
        </div>

        <p className="text-[11px] text-slate-300 mt-2.5 leading-relaxed">
          {building.description}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> {building.serviceName}
          </span>
          <button
            onClick={onToggleFollow}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
              isFollowing
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3 h-3" />
            {isFollowing ? 'Locking View' : 'Focus Store'}
          </button>
        </div>
      </div>

      {/* Body Details */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Auto Upgrade Progress */}
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Auto-Upgrade EXP
            </h3>
            <span className="text-[11px] font-mono text-slate-300 font-bold">
              {building.exp} / {building.expToNext} EXP
            </span>
          </div>

          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
              style={{ width: `${expPercent}%` }}
            />
          </div>

          <p className="text-[10px] text-slate-400 leading-snug">
            ✨ This building automatically levels up every time hunters sell loot, upgrade gear, learn skills, or rest!
          </p>
        </div>

        {/* Transaction History & Revenue */}
        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="text-slate-400 flex items-center gap-1 text-[10px]">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Transactions
            </div>
            <div className="text-base font-bold text-cyan-300 mt-1">
              {building.totalTransactions}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="text-slate-400 flex items-center gap-1 text-[10px]">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> Lifetime Gold
            </div>
            <div className="text-base font-bold text-amber-300 mt-1">
              {building.lifetimeGold.toLocaleString()}g
            </div>
          </div>
        </div>

        {/* Level Perks & Benefits */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Current Store Bonuses
          </h3>
          <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 leading-relaxed">
            {building.upgradeEffect}
            <div className="text-[10px] text-emerald-400/80 mt-1 font-mono">
              Next Lv.{building.level + 1}: +25% efficiency & increased stat multipliers.
            </div>
            {building.type === 'BLACKSMITH' && (
              <div className="text-[10px] text-emerald-300/90 mt-1 font-mono">
                Weapon: 80×tier g + 2 mats · Armor: 60×tier g + 2 mats
              </div>
            )}
            {building.type === 'ALCHEMY_LAB' && (
              <div className="text-[10px] text-emerald-300/90 mt-1 font-mono">
                Elixir: 15+5×Lv g + 1 mat each · Tonic: 20+5×Lv g + 1 mat each
              </div>
            )}
          </div>
        </div>

        {building.type === 'TRADING_POST' && materialStock && (
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1.5">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Town Material Stock
            </h3>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
              {MATERIAL_EMOJI.map(m => (
                <div key={m.key} className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-700/50">
                  <span className="text-slate-300">{m.emoji} {m.label}</span>
                  <span className="text-slate-100 font-bold">{materialStock[m.key]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Capacity & Service */}
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1.5">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-cyan-400" /> Capacity &amp; Service
          </h3>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Occupancy</span>
            <span className="text-slate-200 font-bold">{building.currentVisitors.length} / {buildingCapacity(building)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Service time</span>
            <span className="text-slate-200 font-bold">{serviceTime(building).toFixed(1)}s</span>
          </div>
        </div>

        {/* Visiting Hunters in Queue */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-indigo-400" /> Active Customers
          </h3>

          {visitingHunters.length === 0 ? (
            <div className="p-3 rounded-xl bg-slate-800/40 border border-dashed border-slate-700 text-center text-slate-500 text-[11px]">
              No hunters currently inside. Hunters in the field will return when full on loot or in need of upgrades.
            </div>
          ) : (
            <div className="space-y-1.5">
              {visitingHunters.map(h => (
                <div key={h.id} className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {h.charClass === 'Berserker' ? '⚔️' : h.charClass === 'Ranger' ? '🏹' : h.charClass === 'Sorcerer' ? '🔮' : '🛡️'}
                    </span>
                    <div>
                      <div className="font-bold text-slate-200 text-xs">{h.name}</div>
                      <div className="text-[10px] text-amber-300 font-mono">Lv.{h.level} {h.charClass}</div>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-mono animate-pulse">
                    Transacting
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
