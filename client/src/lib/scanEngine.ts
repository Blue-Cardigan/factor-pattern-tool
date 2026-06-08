/*
 * scanEngine.ts — Systematic closed-loop scanner and complexity grader.
 *
 * Generalised over rulesets: any registered Ruleset (classic, number-theory,
 * Gaussian, formula, continuous) is run through the core turtle and graded with
 * the SAME geometric metrics, so Gallery and Find work for every rule — not just
 * the classic factor rule.
 *
 * Complexity grading combines:
 *   1. cyclesUntilClosed   — fewer cycles = simpler symmetry
 *   2. classDensity        — fraction of steps in a non-base turn class (0..1)
 *   3. boundingBoxRatio    — max(w,h)/min(w,h)  (≥1): 1 = square, large = elongated
 *   4. turnBalance         — |right − left| / total turns (0 = balanced)
 *   5. uniqueVertices      — distinct grid points visited (path complexity proxy)
 *   6. rotationalSymmetry  — derived from net turn per cycle (ruleset-agnostic)
 *
 * complexityScore ∈ [0, 100] — higher = structurally richer.
 */

import { getRuleset, DEFAULT_RULESET_ID } from "./core/rulesets";
import { defaultParams } from "./core/types";
import { runTurtle2D, Segment } from "./core/turtle";
import { gcd, isPrime as ntIsPrime, phi as eulerPhi, divisors } from "./core/numberTheory";

export interface ScanResult {
  rulesetId: string;
  n: number;
  angle: number;          // both angle knobs (symmetric scan: angleA === angleB)
  isClosed: boolean;
  cyclesUntilClosed: number | null;
  complexityScore: number;   // 0–100
  tags: StructureTag[];
  factorDensity: number;     // 0–1 (fraction of steps in a non-base turn class)
  turnBalance: number;       // 0–1 (0 = balanced)
  boundingBoxRatio: number;  // ≥1
  rotationalSymmetry: number; // detected order (1 = none, 2, 3, 4, 6…)
  uniqueVertices: number;
  totalSegments: number;
  phi: number;               // Euler's totient φ(N)
}

export type StructureTag =
  | "square"        // 4-fold symmetry
  | "hexagonal"     // 6-fold symmetry
  | "triangular"    // 3-fold symmetry
  | "bilateral"     // 2-fold symmetry
  | "balanced"      // near-equal left/right turns
  | "dense"         // high turn-class density (>0.6)
  | "sparse"        // low turn-class density (<0.3)
  | "compact"       // bounding box ratio < 1.3
  | "elongated"     // bounding box ratio > 3
  | "prime"         // N is prime
  | "highly-composite" // N has unusually many divisors
  | "perfect"       // N is a perfect number (6, 28, 496…)
  | "power-of-2"    // N = 2^k
  | "simple"        // closes in 1 cycle
  | "complex";      // closes in >6 cycles

const MAX_CYCLES = 20;
const STEP = 10;

const HIGHLY_COMPOSITE = new Set([1,2,4,6,12,24,36,48,60,120,180,240,360,720,840,1260,1680,2520]);
const PERFECT = new Set([6, 28, 496, 8128]);

/** Round a point to a grid for vertex counting. */
function roundPt(x: number, y: number, step: number): string {
  return `${Math.round(x / step)},${Math.round(y / step)}`;
}

/**
 * Rotational symmetry order from the net turn accumulated over ONE cycle.
 * If each cycle re-orients the figure by `netTurn` degrees, the smallest k with
 * k·netTurn ≡ 0 (mod 360) is 360/gcd(360, netTurn) — that's the rotational order.
 * Net turn ≈ 0 means the cycle is a pure translation (no rotational symmetry).
 */
function symmetryFromNetTurn(netTurnDeg: number, cyclesUntilClosed: number | null): number {
  const net = (((Math.round(netTurnDeg) % 360) + 360) % 360);
  if (net === 0) return 1;
  const order = 360 / gcd(360, net);
  if (order >= 2 && order <= 12) return order;
  // Fall back to the cycle count if it lands on a clean low order.
  if (cyclesUntilClosed && cyclesUntilClosed >= 2 && cyclesUntilClosed <= 12) {
    return cyclesUntilClosed;
  }
  return 1;
}

