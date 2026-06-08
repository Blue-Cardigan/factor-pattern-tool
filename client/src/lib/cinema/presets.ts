/*
 * lib/cinema/presets.ts — ready-made cinematography specs for the picker.
 */

import type { CinemaConfig, CinemaSpec } from "./frames";

const baseConfig = (over: Partial<CinemaConfig> = {}): CinemaConfig => ({
  rulesetId: "classic-factor",
  n: 24,
  angleA: 90,
  angleB: 90,
  factorTurnsRight: true,
  stepLength: 8,
  repetitions: 8,
  ...over,
});

export interface CinemaPreset {
  id: string;
  label: string;
  spec: CinemaSpec;
}

export const CINEMA_PRESETS: CinemaPreset[] = [
  {
    id: "angle-sweep-24",
    label: "Angle sweep · N=24 · 30°→150°",
    spec: {
      mode: "angle",
      base: baseConfig({ n: 24, repetitions: 12 }),
      angle: { angleAMin: 30, angleAMax: 150 },
    },
  },
  {
    id: "angle-dual",
    label: "Dual angle sweep · N=36",
    spec: {
      mode: "angle",
      base: baseConfig({ n: 36, repetitions: 8, stepLength: 6 }),
      angle: { angleAMin: 60, angleAMax: 160, angleBMin: 160, angleBMax: 60 },
    },
  },
  {
    id: "n-bloom",
    label: "N bloom · 6→60",
    spec: {
      mode: "bloom",
      base: baseConfig({ angleA: 100, angleB: 100, repetitions: 10, stepLength: 7 }),
      bloom: { nMin: 6, nMax: 60, crossfade: 0.35 },
    },
  },
  {
    id: "morph-12-18",
    label: "Morph · 12 ↔ 18",
    spec: {
      mode: "morph",
      base: baseConfig({ n: 12, angleA: 60, angleB: 120, repetitions: 14, stepLength: 9 }),
      configB: baseConfig({ n: 18, angleA: 144, angleB: 80, repetitions: 10, stepLength: 7 }),
    },
  },
];
