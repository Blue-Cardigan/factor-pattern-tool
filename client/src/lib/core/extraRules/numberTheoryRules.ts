/*
 * core/rulesets/numberTheoryRules.ts — Rulesets that map a per-step integer
 * quantity q(i) to a turn.
 *
 * Convention shared by these rules:
 *   - angleA is the BASE unit angle: yaw = angleA · q(i) (signed by handedness).
 *   - angleB is a constant OFFSET added to the magnitude (a baseline turn).
 *   - factorTurnsRight flips the global handedness.
 *   - klass is a small bucket index for the legend (classCount / classLabels).
 *
 * All quantity functions reuse core/numberTheory.
 */

import { Ruleset, RulesetParams, StepInstruction } from "../types";
import {
  omega,
  bigOmega,
  tau,
  divisors,
  gcd,
} from "../numberTheory";

/** Sign helper from the global handedness toggle. */
function dir(factorTurnsRight: boolean): number {
  return factorTurnsRight ? 1 : -1;
}

/**
 * ω(i) — distinct prime factors. yaw scales with how many DIFFERENT primes
 * divide i; klass buckets ω into {0,1,2,3+}.
 */
export const omegaRule: Ruleset = {
  id: "nt-omega",
  label: "Distinct Primes ω(i)",
  blurb:
    "yaw = A · ω(i) + B, where ω(i) is the number of distinct prime factors of " +
    "step i. Primes and prime powers turn gently; many-prime composites turn hard.",
  category: "number-theory",
  classCount: 4,
  classLabels: ["ω=0/1", "ω=2", "ω=3", "ω≥4"],
  generate(params: RulesetParams): StepInstruction[] {
    const { n, angleA, angleB, factorTurnsRight } = params;
    const d = dir(factorTurnsRight);
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const q = omega(i);
      const yaw = d * (angleA * q + angleB);
      const klass = Math.min(3, Math.max(0, q <= 1 ? 0 : q - 1));
      steps.push({ i, yaw, klass, value: q });
    }
    return steps;
  },
};

/**
 * Ω(i) — prime factors with multiplicity. Same shape as ω but counts repeats,
 * so prime powers (8 = 2³) turn harder than ω alone would.
 */
export const bigOmegaRule: Ruleset = {
  id: "nt-bigomega",
  label: "Prime Count Ω(i)",
  blurb:
    "yaw = A · Ω(i) + B, where Ω(i) counts prime factors of i WITH multiplicity. " +
    "Prime powers turn progressively harder.",
  category: "number-theory",
  classCount: 4,
  classLabels: ["Ω≤1", "Ω=2", "Ω=3", "Ω≥4"],
  generate(params: RulesetParams): StepInstruction[] {
    const { n, angleA, angleB, factorTurnsRight } = params;
    const d = dir(factorTurnsRight);
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const q = bigOmega(i);
      const yaw = d * (angleA * q + angleB);
      const klass = Math.min(3, Math.max(0, q <= 1 ? 0 : q - 1));
      steps.push({ i, yaw, klass, value: q });
    }
    return steps;
  },
};

/**
 * τ(i) — number of divisors. yaw scales with divisor count; klass buckets by
 * size. Highly-composite numbers spike.
 */
export const tauRule: Ruleset = {
  id: "nt-tau",
  label: "Divisor Count τ(i)",
  blurb:
    "yaw = A · τ(i) + B, where τ(i) is the number of divisors of step i. " +
    "Highly-composite steps spike; primes (τ=2) turn gently.",
  category: "number-theory",
  classCount: 4,
  classLabels: ["τ≤2 (1/prime)", "τ=3-4", "τ=5-6", "τ≥7"],
  generate(params: RulesetParams): StepInstruction[] {
    const { n, angleA, angleB, factorTurnsRight } = params;
    const d = dir(factorTurnsRight);
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const q = tau(i);
      const yaw = d * (angleA * q + angleB);
      const klass = q <= 2 ? 0 : q <= 4 ? 1 : q <= 6 ? 2 : 3;
      steps.push({ i, yaw, klass, value: q });
    }
    return steps;
  },
};

/**
 * Divisor-count PARITY: τ(i) is odd iff i is a perfect square. A binary rule
 * (squares vs non-squares) — perfect squares turn one way, everything else the
 * other, producing a sparse-spike pattern.
 */
export const divisorParityRule: Ruleset = {
  id: "nt-divisor-parity",
  label: "Square Detector (τ parity)",
  blurb:
    "τ(i) is odd exactly when i is a perfect square. Perfect squares turn by A; " +
    "all other steps turn by −B. A sparse, spiky signature of the squares.",
  category: "number-theory",
  classCount: 2,
  classLabels: ["non-square (τ even)", "perfect square (τ odd)"],
  generate(params: RulesetParams): StepInstruction[] {
    const { n, angleA, angleB, factorTurnsRight } = params;
    const d = dir(factorTurnsRight);
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const isSquare = tau(i) % 2 === 1;
      const yaw = isSquare ? d * angleA : -d * angleB;
      steps.push({ i, yaw, klass: isSquare ? 1 : 0, value: isSquare ? 1 : 0 });
    }
    return steps;
  },
};

