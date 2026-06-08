/*
 * core/types.ts — The seam between number theory and rendering.
 *
 * A Ruleset turns a number N (plus knob values) into a sequence of per-step
 * StepInstructions for ONE cycle. A turtle (2D or 3D) then walks that sequence,
 * repeated `repetitions` times, into geometry. Alternate renderers (sound, chord
 * diagrams, heatmaps) consume the SAME StepInstruction[] without a turtle.
 *
 * This decoupling is the whole point: new maths = new Ruleset; new visuals =
 * new renderer. Neither needs to know about the other.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/**
 * One step in a single cycle (steps are 1..N).
 *
 *  - `yaw`   signed turn in the plane, degrees (the classic left/right).
 *  - `pitch` optional signed turn out of plane, degrees (3D only).
 *  - `klass` categorical class id (0..classCount-1) — drives colour, legend, the
 *            note in a scale, the cell tint, etc. For the classic rule: 0 = coprime
 *            (left), 1 = shares-factor (right).
 *  - `value` optional continuous scalar (e.g. gcd value, ω(i)) for gradient colour
 *            or pitch mapping when a categorical class is too coarse.
 *  - `stepScale` optional multiplier on the base step length (default 1) — lets
 *            rulesets vary segment length (used by the continuous ruleset).
 */
export interface StepInstruction {
  i: number;
  yaw: number;
  pitch?: number;
  klass: number;
  value?: number;
  stepScale?: number;
}

/** A knob a ruleset exposes to the UI so it can render its own controls. */
export interface Knob {
  key: string;
  label: string;
  type: "slider" | "toggle";
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean;
  hint?: string;
}

/**
 * Parameters passed to a ruleset's generate(). `n`, `angleA`, `angleB` are the
 * common knobs every classic-style ruleset understands; anything else lives in
 * the index signature keyed by the ruleset's own Knob.keys.
 */
export interface RulesetParams {
  n: number;
  angleA: number;
  angleB: number;
  factorTurnsRight: boolean;
  [key: string]: number | string | boolean | undefined;
}

export interface Ruleset {
  id: string;
  label: string;
  blurb: string;
  category: "classic" | "number-theory" | "formula" | "gaussian" | "continuous";
  /** Number of distinct klass values, for legends. Omit if continuous-only. */
  classCount?: number;
  /** Human labels for each klass (index = klass id), for legends. */
  classLabels?: string[];
  /** Extra UI knobs beyond n/angleA/angleB. */
  knobs?: Knob[];
  /** Generate exactly one cycle: instructions for steps 1..n. */
  generate(params: RulesetParams): StepInstruction[];
}

/** Default knob values for a ruleset (n/angleA/angleB plus its custom knobs). */
export function defaultParams(rule: Ruleset, n: number): RulesetParams {
  const p: RulesetParams = {
    n,
    angleA: 90,
    angleB: 90,
    factorTurnsRight: true,
  };
  for (const k of rule.knobs ?? []) p[k.key] = k.default;
  return p;
}
