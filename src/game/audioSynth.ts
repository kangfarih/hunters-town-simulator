// Retro 16-bit Chiptune Audio Synthesizer using Web Audio API
// Autonomous spectator friendly: soft, non-intrusive sound effects with volume control and mute toggle.
// Positional audio: combat sounds fade + pan with X/Y grid distance from the
// camera focus. Far = faint whisper, very far (> SILENT_RADIUS) = silent, so
// empty views hear nothing. UI chimes (coin/summon/level-up/upgrade) stay global.

import type { ZoneKind } from './types/zone';

/** Full volume inside this radius (grid units). */
export const AUDIO_FULL_RADIUS = 6;
/** Faint whisper around this distance. */
export const AUDIO_FAINT_RADIUS = 18;
/** Beyond this: culled (silent). Continuous falloff, not on/off. */
export const AUDIO_SILENT_RADIUS = 26;

interface PositionalMix {
  audible: boolean;
  volScale: number;
  pan: number;
  cutoff: number;
}

class AudioSynth {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  public volume: number = 0.3;

  // Camera ear in grid coords. Defaults to town center so boot sounds work
  // before the renderer reports its first focus.
  private listenerGx: number = 30;
  private listenerGy: number = 30;

  private lastPlayMs: Map<string, number> = new Map();

