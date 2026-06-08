/*
 * lib/search/runSearch.ts — Chunked, non-blocking inverse-design search.
 *
 * Walks the search space (N range × angle set), calls scanSingle (REUSED) on
 * each candidate, scores it against the target, and keeps the top-K matches.
 *
 * The work is chunked with `await yieldToBrowser()` between batches so the main
 * thread stays responsive while scanning a few thousand candidates. Progress is
 * reported via the onProgress callback. An AbortSignal cancels mid-flight.
 */

import { scanSingleRule, CANONICAL_ANGLES } from "../scanEngine";
import { DEFAULT_RULESET_ID } from "../core/rulesets";
import { scoreCandidate, type SearchTarget, type ScoredCandidate } from "./scoring";

export interface SearchSpace {
  /** Ruleset to search over (defaults to the classic factor rule). */
  rulesetId: string;
  nMin: number;
  nMax: number;
  /** Angle set to test. Defaults to CANONICAL_ANGLES; "fine" adds more. */
  angles: number[];
}

export const DEFAULT_SPACE: SearchSpace = {
  rulesetId: DEFAULT_RULESET_ID,
  nMin: 4,
  nMax: 120,
  angles: CANONICAL_ANGLES,
};

/** A denser angle set for finer searches (still all integer-degree). */
export const FINE_ANGLES = [
  10, 15, 18, 20, 24, 30, 36, 40, 45, 51, 60, 72, 80, 90, 108, 120, 135, 144,
];

export interface SearchProgress {
  scanned: number;
  total: number;
  matches: number;
}

export interface SearchResult {
  candidates: ScoredCandidate[];
  scanned: number;
  total: number;
  /** Candidates that passed hard filters (before top-K truncation). */
  matched: number;
}

/** Yield to the browser so it can paint / handle input between chunks. */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
      .requestIdleCallback;
    if (ric) ric(() => resolve());
    else setTimeout(resolve, 0);
  });
}

export async function runSearch(
  target: SearchTarget,
  space: SearchSpace,
  opts: {
    topK?: number;
    chunkSize?: number;
    onProgress?: (p: SearchProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<SearchResult> {
  const topK = opts.topK ?? 48;
  const chunkSize = opts.chunkSize ?? 200;

  const rulesetId = space.rulesetId ?? DEFAULT_RULESET_ID;
  const ns: number[] = [];
  for (let n = space.nMin; n <= space.nMax; n++) ns.push(n);
  const total = ns.length * space.angles.length;

  const kept: ScoredCandidate[] = [];
  let scanned = 0;
  let matched = 0;
  let sinceYield = 0;

  for (const n of ns) {
    for (const angle of space.angles) {
      if (opts.signal?.aborted) {
        throw new DOMException("Search aborted", "AbortError");
      }
      const result = scanSingleRule(rulesetId, n, angle);
      const score = scoreCandidate(result, target);
      scanned++;
      if (score >= 0) {
        matched++;
        kept.push({ result, score });
      }
      sinceYield++;
      if (sinceYield >= chunkSize) {
        sinceYield = 0;
        opts.onProgress?.({ scanned, total, matches: matched });
        await yieldToBrowser();
      }
    }
  }

  opts.onProgress?.({ scanned, total, matches: matched });

  kept.sort((a, b) => b.score - a.score || b.result.complexityScore - a.result.complexityScore);

  return {
    candidates: kept.slice(0, topK),
    scanned,
    total,
    matched,
  };
}
