/*
 * features/search/Thumbnail.tsx — Mini SVG preview of a candidate (N, angle).
 *
 * Renders the pattern via generatePattern (REUSED) and fits it to the viewBox
 * using the computed bounds, with hue-cycling per repetition cycle to match the
 * Canvas aesthetic.
 */

import { useMemo } from "react";
import { cycleHue, hslString } from "@/lib/patternEngine";
import { renderScanPattern } from "@/lib/scanEngine";
import { DEFAULT_RULESET_ID } from "@/lib/core/rulesets";

interface ThumbnailProps {
  n: number;
  angle: number;
  /** Which ruleset to render (defaults to the classic factor rule). */
  rulesetId?: string;
  /** Display size in px (square). */
  size?: number;
  className?: string;
}

const PREVIEW_REPS = 12;

export default function Thumbnail({
  n,
  angle,
  rulesetId = DEFAULT_RULESET_ID,
  size = 132,
  className,
}: ThumbnailProps) {
  const { path, viewBox, cycles } = useMemo(() => {
    const result = renderScanPattern(rulesetId, n, angle, PREVIEW_REPS);
    const { minX, maxX, minY, maxY } = result.bounds;
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    const pad = Math.max(w, h) * 0.06 + 2;
    const vb = `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`;

    // Group segments by cycle so each cycle gets its own hue.
    const totalCycles = result.closedAfterCycles ?? PREVIEW_REPS;
    const byCycle = new Map<number, string[]>();
    for (const seg of result.segments) {
      if (result.closedAfterCycles && seg.cycle >= result.closedAfterCycles) continue;
      const arr = byCycle.get(seg.cycle) ?? [];
      if (arr.length === 0) arr.push(`M ${seg.from.x} ${seg.from.y}`);
      arr.push(`L ${seg.to.x} ${seg.to.y}`);
      byCycle.set(seg.cycle, arr);
    }
    const paths = Array.from(byCycle.entries()).map(([cycle, cmds]) => ({
      d: cmds.join(" "),
      color: hslString(cycleHue(cycle, Math.max(totalCycles, 1)), 75, 62),
    }));
    return { path: paths, viewBox: vb, cycles: totalCycles };
  }, [rulesetId, n, angle]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={className}
      role="img"
      aria-label={`Pattern N=${n} angle=${angle} (${cycles} cycles)`}
    >
      {path.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke={p.color}
          strokeWidth={Math.max(1, 0.9)}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
