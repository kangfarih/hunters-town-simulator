import type { Equipment } from './equipment';

export interface ItemDrop {
  id: string;
  name: string;
  count: number;
  value: number;
  iconType: 'bone' | 'pelt' | 'horn' | 'fang' | 'magic_orb' | 'dragon_scale';
  equipment?: Equipment; // gear drop rides the loot pipeline (else material)
}
