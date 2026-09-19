// Town buildings: placements, service timings, and capacity curves.
// To add/reposition a building, edit INITIAL_BUILDINGS only — door logic,
// capacity, and economy code read through these helpers.

import type { Building } from '../types';

export const INITIAL_BUILDINGS: Building[] = [
  {
    id: 'b-townhall',
    type: 'TOWN_HALL',
    name: 'Sanctuary Hall',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 100,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 28,
    gy: 24,
    width: 3,
    height: 3,
    doorGx: 29,
    doorGy: 26,
    description: 'The Chief Sanctuary. Manages town territory and hunter allowances.',
    serviceName: 'Town Governance',
    currentVisitors: [],
    upgradeEffect: 'Increases max hunters & global town hunting tax rate.'
  },
  {
    id: 'b-blacksmith',
    type: 'BLACKSMITH',
    name: 'Vulcan Forge',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 80,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 24,
    gy: 28,
    width: 2,
    height: 2,
    doorGx: 25,
    doorGy: 30,
    description: 'Crafts and upgrades high-grade weapons and heavy armor for hunters.',
    serviceName: 'Weapon & Armor Crafting',
    currentVisitors: [],
    upgradeEffect: 'Unlocks higher weapon & armor tiers for auto-buying.'
  },
  {
    id: 'b-alchemy',
    type: 'ALCHEMY_LAB',
    name: 'Elixir Cauldron',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 75,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 32,
    gy: 28,
    width: 2,
    height: 2,
    doorGx: 32,
    doorGy: 30,
    description: 'Brews restorative HP and combat elixirs from monster essences.',
    serviceName: 'Potion Dispensing',
    currentVisitors: [],
    upgradeEffect: 'Brews stronger restorative potions with instant heal.'
  },
  {
    id: 'b-tavern',
    type: 'TAVERN',
    name: 'Boar & Barrel Tavern',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 90,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 24,
    gy: 33,
    width: 2,
    height: 2,
    doorGx: 25,
    doorGy: 35,
    description: 'Serves roast meat and frothy ale to recharge exhausted hunters.',
    serviceName: 'Food & Lodging',
    currentVisitors: [],
    upgradeEffect: 'Grants temporary Morale ATK buff to visiting hunters.'
  },
  {
    id: 'b-academy',
    type: 'TRAINING_ACADEMY',
    name: 'Valor Academy',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 100,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 32,
    gy: 33,
    width: 2,
    height: 2,
    doorGx: 32,
    doorGy: 35,
    description: 'Martial school where hunters study and auto-upgrade combat skills.',
    serviceName: 'Skill Mastery',
    currentVisitors: [],
    upgradeEffect: 'Unlocks advanced skill masteries and reduces cooldowns.'
  },
  {
    id: 'b-trading',
    type: 'TRADING_POST',
    name: 'Merchant Bazaar',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 60,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 28,
    gy: 31,
    width: 2,
    height: 2,
    doorGx: 28,
    doorGy: 33,
    description: 'Buys all harvested monster trophies, fangs, and pelts for gold.',
    serviceName: 'Loot Exchange',
    currentVisitors: [],
    upgradeEffect: 'Increases purchase price paid to hunters by +15% per level.'
  },
  {
    id: 'b-clinic',
    type: 'CLINIC',
    name: 'Mercy Clinic',
    level: 1,
    maxLevel: 10,
    exp: 0,
    expToNext: 70,
    totalTransactions: 0,
    lifetimeGold: 0,
    gx: 28,
    gy: 35,
    width: 2,
    height: 2,
    doorGx: 28,
    doorGy: 37,
    description: 'Tends to wounded hunters and resurrects fallen warriors from fields.',
    serviceName: 'Emergency Healing',
    currentVisitors: [],
    upgradeEffect: 'Dramatically speeds up recovery time from field wounds.'
  }
];

/** Max concurrent customers inside a building. */
export function buildingCapacity(b: Building): number {
  if (b.type === 'TOWN_HALL') return 3 + Math.floor(b.level / 2);
  return 1 + Math.floor(b.level / 3);
}

/** Seconds a hunter spends receiving a building's service. */
export function serviceTime(b: Building): number {
  switch (b.type) {
    case 'TRADING_POST': return Math.max(1.5, 11 - 0.95 * b.level);
    case 'BLACKSMITH': return Math.max(1.5, 12 - 1.0 * b.level);
    case 'TRAINING_ACADEMY': return Math.max(1.5, 11 - 0.9 * b.level);
    case 'ALCHEMY_LAB': return Math.max(1.5, 12 - 1.0 * b.level);
    case 'TAVERN': return Math.max(1.5, 11 - 0.9 * b.level);
    case 'CLINIC': return Math.max(2.0, 13 - 1.1 * b.level);
    default: return Math.max(1.5, 11 - 0.9 * b.level);
  }
}
