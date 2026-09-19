export interface GameLog {
  id: string;
  timestamp: string;
  type: 'summon' | 'combat' | 'upgrade' | 'trade' | 'skill' | 'boss';
  message: string;
  hunterName?: string;
}
