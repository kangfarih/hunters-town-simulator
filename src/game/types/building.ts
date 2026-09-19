export type BuildingType =
  | 'TOWN_HALL'
  | 'BLACKSMITH'
  | 'ALCHEMY_LAB'
  | 'TAVERN'
  | 'TRAINING_ACADEMY'
  | 'TRADING_POST'
  | 'CLINIC';

export interface Building {
  id: string;
  type: BuildingType;
  name: string;
  level: number;
  maxLevel: number;
  exp: number;
  expToNext: number;
  totalTransactions: number;
  lifetimeGold: number;

  // Grid placement
  gx: number;
  gy: number;
  width: number;
  height: number;
  doorGx: number;
  doorGy: number;

  description: string;
  serviceName: string;
  currentVisitors: string[]; // hunter IDs inside or using service
  upgradeEffect: string;
}