/** Render a ruleset's closed-loop segments — shared by the thumbnail previews. */
export function renderScanPattern(
  rulesetId: string,
  n: number,
  angle: number,
  repetitions: number
): {
  segments: Segment[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  isClosed: boolean;
  closedAfterCycles: number | null;
} {
  const rule = getRuleset(rulesetId) ?? getRuleset(DEFAULT_RULESET_ID)!;
  const params = defaultParams(rule, n);
  params.angleA = angle;
  params.angleB = angle;
  params.factorTurnsRight = true;
  const steps = rule.generate(params);
  const turtle = runTurtle2D({ steps, stepLength: STEP, repetitions });
  return {
    segments: turtle.segments,
    bounds: turtle.bounds,
    isClosed: turtle.isClosed,
    closedAfterCycles: turtle.closedAfterCycles,
  };
}

/** Analyse a single (ruleset, N, angle) candidate. */
export function scanSingleRule(rulesetId: string, n: number, angle: number): ScanResult {
  const rule = getRuleset(rulesetId) ?? getRuleset(DEFAULT_RULESET_ID)!;
  const params = defaultParams(rule, n);
  params.angleA = angle;
  params.angleB = angle;
  params.factorTurnsRight = true;

  const steps = rule.generate(params);
  const turtle = runTurtle2D({ steps, stepLength: STEP, repetitions: MAX_CYCLES });

  const phi = eulerPhi(n);

  // Turn-class density: fraction of steps in a non-base class (klass > 0).
  const classPos = steps.reduce((acc, s) => acc + (s.klass > 0 ? 1 : 0), 0);
  const factorDensity = steps.length > 0 ? classPos / steps.length : 0;

  // Turn balance from actual yaw signs (works for any ruleset).
  let right = 0, left = 0, netTurn = 0;
  for (const s of steps) {
    netTurn += s.yaw;
    if (s.yaw > 0) right++;
    else if (s.yaw < 0) left++;
  }
  const totalTurns = right + left;
  const turnBalance = totalTurns > 0 ? Math.abs(right - left) / totalTurns : 0;

  // Bounding box ratio.
  const { minX, maxX, minY, maxY } = turtle.bounds;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const bbRatio = Math.max(w, h) / Math.min(w, h);

  // Unique vertices (approximate, on a grid).
  const vertexSet = new Set<string>();
  for (const seg of turtle.segments) {
    vertexSet.add(roundPt(seg.from.x, seg.from.y, STEP));
    vertexSet.add(roundPt(seg.to.x, seg.to.y, STEP));
  }
  const uniqueVertices = vertexSet.size;

  const rotSym = symmetryFromNetTurn(netTurn, turtle.closedAfterCycles);

  // Composite complexity score.
  let score = 0;
  score += Math.max(0, (1 - Math.abs(turnBalance - 0.3)) * 25);     // balance (0–25)
  score += Math.min(rotSym, 8) / 8 * 20;                            // symmetry (0–20)
  score += Math.max(0, (1 - Math.abs(factorDensity - 0.45) * 2) * 20); // density (0–20)
  if (turtle.isClosed && turtle.closedAfterCycles) {                // cycles (0–20)
    const c = turtle.closedAfterCycles;
    score += c === 1 ? 5 : c <= 4 ? 20 : c <= 8 ? 15 : c <= 12 ? 10 : 5;
  }
  const vertexRatio = uniqueVertices / Math.max(turtle.totalSteps, 1);
  score += Math.min(vertexRatio * 30, 15);                          // vertex density (0–15)
  score = Math.min(100, Math.max(0, Math.round(score)));

  // Tags — N-based (describe the number) + geometric (describe the figure).
  const tags: StructureTag[] = [];
  if (ntIsPrime(n)) tags.push("prime");
  if (HIGHLY_COMPOSITE.has(n)) tags.push("highly-composite");
  if (PERFECT.has(n)) tags.push("perfect");
  if (n > 1 && (n & (n - 1)) === 0) tags.push("power-of-2");
  if (factorDensity > 0.6) tags.push("dense");
  if (factorDensity < 0.3) tags.push("sparse");
  if (bbRatio < 1.3) tags.push("compact");
  if (bbRatio > 3) tags.push("elongated");
  if (turnBalance < 0.15) tags.push("balanced");
  if (turtle.closedAfterCycles === 1) tags.push("simple");
  if (turtle.closedAfterCycles && turtle.closedAfterCycles > 6) tags.push("complex");
  if (rotSym === 4) tags.push("square");
  if (rotSym === 6) tags.push("hexagonal");
  if (rotSym === 3) tags.push("triangular");
  if (rotSym === 2) tags.push("bilateral");

  return {
    rulesetId: rule.id,
    n,
    angle,
    isClosed: turtle.isClosed,
    cyclesUntilClosed: turtle.closedAfterCycles,
    complexityScore: score,
    tags: Array.from(new Set(tags)),
    factorDensity,
    turnBalance,
    boundingBoxRatio: bbRatio,
    rotationalSymmetry: rotSym,
    uniqueVertices,
    totalSegments: turtle.totalSteps,
    phi,
  };
}

/** Backward-compatible classic-rule scan. */
export function scanSingle(n: number, angle: number): ScanResult {
  return scanSingleRule(DEFAULT_RULESET_ID, n, angle);
}

export interface ScanConfig {
  rulesetId: string;
  nMin: number;
  nMax: number;
  angles: number[];   // list of angles to test
  onlyClosedLoops: boolean;
}

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  rulesetId: DEFAULT_RULESET_ID,
  nMin: 2,
  nMax: 60,
  angles: [30, 45, 60, 72, 90, 120],
  onlyClosedLoops: true,
};

/**
 * Run a full scan over all (N, angle) combinations for the config's ruleset.
 * Returns results sorted by complexityScore descending. Intended to be chunked
 * by the caller to avoid blocking the main thread.
 */
export function runScan(
  config: ScanConfig,
  onProgress?: (done: number, total: number) => void
): ScanResult[] {
  const results: ScanResult[] = [];
  const rulesetId = config.rulesetId ?? DEFAULT_RULESET_ID;
  const total = (config.nMax - config.nMin + 1) * config.angles.length;
  let done = 0;

  for (let n = config.nMin; n <= config.nMax; n++) {
    for (const angle of config.angles) {
      const r = scanSingleRule(rulesetId, n, angle);
      if (!config.onlyClosedLoops || r.isClosed) {
        results.push(r);
      }
      done++;
      onProgress?.(done, total);
    }
  }

  return results.sort((a, b) => b.complexityScore - a.complexityScore);
}

/** Canonical angles that tend to produce closed loops. */
export const CANONICAL_ANGLES = [15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120];

/** For a given N (and ruleset), angles that produce closed loops. */
export function findClosedAngles(
  n: number,
  rulesetId: string = DEFAULT_RULESET_ID
): { angle: number; cycles: number }[] {
  return CANONICAL_ANGLES
    .map((angle) => scanSingleRule(rulesetId, n, angle))
    .filter((r) => r.isClosed)
    .map((r) => ({ angle: r.angle, cycles: r.cyclesUntilClosed! }))
    .sort((a, b) => a.cycles - b.cycles);
}
