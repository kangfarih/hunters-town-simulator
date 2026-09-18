import React from 'react';
import { Users, ChevronUp, ChevronDown } from 'lucide-react';
import { Hunter } from '../types';

interface HunterRosterDrawerProps {
  hunters: Hunter[];
  selectedHunterId: string | null;
  onSelectHunter: (hunter: Hunter) => void;
}

export const HunterRosterDrawer: React.FC<HunterRosterDrawerProps> = ({
  hunters,
  selectedHunterId,
  onSelectHunter
}) => {
  const [isOpen, setIsOpen] = React.useState(true);

  const getRarityStyle = (rarity: string) => {
    switch (rarity) {
      case 'Legendary': return { badge: 'text-amber-400 border-amber-500/40 bg-amber-500/10', edge: 'border-l-amber-400' };
      case 'Heroic': return { badge: 'text-red-400 border-red-500/40 bg-red-500/10', edge: 'border-l-red-400' };
      case 'Superior': return { badge: 'text-purple-400 border-purple-500/40 bg-purple-500/10', edge: 'border-l-purple-400' };
      case 'Rare': return { badge: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10', edge: 'border-l-cyan-400' };
      default: return { badge: 'text-slate-300 border-slate-600/40 bg-slate-800/40', edge: 'border-l-slate-500' };
    }
  };

  const getActionBadge = (state: Hunter['state']) => {
    switch (state) {
      case 'FIGHTING': return { text: '⚔️ Slaying', color: 'text-red-400' };
      case 'HUNTING': return { text: '🌲 Hunting', color: 'text-emerald-400' };
      case 'SELLING_LOOT': return { text: '💰 Selling', color: 'text-yellow-400' };
      case 'UPGRADING_GEAR': return { text: '🔨 Forging', color: 'text-blue-400' };
      case 'LEARNING_SKILL': return { text: '📜 Training', color: 'text-purple-400' };
      case 'BREWING_ELIXIR': return { text: '🧪 Brewing', color: 'text-emerald-300' };
      case 'RECOVERING_CLINIC': return { text: '💚 Healing', color: 'text-rose-400' };
      case 'RESTING_TAVERN': return { text: '🍺 Tavern', color: 'text-orange-400' };
      case 'RETURNING_TO_TOWN': return { text: '🏰 Returning', color: 'text-amber-400' };
      case 'REGISTERING': return { text: '📋 Registering', color: 'text-amber-300' };
      default: return { text: '🏃 Marching', color: 'text-slate-400' };
    }
  };

  // Live activity breakdown, grouped by the same action badges above.
  // Computed from the hunters prop each render (no new state/timers).
  const activityGroups = (() => {
    const counts = new Map<string, number>();
    for (const h of hunters) {
      const label = getActionBadge(h.state).text;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({
      label,
      emoji: label.split(' ')[0],
      count,
    }));
  })();

  return (
    <div className="absolute left-3 top-20 bottom-3 z-20 pointer-events-auto font-sans w-60 max-w-[calc(100vw-24px)] flex flex-col">
      {/* Drawer Toggle Pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 text-slate-200 hover:text-white shadow-xl text-xs font-bold transition-all mb-2 cursor-pointer shrink-0"
      >
        <Users className="w-4 h-4 text-indigo-400" />
        <span>Hunters Roster ({hunters.length})</span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-auto" />}
      </button>

      {/* Vertical scrollable roster */}
      {isOpen && (
        <div className="flex-1 min-h-0 flex flex-col p-2 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/60">
          {hunters.length > 0 && (
            <div className="text-[10px] font-mono text-slate-400 px-1 pb-1 flex flex-wrap gap-x-2">
              {activityGroups.map(g => (
                <span key={g.label} title={g.label}>{g.emoji}×{g.count}</span>
              ))}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
          {hunters.length === 0 && (
            <div className="text-center text-slate-500 text-xs py-6">
              No hunters yet — the portal will summon one soon.
            </div>
          )}
          {hunters.map(hunter => {
            const isSelected = selectedHunterId === hunter.id;
            const rarityStyle = getRarityStyle(hunter.rarity);
            const action = getActionBadge(hunter.state);
            const hpRatio = Math.max(0, Math.min(1, hunter.hp / (hunter.maxHp + hunter.armor.hpBonus + hunter.accessory.hpBonus)));
            const moodRatio = Math.max(0, Math.min(1, (hunter.mood ?? 100) / 100));

            return (
              <button
                key={hunter.id}
                onClick={() => onSelectHunter(hunter)}
                className={`w-full p-2 rounded-xl border border-l-4 text-left transition-all cursor-pointer ${rarityStyle.edge} ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/20'
                    : 'border-slate-700/70 bg-slate-800/70 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">
                    {hunter.charClass === 'Berserker' ? '⚔️' : hunter.charClass === 'Ranger' ? '🏹' : hunter.charClass === 'Sorcerer' ? '🔮' : '🛡️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-200 truncate" title={hunter.name}>
                        {hunter.name.split(' ')[0]}
                      </span>
                      <span className="text-[10px] font-bold text-amber-300 font-mono shrink-0">
                        Lv.{hunter.level}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className={`text-[9px] font-black uppercase px-1 rounded border ${rarityStyle.badge}`}>
                        {hunter.rarity}
                      </span>
                      <span className={`text-[10px] font-medium truncate ${action.color}`}>
                        {action.text}
                      </span>
                    </div>
                  </div>
                </div>

                {/* HP + Mood micro-bars */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="flex-1 h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-700/50" title={`HP ${Math.round(hunter.hp)}/${hunter.maxHp + hunter.armor.hpBonus + hunter.accessory.hpBonus}`}>
                    <div
                      className={`h-full ${hpRatio > 0.5 ? 'bg-emerald-400' : hpRatio > 0.25 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${hpRatio * 100}%` }}
                    />
                  </div>
                  <div className="flex-1 h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-700/50" title={`Mood ${Math.round(moodRatio * 100)}`}>
                    <div
                      className={`h-full ${moodRatio >= 0.6 ? 'bg-orange-400' : moodRatio >= 0.4 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${moodRatio * 100}%` }}
                    />
                  </div>
                  {(hunter.deaths ?? 0) > 0 && (
                    <span className="text-[9px] font-mono text-red-300/80 shrink-0" title="Times knocked down">
                      💀{hunter.deaths}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
};
