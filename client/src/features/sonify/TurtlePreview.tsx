/*
 * features/sonify/TurtlePreview.tsx — Mini turtle path, lit up to the current
 * step so you can watch the geometry being drawn as the melody plays.
 */

import { useMemo } from "react";
import { runTurtle2D } from "@/lib/core/turtle";
import type { StepInstruction } from "@/lib/core/types";

interface Props {
  steps: StepInstruction[];
  currentIndex: number;
}

export default function TurtlePreview({ steps, currentIndex }: Props) {
  const result = useMemo(
    () => runTurtle2D({ steps, stepLength: 10, repetitions: 1 }),
    [steps],
  );

  const { segments, bounds } = result;
  const w = Math.max(1e-3, bounds.maxX - bounds.minX);
  const h = Math.max(1e-3, bounds.maxY - bounds.minY);
  const pad = Math.max(w, h) * 0.08 + 2;
  const vb = `${bounds.minX - pad} ${bounds.minY - pad} ${w + pad * 2} ${h + pad * 2}`;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-violet-500/20 bg-black/40">
      <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        {segments.map((seg, i) => {
          const drawn = i <= currentIndex || currentIndex < 0;
          const isHead = i === currentIndex;
          return (
            <line
              key={i}
              x1={seg.from.x}
              y1={seg.from.y}
              x2={seg.to.x}
              y2={seg.to.y}
              stroke={isHead ? "hsl(48,100%,62%)" : drawn ? "hsl(265,80%,68%)" : "hsl(265,30%,30%)"}
              strokeWidth={isHead ? 2.4 : 1.4}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity={drawn ? 1 : 0.35}
            />
          );
        })}
      </svg>
    </div>
  );
}
