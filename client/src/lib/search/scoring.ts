/*
 * lib/search/scoring.ts — Inverse-design scoring.
 *
 * The user describes a TARGET (desired symmetry, complexity range, tags,
 * elongation, density, closed-only). For every candidate (N, angle) pair we
 * run scanEngine.scanSingle (REUSED — the math lives there, not here) and
 * score the resulting ScanResult against the target.
 *
 * Scoring model
 * -------------
 *  - Hard filters first: closed-only, exact rotational symmetry. A candidate
 *    that fails a hard filter is rejected outright (score = -1, not returned).
 *  - Soft criteria contribute a weighted distance in [0,1] each. The final
 *    score is 100 * (1 - weightedAverageDistance) so higher = better match.
 *  - Tag matches add a bonus proportional to how many desired tags are present.
 */

import type { ScanResult, StructureTag } from "../scanEngine";

/** Rotational symmetry the user wants. "any" = no constraint. */
export type TargetSymmetry = "any" | 2 | 3 | 4 | 6;

export interface SearchTarget {
  /** Desired rotational symmetry order, or "any". Hard filter when not "any". */
  symmetry: TargetSymmetry;
  /** Only consider closed loops. Hard filter. */
  closedOnly: boolean;
  /** Desired complexity window (0–100). */
  complexityMin: number;
  complexityMax: number;
  /** Tags the user wants the result to have (soft bonus, OR-ish). */
  desiredTags: StructureTag[];
  /**
   * Elongation preference, -1 (very compact) .. +1 (very elongated), 0 = no pref.
   * Mapped against boundingBoxRatio.
   */
  elongation: number;
  /** Desired factor-density window (0–1). */
  densityMin: number;
  densityMax: number;
}

export const DEFAULT_TARGET: SearchTarget = {
  symmetry: "any",
  closedOnly: true,
  complexityMin: 40,
  complexityMax: 100,
  desiredTags: [],
  elongation: 0,
  densityMin: 0,
  densityMax: 1,
};

/** A scored candidate ready for the results grid. */
export interface ScoredCandidate {
  result: ScanResult;
  /** 0–100, higher = better match. */
  score: number;
}

/** Distance of x from a [min,max] window, normalised by `scale`. 0 if inside. */
function windowDistance(x: number, min: number, max: number, scale: number): number {
  if (x < min) return Math.min(1, (min - x) / scale);
  if (x > max) return Math.min(1, (x - max) / scale);
  return 0;
}

/**
 * Map boundingBoxRatio (≥1, unbounded) to a 0..1 "elongation" value.
 * ratio 1 → 0 (perfectly compact); ratio 4+ → ~1 (very elongated).
 */
function elongationOf(ratio: number): number {
  return Math.min(1, (ratio - 1) / 3);
}

/**
 * Score a single ScanResult against the target.
 * Returns -1 if the candidate fails a hard filter (caller should drop it).
 */
export function scoreCandidate(r: ScanResult, t: SearchTarget): number {
  // --- Hard filters ---
  if (t.closedOnly && !r.isClosed) return -1;
  if (t.symmetry !== "any" && r.rotationalSymmetry !== t.symmetry) return -1;

  // --- Soft weighted distances (each 0..1, lower = closer) ---
  const terms: { dist: number; weight: number }[] = [];

  // Complexity window
  terms.push({
    dist: windowDistance(r.complexityScore, t.complexityMin, t.complexityMax, 50),
    weight: 1.0,
  });

  // Factor-density window
  terms.push({
    dist: windowDistance(r.factorDensity, t.densityMin, t.densityMax, 0.5),
    weight: 0.8,
  });

  // Elongation preference (only when user expressed one)
  if (Math.abs(t.elongation) > 0.01) {
    const target = (t.elongation + 1) / 2; // -1..1 → 0..1
    const actual = elongationOf(r.boundingBoxRatio);
    terms.push({ dist: Math.abs(actual - target), weight: 0.9 });
  }

  // Desired tags — soft. Fraction of wanted tags that are MISSING = distance.
  if (t.desiredTags.length > 0) {
    const have = new Set(r.tags);
    const missing = t.desiredTags.filter((tag) => !have.has(tag)).length;
    terms.push({ dist: missing / t.desiredTags.length, weight: 1.2 });
  }

  const totalWeight = terms.reduce((s, x) => s + x.weight, 0) || 1;
  const weightedDist = terms.reduce((s, x) => s + x.dist * x.weight, 0) / totalWeight;

  let score = 100 * (1 - weightedDist);

  // Small bonus for extra desired tags present beyond the minimum, to break ties.
  if (t.desiredTags.length > 0) {
    const have = new Set(r.tags);
    const present = t.desiredTags.filter((tag) => have.has(tag)).length;
    score += (present / t.desiredTags.length) * 4;
  }

  return Math.max(0, Math.min(100, score));
}
