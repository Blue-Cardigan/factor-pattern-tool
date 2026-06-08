/*
 * lib/sonify/scales.ts — Musical scales + note name helpers.
 *
 * A scale is a set of semitone offsets within an octave. We map an integer
 * "degree" (0,1,2,…) onto pitches by walking the scale and wrapping into higher
 * octaves, so any unbounded sequence of step indices becomes a melody confined
 * to a chosen scale / root / octave range.
 */

export type ScaleId = "pentatonic" | "major" | "minor" | "blues" | "chromatic";

export interface ScaleDef {
  id: ScaleId;
  label: string;
  /** Semitone offsets within one octave. */
  steps: number[];
}

export const SCALES: ScaleDef[] = [
  { id: "pentatonic", label: "Pentatonic", steps: [0, 2, 4, 7, 9] },
  { id: "major", label: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: "minor", label: "Minor", steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: "blues", label: "Blues", steps: [0, 3, 5, 6, 7, 10] },
  { id: "chromatic", label: "Chromatic", steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

export function getScale(id: ScaleId): ScaleDef {
  return SCALES.find((s) => s.id === id) ?? SCALES[0];
}

/** Note names for the 12 semitones, root = C. */
export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

/** MIDI note number for a name + octave (C4 = 60, A4 = 69 = 440Hz). */
export function midiOf(root: NoteName, octave: number): number {
  const idx = NOTE_NAMES.indexOf(root);
  return (octave + 1) * 12 + idx;
}

/** Standard equal-temperament frequency for a MIDI number. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Map a non-negative integer degree onto a MIDI note within `octaveRange`
 * octaves above `rootMidi`. Degrees wrap through the scale, climbing octaves,
 * then fold back so the melody stays inside the chosen window.
 */
export function degreeToMidi(
  degree: number,
  scale: ScaleDef,
  rootMidi: number,
  octaveRange: number,
): number {
  const span = scale.steps.length * Math.max(1, octaveRange);
  const d = ((degree % span) + span) % span;
  const octave = Math.floor(d / scale.steps.length);
  const within = scale.steps[d % scale.steps.length];
  return rootMidi + octave * 12 + within;
}

export function midiToName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}
