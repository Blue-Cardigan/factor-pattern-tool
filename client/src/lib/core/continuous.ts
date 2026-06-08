/*
 * core/continuous.ts — Smooth, curvature-driven rulesets.
 *
 * Instead of sharp categorical turns, these emit small fractional yaw per step so
 * the turtle traces smooth curves. They also set `value` (for gradient colour)
 * and may set `stepScale` (varying segment length), exercising those fields of
 * StepInstruction.
 */

import { Ruleset, RulesetParams, StepInstruction } from "./types";
import { phi } from "./numberTheory";

/**
 * SINE CURVE ruleset: yaw(i) = base · sin(i · freq + phase). Continuous gentle
 * oscillation; value tracks the sine for a flowing gradient.
 */
export const sineCurveRule: Ruleset = {
  id: "continuous-sine",
  label: "Sine Flow",
  blurb:
    "yaw(i) = base · sin(i · freq + phase). Smooth oscillating curvature; colour " +
    "follows the sine wave. angleA sets the base amplitude in degrees.",
  category: "continuous",
  knobs: [
    {
      key: "freq",
      label: "Frequency",
      type: "slider",
      min: 0.01,
      max: 1.5,
      step: 0.01,
      default: 0.2,
      hint: "Angular frequency of the curvature wave.",
    },
    {
      key: "phase",
      label: "Phase",
      type: "slider",
      min: 0,
      max: 6.28,
      step: 0.05,
      default: 0,
      hint: "Phase offset (radians).",
    },
  ],
  generate(params: RulesetParams): StepInstruction[] {
    const { n, angleA } = params;
    const freq = typeof params.freq === "number" ? params.freq : 0.2;
    const phase = typeof params.phase === "number" ? params.phase : 0;
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const s = Math.sin(i * freq + phase);
      steps.push({ i, yaw: angleA * s, klass: s < 0 ? 0 : 1, value: s });
    }
    return steps;
  },
};

/**
 * TOTIENT CURL ruleset: curvature ∝ φ(i)/i, a value in (0,1] that dips at
 * highly-composite i and peaks at primes (φ(p)/p = (p-1)/p ≈ 1). Produces an
 * irregular spiral whose tightness encodes the totient ratio; segment length
 * scales with the same ratio and colour follows it.
 */
export const totientCurlRule: Ruleset = {
  id: "continuous-totient",
  label: "Totient Curl",
  blurb:
    "Curvature ∝ φ(i)/i (the density of coprimes below i). Primes ≈ straight, " +
    "highly-composite i curl hard. Segment length and colour also track φ(i)/i, " +
    "giving an organic, number-theoretic spiral.",
  category: "continuous",
  knobs: [
    {
      key: "curlGain",
      label: "Curl gain",
      type: "slider",
      min: 0.2,
      max: 6,
      step: 0.1,
      default: 2,
      hint: "Multiplies the totient-ratio curvature.",
    },
    {
      key: "varyLength",
      label: "Vary segment length",
      type: "toggle",
      default: true,
      hint: "Scale each segment by φ(i)/i for extra texture.",
    },
  ],
  generate(params: RulesetParams): StepInstruction[] {
    const { n, angleA } = params;
    const gain = typeof params.curlGain === "number" ? params.curlGain : 2;
    const varyLength = params.varyLength !== false;
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const ratio = phi(i) / i; // (0, 1]
      // Low ratio (composite) => sharp curl; high ratio (prime) => near straight.
      const yaw = angleA * gain * (1 - ratio);
      const stepScale = varyLength ? 0.5 + ratio : 1;
      steps.push({ i, yaw, klass: ratio < 0.5 ? 0 : 1, value: ratio, stepScale });
    }
    return steps;
  },
};

export const CONTINUOUS_RULES: Ruleset[] = [sineCurveRule, totientCurlRule];