/**
 * gcd(i, n) BUCKETS: how strongly step i shares structure with N. yaw scales
 * with gcd; klass buckets {1, small, medium, large divisor}.
 */
export const gcdBucketRule: Ruleset = {
  id: "nt-gcd-buckets",
  label: "GCD Buckets gcd(i,N)",
  blurb:
    "yaw = A · gcd(i, N) + B. Coprime steps (gcd=1) turn the baseline; steps " +
    "sharing large divisors with N turn hardest. klass buckets the gcd by size.",
  category: "number-theory",
  classCount: 4,
  classLabels: ["gcd=1 (coprime)", "gcd small", "gcd medium", "gcd large"],
  generate(params: RulesetParams): StepInstruction[] {
    const { n, angleA, angleB, factorTurnsRight } = params;
    const d = dir(factorTurnsRight);
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const g = gcd(i, n);
      const yaw = d * (angleA * g + angleB);
      let klass: number;
      if (g === 1) klass = 0;
      else if (g <= n / 8) klass = 1;
      else if (g <= n / 2) klass = 2;
      else klass = 3;
      steps.push({ i, yaw, klass, value: g });
    }
    return steps;
  },
};

/**
 * i mod k — the simplest k-ary rule. yaw scales with the residue class of i
 * modulo k; klass IS the residue (capped for the legend). Exposes the modulus k
 * as a knob. Drives crisp k-fold rosette geometry.
 */
export const modKRule: Ruleset = {
  id: "nt-mod-k",
  label: "Residue mod k",
  blurb:
    "yaw = A · (i mod k) + B. The step's residue class modulo k sets the turn; " +
    "klass is that residue. Tune k for k-fold rosettes and lattices.",
  category: "number-theory",
  classCount: 6,
  classLabels: ["r=0", "r=1", "r=2", "r=3", "r=4", "r≥5"],
  knobs: [
    {
      key: "k",
      label: "Modulus k",
      type: "slider",
      min: 2,
      max: 24,
      step: 1,
      default: 5,
      hint: "Residue is i mod k; controls the rotational symmetry.",
    },
    {
      key: "centered",
      label: "Center residues",
      type: "toggle",
      default: false,
      hint: "Map residue to (r − k/2) so turns are signed around zero.",
    },
  ],
  generate(params: RulesetParams): StepInstruction[] {
    const { n, angleA, angleB, factorTurnsRight } = params;
    const k = Math.max(2, Math.round(typeof params.k === "number" ? params.k : 5));
    const centered = params.centered === true;
    const d = dir(factorTurnsRight);
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const r = i % k;
      const q = centered ? r - k / 2 : r;
      const yaw = d * (angleA * q + angleB);
      const klass = Math.min(5, r);
      steps.push({ i, yaw, klass, value: r });
    }
    return steps;
  },
};

/**
 * Largest-divisor step: yaw scales with the largest proper divisor of i (the
 * "drop" from i). Gives a different texture from gcd/τ — emphasizes how
 * composite each i is on its own terms.
 */
export const largestDivisorRule: Ruleset = {
  id: "nt-largest-divisor",
  label: "Largest Proper Divisor",
  blurb:
    "yaw = A · (largest proper divisor of i)/i · 90 + B. Primes (largest proper " +
    "divisor 1) turn least; even numbers (divisor i/2) turn most. Reveals each " +
    "step's compositeness independent of N.",
  category: "number-theory",
  classCount: 3,
  classLabels: ["prime/1", "odd composite", "even"],
  generate(params: RulesetParams): StepInstruction[] {
    const { n, angleA, angleB, factorTurnsRight } = params;
    const d = dir(factorTurnsRight);
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const ds = divisors(i);
      const lpd = ds.length >= 2 ? ds[ds.length - 2] : 1; // largest proper divisor
      const ratio = i > 0 ? lpd / i : 0; // (0, 0.5]
      const yaw = d * (angleA * ratio * 90 + angleB);
      const klass = lpd === 1 ? 0 : i % 2 === 0 ? 2 : 1;
      steps.push({ i, yaw, klass, value: ratio });
    }
    return steps;
  },
};

export const NUMBER_THEORY_RULES: Ruleset[] = [
  omegaRule,
  bigOmegaRule,
  tauRule,
  divisorParityRule,
  gcdBucketRule,
  modKRule,
  largestDivisorRule,
];
