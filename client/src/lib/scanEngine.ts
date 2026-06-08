/*
 * scanEngine.ts — Systematic closed-loop scanner and complexity grader
 *
 * For each (N, angle) pair, we run the pattern engine and check whether
 * the path returns to its origin after at most MAX_CYCLES repetitions.
 *
 * Complexity grading
 * ------------------
 * We want a meaningful, multi-dimensional measure of "how interesting" a
 * closed loop is. The grade is a composite of:
 *
 *   1. cyclesUntilClosed   — fewer cycles = simpler symmetry
 *   2. factorDensity       — |factorSteps| / N  (0..1)
 *      High density → mostly right turns → likely compact/symmetric
 *      Low density  → mostly left turns  → more open, wandering
 *   3. boundingBoxRatio    — max(w,h) / min(w,h)  (≥1)
 *      Close to 1 = square/symmetric; large = elongated
 *   4. turnBalance         — |rightTurns - leftTurns| / totalTurns
 *      0 = perfectly balanced; 1 = all one direction
 *   5. uniqueVertices      — approximate count of distinct grid points visited
 *      (proxy for path complexity / self-intersection density)
 *   6. rotationalSymmetry  — detected order of rotational symmetry (1,2,3,4,6…)
 *
 * complexityScore ∈ [0, 100] — higher = more structurally interesting
 * (not "harder", but "richer" — balanced turns, non-trivial symmetry, etc.)
 *
 * Structural tags are assigned based on the above metrics.
 */

import { generatePattern, getFactors, gcd, PatternConfig } from "./patternEngine";

export interface ScanResult {
  n: number;
  angle: number;          // both factor and non-factor angle (symmetric scan)
  isClosed: boolean;
  cyclesUntilClosed: number | null;
  complexityScore: number;   // 0–100
  tags: StructureTag[];
  factorDensity: number;     // 0–1
  turnBalance: number;       // 0–1 (0 = balanced)
  boundingBoxRatio: number;  // ≥1
  rotationalSymmetry: number; // detected order (1 = none, 2, 3, 4, 6…)
  uniqueVertices: number;
  totalSegments: number;
  // Euler's totient φ(N) — count of steps coprime to N (left-turn steps)
  phi: number;
}

export type StructureTag =
  | "square"        // 4-fold symmetry
  | "hexagonal"     // 6-fold symmetry
  | "triangular"    // 3-fold symmetry
  | "bilateral"     // 2-fold symmetry
  | "balanced"      // near-equal left/right turns
  | "dense"         // high factor density (>0.6)
  | "sparse"        // low factor density (<0.3)
  | "compact"       // bounding box ratio < 1.3
  | "elongated"     // bounding box ratio > 3
  | "prime"         // N is prime
  | "highly-composite" // N has unusually many divisors
  | "perfect"       // N is a perfect number (6, 28, 496…)
  | "power-of-2"    // N = 2^k
  | "simple"        // closes in 1 cycle
  | "complex";      // closes in >6 cycles

const MAX_CYCLES = 20;

/** Euler's totient function φ(N) */
function totient(n: number): number {
  let result = n;
  let p = 2;
  let temp = n;
  while (p * p <= temp) {
    if (temp % p === 0) {
      while (temp % p === 0) temp = Math.floor(temp / p);
      result -= Math.floor(result / p);
    }
    p++;
  }
  if (temp > 1) result -= Math.floor(result / temp);
  return result;
}

/** Check if N is prime */
function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

/** Count divisors of n */
function divisorCount(n: number): number {
  let count = 0;
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) count += i === Math.floor(n / i) ? 1 : 2;
  }
  return count;
}

/** Highly composite: more divisors than any smaller positive integer */
const HIGHLY_COMPOSITE = new Set([1,2,4,6,12,24,36,48,60,120,180,240,360,720,840,1260,1680,2520]);

/** Perfect numbers up to reasonable range */
const PERFECT = new Set([6, 28, 496, 8128]);

