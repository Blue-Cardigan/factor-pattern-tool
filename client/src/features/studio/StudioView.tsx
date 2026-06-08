/*
 * features/studio/StudioView.tsx — the Canvas mode, now ruleset-driven.
 *
 * Generation flows through the core seam: getRuleset(id).generate(params) -> a
 * StepInstruction[] -> runTurtle2D -> segments, which we adapt to the shape the
 * existing PatternCanvas renderer expects. RulePicker (built alongside the
 * rulesets) supplies the rule + n + angle + knob + formula controls; this view
 * adds the render/display controls, factor analysis, presets and SVG export.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Play, RotateCcw, Download } from "lucide-react";

import RulePicker from "./RulePicker";
import PatternCanvas from "@/components/PatternCanvas";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { getRuleset, DEFAULT_RULESET_ID } from "@/lib/core/rulesets";
import { defaultParams, type RulesetParams } from "@/lib/core/types";
import { runTurtle2D } from "@/lib/core/turtle";
import { divisors, gcd } from "@/lib/core/numberTheory";
import type { PatternResult } from "@/lib/patternEngine";
import type { CanvasPreset } from "@/features/types";

interface StudioViewProps {
  externalPreset?: CanvasPreset | null;
  onExternalConfigApplied?: () => void;
}

type ColorMode = "hue-cycle" | "factor-highlight" | "monochrome";

const OUTFIT = { fontFamily: "'Outfit', sans-serif" } as const;

function initialParams(): RulesetParams {
  const rule = getRuleset(DEFAULT_RULESET_ID)!;
  return { ...defaultParams(rule, 15), angleA: 90, angleB: 90 };
}

/** Build a params object for a preset coming from another mode. */
function presetToParams(preset: CanvasPreset): { rulesetId: string; params: RulesetParams } {
  const id = preset.rulesetId && getRuleset(preset.rulesetId) ? preset.rulesetId : DEFAULT_RULESET_ID;
  const rule = getRuleset(id)!;
  const params: RulesetParams = defaultParams(rule, preset.n ?? 15);
  if (preset.angleA !== undefined) params.angleA = preset.angleA;
  if (preset.angleB !== undefined) params.angleB = preset.angleB;
  if (preset.factorTurnsRight !== undefined) params.factorTurnsRight = preset.factorTurnsRight;
  if (preset.knobs) for (const [k, v] of Object.entries(preset.knobs)) params[k] = v;
  return { rulesetId: id, params };
}

/** Adapt a core TurtleResult into the PatternResult shape PatternCanvas reads. */
function toPatternResult(
  rulesetId: string,
  params: RulesetParams,
  stepLength: number,
  repetitions: number
): PatternResult {
  const rule = getRuleset(rulesetId) ?? getRuleset(DEFAULT_RULESET_ID)!;
  const steps = rule.generate(params);
  const turtle = runTurtle2D({ steps, stepLength, repetitions });
  const n = params.n;
  const factorSteps: number[] = [];
  for (let i = 2; i <= n; i++) if (gcd(i, n) > 1) factorSteps.push(i);
  return {
    segments: turtle.segments.map((s) => ({
      from: s.from,
      to: s.to,
      cycle: s.cycle,
      step: s.step,
      isFactor: s.klass > 0,
    })),
    factors: divisors(n),
    factorSteps,
    isClosed: turtle.isClosed,
    closedAfterCycles: turtle.closedAfterCycles,
    bounds: turtle.bounds,
    totalSteps: turtle.totalSteps,
  };
}

const COLOR_MODES: { id: ColorMode; label: string }[] = [
  { id: "hue-cycle", label: "Hue Cycle" },
  { id: "factor-highlight", label: "Factor Highlight" },
  { id: "monochrome", label: "Monochrome" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2 mt-5 first:mt-0">
      {children}
    </div>
  );
}

