/*
 * DESIGN PHILOSOPHY: Dark Generative Art Studio
 * patternEngine.ts — Core mathematical engine for factor-based turn patterns
 *
 * Algorithm:
 *   For each step i from 1..N:
 *     - If gcd(i, N) > 1  → i shares a factor with N → turn RIGHT
 *     - If gcd(i, N) = 1  → i is coprime to N        → turn LEFT
 *   (Step 1 is always coprime to N for N>1, so it always goes straight.)
 *
 *   This means: factors of N turn right, AND multiples of those factors
 *   (up to N) also turn right — e.g. for N=15, steps 3,5,6,9,10,12,15
 *   all share a factor with 15 and turn right.
 *
 * The pattern is repeated `repetitions` times (or until it closes).
 */

export interface PatternConfig {
  /** The number whose factors drive the turn rules */
  n: number;
  /** Angle in degrees to turn when the step is a factor of n */
  factorAngle: number;
  /** Angle in degrees to turn when the step is NOT a factor of n */
  nonFactorAngle: number;
  /** Length of each step segment */
  stepLength: number;
  /** How many full 1..n cycles to draw */
  repetitions: number;
  /** Whether to turn right on factor (true) or left on factor (true = default) */
  factorTurnsRight: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  from: Point;
  to: Point;
  /** Which repetition cycle this segment belongs to (0-indexed) */
  cycle: number;
  /** Step index within the cycle (1-indexed, matching the factor check) */
  step: number;
  /** Whether this step was a factor turn */
  isFactor: boolean;
}

export interface PatternResult {
  segments: Segment[];
  factors: number[];        // true divisors of n
  factorSteps: number[];   // steps 1..n where gcd(step,n)>1 (the "turn right" set)
  isClosed: boolean;
  closedAfterCycles: number | null;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  totalSteps: number;
}

/** Return all factors of n (divisors including 1 and n) */
export function getFactors(n: number): number[] {
  const factors: number[] = [];
  for (let i = 1; i <= n; i++) {
    if (n % i === 0) factors.push(i);
  }
  return factors;
}

/** Greatest common divisor (Euclidean) */
export function gcd(a: number, b: number): number {
  while (b !== 0) { const t = b; b = a % b; a = t; }
  return a;
}

/**
 * Return the set of steps 1..n that share a factor with n (gcd > 1).
 * These are the steps that trigger a "factor turn".
 * For n=15: {3,5,6,9,10,12,15} — factors AND their multiples up to n.
 */
export function getFactorSteps(n: number): Set<number> {
  const set = new Set<number>();
  for (let i = 2; i <= n; i++) {
    if (gcd(i, n) > 1) set.add(i);
  }
  return set;
}

const DEG = Math.PI / 180;

/** Check if two points are approximately equal */
function approxEqual(a: Point, b: Point, eps = 0.5): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

export function generatePattern(config: PatternConfig): PatternResult {
  const { n, factorAngle, nonFactorAngle, stepLength, repetitions, factorTurnsRight } = config;

  const factors = getFactors(n);
  const factorSteps = getFactorSteps(n); // steps that share a factor with n

  const segments: Segment[] = [];

  let x = 0;
  let y = 0;
  let angle = 0; // degrees, 0 = right (+x direction)

  const startPoint: Point = { x: 0, y: 0 };
  let isClosed = false;
  let closedAfterCycles: number | null = null;

  for (let cycle = 0; cycle < repetitions; cycle++) {
    for (let step = 1; step <= n; step++) {
      const isFactor = factorSteps.has(step); // true if gcd(step, n) > 1

      // Determine turn direction
      // factorTurnsRight=true: factor→right (+angle), non-factor→left (-angle)
      let turnDeg: number;
      if (isFactor) {
        turnDeg = factorTurnsRight ? factorAngle : -factorAngle;
      } else {
        turnDeg = factorTurnsRight ? -nonFactorAngle : nonFactorAngle;
      }

      // Apply turn BEFORE drawing (except for step 1 which draws straight)
      if (step === 1 && cycle === 0) {
        // First segment: draw straight, no turn
      } else {
        angle += turnDeg;
      }

      const rad = angle * DEG;
      const nx = x + stepLength * Math.cos(rad);
      const ny = y + stepLength * Math.sin(rad);

      segments.push({
        from: { x, y },
        to: { x: nx, y: ny },
        cycle,
        step,
        isFactor,
      });

      x = nx;
      y = ny;
    }

    // After each cycle, check if we're back near the start
    if (!isClosed && approxEqual({ x, y }, startPoint)) {
      isClosed = true;
      closedAfterCycles = cycle + 1;
    }
  }

  // Compute bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const seg of segments) {
    for (const pt of [seg.from, seg.to]) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  return {
    segments,
    factors,
    factorSteps: Array.from(factorSteps).sort((a, b) => a - b),
    isClosed,
    closedAfterCycles,
    bounds: { minX, maxX, minY, maxY },
    totalSteps: segments.length,
  };
}

/** Default config matching the 15-example in the brief */
export const DEFAULT_CONFIG: PatternConfig = {
  n: 15,
  factorAngle: 90,
  nonFactorAngle: 90,
  stepLength: 10,
  repetitions: 8,
  factorTurnsRight: true,
};

/** Generate a hue for a given cycle index — evenly spread around the colour wheel */
export function cycleHue(cycleIndex: number, totalCycles: number): number {
  return (cycleIndex / totalCycles) * 360;
}

/** Convert HSL to a CSS colour string */
export function hslString(h: number, s = 80, l = 60): string {
  return `hsl(${h % 360}, ${s}%, ${l}%)`;
}
