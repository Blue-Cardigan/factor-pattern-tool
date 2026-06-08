/*
 * features/sonify/presets.ts — Ready-to-hear starting points.
 */

import type { ScaleId, NoteName } from "@/lib/sonify/scales";
import type { PitchSource } from "@/lib/sonify/mapping";
import type { Waveform } from "@/lib/sonify/engine";

export interface SonifyPreset {
  name: string;
  blurb: string;
  rulesetId: string;
  n: number;
  bpm: number;
  scale: ScaleId;
  root: NoteName;
  octaveRange: number;
  waveform: Waveform;
  pitchSource: PitchSource;
  directionOctave: boolean;
}

export const PRESETS: SonifyPreset[] = [
  {
    name: "First Light",
    blurb: "Gentle pentatonic walk over the classic factor rule.",
    rulesetId: "classic-factor",
    n: 24,
    bpm: 120,
    scale: "pentatonic",
    root: "C",
    octaveRange: 3,
    waveform: "triangle",
    pitchSource: "index",
    directionOctave: true,
  },
  {
    name: "Prime Bells",
    blurb: "ω(i) drives pitch — primes ring low, composites climb.",
    rulesetId: "classic-factor",
    n: 48,
    bpm: 150,
    scale: "major",
    root: "A",
    octaveRange: 3,
    waveform: "sine",
    pitchSource: "omega",
    directionOctave: false,
  },
  {
    name: "Dark Pulse",
    blurb: "Driving minor-scale square wave at speed.",
    rulesetId: "classic-factor",
    n: 36,
    bpm: 200,
    scale: "minor",
    root: "E",
    octaveRange: 2,
    waveform: "square",
    pitchSource: "index",
    directionOctave: true,
  },
  {
    name: "Blue Drift",
    blurb: "Slow bluesy saw — turns swing the stereo field.",
    rulesetId: "classic-factor",
    n: 30,
    bpm: 90,
    scale: "blues",
    root: "G",
    octaveRange: 2,
    waveform: "sawtooth",
    pitchSource: "index",
    directionOctave: false,
  },
];
