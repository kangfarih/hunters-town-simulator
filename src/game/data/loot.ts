// Loot & gear tables: materials pipeline, rarity multipliers/colors,
// boss-only epics, and gear-name helpers. Drop-rate rolls stay in simulation;
// everything a designer tweaks lives here.

import type { CharacterClass, EquipmentEffectId, EquipmentRarity, ZoneId } from '../types';

export type { EquipmentEffectId, EquipmentRarity };

// --------------------------------------------------------------------------
// Rarity loot: Normal x1.0 / Uncommon x1.15 / Rare x1.35 / Epic x1.6 on tier base.
// Tier base (shop equivalent): weapon 5+(t-1)*8; armor DEF 3+(t-1)*4, HP 20+(t-1)*15.
// Uncommon/Rare are stats-only; only Epics carry effectId.
// --------------------------------------------------------------------------

export const RARITY_STAT_MULT: Record<EquipmentRarity, number> = {
  Common: 1.0,
  Uncommon: 1.15,
  Rare: 1.35,
  Epic: 1.6,
};

export const GEAR_SELL_MULT: Record<EquipmentRarity, number> = {
  Common: 1.0,
  Uncommon: 1.5,
  Rare: 2.5,
  Epic: 5.0,
};

export function gearSellPrice(tier: number, rarity: EquipmentRarity): number {
  return Math.round(tier * 40 * (GEAR_SELL_MULT[rarity] ?? 1));
}

// --------------------------------------------------------------------------
// Auction House v1 (Merchant Bazaar extension): instant buyout pool for
// green/blue (Uncommon/Rare) weapon/armor only. Sellers get an instant
// buyout; buyers pay a 25% markup + tier fee.
//
// Reserved shelves per rarity: green floods (40% drop rate) can never
// evict blues (10% on ghoul/drake only). Each shelf evicts FIFO within
// itself when full — a full green shelf salvages the oldest green, the
// blue shelf is untouched. Total stock stays 24 (12 + 12).
// --------------------------------------------------------------------------

export const AUCTION_STOCK_CAP = 24;
export const AUCTION_MAX_COPIES_PER_ITEM = 3;

/** Reserved slots per auctionable rarity (Uncommon = green, Rare = blue). */
export const AUCTION_SHELF_CAP: Record<'Uncommon' | 'Rare', number> = {
  Uncommon: 12,
  Rare: 12,
};

/** Shelf cap for a rarity (non-auctionable rarities hold nothing: 0). */
export function auctionShelfCap(rarity: EquipmentRarity | undefined | null): number {
  if (rarity === 'Uncommon' || rarity === 'Rare') return AUCTION_SHELF_CAP[rarity];
  return 0;
}

/** Live count of a rarity on its shelf. */
export function auctionShelfCount(
  stock: { rarity?: EquipmentRarity | null }[],
  rarity: EquipmentRarity | undefined | null,
): number {
  if (rarity !== 'Uncommon' && rarity !== 'Rare') return 0;
  let n = 0;
  for (const s of stock) if ((s.rarity ?? 'Common') === rarity) n++;
  return n;
}

export function isAuctionable(equipment: { rarity?: EquipmentRarity | null; type?: string | null } | null | undefined): boolean {
  if (!equipment) return false;
  const rarity = equipment.rarity ?? 'Common';
  const type = equipment.type;
  return (rarity === 'Uncommon' || rarity === 'Rare') && (type === 'weapon' || type === 'armor');
}

/** Instant buyout paid to the seller: sell value scaled by bazaar level (+10%/level). */
export function auctionBuyoutPrice(tier: number, rarity: EquipmentRarity, bazaarLevel: number): number {
  return Math.round(gearSellPrice(tier, rarity) * (1 + bazaarLevel * 0.1));
}

/** Buyer price: 25% markup over the buyout plus a flat tier fee. */
export function auctionBuyerPrice(buyout: number, tier: number): number {
  return Math.round(buyout * 1.25 + tier * 10);
}

/** Unique-item grouping key: type + tier + rarity + base name (no rarity prefix). */
export function auctionItemKey(eq: { type: string; tier: number; rarity?: EquipmentRarity | null; name: string }): string {
  return `${eq.type}|${eq.tier}|${eq.rarity ?? 'Common'}|${eq.name}`;
}

// --------------------------------------------------------------------------
// Rarity colors: Common white, Uncommon green, Rare blue, Epic purple.
// Single source of truth for UI text/border + canvas floating-text hex.
// --------------------------------------------------------------------------

export const RARITY_HEX: Record<EquipmentRarity, string> = {
  Common: '#e2e8f0', // slate-200 white
  Uncommon: '#4ade80', // green
  Rare: '#60a5fa', // blue
  Epic: '#c084fc', // purple
};

