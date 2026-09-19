// Skill VFX sprite painter: one 64px effect texture per skill type.
// Flight/rotation behavior lives in the effects render layer.

import { Texture } from 'pixi.js';
import { createPixelCanvas } from '../objects/iso';

export function createSkillVfxTexture(type: string): Texture {
  const size = 64;
  const canvas = createPixelCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;

  if (type === 'slash') {
    // Arc of razor energy
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(center, center, 22, -Math.PI * 0.7, Math.PI * 0.1);
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, 20, -Math.PI * 0.7, Math.PI * 0.1);
    ctx.stroke();
  } else if (type === 'meteor') {
    // Burning asteroid meteor
    const grad = ctx.createRadialGradient(center, center, 4, center, center, 24);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.4, '#ea580c');
    grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, Math.PI * 2);
    ctx.fill();
    // Inner core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(center, center, 8, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'whirlwind') {
    // Double cyclone vortex
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center, 18, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, 24, Math.PI * 0.5, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'smite') {
    // Holy radiant beam
    ctx.fillStyle = 'rgba(253, 224, 71, 0.8)';
    ctx.fillRect(center - 6, 0, 12, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center - 2, 0, 4, size);
    // Holy sparkle stars
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(center - 12, center - 2, 24, 4);
  } else if (type === 'multishot') {
    // Single piercing arrow (points up; renderer rotates to flight path).
    // One arrow per sprite — Quick Shot's 3-shot volley comes from 3
    // staggered VFX spawns, not 3 arrows baked into one texture.
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(center, center - 14, 2, 16);
    ctx.beginPath();
    ctx.moveTo(center - 3, center - 14);
    ctx.lineTo(center + 1, center - 20);
    ctx.lineTo(center + 5, center - 14);
    ctx.fill();
  } else if (type === 'heal') {
    // Soft green-gold upward sparkle burst
    const grad = ctx.createRadialGradient(center, center + 6, 2, center, center + 6, 22);
    grad.addColorStop(0, 'rgba(248, 250, 252, 0.95)');
    grad.addColorStop(0.4, 'rgba(74, 222, 128, 0.7)');
    grad.addColorStop(1, 'rgba(212, 160, 23, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center + 6, 22, 0, Math.PI * 2);
    ctx.fill();
    // Rising sparkles (lower = larger, fading upward)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(center - 8, center + 10, 4, 4);
    ctx.fillRect(center + 5, center + 4, 3, 3);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(center - 3, center - 2, 3, 3);
    ctx.fillRect(center - 11, center - 6, 2, 2);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(center + 2, center - 12, 2, 2);
    ctx.fillRect(center - 1, center - 18, 2, 2);
  } else if (type === 'ballad' || type === 'encore') {
    // Bard music burst: teal-gold notes on a soft glow
    const grad = ctx.createRadialGradient(center, center, 2, center, center, 24);
    grad.addColorStop(0, 'rgba(45, 212, 191, 0.9)');
    grad.addColorStop(0.5, 'rgba(251, 191, 36, 0.55)');
    grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, Math.PI * 2);
    ctx.fill();
    // Three note heads + stems
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(center - 12, center + 2, 6, 5);
    ctx.fillRect(center - 1, center - 8, 6, 5);
    ctx.fillRect(center + 8, center + 6, 5, 4);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(center - 8, center - 10, 2, 12);
    ctx.fillRect(center + 3, center - 18, 2, 10);
    ctx.fillRect(center + 11, center - 4, 2, 10);
  } else if (type === 'holy_burst') {
    // Renewing Dawn: gold pillar (party burst) wrapped in a green healing ring
    ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.fillRect(center - 5, 4, 10, size - 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center - 2, 4, 4, size - 8);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center + 6, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center + 6, 26, 0, Math.PI * 2);
    ctx.stroke();
    // Rising healing sparks
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(center - 12, 8, 3, 3);
    ctx.fillRect(center + 8, 16, 3, 3);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(center - 4, 24, 2, 2);
    ctx.fillRect(center + 3, 6, 2, 2);
  } else if (type === 'levelup') {
    // Level-up burst: gold pillar + expanding ring + rising sparks
    ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.fillRect(center - 5, 4, 10, size - 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(center - 2, 4, 4, size - 8);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center + 6, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center + 6, 26, 0, Math.PI * 2);
    ctx.stroke();
    // Rising sparks
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(center - 12, 8, 3, 3);
    ctx.fillRect(center + 8, 16, 3, 3);
    ctx.fillRect(center - 4, 24, 2, 2);
    ctx.fillRect(center + 3, 6, 2, 2);
  } else {
    // Impact spark burst
    ctx.fillStyle = '#facc15';
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      const x = center + Math.cos(angle) * 14;
      const y = center + Math.sin(angle) * 14;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  return Texture.from(canvas);
}
