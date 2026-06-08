/*
 * lib/threed/build3d.ts — Turn a ruleset's yaw-only step list into a true 3D
 * walk by injecting a per-step PITCH derived from a number-theoretic quantity.
 *
 * The classic factor rule (or any registered ruleset) gives us yaw. We then
 * decide how steeply each step climbs out of the plane based on a chosen
 * arithmetic property of the step index i relative to N. Scaling by a single
 * "pitch angle" knob lets the user dial the path from flat (2D) up into helices,
 * towers and shells.
 */

import { StepInstruction, RulesetParams } from "@/lib/core/types";
import { getRuleset } from "@/lib/core/rulesets";
import { omega, bigOmega, gcd, tau } from "@/lib/core/numberTheory";

export type PitchMode = "omega" | "bigOmega" | "gcd" | "tau" | "alternate";

export const PITCH_MODES: { id: PitchMode; label: string; hint: string }[] = [
  { id: "omega", label: "ω(i) — distinct primes", hint: "Climb by count of distinct prime factors of each step." },
  { id: "bigOmega", label: "Ω(i) — primes w/ multiplicity", hint: "Climb by total prime factors of each step." },
  { id: "gcd", label: "gcd(i, N) buckets", hint: "Steps sharing more of N's factors climb steeper." },
  { id: "tau", label: "τ(i) — divisor count", hint: "Highly-composite steps lift the path more." },
  { id: "alternate", label: "alternating saw", hint: "Coprime steps dip, factor steps rise — a clean weave." },
];

/**
 * Map a step index to a signed pitch multiplier in roughly [-1, 1] before the
 * pitchAngle scale is applied. Centred so the path neither runs away nor flattens.
 */
function pitchUnit(i: number, n: number, mode: PitchMode): number {
  switch (mode) {
    case "omega": {
      // ω grows ~ log log; centre around 1 distinct factor.
      return omega(i) - 1.2;
    }
    case "bigOmega": {
      return bigOmega(i) - 1.5;
    }
    case "gcd": {
      const g = gcd(i, n);
      if (g <= 1) return -0.6; // coprime dips
      // bucket by how large the shared factor is relative to N
      return Math.min(1.4, 0.4 + (g / n) * 3);
    }
    case "tau": {
      return tau(i) - 2.2;
    }
    case "alternate":
    default: {
      return gcd(i, n) > 1 ? 1 : -1;
    }
  }
}

export interface Build3DOptions {
  rulesetId: string;
  params: RulesetParams;
  pitchMode: PitchMode;
  /** degrees: scale applied to each step's pitch unit */
  pitchAngle: number;
}

/**
 * Produce StepInstruction[] with both yaw (from the ruleset) and pitch (from the
 * chosen number-theoretic quantity). Falls back to the classic rule if the id is
 * unknown (e.g. during isolated typecheck where only classic is registered).
 */
export function build3DSteps({ rulesetId, params, pitchMode, pitchAngle }: Build3DOptions): StepInstruction[] {
  const rule = getRuleset(rulesetId) ?? getRuleset("classic-factor")!;
  const base = rule.generate(params);
  return base.map((s) => ({
    ...s,
    pitch: pitchUnit(s.i, params.n, pitchMode) * pitchAngle,
  }));
}
