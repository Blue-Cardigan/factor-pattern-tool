/*
 * DESIGN PHILOSOPHY: Dark Generative Art Studio
 * MiniPattern.tsx — Tiny inline SVG preview of a factor pattern
 * Used in the Explorer grid cells. Renders synchronously from a ScanResult.
 */

import React, { useMemo } from "react";
import { cycleHue, hslString } from "@/lib/patternEngine";
import { ScanResult, renderScanPattern } from "@/lib/scanEngine";

interface MiniPatternProps {
  result: ScanResult;
  size?: number;          // pixel size of the square thumbnail
  selected?: boolean;
  colorMode?: "hue-cycle" | "monochrome";
}

const PADDING = 4;

export default function MiniPattern({
  result,
  size = 72,
  selected = false,
  colorMode = "hue-cycle",
}: MiniPatternProps) {
  const patternResult = useMemo(
    () =>
      renderScanPattern(
        result.rulesetId,
        result.n,
        result.angle,
        Math.min((result.cyclesUntilClosed ?? 4) + 1, 12)
      ),
    [result.rulesetId, result.n, result.angle, result.cyclesUntilClosed]
  );

  const { viewBox, transform } = useMemo(() => {
    const { minX, maxX, minY, maxY } = patternResult.bounds;
    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const w = bw + PADDING * 2;
    const h = bh + PADDING * 2;
    const tx = -minX + PADDING;
    const ty = -minY + PADDING;
    return {
      viewBox: `0 0 ${w} ${h}`,
      transform: `translate(${tx}, ${ty})`,
    };
  }, [patternResult.bounds]);

  // Group segments by cycle for hue-cycling
  const cyclePaths = useMemo(() => {
    const groups = new Map<number, typeof patternResult.segments>();
    for (const seg of patternResult.segments) {
      if (!groups.has(seg.cycle)) groups.set(seg.cycle, []);
      groups.get(seg.cycle)!.push(seg);
    }
    const totalCycles = groups.size;
    const paths: { cycle: number; d: string; color: string }[] = [];
    groups.forEach((segs, cycle) => {
      if (!segs.length) return;
      const pts = [segs[0].from, ...segs.map((s) => s.to)];
      const d = pts
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");
      const color =
        colorMode === "hue-cycle"
          ? hslString(cycleHue(cycle, Math.max(totalCycles, 1)), 75, 62)
          : "hsl(270, 50%, 70%)";
      paths.push({ cycle, d, color });
    });
    return paths;
  }, [patternResult.segments, colorMode]);

  const strokeW = Math.max(0.8, size / 80);

  return (
    <div
      style={{
        width: size,
        height: size,
        background: selected ? "oklch(0.16 0.015 265)" : "oklch(0.10 0.01 265)",
        border: selected
          ? "1.5px solid oklch(0.62 0.2 200)"
          : "1px solid oklch(0.22 0.01 265)",
        borderRadius: 6,
        overflow: "hidden",
        flexShrink: 0,
        transition: "border-color 120ms ease-out, background 120ms ease-out",
        boxShadow: selected ? "0 0 0 2px oklch(0.62 0.2 200 / 0.4)" : undefined,
      }}
    >
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform={transform}>
          {cyclePaths.map(({ cycle, d, color }) => (
            <path
              key={cycle}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
