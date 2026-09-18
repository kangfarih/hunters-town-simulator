import React from 'react';
import { ScrollText, X, Sparkles, TrendingUp, Skull, Zap, ChevronUp, ChevronDown } from 'lucide-react';
import { GameLog } from '../types';

interface ChronicleLogDrawerProps {
  logs: GameLog[];
}

export const ChronicleLogDrawer: React.FC<ChronicleLogDrawerProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'trade' | 'upgrade' | 'boss' | 'summon'>('all');

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  const getLogIcon = (type: GameLog['type']) => {
    switch (type) {
      case 'summon': return <Sparkles className="w-3.5 h-3.5 text-indigo-400" />;
      case 'upgrade': return <TrendingUp className="w-3.5 h-3.5 text-amber-400" />;
      case 'trade': return <span className="text-xs">💰</span>;
      case 'boss': return <Skull className="w-3.5 h-3.5 text-red-400" />;
      case 'skill': return <Zap className="w-3.5 h-3.5 text-cyan-400" />;
      default: return <span className="text-xs">⚔️</span>;
    }
  };

  return (
    <div className="absolute bottom-3 right-3 z-20 pointer-events-auto font-sans">
      {/* Drawer Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 text-slate-200 hover:text-white shadow-xl text-xs font-bold transition-all mb-2 ml-auto cursor-pointer"
      >
        <ScrollText className="w-4 h-4 text-amber-400" />
        <span>Town Chronicles ({logs.length})</span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      {/* Expanded Logs Panel */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-80 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/60 flex flex-col overflow-hidden text-xs">
          {/* Header & Filter Tabs */}
          <div className="p-3 border-b border-slate-700/60 bg-slate-800/60">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <ScrollText className="w-4 h-4 text-amber-400" /> Autonomous Event Feed
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {(['all', 'trade', 'upgrade', 'boss', 'summon'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition-colors capitalize ${
                    filter === f
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Logs Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-slate-500 py-6 text-[11px]">
                No logged events in this category yet.
              </div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/50 flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    {getLogIcon(log.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-slate-200 leading-snug">
                      {log.message}
                    </p>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">
                      {log.timestamp}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