/**
 * Detect approximate rotational symmetry order from the bounding box
 * and cycle count. This is a heuristic — true detection would require
 * comparing rotated copies of the vertex set.
 */
function detectSymmetry(cyclesUntilClosed: number | null, angle: number, n: number): number {
  if (!cyclesUntilClosed) return 1;
  // The net turning angle per cycle determines rotational order
  // Net turn = sum of all turns in one cycle
  // For symmetric angles: each step turns ±angle
  // factorSteps turn right (+angle), others turn left (-angle)
  // Net = (factorCount - nonFactorCount) * angle  (mod 360)
  const phi = totient(n);
  const factorStepCount = n - 1 - phi + 1; // steps 2..n where gcd>1, plus step 1 is always left
  // Actually: factorSteps = {i: gcd(i,n)>1}, count = n - phi(n) - 1 (excluding step 1 which is coprime)
  // step 1: gcd(1,n)=1 always → left turn (but first step is straight)
  // steps 2..n: gcd>1 → right, gcd=1 → left
  const rightCount = n - phi; // steps where gcd(i,n)>1, i=1..n; step 1 always coprime so right=n-phi-1... 
  // Simpler: use cyclesUntilClosed as proxy
  if (cyclesUntilClosed === 1) return 1;
  if (360 % Math.round(angle) === 0) {
    const order = 360 / Math.round(angle);
    if ([2, 3, 4, 6, 8, 12].includes(order)) return order;
  }
  if (cyclesUntilClosed <= 4) return 4;
  if (cyclesUntilClosed === 6) return 6;
  if (cyclesUntilClosed === 3) return 3;
  return 2;
}

/** Round a point to a grid for vertex counting */
function roundPt(x: number, y: number, step: number): string {
  return `${Math.round(x / step)},${Math.round(y / step)}`;
}

