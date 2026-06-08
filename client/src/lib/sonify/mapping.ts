/*
 * lib/sonify/mapping.ts — Turn a StepInstruction[] into a sequence of notes.
 *
 * This is the "renderer" half of the core seam for audio: it consumes the same
 * StepInstruction[] the turtle does, and produces Note[] the scheduler plays.
 * Pitch is driven by a selectable source (step index, klass, value, or a
 * number-theoretic quantity ω(i)), folded onto a chosen scale/root/octaves.
 * The sign of yaw nudges stereo pan and (optionally) octave.
 */

import type { StepInstruction } from "@/lib/core/types";
import { omega } from "@/lib/core/numberTheory";
import { degreeToMidi, midiToFreq, type ScaleDef } from "./scales";

export type PitchSource = "index" | "klass" | "value" | "omega";

export const PITCH_SOURCES: { id: PitchSource; label: string }[] = [
  { id: "index", label: "Step index" },
  { id: "klass", label: "Class (turn type)" },
  { id: "value", label: "Step value" },
  { id: "omega", label: "ω(i) — distinct primes" },
];

export interface Note {
  /** 0-based position in the sequence. */
  index: number;
  /** Original step number (1..n). */
  step: number;
  midi: number;
  freq: number;
  /** Stereo pan -1..1 from the turn direction. */
  pan: number;
  /** Turn direction sign: -1 left, +1 right, 0 straight. */
  dir: number;
  klass: number;
}

export interface MappingConfig {
  scale: ScaleDef;
  rootMidi: number;
  octaveRange: number;
  pitchSource: PitchSource;
  /** Let turn direction shift pitch by an octave (left = down, right = up). */
  directionOctave: boolean;
  /** How strongly pan tracks turn direction (0..1). */
  panAmount: number;
}

function pitchDegree(step: StepInstruction, source: PitchSource): number {
  switch (source) {
    case "klass":
      return step.klass;
    case "value":
      return Math.round(step.value ?? step.i);
    case "omega":
      return omega(step.i);
    case "index":
    default:
      return step.i - 1;
  }
}

export function mapStepsToNotes(steps: StepInstruction[], cfg: MappingConfig): Note[] {
  return steps.map((s, idx) => {
    const dir = Math.sign(s.yaw);
    let midi = degreeToMidi(pitchDegree(s, cfg.pitchSource), cfg.scale, cfg.rootMidi, cfg.octaveRange);
    if (cfg.directionOctave) midi += dir * 12;
    const pan = dir * cfg.panAmount;
    return {
      index: idx,
      step: s.i,
      midi,
      freq: midiToFreq(midi),
      pan,
      dir,
      klass: s.klass,
    };
  });
}
