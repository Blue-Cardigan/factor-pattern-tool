/*
 * DESIGN PHILOSOPHY: Dark Generative Art Studio
 * Home.tsx — Full-viewport layout: left sidebar controls + right SVG canvas
 * Accepts externalConfig prop so Explorer can push patterns into the canvas
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { PatternConfig, PatternResult, generatePattern, DEFAULT_CONFIG } from "@/lib/patternEngine";
import PatternCanvas from "@/components/PatternCanvas";
import ControlPanel from "@/components/ControlPanel";
import { toast } from "sonner";
import type { CanvasPreset } from "@/features/types";
import { presetToPatternConfig } from "@/features/registry";

interface HomeProps {
  externalPreset?: CanvasPreset | null;
  onExternalConfigApplied?: () => void;
}

export default function Home({ externalPreset, onExternalConfigApplied }: HomeProps) {
  const [config, setConfig] = useState<PatternConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<PatternResult>(() => generatePattern(DEFAULT_CONFIG));
  const [colorMode, setColorMode] = useState<"hue-cycle" | "factor-highlight" | "monochrome">("hue-cycle");
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const [showGrid, setShowGrid] = useState(false);
  const [loopAnimation, setLoopAnimation] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Apply external preset when pushed from another mode
  useEffect(() => {
    if (!externalPreset) return;
    const newConfig = { ...config, ...presetToPatternConfig(externalPreset) };
    setConfig(newConfig);
    const r = generatePattern(newConfig);
    setResult(r);
    setIsAnimating(true);
    setAnimKey((k) => k + 1);
    onExternalConfigApplied?.();
    if (r.isClosed) {
      toast.success(
        `Loaded — closes after ${r.closedAfterCycles} cycle${r.closedAfterCycles === 1 ? "" : "s"}.`,
        { duration: 3000 }
      );
    }
  }, [externalPreset]);

  const handleConfigChange = useCallback((patch: Partial<PatternConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleGenerate = useCallback(() => {
    const newResult = generatePattern(config);
    setResult(newResult);
    setIsAnimating(true);
    setAnimKey((k) => k + 1);

    if (newResult.isClosed) {
      toast.success(
        `Closed loop! Returns to start after ${newResult.closedAfterCycles} cycle${newResult.closedAfterCycles === 1 ? "" : "s"}.`,
        { duration: 3000 }
      );
    }
  }, [config]);

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    const r = generatePattern(DEFAULT_CONFIG);
    setResult(r);
    setIsAnimating(true);
    setAnimKey((k) => k + 1);
    toast.info("Reset to default (N=15)");
  }, []);

  const handleApplyPreset = useCallback((patch: Partial<PatternConfig>) => {
    const newConfig = { ...config, ...patch };
    setConfig(newConfig);
    const r = generatePattern(newConfig);
    setResult(r);
    setIsAnimating(true);
    setAnimKey((k) => k + 1);
  }, [config]);

  const handleExport = useCallback(() => {
    const svgEl = svgContainerRef.current?.querySelector("svg");
    if (!svgEl) return;

    const clone = svgEl.cloneNode(true) as SVGElement;
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "#000000");
    clone.insertBefore(bg, clone.firstChild);

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `factor-pattern-${config.n}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("SVG exported!");
  }, [config.n]);

  // Auto-generate on mount
  useEffect(() => {
    setIsAnimating(true);
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Left sidebar */}
      <ControlPanel
        config={config}
        onChange={handleConfigChange}
        onGenerate={handleGenerate}
        onReset={handleReset}
        onExport={handleExport}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        showGrid={showGrid}
        onShowGridChange={setShowGrid}
        loopAnimation={loopAnimation}
        onLoopAnimationChange={setLoopAnimation}
        factors={result.factors}
        factorSteps={result.factorSteps}
        isClosed={result.isClosed}
        closedAfterCycles={result.closedAfterCycles}
        isAnimating={isAnimating}
        onApplyPreset={handleApplyPreset}
      />

      {/* Canvas area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-black relative">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-black/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">
              N = <span className="text-primary font-semibold">{config.n}</span>
            </span>
            <span className="text-border">|</span>
            <span className="font-mono text-xs text-muted-foreground">
              {result.totalSteps.toLocaleString()} segments
            </span>
            <span className="text-border">|</span>
            <span className="font-mono text-xs text-muted-foreground">
              {config.repetitions} repetition{config.repetitions !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {result.isClosed && (
              <span className="font-mono text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                ✓ closed loop
              </span>
            )}
            {!result.isClosed && result.totalSteps > 0 && (
              <span className="font-mono text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20">
                open path
              </span>
            )}
          </div>
        </div>

        {/* SVG canvas */}
        <div
          ref={svgContainerRef}
          className="flex-1 flex items-center justify-center overflow-hidden p-4"
          style={{ background: "radial-gradient(ellipse at center, #0a0a0f 0%, #000000 100%)" }}
        >
          <PatternCanvas
            key={animKey}
            result={result}
            repetitions={config.repetitions}
            animating={isAnimating}
            onAnimationEnd={() => setIsAnimating(false)}
            colorMode={colorMode}
            strokeWidth={strokeWidth}
            showGrid={showGrid}
            loopAnimation={loopAnimation}
          />
        </div>

        {/* Bottom legend */}
        <div className="px-5 py-2 border-t border-border/50 bg-black/60 flex items-center gap-6 text-xs font-mono text-muted-foreground">
          {colorMode === "factor-highlight" ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ background: "hsl(340,90%,65%)" }} />
                factor turn (right)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ background: "hsl(200,80%,60%)" }} />
                non-factor turn (left)
              </span>
            </>
          ) : (
            <span>
              Each colour = one repetition cycle · turn-right steps for {config.n}:{" "}
              <span className="text-primary">{result.factorSteps.join(", ")}</span>
            </span>
          )}
        </div>
      </main>
    </div>
  );
}