  public setListener(gx: number, gy: number) {
    if (Number.isFinite(gx) && Number.isFinite(gy)) {
      this.listenerGx = gx;
      this.listenerGy = gy;
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Continuous 3D-ish mix: X -> pan, X+Y distance -> volume + dullness. */
  private mixFor(gx: number, gy: number): PositionalMix {
    const dx = gx - this.listenerGx;
    const dy = gy - this.listenerGy;
    const dist = Math.hypot(dx, dy);
    if (dist > AUDIO_SILENT_RADIUS) return { audible: false, volScale: 0, pan: 0, cutoff: 800 };
    // 1.0 inside FULL, quadratic fade to ~0.03 at SILENT (still faint at FAINT).
    const span = AUDIO_SILENT_RADIUS + 4 - AUDIO_FULL_RADIUS;
    const volScale = dist <= AUDIO_FULL_RADIUS ? 1 : Math.pow(Math.max(0, 1 - (dist - AUDIO_FULL_RADIUS) / span), 2);
    if (volScale < 0.02) return { audible: false, volScale: 0, pan: 0, cutoff: 800 };
    const pan = Math.max(-1, Math.min(1, dx / 12));
    const cutoff = Math.max(800, 20000 - (dist / AUDIO_SILENT_RADIUS) * (20000 - 1200));
    return { audible: true, volScale, pan, cutoff };
  }

  /** Per-type throttle so 4x-speed battles don't stack into clipping. */
  private throttled(key: string, minMs = 45): boolean {
    const now = Date.now();
    const last = this.lastPlayMs.get(key) ?? 0;
    if (now - last < minMs) return true;
    this.lastPlayMs.set(key, now);
    return false;
  }

  // Play a simple frequency envelope sound
  private playTone(
    freqStart: number, freqEnd: number, duration: number,
    type: OscillatorType = 'square', gainLevel: number = 0.2,
    opts?: { volScale?: number; pan?: number; cutoff?: number },
  ) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const volScale = opts?.volScale ?? 1;
      const masterVol = this.volume * gainLevel * volScale;
      if (masterVol < 0.0005) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(masterVol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      // Chain: osc -> gain -> [lowpass] -> [stereo pan] -> destination.
      osc.connect(gain);
      let head: AudioNode = gain;
      const cutoff = opts?.cutoff;
      if (cutoff !== undefined && cutoff < 18000 && typeof this.ctx.createBiquadFilter === 'function') {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);
        gain.connect(filter);
        head = filter;
      }

      const pan = opts?.pan ?? 0;
      if (pan !== 0 && typeof this.ctx.createStereoPanner === 'function') {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime);
        head.connect(panner);
        panner.connect(this.ctx.destination);
      } else {
        head.connect(this.ctx.destination);
      }

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy catch
    }
  }

  /** Shared positional gate: returns mix or null when silent/throttled. */
  private positionalGate(key: string, gx: number | undefined, gy: number | undefined): PositionalMix | null {
    if (gx === undefined || gy === undefined) return { audible: true, volScale: 1, pan: 0, cutoff: 20000 };
    const mix = this.mixFor(gx, gy);
    if (!mix.audible) return null;
    if (this.throttled(key)) return null;
    return mix;
  }

  // 1. Coin / Sell Sound (global UI; optional coords make field elixirs positional)
  public playCoin(gx?: number, gy?: number) {
    if (this.isMuted) return;
    if (gx !== undefined && gy !== undefined) {
      const mix = this.positionalGate('coin', gx, gy);
      if (!mix) return;
      this.playTone(987.77, 1318.51, 0.12, 'sine', 0.15, mix);
      return;
    }
    if (this.throttled('coin', 60)) return;
    this.playTone(987.77, 1318.51, 0.12, 'sine', 0.15);
  }

  // 2. Slash / Physical Hit (positional when coords given)
  public playSlash(gx?: number, gy?: number) {
    if (this.isMuted) return;
    const mix = this.positionalGate('slash', gx, gy);
    if (!mix) return;
    this.playTone(400, 80, 0.1, 'sawtooth', 0.12, mix);
  }

  // 3. Arrow Shoot
  public playArrow(gx?: number, gy?: number) {
    if (this.isMuted) return;
    const mix = this.positionalGate('arrow', gx, gy);
    if (!mix) return;
    this.playTone(880, 440, 0.08, 'triangle', 0.1, mix);
  }

  // 4. Magic Cast / Meteor
  public playMagic(gx?: number, gy?: number) {
    if (this.isMuted) return;
    const mix = this.positionalGate('magic', gx, gy);
    if (!mix) return;
    this.playTone(300, 900, 0.18, 'sine', 0.15, mix);
  }

  // 5b. Cleric Heal: two soft sine tones rising, quiet like playCoin
  public playHeal(gx?: number, gy?: number) {
    if (this.isMuted) return;
    const mix = this.positionalGate('heal', gx, gy);
    if (!mix) return;
    const { volScale, pan, cutoff } = mix;
    const notes = [659.25, 987.77];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq * 1.02, 0.15, 'sine', 0.15, { volScale, pan, cutoff });
      }, idx * 90);
    });
  }

  // 5c. Bard Lute: three quick bright plucks (ballad/encore)
  public playLute(gx?: number, gy?: number) {
    if (this.isMuted) return;
    const mix = this.positionalGate('lute', gx, gy);
    if (!mix) return;
    const { volScale, pan, cutoff } = mix;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq * 1.01, 0.14, 'triangle', 0.14, { volScale, pan, cutoff });
      }, idx * 70);
    });
  }

  // 5. Holy Smite (boss-spawn alert stays global; combat smites pass coords)
  public playSmite(gx?: number, gy?: number) {
    if (this.isMuted) return;
    const mix = this.positionalGate('smite', gx, gy);
    if (!mix) return;
    this.playTone(523.25, 783.99, 0.25, 'triangle', 0.18, mix);
  }

  // 5d. Zone tick: one quiet blip per ticking zone (positional).
  public playZoneTick(kind: ZoneKind, gx?: number, gy?: number) {
    if (this.isMuted) return;
    const freqs: Record<ZoneKind, [number, number]> = {
      storm: [520, 320],
      arrows: [920, 620],
      burn: [240, 520],
      consecration: [620, 820],
      radiance: [700, 940],
      hymn: [660, 880],
    };
    const [a, b] = freqs[kind] ?? [440, 560];
    const mix = this.positionalGate(`zone-${kind}`, gx, gy);
    if (!mix) return;
    this.playTone(a, b, 0.12, 'sine', 0.06, mix);
  }

  // 6. Level Up Fanfare (global UI)
  public playLevelUp() {
    if (this.isMuted) return;
    if (this.throttled('levelup', 120)) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq * 1.02, 0.18, 'square', 0.14);
      }, idx * 75);
    });
  }

  // 7. Hero Summon Fanfare (global UI)
  public playSummon() {
    if (this.isMuted) return;
    if (this.throttled('summon', 200)) return;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq, 0.22, 'triangle', 0.16);
      }, idx * 100);
    });
  }

  // 8. Building Upgrade chime (global UI)
  public playBuildingUpgrade() {
    if (this.isMuted) return;
    if (this.throttled('upgrade', 200)) return;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq * 1.05, 0.15, 'sine', 0.15);
      }, idx * 60);
    });
  }
}

export const soundFx = new AudioSynth();
