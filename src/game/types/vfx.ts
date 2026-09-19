export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  opacity: number;
  duration: number;
  elapsed: number;
  vy: number;
  isCrit?: boolean;
}

export interface SkillVFX {
  id: string;
  type: 'slash' | 'multishot' | 'meteor' | 'smite' | 'whirlwind' | 'holy_burst' | 'heal' | 'ballad' | 'encore' | 'impact' | 'levelup' | 'death';
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  duration: number;
  elapsed: number;
  color: string;
  radius?: number;
}
