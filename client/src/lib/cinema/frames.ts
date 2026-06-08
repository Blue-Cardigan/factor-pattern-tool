/*
 * lib/cinema/frames.ts — parameter-space cinematography math.
 *
 * Pure functions: given an animation mode + a normalised time t in [0,1],
 * compute the live RulesetParams/stepLength for that frame, then walk them into
 * geometry via runTurtle2D. No React, no canvas — just numbers and segments.
 *
 * Three modes:
 *   - angle : sweep angleA (and optionally angleB) through a degree range.
 *   - bloom : step N from a..b over time, one integer per "slot" + crossfade.
 *   - morph : interpolate between two saved configs A -> B.
 */

import type { RulesetParams } from "@/lib/core/types";
import { getRuleset } from "@/lib/core/rulesets";
import { runTurtle2D, type TurtleResult } from "@/lib/core/turtle";

export type CinemaMode = "angle" | "bloom" | "morph";

/** Hard caps so a frame never explodes the canvas / blows the frame budget. */
export const MAX_N = 120;
export const MAX_SEGMENTS = 60000;

/** A fully-resolved config A or B for the morph mode. */
export interface CinemaConfig {
  rulesetId: string;
  n: number;
  angleA: number;
  angleB: number;
  factorTurnsRight: boolean;
  stepLength: number;
  repetitions: number;
}

export interface AngleSpec {
  /** Sweep angleA between these two degree values (fractional allowed). */
  angleAMin: number;
  angleAMax: number;
  /** If set, sweep angleB in lockstep; otherwise angleB is held constant. */
  angleBMin?: number;
  angleBMax?: number;
}

export interface BloomSpec {
  nMin: number;
  nMax: number;
  /** Fraction of each integer slot spent crossfading into the next, 0..0.5. */
  crossfade: number;
}

/** The whole animation spec the engine needs to render any frame. */
export interface CinemaSpec {
  mode: CinemaMode;
  /** Shared base config (also config A for morph). */
  base: CinemaConfig;
  /** Config B for morph mode. */
  configB?: CinemaConfig;
  angle?: AngleSpec;
  bloom?: BloomSpec;
}

export interface FrameValues {
  rulesetId: string;
  n: number;
  angleA: number;
  angleB: number;
  factorTurnsRight: boolean;
  stepLength: number;
  repetitions: number;
}

export interface ComputedFrame {
  values: FrameValues;
  primary: TurtleResult;
  /** Optional second layer for crossfading (bloom/morph N switch). */
  secondary?: TurtleResult;
  /** 0 = show only primary, 1 = show only secondary. */
  blend: number;
}

/** Fallbacks used when a spec is switched to a mode whose block isn't set yet. */
export const DEFAULT_ANGLE_SPEC: AngleSpec = { angleAMin: 30, angleAMax: 150 };
export const DEFAULT_BLOOM_SPEC: BloomSpec = { nMin: 6, nMax: 60, crossfade: 0.35 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);

function capN(n: number): number {
  return clamp(Math.round(n), 1, MAX_N);
}

/** Walk a single frame's params into geometry, capping segment count. */
function walk(values: FrameValues): TurtleResult {
  const rule = getRuleset(values.rulesetId) ?? getRuleset("classic-factor")!;
  const params: RulesetParams = {
    n: values.n,
    angleA: values.angleA,
    angleB: values.angleB,
    factorTurnsRight: values.factorTurnsRight,
  };
  const steps = rule.generate(params);
  // Cap repetitions so steps * reps never blows MAX_SEGMENTS.
  const maxReps = Math.max(1, Math.floor(MAX_SEGMENTS / Math.max(1, steps.length)));
  const repetitions = clamp(Math.round(values.repetitions), 1, maxReps);
  return runTurtle2D({ steps, stepLength: values.stepLength, repetitions });
}

/* ----------------------------- per-mode values ----------------------------- */

function angleValues(spec: CinemaSpec, t: number): FrameValues {
  const a = spec.angle ?? DEFAULT_ANGLE_SPEC;
  const b = spec.base;
  const angleA = lerp(a.angleAMin, a.angleAMax, t);
  const angleB =
    a.angleBMin != null && a.angleBMax != null ? lerp(a.angleBMin, a.angleBMax, t) : b.angleB;
  return {
    rulesetId: b.rulesetId,
    n: capN(b.n),
    angleA,
    angleB,
    factorTurnsRight: b.factorTurnsRight,
    stepLength: b.stepLength,
    repetitions: b.repetitions,
  };
}

/**
 * Bloom: divide [0,1] into (count) slots, one integer N each. Within the tail
 * `crossfade` fraction of a slot, blend toward the next integer's geometry.
 */
