/*
 * Tactile UI sounds ported verbatim from spatial-notes / Vellum (MIT).
 * Copyright (c) 2026 Ayomide Aluko. Synthesized at runtime with Web Audio —
 * no audio assets shipped. Only adaptation: storage key namespaced to aira.
 */

type Tone = {
  freq: number;
  durationMs: number;
  type?: OscillatorType;
  gain?: number;
  attackMs?: number;
  releaseMs?: number;
  noiseAmount?: number;
};

export type SoundName =
  | "tapSoft"
  | "tapFirm"
  | "create"
  | "delete"
  | "pickup"
  | "drop"
  | "toggle";

const presets: Record<SoundName, Tone[]> = {
  tapSoft: [{ freq: 2200, durationMs: 28, type: "sine", gain: 0.05, releaseMs: 60 }],
  tapFirm: [{ freq: 1400, durationMs: 22, type: "triangle", gain: 0.09, releaseMs: 50 }],
  toggle: [{ freq: 1800, durationMs: 24, type: "sine", gain: 0.07, releaseMs: 55 }],
  pickup: [
    { freq: 520, durationMs: 18, type: "sine", gain: 0.06, releaseMs: 80 },
    { freq: 880, durationMs: 22, type: "sine", gain: 0.05, releaseMs: 90 },
  ],
  drop: [
    { freq: 320, durationMs: 22, type: "sine", gain: 0.08, releaseMs: 90 },
    { freq: 220, durationMs: 30, type: "sine", gain: 0.06, releaseMs: 120 },
  ],
  create: [
    { freq: 660, durationMs: 20, type: "sine", gain: 0.05, releaseMs: 70 },
    { freq: 990, durationMs: 26, type: "sine", gain: 0.05, releaseMs: 90 },
    { freq: 1320, durationMs: 30, type: "sine", gain: 0.04, releaseMs: 100 },
  ],
  delete: [
    { freq: 880, durationMs: 18, type: "triangle", gain: 0.05, releaseMs: 60 },
    { freq: 440, durationMs: 24, type: "triangle", gain: 0.05, releaseMs: 90 },
  ],
};

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let enabled = true;

function ensureCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function playTone(tone: Tone, when = 0) {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const t0 = c.currentTime + when;

  const osc = c.createOscillator();
  osc.type = tone.type ?? "sine";
  osc.frequency.setValueAtTime(tone.freq, t0);

  const g = c.createGain();
  const peak = tone.gain ?? 0.06;
  const attack = (tone.attackMs ?? 2) / 1000;
  const release = (tone.releaseMs ?? 80) / 1000;
  const dur = tone.durationMs / 1000;

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);

  // Soft lowpass keeps tones from feeling shrill — closer to Apple "tic"
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = Math.min(8000, tone.freq * 4);
  lp.Q.value = 0.4;

  osc.connect(g).connect(lp).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + release + 0.02);
}

export function playSound(name: SoundName) {
  if (!enabled) return;
  const tones = presets[name];
  // Stagger overtones by a tiny amount for a richer, layered click
  tones.forEach((t, i) => playTone(t, i * 0.008));
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
  if (typeof window !== "undefined") {
    localStorage.setItem("aira:sound", value ? "1" : "0");
  }
}

export function isSoundEnabled() {
  if (typeof window === "undefined") return enabled;
  const stored = localStorage.getItem("aira:sound");
  if (stored !== null) enabled = stored === "1";
  return enabled;
}
