'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Sistema de sons usando Web Audio API (sem arquivos externos)
class SoundEngine {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.enabled = localStorage.getItem('sounds_enabled') !== 'false';
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sounds_enabled', String(enabled));
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Som de clique (curto, sutil)
  playClick() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  // Som de vitória (ascendente, alegre)
  playWin() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const duration = 0.12;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * duration);

      const startTime = ctx.currentTime + i * duration;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration + 0.05);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    });

    // Acorde final brilhante
    const chord = [523.25, 659.25, 783.99];
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + notes.length * duration);

      const startTime = ctx.currentTime + notes.length * duration;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  // Som de perda (descendente, grave)
  playLoss() {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    // Tom descendente principal
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.3);

    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Segundo tom (mais grave, atrasado)
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(165, ctx.currentTime + 0.4);

    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.45);
  }
}

// Singleton
let soundEngineInstance: SoundEngine | null = null;

function getSoundEngine(): SoundEngine {
  if (!soundEngineInstance) {
    soundEngineInstance = new SoundEngine();
  }
  return soundEngineInstance;
}

export function useSounds() {
  const engineRef = useRef<SoundEngine>(getSoundEngine());
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sounds_enabled') !== 'false';
    }
    return true;
  });

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      engineRef.current.setEnabled(next);
      return next;
    });
  }, []);

  const playClick = useCallback(() => {
    engineRef.current.playClick();
  }, []);

  const playWin = useCallback(() => {
    engineRef.current.playWin();
  }, []);

  const playLoss = useCallback(() => {
    engineRef.current.playLoss();
  }, []);

  return {
    soundEnabled,
    toggleSound,
    playClick,
    playWin,
    playLoss,
  };
}
