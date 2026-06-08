/*
 * core/gaussian.ts — Gaussian integer (ℤ[i]) driven ruleset.
 *
 * A Gaussian integer is a + bi with a,b ∈ ℤ. Its norm is N(a+bi) = a² + b².
 * Arithmetic in ℤ[i] has its own primes ("Gaussian primes"):
 *   - a rational prime p ≡ 3 (mod 4) stays prime in ℤ[i],
 *   - p = 2 and p ≡ 1 (mod 4) split into two conjugate Gaussian primes.
 *
 * THE RULE (documented in the blurb): for step i we form the Gaussian integer
 *   z = i + (i mod n) · i        (real part i, imaginary part i mod n)
 * compute its norm Nz = i² + (i mod n)², count the number of Gaussian-prime
 * factors of Nz (with multiplicity, via the rational factorisation of the norm),
 * and:
 *   - turn LEFT  by angleA              if Nz shares a factor with N (gcd>1),
 *   - turn RIGHT by angleB · gaussΩ     otherwise,
 * where gaussΩ is that Gaussian-prime-factor count (capped). This couples the
 * arithmetic of N to a 2D-lattice quantity, producing dense near-closing loops.
 */

import { Ruleset, RulesetParams, StepInstruction } from "./types";
import { gcd, primeFactorization } from "./numberTheory";

/** Norm of a Gaussian integer a + bi. */
export function gaussianNorm(a: number, b: number): number {
  return a * a + b * b;
}

/**
 * Count Gaussian-prime factors (with multiplicity) of a Gaussian integer whose
 * norm is `norm`. Uses the splitting law on the rational factorisation of the
 * norm: each rational prime p with exponent e contributes
 *   - e          Gaussian primes if p ≡ 1 (mod 4)  (splits)
 *   - e          if p === 2                          (ramifies: (1+i)^2 ~ 2)
 *   - e/2        if p ≡ 3 (mod 4)                    (inert; appears squared in norms)
 * This is an exact count of the Gaussian-prime factors implied by the norm.
 */
export function gaussianPrimeFactorCount(norm: number): number {
  if (norm <= 1) return 0;
  let count = 0;
  for (const [p, e] of primeFactorization(norm)) {
    if (p === 2) count += e;
    else if (p % 4 === 1) count += e;
    else count += Math.floor(e / 2); // p ≡ 3 (mod 4), inert
  }
  return count;
}

/** Whether a Gaussian integer of this norm is a Gaussian prime. */
export function isGaussianPrime(a: number, b: number): boolean {
  const norm = gaussianNorm(a, b);
  // a + bi is prime iff norm is a rational prime, or one of a,b is 0 and the
  // other is a rational prime p ≡ 3 (mod 4).
  if (a === 0 || b === 0) {
    const m = Math.abs(a === 0 ? b : a);
    return primeFactorization(m).size === 1 &&
      [...primeFactorization(m).values()][0] === 1 &&
      m % 4 === 3;
  }
  const f = primeFactorization(norm);
  return f.size === 1 && [...f.values()][0] === 1;
}

/**
 * GAUSSIAN ruleset. See the file header for the exact rule. angleA is the
 * left-turn unit; angleB the right-turn unit scaled by the Gaussian-prime count.
 */
export const gaussianRule: Ruleset = {
  id: "gaussian-norm",
  label: "Gaussian Integers",
  blurb:
    "z = i + (i mod n)·𝑖 in ℤ[𝑖]. Norm Nz = i² + (i mod n)². If Nz shares a " +
    "factor with N, turn left by A; else turn right by B × (count of Gaussian-" +
    "prime factors of Nz). Couples N's arithmetic to the integer lattice for " +
    "dense, near-closing loops.",
  category: "gaussian",
  classCount: 2,
  classLabels: ["norm shares factor (left)", "coprime norm (right)"],
  knobs: [
    {
      key: "gaussCap",
      label: "Prime-count cap",
      type: "slider",
      min: 1,
      max: 8,
      step: 1,
      default: 5,
      hint: "Caps the Gaussian-prime factor count used to scale the right turn.",
    },
  ],
  generate(params: RulesetParams): StepInstruction[] {
    const { n, angleA, angleB } = params;
    const cap = typeof params.gaussCap === "number" ? params.gaussCap : 5;
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const a = i;
      const b = i % n;
      const norm = gaussianNorm(a, b);
      const shares = gcd(norm, n) > 1;
      let yaw: number;
      let klass: number;
      if (shares) {
        yaw = -angleA;
        klass = 0;
      } else {
        const gOmega = Math.min(cap, gaussianPrimeFactorCount(norm));
        yaw = angleB * (gOmega + 1);
        klass = 1;
      }
      steps.push({ i, yaw, klass, value: norm });
    }
    return steps;
  },
};