export function scanSingle(n: number, angle: number): ScanResult {
  const config: PatternConfig = {
    n,
    factorAngle: angle,
    nonFactorAngle: angle,
    stepLength: 10,
    repetitions: MAX_CYCLES,
    factorTurnsRight: true,
  };

  const result = generatePattern(config);
  const phi = totient(n);
  const factorDensity = result.factorSteps.length / n;

  // Count right vs left turns
  let rightTurns = 0, leftTurns = 0;
  for (const seg of result.segments) {
    if (seg.step === 1 && seg.cycle === 0) continue; // first segment, no turn
    if (seg.isFactor) rightTurns++; else leftTurns++;
  }
  const totalTurns = rightTurns + leftTurns;
  const turnBalance = totalTurns > 0 ? Math.abs(rightTurns - leftTurns) / totalTurns : 0;

  // Bounding box ratio
  const { minX, maxX, minY, maxY } = result.bounds;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const bbRatio = Math.max(w, h) / Math.min(w, h);

  // Unique vertices (approximate)
  const vertexSet = new Set<string>();
  for (const seg of result.segments) {
    vertexSet.add(roundPt(seg.from.x, seg.from.y, 10));
    vertexSet.add(roundPt(seg.to.x, seg.to.y, 10));
  }
  const uniqueVertices = vertexSet.size;

  const rotSym = detectSymmetry(result.closedAfterCycles, angle, n);

  // Complexity score: composite of several signals
  // We want "interesting" = balanced turns + non-trivial symmetry + moderate density
  let score = 0;

  // Balance contribution (0–25): most interesting near 0.5 balance
  const balanceScore = (1 - Math.abs(turnBalance - 0.3)) * 25;
  score += Math.max(0, balanceScore);

  // Symmetry contribution (0–20): higher order = more interesting
  const symScore = Math.min(rotSym, 8) / 8 * 20;
  score += symScore;

  // Density contribution (0–20): most interesting in middle range
  const densScore = (1 - Math.abs(factorDensity - 0.45) * 2) * 20;
  score += Math.max(0, densScore);

  // Cycle count contribution (0–20): 2–6 cycles most interesting
  if (result.isClosed && result.closedAfterCycles) {
    const c = result.closedAfterCycles;
    const cycleScore = c === 1 ? 5 : c <= 4 ? 20 : c <= 8 ? 15 : c <= 12 ? 10 : 5;
    score += cycleScore;
  }

  // Vertex density (0–15): more unique vertices relative to steps = more complex path
  const vertexRatio = uniqueVertices / Math.max(result.totalSteps, 1);
  score += Math.min(vertexRatio * 30, 15);

  score = Math.min(100, Math.max(0, Math.round(score)));

  // Tags
  const tags: StructureTag[] = [];
  if (isPrime(n)) tags.push("prime");
  if (HIGHLY_COMPOSITE.has(n)) tags.push("highly-composite");
  if (PERFECT.has(n)) tags.push("perfect");
  if ((n & (n - 1)) === 0) tags.push("power-of-2");
  if (factorDensity > 0.6) tags.push("dense");
  if (factorDensity < 0.3) tags.push("sparse");
  if (bbRatio < 1.3) tags.push("compact");
  if (bbRatio > 3) tags.push("elongated");
  if (turnBalance < 0.15) tags.push("balanced");
  if (result.closedAfterCycles === 1) tags.push("simple");
  if (result.closedAfterCycles && result.closedAfterCycles > 6) tags.push("complex");
  if (rotSym === 4 || (Math.abs(angle - 90) < 1)) tags.push("square");
  if (rotSym === 6 || (Math.abs(angle - 60) < 1)) tags.push("hexagonal");
  if (rotSym === 3 || (Math.abs(angle - 120) < 1)) tags.push("triangular");
  if (rotSym === 2) tags.push("bilateral");

  return {
    n,
    angle,
    isClosed: result.isClosed,
    cyclesUntilClosed: result.closedAfterCycles,
    complexityScore: score,
    tags: Array.from(new Set(tags)),
    factorDensity,
    turnBalance,
    boundingBoxRatio: bbRatio,
    rotationalSymmetry: rotSym,
    uniqueVertices,
    totalSegments: result.totalSteps,
    phi,
  };
}

export interface ScanConfig {
  nMin: number;
  nMax: number;
  angles: number[];   // list of angles to test
  onlyClosedLoops: boolean;
}

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  nMin: 2,
  nMax: 60,
  angles: [30, 45, 60, 72, 90, 120],
  onlyClosedLoops: true,
};

/**
 * Run a full scan over all (N, angle) combinations.
 * Returns results sorted by complexityScore descending.
 * This is designed to be called in a Web Worker or chunked via setTimeout
 * to avoid blocking the main thread.
 */
export function runScan(
  config: ScanConfig,
  onProgress?: (done: number, total: number) => void
): ScanResult[] {
  const results: ScanResult[] = [];
  const total = (config.nMax - config.nMin + 1) * config.angles.length;
  let done = 0;

  for (let n = config.nMin; n <= config.nMax; n++) {
    for (const angle of config.angles) {
      const r = scanSingle(n, angle);
      if (!config.onlyClosedLoops || r.isClosed) {
        results.push(r);
      }
      done++;
      onProgress?.(done, total);
    }
  }

  return results.sort((a, b) => b.complexityScore - a.complexityScore);
}

/** Canonical angles that tend to produce closed loops */
export const CANONICAL_ANGLES = [15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120];

/**
 * For a given N, find all angles (from CANONICAL_ANGLES) that produce closed loops.
 */
export function findClosedAngles(n: number): { angle: number; cycles: number }[] {
  return CANONICAL_ANGLES
    .map((angle) => scanSingle(n, angle))
    .filter((r) => r.isClosed)
    .map((r) => ({ angle: r.angle, cycles: r.cyclesUntilClosed! }))
    .sort((a, b) => a.cycles - b.cycles);
}
