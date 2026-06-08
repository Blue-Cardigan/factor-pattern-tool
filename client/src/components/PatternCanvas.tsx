/*
 * DESIGN PHILOSOPHY: Dark Generative Art Studio
 * PatternCanvas.tsx — SVG canvas that renders factor-pattern segments
 * Supports one-shot draw animation AND a continuous loop-redraw mode.
 *
 * Loop mode: after each draw completes, a short pause then it redraws.
 * The pattern fades out briefly between cycles for a "breathing" effect.
 */

import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { PatternResult, cycleHue, hslString } from "@/lib/patternEngine";

interface PatternCanvasProps {
  result: PatternResult;
  repetitions: number;
  animating: boolean;
  onAnimationEnd?: () => void;
  colorMode: "hue-cycle" | "factor-highlight" | "monochrome";
  strokeWidth: number;
  showGrid: boolean;
  /** When true, the pattern continuously redraws on a loop */
  loopAnimation?: boolean;
}

const PADDING = 40;
const LOOP_PAUSE_MS = 600; // gap between loop iterations

export default function PatternCanvas({
  result,
  repetitions,
  animating,
  onAnimationEnd,
  colorMode,
  strokeWidth,
  showGrid,
  loopAnimation = false,
}: PatternCanvasProps) {
  const { segments, bounds } = result;
  const animGroupRef = useRef<SVGGElement>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loopPhase, setLoopPhase] = useState<"drawing" | "fading" | "idle">("idle");

  const { viewBox, transform } = useMemo(() => {
    const bw = bounds.maxX - bounds.minX || 1;
    const bh = bounds.maxY - bounds.minY || 1;
    const w = bw + PADDING * 2;
    const h = bh + PADDING * 2;
    const tx = -bounds.minX + PADDING;
    const ty = -bounds.minY + PADDING;
    return { viewBox: `0 0 ${w} ${h}`, transform: `translate(${tx}, ${ty})` };
  }, [bounds]);

  // Group segments by cycle for hue-cycling
  const cycleGroups = useMemo(() => {
    const groups = new Map<number, typeof segments>();
    for (const seg of segments) {
      if (!groups.has(seg.cycle)) groups.set(seg.cycle, []);
      groups.get(seg.cycle)!.push(seg);
    }
    const totalCycles = groups.size;
    const paths: { cycle: number; d: string; color: string }[] = [];
    groups.forEach((segs, cycle) => {
      if (!segs.length) return;
      const pts = [segs[0].from, ...segs.map((s) => s.to)];
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
      let color: string;
      if (colorMode === "hue-cycle") {
        color = hslString(cycleHue(cycle, Math.max(totalCycles, 1)), 80, 62);
      } else if (colorMode === "monochrome") {
        color = "hsl(270, 50%, 70%)";
      } else {
        color = hslString(cycleHue(cycle, Math.max(totalCycles, 1)), 80, 62);
      }
      paths.push({ cycle, d, color });
    });
    return paths;
  }, [segments, colorMode]);

  // Factor-highlight mode: individual line segments
  const factorSegments = useMemo(() => {
    if (colorMode !== "factor-highlight") return null;
    return segments.map((s, i) => ({
      key: i,
      x1: s.from.x, y1: s.from.y,
      x2: s.to.x, y2: s.to.y,
      color: s.isFactor ? "hsl(340, 90%, 65%)" : "hsl(200, 80%, 60%)",
    }));
  }, [segments, colorMode]);

  // Core draw function — animates stroke-dashoffset on all paths/lines
  const runDrawAnimation = useCallback(() => {
    if (!animGroupRef.current) return 0;
    const paths = animGroupRef.current.querySelectorAll<SVGPathElement | SVGLineElement>("path, line");

    paths.forEach((el) => {
      const len = el instanceof SVGPathElement ? el.getTotalLength() : 50;
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
      el.style.transition = "none";
      el.style.opacity = "1";
    });

    // Force reflow
    animGroupRef.current.getBoundingClientRect();

    const duration = Math.min(1800, Math.max(400, segments.length * 0.8));
    paths.forEach((el, i) => {
      const delay = (i / paths.length) * (duration * 0.6);
      el.style.transition = `stroke-dashoffset ${duration * 0.4}ms cubic-bezier(0.23,1,0.32,1) ${delay}ms`;
      el.style.strokeDashoffset = "0";
    });

    return duration;
  }, [segments.length]);

  // Fade out all paths
  const runFadeOut = useCallback(() => {
    if (!animGroupRef.current) return;
    const paths = animGroupRef.current.querySelectorAll<SVGPathElement | SVGLineElement>("path, line");
    paths.forEach((el) => {
      el.style.transition = "opacity 400ms ease-in";
      el.style.opacity = "0";
    });
  }, []);

  // Clear all timers on unmount
  useEffect(() => {
    return () => {
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    };
  }, []);

  // One-shot animation (triggered by parent via animating prop)
  useEffect(() => {
    if (!animating || loopAnimation) return;
    const duration = runDrawAnimation();
    const timer = setTimeout(() => {
      onAnimationEnd?.();
    }, duration * 1.1);
    return () => clearTimeout(timer);
  }, [animating, loopAnimation, segments]);

  // Loop animation — self-sustaining cycle
  useEffect(() => {
    if (!loopAnimation) {
      // When loop is turned off, ensure paths are fully visible
      if (animGroupRef.current) {
        const paths = animGroupRef.current.querySelectorAll<SVGPathElement | SVGLineElement>("path, line");
        paths.forEach((el) => {
          el.style.transition = "none";
          el.style.strokeDasharray = "";
          el.style.strokeDashoffset = "";
          el.style.opacity = "1";
        });
      }
      setLoopPhase("idle");
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
      return;
    }

    // Start the loop
    const startCycle = () => {
      setLoopPhase("drawing");
      const duration = runDrawAnimation();

      loopTimerRef.current = setTimeout(() => {
        // Fade out
        setLoopPhase("fading");
        runFadeOut();

        loopTimerRef.current = setTimeout(() => {
          // Restart
          startCycle();
        }, LOOP_PAUSE_MS);
      }, duration * 1.05);
    };

    startCycle();

    return () => {
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    };
  }, [loopAnimation, segments, runDrawAnimation, runFadeOut]);

  // Grid lines
  const gridLines = useMemo(() => {
    if (!showGrid) return null;
    const lines = [];
    const step = 20;
    const bw = bounds.maxX - bounds.minX + PADDING * 2;
    const bh = bounds.maxY - bounds.minY + PADDING * 2;
    const ox = bounds.minX - PADDING;
    const oy = bounds.minY - PADDING;
    for (let gx = Math.floor(ox / step) * step; gx < ox + bw; gx += step) {
      lines.push(<line key={`vg${gx}`} x1={gx} y1={oy} x2={gx} y2={oy + bh} stroke="oklch(0.3 0.01 265)" strokeWidth="0.5" />);
    }
    for (let gy = Math.floor(oy / step) * step; gy < oy + bh; gy += step) {
      lines.push(<line key={`hg${gy}`} x1={ox} y1={gy} x2={ox + bw} y2={gy} stroke="oklch(0.3 0.01 265)" strokeWidth="0.5" />);
    }
    return lines;
  }, [showGrid, bounds]);

  if (segments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm">
        Enter a number and press Generate
      </div>
    );
  }

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {showGrid && <g transform={transform}>{gridLines}</g>}

      {/* Origin dot */}
      <g transform={transform}>
        <circle cx={0} cy={0} r={3} fill="oklch(0.55 0.22 290)" opacity={0.6} />
      </g>

      {/* Pattern lines */}
      <g ref={animGroupRef} transform={transform}>
        {colorMode === "factor-highlight" && factorSegments
          ? factorSegments.map((s) => (
              <line
                key={s.key}
                x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={s.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 ${strokeWidth * 1.5}px ${s.color}88)` }}
              />
            ))
          : cycleGroups.map(({ cycle, d, color }) => (
              <path
                key={cycle}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 ${strokeWidth * 2}px ${color}66)` }}
              />
            ))}
      </g>
    </svg>
  );
}