export const RARITY_TEXT_CLASS: Record<EquipmentRarity, string> = {
  Common: 'text-slate-200',
  Uncommon: 'text-emerald-400',
  Rare: 'text-blue-400',
  Epic: 'text-purple-400',
};

export const RARITY_BORDER_CLASS: Record<EquipmentRarity, string> = {
  Common: 'border-slate-700/60',
  Uncommon: 'border-emerald-500/50',
  Rare: 'border-blue-500/50',
  Epic: 'border-purple-500/60',
};

export function rarityHex(rarity: EquipmentRarity | undefined | null): string {
  return RARITY_HEX[rarity ?? 'Common'] ?? RARITY_HEX.Common;
}

export function rarityTextClass(rarity: EquipmentRarity | undefined | null): string {
  return RARITY_TEXT_CLASS[rarity ?? 'Common'] ?? RARITY_TEXT_CLASS.Common;
}

export function rarityBorderClass(rarity: EquipmentRarity | undefined | null): string {
  return RARITY_BORDER_CLASS[rarity ?? 'Common'] ?? RARITY_BORDER_CLASS.Common;
}

// --------------------------------------------------------------------------
// Epics & gear names
// --------------------------------------------------------------------------

export interface EpicDef {
  name: string;
  slot: 'weapon' | 'armor';
  reqClass?: CharacterClass;
  effectId: EquipmentEffectId;
  effectValue: number;
}

// Boss-only Tier 5 epics. Weapons are class-locked, armors are open.
export const EPIC_DEFS: EpicDef[] = [
  { name: 'Kingsbane Reaver', slot: 'weapon', reqClass: 'Berserker', effectId: 'execution', effectValue: 0.6 },
  { name: 'Cometfang Longbow', slot: 'weapon', reqClass: 'Ranger', effectId: 'deadeye', effectValue: 0.12 },
  { name: 'Solar Cataclysm Staff', slot: 'weapon', reqClass: 'Sorcerer', effectId: 'meteorfall', effectValue: 0.35 },
  { name: 'Dawnbreaker Gavel', slot: 'weapon', reqClass: 'Paladin', effectId: 'bossbane', effectValue: 0.5 },
  { name: 'Fateweaver Lute', slot: 'weapon', reqClass: 'Bard', effectId: 'crescendo', effectValue: 0.25 },
  { name: 'Bloodlord Carapace', slot: 'armor', effectId: 'lifesteal', effectValue: 0.10 },
  { name: 'Windstalker Shroud', slot: 'armor', effectId: 'swiftwind', effectValue: 0.012 },
  { name: 'Astral Veil Robe', slot: 'armor', effectId: 'focus', effectValue: 0.20 },
  { name: 'Aegis of the Martyr', slot: 'armor', effectId: 'martyr', effectValue: 0.25 },
];

export function epicEffectDescription(effectId: EquipmentEffectId, value: number): string {
  switch (effectId) {
    case 'execution': return `Execute: +${Math.round(value * 100)}% damage vs targets below 30% HP`;
    case 'deadeye': return `Deadeye: +${Math.round(value * 100)}% crit, crits hit x1.8`;
    case 'meteorfall': return `Meteorfall: +${Math.round(value * 100)}% skill damage`;
    case 'bossbane': return `Bossbane: +${Math.round(value * 100)}% damage vs bosses`;
    case 'crescendo': return `Crescendo: Encore-buffed allies deal +${Math.round(value * 100)}% skill damage`;
    case 'lifesteal': return `Lifesteal: heal ${Math.round(value * 100)}% of damage dealt`;
    case 'swiftwind': return `Swiftwind: faster attacks`;
    case 'focus': return `Focus: skills recharge ${Math.round(value * 100)}% faster`;
    case 'martyr': return `Martyr: reflect ${Math.round(value * 100)}% damage, calmer under fire`;
  }
}

/** Display name: rarity prefix for Uncommon/Rare/Epic, plain base name for Common.
 * Stored equipment.name is always the base name (no rarity prefix). */
export function equipmentDisplayName(rarity: EquipmentRarity | undefined | null, baseName: string): string {
  if (!baseName) return '';
  // Strip a legacy embedded prefix (old saves stored "Uncommon Iron ...").
  const clean = baseName.replace(/^(Common|Uncommon|Rare|Epic)\s+/i, '');
  if (!rarity || rarity === 'Common') return clean;
  return `${rarity} ${clean}`;
}

/** Gear tier prefix: 1 Bronze … 5 Dragonforged. */
export function getEquipmentPrefix(tier: number): string {
  const prefixes = ['Bronze', 'Iron', 'Steel', 'Mithril', 'Dragonforged'];
  return prefixes[Math.min(tier - 1, prefixes.length - 1)];
}

/** Loot gear tier by hunting zone: forest 2, crypt 3, volcano 4 (boss 5). */
export function zoneGearTier(zone: ZoneId): number {
  return zone === 1 ? 2 : (zone === 2 ? 3 : 4);
}