export default function StudioView({ externalPreset, onExternalConfigApplied }: StudioViewProps) {
  const [rulesetId, setRulesetId] = useState<string>(DEFAULT_RULESET_ID);
  const [params, setParams] = useState<RulesetParams>(initialParams);
  const [stepLength, setStepLength] = useState(10);
  const [repetitions, setRepetitions] = useState(8);

  const [colorMode, setColorMode] = useState<ColorMode>("hue-cycle");
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const [showGrid, setShowGrid] = useState(false);
  const [loopAnimation, setLoopAnimation] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  const [animKey, setAnimKey] = useState(0);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const result = useMemo(
    () => toPatternResult(rulesetId, params, stepLength, repetitions),
    [rulesetId, params, stepLength, repetitions]
  );

  const reAnimate = useCallback(() => {
    setIsAnimating(true);
    setAnimKey((k) => k + 1);
  }, []);

  // Apply a preset pushed from another mode.
  useEffect(() => {
    if (!externalPreset) return;
    const { rulesetId: id, params: p } = presetToParams(externalPreset);
    setRulesetId(id);
    setParams(p);
    if (externalPreset.stepLength !== undefined) setStepLength(externalPreset.stepLength);
    if (externalPreset.repetitions !== undefined) setRepetitions(externalPreset.repetitions);
    reAnimate();
    onExternalConfigApplied?.();
    const r = toPatternResult(id, p, externalPreset.stepLength ?? stepLength, externalPreset.repetitions ?? repetitions);
    if (r.isClosed) {
      toast.success(`Loaded — closes after ${r.closedAfterCycles} cycle${r.closedAfterCycles === 1 ? "" : "s"}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPreset]);

  const handleRuleChange = useCallback((id: string, next: RulesetParams) => {
    setRulesetId(id);
    setParams(next);
  }, []);

  const handleGenerate = useCallback(() => {
    reAnimate();
    if (result.isClosed) {
      toast.success(
        `Closed loop! Returns to start after ${result.closedAfterCycles} cycle${result.closedAfterCycles === 1 ? "" : "s"}.`
      );
    }
  }, [reAnimate, result.isClosed, result.closedAfterCycles]);

  const handleReset = useCallback(() => {
    setRulesetId(DEFAULT_RULESET_ID);
    setParams(initialParams());
    setStepLength(10);
    setRepetitions(8);
    reAnimate();
    toast.info("Reset to default (Classic, N=15)");
  }, [reAnimate]);

  const handleExport = useCallback(() => {
    const svgEl = svgContainerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGElement;
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "#000000");
    clone.insertBefore(bg, clone.firstChild);
    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `factor-pattern-${rulesetId}-${params.n}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("SVG exported!");
  }, [rulesetId, params.n]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Left sidebar */}
      <aside className="w-80 shrink-0 h-full flex flex-col bg-card border-r border-border overflow-y-auto">
        <div className="px-5 py-4 border-b border-border">
          <h1 className="text-lg font-bold tracking-tight" style={OUTFIT}>
            Canvas
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            Pick a rule, tune it, watch it draw.
          </p>
        </div>

        <div className="px-5 py-4 flex-1">
          <RulePicker rulesetId={rulesetId} params={params} onChange={handleRuleChange} />

          <SectionLabel>Geometry</SectionLabel>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-medium text-foreground/80">Repetitions</Label>
              <span className="font-mono text-xs text-primary">{repetitions}</span>
            </div>
            <Slider min={1} max={32} step={1} value={[repetitions]} onValueChange={([v]) => setRepetitions(v)} />
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-medium text-foreground/80">Step length</Label>
              <span className="font-mono text-xs text-primary">{stepLength}px</span>
            </div>
            <Slider min={2} max={40} step={1} value={[stepLength]} onValueChange={([v]) => setStepLength(v)} />
          </div>

          <SectionLabel>Display</SectionLabel>
          <div className="mb-3">
            <Label className="text-sm font-medium text-foreground/80 mb-2 block">Colour mode</Label>
            <div className="grid grid-cols-1 gap-1">
              {COLOR_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setColorMode(m.id)}
                  className={`text-left px-3 py-1.5 rounded text-xs font-mono transition-all duration-150 ${
                    colorMode === m.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground hover:bg-accent/80"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-medium text-foreground/80">Stroke width</Label>
              <span className="font-mono text-xs text-primary">{strokeWidth}px</span>
            </div>
            <Slider min={0.5} max={6} step={0.5} value={[strokeWidth]} onValueChange={([v]) => setStrokeWidth(v)} />
          </div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium text-foreground/80">Show grid</Label>
            <Switch checked={showGrid} onCheckedChange={setShowGrid} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label className="text-sm font-medium text-foreground/80">Loop redraw</Label>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Continuously redraws</p>
            </div>
            <Switch checked={loopAnimation} onCheckedChange={setLoopAnimation} />
          </div>

          <SectionLabel>Factor Analysis</SectionLabel>
          <div className="bg-accent rounded p-3 mb-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground font-mono">Divisors of {params.n}</span>
              <span className="font-mono text-primary">{result.factors.length}</span>
            </div>
            <div className="font-mono text-xs text-foreground/50 break-all leading-relaxed">
              {result.factors.join(", ")}
            </div>
            <div className="border-t border-border pt-2 flex justify-between text-xs">
              <span className="text-muted-foreground font-mono">Closed loop</span>
              <span className={`font-mono font-semibold ${result.isClosed ? "text-green-400" : "text-yellow-400"}`}>
                {result.isClosed ? `✓ after ${result.closedAfterCycles}` : "open"}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border space-y-2">
          <Button className="w-full gap-2" onClick={handleGenerate} disabled={isAnimating && !loopAnimation}>
            <Play size={14} />
            Generate
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="gap-1.5 text-xs" onClick={handleReset}>
              <RotateCcw size={12} />
              Reset
            </Button>
            <Button variant="outline" className="gap-1.5 text-xs" onClick={handleExport}>
              <Download size={12} />
              Export SVG
            </Button>
          </div>
        </div>
      </aside>

      {/* Canvas area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-black relative">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-black/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">
              N = <span className="text-primary font-semibold">{params.n}</span>
            </span>
            <span className="text-border">|</span>
            <span className="font-mono text-xs text-muted-foreground">
              {result.totalSteps.toLocaleString()} segments
            </span>
            <span className="text-border">|</span>
            <span className="font-mono text-xs text-muted-foreground">
              {repetitions} repetition{repetitions !== 1 ? "s" : ""}
            </span>
          </div>
          {result.isClosed ? (
            <span className="font-mono text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
              ✓ closed loop
            </span>
          ) : (
            result.totalSteps > 0 && (
              <span className="font-mono text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/20">
                open path
              </span>
            )
          )}
        </div>

        <div
          ref={svgContainerRef}
          className="flex-1 flex items-center justify-center overflow-hidden p-4"
          style={{ background: "radial-gradient(ellipse at center, #0a0a0f 0%, #000000 100%)" }}
        >
          <PatternCanvas
            key={animKey}
            result={result}
            repetitions={repetitions}
            animating={isAnimating}
            onAnimationEnd={() => setIsAnimating(false)}
            colorMode={colorMode}
            strokeWidth={strokeWidth}
            showGrid={showGrid}
            loopAnimation={loopAnimation}
          />
        </div>
      </main>
    </div>
  );
}
