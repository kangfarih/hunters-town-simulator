import React from 'react';
import { 
  X, Shield, Swords, Sparkles, Heart, Zap, Crosshair, 
  Package, Trophy, Eye, ArrowUpCircle, Compass 
} from 'lucide-react';
import { Hunter, HunterRarity } from '../types';

interface HeroInspectorProps {
  hunter: Hunter;
  onClose: () => void;
  isFollowing: boolean;
  onToggleFollow: () => void;
  partyMembers?: Hunter[];
  isPartyLeader?: boolean;
}

export const HeroInspector: React.FC<HeroInspectorProps> = ({
  hunter,
  onClose,
  isFollowing,
  onToggleFollow,
  partyMembers,
  isPartyLeader
}) => {
  const getRarityBadge = (rarity: HunterRarity) => {
    switch (rarity) {
      case 'Legendary':
        return { border: 'border-amber-400', bg: 'bg-amber-500/20', text: 'text-amber-300', glow: 'shadow-amber-500/30' };
      case 'Heroic':
        return { border: 'border-red-500', bg: 'bg-red-500/20', text: 'text-red-400', glow: 'shadow-red-500/30' };
      case 'Superior':
        return { border: 'border-purple-500', bg: 'bg-purple-500/20', text: 'text-purple-300', glow: 'shadow-purple-500/30' };
      case 'Rare':
        return { border: 'border-cyan-500', bg: 'bg-cyan-500/20', text: 'text-cyan-300', glow: 'shadow-cyan-500/30' };
      default:
        return { border: 'border-slate-500', bg: 'bg-slate-500/20', text: 'text-slate-300', glow: 'shadow-slate-500/20' };
    }
  };

  const getStatusDisplay = (state: Hunter['state']) => {
    switch (state) {
      case 'FIGHTING':
        return { label: '⚔️ Slaying Monster', color: 'text-red-400 bg-red-950/60 border-red-500/40' };
      case 'HUNTING':
        return { label: '🌲 Tracking Field Beasts', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40' };
      case 'TRAVELING_TO_HUNT':
        return { label: '🏃 Marching to Hunt Field', color: 'text-cyan-400 bg-cyan-950/60 border-cyan-500/40' };
      case 'RETURNING_TO_TOWN':
        return { label: '🏰 Returning to Town', color: 'text-amber-400 bg-amber-950/60 border-amber-500/40' };
      case 'SELLING_LOOT':
        return { label: '💰 Auto-Selling Monster Loot', color: 'text-yellow-400 bg-yellow-950/60 border-yellow-500/40 animate-pulse' };
      case 'UPGRADING_GEAR':
        return { label: '🔨 Forging Gear at Blacksmith', color: 'text-blue-400 bg-blue-950/60 border-blue-500/40 animate-pulse' };
      case 'LEARNING_SKILL':
        return { label: '📜 Training Skill at Academy', color: 'text-purple-400 bg-purple-950/60 border-purple-500/40 animate-pulse' };
      case 'RECOVERING_CLINIC':
        return { label: '💚 Emergency Care in Clinic', color: 'text-rose-400 bg-rose-950/60 border-rose-500/40 animate-pulse' };
      case 'RESTING_TAVERN':
        return { label: '🍖 Feasting & Resting at Tavern', color: 'text-orange-400 bg-orange-950/60 border-orange-500/40' };
      case 'REGISTERING':
        return { label: '📋 Registering at Sanctuary Hall', color: 'text-amber-400 bg-amber-950/60 border-amber-500/40' };
      case 'BREWING_ELIXIR':
        return { label: '🧪 Brewing Elixirs at Cauldron', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40 animate-pulse' };
      default:
        return { label: '✨ Sanctuary Stroll', color: 'text-slate-400 bg-slate-900 border-slate-700' };
    }
  };

  const rarityStyle = getRarityBadge(hunter.rarity);
  const status = getStatusDisplay(hunter.state);
  const effectiveMaxHp = hunter.maxHp + hunter.armor.hpBonus + hunter.accessory.hpBonus;
  const hpPercent = Math.max(0, Math.min(100, (hunter.hp / effectiveMaxHp) * 100));
  const expPercent = Math.max(0, Math.min(100, (hunter.exp / hunter.expToNext) * 100));
  const moodPercent = Math.max(0, Math.min(100, hunter.mood ?? 100));
  const hasMorale = (hunter.moraleBoostTimer ?? 0) > 0 && (hunter.moraleBoost ?? 0) > 0;
  const hasTonic = (hunter.tonicBoostTimer ?? 0) > 0 && (hunter.tonicBoost ?? 0) > 0;

  return (
    <div className="absolute right-3 top-20 bottom-3 w-84 max-w-[calc(100vw-24px)] z-20 flex flex-col bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/60 overflow-hidden text-slate-200 pointer-events-auto font-sans">
      {/* Header Banner */}
      <div className={`p-4 border-b border-slate-700/60 relative ${rarityStyle.bg}`}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          {/* Class Avatar & Rarity Frame */}
          <div className={`w-14 h-14 rounded-xl border-2 ${rarityStyle.border} ${rarityStyle.bg} shadow-lg ${rarityStyle.glow} flex flex-col items-center justify-center p-1 relative`}>
            <span className="text-xl">
              {hunter.charClass === 'Berserker' ? '⚔️' : hunter.charClass === 'Ranger' ? '🏹' : hunter.charClass === 'Sorcerer' ? '🔮' : '🛡️'}
            </span>
            <span className="text-[9px] font-black tracking-wider uppercase text-amber-300 font-mono">
              {hunter.charClass}
            </span>
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${rarityStyle.border} ${rarityStyle.text}`}>
                {hunter.rarity}
              </span>
              <span className="text-xs font-mono font-bold text-amber-400">
                Lv.{hunter.level}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white truncate mt-0.5" title={hunter.name}>
              {hunter.name}
            </h2>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
              <span className="text-amber-300">💰 {hunter.gold}g</span>
              <span>💀 {hunter.killCount} Kills</span>
              <span className="text-emerald-300">🧪 {hunter.elixirs ?? 0} 🥤 {hunter.tonics ?? 0}</span>
              {hasTonic && (
                <span className="text-orange-300 font-bold">
                  🥤+20% Tonic {Math.ceil(hunter.tonicBoostTimer ?? 0)}s
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Autonomous Behavior Status */}
        <div className={`mt-3 px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-between ${status.color}`}>
          <span>{status.label}</span>
          <button
            onClick={onToggleFollow}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
              isFollowing
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-3 h-3" />
            {isFollowing ? 'Tracking' : 'Follow'}
          </button>
        </div>
      </div>

      {/* Scrollable Details Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* HP & EXP Bars */}
        <div className="space-y-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Heart className="w-3 h-3 text-red-400 fill-red-400" /> HP
              </span>
              <span className="font-mono text-slate-200">
                {Math.max(0, Math.round(hunter.hp))} / {effectiveMaxHp}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60">
              <div 
                className={`h-full transition-all duration-200 ${
                  hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 25 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" /> EXP Progress
              </span>
              <span className="font-mono text-slate-300">
                {hunter.exp} / {hunter.expToNext}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-200"
                style={{ width: `${expPercent}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400 flex items-center gap-1">
                <span className="text-sm">🍺</span> Mood
              </span>
              <span className="font-mono text-slate-300">
                {Math.round(moodPercent)}
                {hasMorale && (
                  <span className="ml-1.5 text-amber-300 font-bold">
                    ⚡+{Math.round((hunter.moraleBoost ?? 0) * 100)}% {Math.ceil(hunter.moraleBoostTimer ?? 0)}s
                  </span>
                )}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60">
              <div 
                className={`h-full transition-all duration-200 ${
                  moodPercent > 60 ? 'bg-gradient-to-r from-amber-400 to-orange-400' : moodPercent > 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${moodPercent}%` }}
              />
            </div>
            {moodPercent < 40 && (
              <div className="text-[10px] text-red-300/80 mt-1">Miserable — will seek the Tavern. ATK/DEF scaled down.</div>
            )}
          </div>
        </div>

        {/* Field Party (compact fellow-member line) */}
        {hunter.partyId && (
          <div className="p-2.5 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-[11px]">
            <span className="font-bold text-indigo-300">
              👥 Party ({(partyMembers?.length ?? 0) + 1}) {isPartyLeader ? '♛ leading' : 'member'}
            </span>
            {(partyMembers?.length ?? 0) > 0 && (
              <span className="text-slate-300 font-mono">
                {' — '}{partyMembers!.map(m => `${m.name.split(' ')[0]} Lv.${m.level}`).join(' · ')}
              </span>
            )}
          </div>
        )}

        {/* Combat Attributes Grid */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Swords className="w-3.5 h-3.5 text-amber-400" /> Combat Attributes
          </h3>          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex justify-between items-center">
              <span className="text-slate-400">ATK</span>
              <span className="font-bold text-amber-300">
                {hunter.atk + hunter.weapon.atkBonus + hunter.accessory.atkBonus}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex justify-between items-center">
              <span className="text-slate-400">DEF</span>
              <span className="font-bold text-cyan-300">
                {hunter.def + hunter.armor.defBonus + hunter.accessory.defBonus}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex justify-between items-center">
              <span className="text-slate-400">Crit Rate</span>
              <span className="font-bold text-red-300">
                {Math.round(hunter.critRate * 100)}%
              </span>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex justify-between items-center">
              <span className="text-slate-400">Speed</span>
              <span className="font-bold text-emerald-300">
                {Math.round(hunter.speed * 1000)}
              </span>
            </div>
          </div>
        </div>

        {/* Equipment Loadout */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-400" /> Equipment (Auto-Forged)
          </h3>
          <div className="space-y-1.5">
            {/* Weapon */}
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">🗡️</span>
                <div>
                  <div className="font-bold text-slate-200">{hunter.weapon.name}</div>
                  <div className="text-[10px] text-amber-400 font-mono">+ {hunter.weapon.atkBonus} ATK</div>
                </div>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-mono font-bold">
                Tier {hunter.weapon.tier}
              </span>
            </div>

            {/* Armor */}
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">🛡️</span>
                <div>
                  <div className="font-bold text-slate-200">{hunter.armor.name}</div>
                  <div className="text-[10px] text-cyan-400 font-mono">+ {hunter.armor.defBonus} DEF / +{hunter.armor.hpBonus} HP</div>
                </div>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-mono font-bold">
                Tier {hunter.armor.tier}
              </span>
            </div>
          </div>
        </div>

        {/* Skills List */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-yellow-400" /> Auto-Mastered Skills
          </h3>
          <div className="space-y-1.5">
            {hunter.skills.map((skill) => (
              <div key={skill.id} className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-300">{skill.name}</span>
                  <span className="text-[10px] font-mono text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                    Rank {skill.level} / {skill.maxLevel}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{skill.description}</div>
                <div className="text-[9px] text-slate-500 font-mono mt-1 flex justify-between">
                  <span>Dmg: {Math.round(skill.damageMultiplier * 100)}%</span>
                  <span>CD: {skill.cooldownMs / 1000}s</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Loot Inventory Bag (Awaiting Sale) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-emerald-400" /> Monster Loot Bag
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {hunter.inventory.length} / {hunter.maxInventorySlots} Slots
            </span>
          </div>

          {hunter.inventory.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-800/40 border border-dashed border-slate-700 text-center text-slate-500 text-[11px]">
              Bag is empty. Slaying beasts in the field will harvest loot to auto-sell in town.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {hunter.inventory.map((item, idx) => (
                <div key={idx} className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-between text-[10px]">
                  <span className="truncate text-slate-300" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-amber-400 font-mono font-bold shrink-0 ml-1">
                    {item.value}g
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