function bloomFrame(spec: CinemaSpec, t: number): ComputedFrame {
  const bl = spec.bloom ?? DEFAULT_BLOOM_SPEC;
  const b = spec.base;
  const lo = capN(bl.nMin);
  const hi = capN(bl.nMax);
  const count = Math.max(1, hi - lo + 1);
  const tt = clamp(t, 0, 0.999999);
  const slot = tt * count; // 0..count
  const idx = Math.min(count - 1, Math.floor(slot));
  const frac = slot - idx; // 0..1 within this integer's slot
  const nCur = lo + idx;

  const baseVals = (n: number): FrameValues => ({
    rulesetId: b.rulesetId,
    n: capN(n),
    angleA: b.angleA,
    angleB: b.angleB,
    factorTurnsRight: b.factorTurnsRight,
    stepLength: b.stepLength,
    repetitions: b.repetitions,
  });

  const cf = clamp(bl.crossfade, 0, 0.5);
  const primary = walk(baseVals(nCur));
  if (cf > 0 && frac > 1 - cf && nCur < hi) {
    const nNext = nCur + 1;
    const secondary = walk(baseVals(nNext));
    const blend = smoothstep((frac - (1 - cf)) / cf);
    return { values: { ...baseVals(nCur), n: nCur }, primary, secondary, blend };
  }
  return { values: baseVals(nCur), primary, blend: 0 };
}

/**
 * Morph: continuously interpolate angles + stepLength + repetitions from A to B.
 * For N (integer) we crossfade across the midpoint t=0.5.
 */
function morphFrame(spec: CinemaSpec, t: number): ComputedFrame {
  const A = spec.base;
  const B = spec.configB ?? spec.base;
  const tt = smoothstep(clamp(t, 0, 1));

  const lerpVals = (n: number): FrameValues => ({
    rulesetId: tt < 0.5 ? A.rulesetId : B.rulesetId,
    n: capN(n),
    angleA: lerp(A.angleA, B.angleA, tt),
    angleB: lerp(A.angleB, B.angleB, tt),
    factorTurnsRight: tt < 0.5 ? A.factorTurnsRight : B.factorTurnsRight,
    stepLength: lerp(A.stepLength, B.stepLength, tt),
    repetitions: Math.round(lerp(A.repetitions, B.repetitions, tt)),
  });

  const nA = capN(A.n);
  const nB = capN(B.n);
  // Crossfade window around the midpoint when N (or ruleset) differs.
  const needsSwitch = nA !== nB || A.rulesetId !== B.rulesetId || A.factorTurnsRight !== B.factorTurnsRight;
  const fadeHalf = 0.12;

  if (needsSwitch && tt > 0.5 - fadeHalf && tt < 0.5 + fadeHalf) {
    const blend = smoothstep((tt - (0.5 - fadeHalf)) / (2 * fadeHalf));
    const primary = walk({ ...lerpVals(nA), rulesetId: A.rulesetId, factorTurnsRight: A.factorTurnsRight });
    const secondary = walk({ ...lerpVals(nB), rulesetId: B.rulesetId, factorTurnsRight: B.factorTurnsRight });
    return { values: tt < 0.5 ? lerpVals(nA) : lerpVals(nB), primary, secondary, blend };
  }

  const n = tt < 0.5 ? nA : nB;
  const values = lerpVals(n);
  return { values, primary: walk(values), blend: 0 };
}

/** Compute everything needed to draw the frame at normalised time t in [0,1]. */
export function computeFrame(spec: CinemaSpec, t: number): ComputedFrame {
  switch (spec.mode) {
    case "angle": {
      const values = angleValues(spec, t);
      return { values, primary: walk(values), blend: 0 };
    }
    case "bloom":
      return bloomFrame(spec, t);
    case "morph":
      return morphFrame(spec, t);
  }
}

/** Live label for the swept parameter(s), shown in the HUD. */
export function frameLabel(spec: CinemaSpec, f: ComputedFrame): string {
  const v = f.values;
  switch (spec.mode) {
    case "angle": {
      const ab =
        spec.angle?.angleBMin != null
          ? ` · B ${v.angleB.toFixed(1)}°`
          : "";
      return `angleA ${v.angleA.toFixed(1)}°${ab} · N ${v.n}`;
    }
    case "bloom":
      return `N ${v.n}${f.secondary ? ` → ${v.n + 1}` : ""}`;
    case "morph":
      return `N ${v.n} · A ${v.angleA.toFixed(1)}° · B ${v.angleB.toFixed(1)}°`;
  }
}
