// Retro 16-bit Chiptune Audio Synthesizer using Web Audio API
// Autonomous spectator friendly: soft, non-intrusive sound effects with volume control and mute toggle.

class AudioSynth {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  public volume: number = 0.3;

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

  // Play a simple frequency envelope sound
  private playTone(freqStart: number, freqEnd: number, duration: number, type: OscillatorType = 'square', gainLevel: number = 0.2) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), this.ctx.currentTime + duration);

      const masterVol = this.volume * gainLevel;
      gain.gain.setValueAtTime(masterVol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy catch
    }
  }

  // 1. Coin / Sell Sound
  public playCoin() {
    if (this.isMuted) return;
    this.playTone(987.77, 1318.51, 0.12, 'sine', 0.15);
  }

  // 2. Slash / Physical Hit
  public playSlash() {
    if (this.isMuted) return;
    this.playTone(400, 80, 0.1, 'sawtooth', 0.12);
  }

  // 3. Arrow Shoot
  public playArrow() {
    if (this.isMuted) return;
    this.playTone(880, 440, 0.08, 'triangle', 0.1);
  }

  // 4. Magic Cast / Meteor
  public playMagic() {
    if (this.isMuted) return;
    this.playTone(300, 900, 0.18, 'sine', 0.15);
  }

  // 5b. Cleric Heal: two soft sine tones rising, quiet like playCoin
  public playHeal() {
    if (this.isMuted) return;
    const notes = [659.25, 987.77];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq * 1.02, 0.15, 'sine', 0.15);
      }, idx * 90);
    });
  }

  // 5c. Bard Lute: three quick bright plucks (ballad/encore)
  public playLute() {
    if (this.isMuted) return;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq * 1.01, 0.14, 'triangle', 0.14);
      }, idx * 70);
    });
  }

  // 5. Holy Smite
  public playSmite() {
    if (this.isMuted) return;
    this.playTone(523.25, 783.99, 0.25, 'triangle', 0.18);
  }

  // 6. Level Up Fanfare
  public playLevelUp() {
    if (this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq * 1.02, 0.18, 'square', 0.14);
      }, idx * 75);
    });
  }

  // 7. Hero Summon Fanfare
  public playSummon() {
    if (this.isMuted) return;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq, 0.22, 'triangle', 0.16);
      }, idx * 100);
    });
  }

  // 8. Building Upgrade chime
  public playBuildingUpgrade() {
    if (this.isMuted) return;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq * 1.05, 0.15, 'sine', 0.15);
      }, idx * 60);
    });
  }
}

export const soundFx = new AudioSynth();
