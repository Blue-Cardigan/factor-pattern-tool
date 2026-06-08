/*
 * DESIGN PHILOSOPHY: Dark Generative Art Studio
 * ControlPanel.tsx — Left sidebar with all pattern controls
 * IBM Plex Mono for values, Outfit for labels
 */

import React from "react";
import { PatternConfig } from "@/lib/patternEngine";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Play, RotateCcw, Download } from "lucide-react";
import SuggestionsPanel from "@/components/SuggestionsPanel";

interface ControlPanelProps {
  onApplyPreset: (patch: Partial<PatternConfig>) => void;
  config: PatternConfig;
  onChange: (patch: Partial<PatternConfig>) => void;
  onGenerate: () => void;
  onReset: () => void;
  onExport: () => void;
  colorMode: "hue-cycle" | "factor-highlight" | "monochrome";
  onColorModeChange: (m: "hue-cycle" | "factor-highlight" | "monochrome") => void;
  strokeWidth: number;
  onStrokeWidthChange: (v: number) => void;
  showGrid: boolean;
  onShowGridChange: (v: boolean) => void;
  loopAnimation: boolean;
  onLoopAnimationChange: (v: boolean) => void;
  factors: number[];
  factorSteps: number[];
  isClosed: boolean;
  closedAfterCycles: number | null;
  isAnimating: boolean;
}


function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2 mt-5 first:mt-0">
      {children}
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string | number; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <Label className="text-sm font-medium text-foreground/80">{label}</Label>
        {value !== undefined && (
          <span className="font-mono text-xs text-primary">{value}</span>
        )}
      </div>
      {children}
    </div>
  );
}

const COLOR_MODES = [
  { id: "hue-cycle" as const, label: "Hue Cycle" },
  { id: "factor-highlight" as const, label: "Factor Highlight" },
  { id: "monochrome" as const, label: "Monochrome" },
];

export default function ControlPanel({
  config,
  onChange,
  onGenerate,
  onReset,
  onExport,
  colorMode,
  onColorModeChange,
  strokeWidth,
  onStrokeWidthChange,
  showGrid,
  onShowGridChange,
  loopAnimation,
  onLoopAnimationChange,
  factors,
  factorSteps,
  isClosed,
  closedAfterCycles,
  isAnimating,
  onApplyPreset,
}: ControlPanelProps) {
  return (
    <aside className="sidebar-enter w-80 shrink-0 h-screen flex flex-col bg-card border-r border-border overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Factor Pattern
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          Generative turn-based art
        </p>
      </div>

      <div className="px-5 py-4 flex-1">
        {/* Core Parameters */}
        <SectionLabel>Core Parameters</SectionLabel>

        <Row label="Number (N)" value={config.n}>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={2}
              max={500}
              value={config.n}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 2) onChange({ n: Math.min(v, 500) });
              }}
              className="w-full font-mono text-sm bg-input border border-border rounded px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {[6, 10, 12, 15, 20, 24, 30, 36, 60].map((v) => (
              <button
                key={v}
                onClick={() => onChange({ n: v })}
                className={`font-mono text-[11px] px-2 py-0.5 rounded border transition-all duration-100 ${
                  config.n === v
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Repetitions" value={config.repetitions}>
          <Slider
            min={1}
            max={32}
            step={1}
            value={[config.repetitions]}
            onValueChange={([v]) => onChange({ repetitions: v })}
          />
        </Row>

        {/* Turn Rules */}
        <SectionLabel>Turn Rules</SectionLabel>

        <Row label="Factor turn angle" value={`${config.factorAngle}°`}>
          <Slider
            min={1}
            max={180}
            step={1}
            value={[config.factorAngle]}
            onValueChange={([v]) => onChange({ factorAngle: v })}
          />
        </Row>

        <Row label="Non-factor turn angle" value={`${config.nonFactorAngle}°`}>
          <Slider
            min={1}
            max={180}
            step={1}
            value={[config.nonFactorAngle]}
            onValueChange={([v]) => onChange({ nonFactorAngle: v })}
          />
        </Row>

        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium text-foreground/80">
            Factor turns right
          </Label>
          <Switch
            checked={config.factorTurnsRight}
            onCheckedChange={(v) => onChange({ factorTurnsRight: v })}
          />
        </div>

        <Row label="Step length" value={`${config.stepLength}px`}>
          <Slider
            min={2}
            max={40}
            step={1}
            value={[config.stepLength]}
            onValueChange={([v]) => onChange({ stepLength: v })}
          />
        </Row>

        {/* Display */}
        <SectionLabel>Display</SectionLabel>

        <div className="mb-3">
          <Label className="text-sm font-medium text-foreground/80 mb-2 block">Colour mode</Label>
          <div className="grid grid-cols-1 gap-1">
            {COLOR_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => onColorModeChange(m.id)}
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

        <Row label="Stroke width" value={`${strokeWidth}px`}>
          <Slider
            min={0.5}
            max={6}
            step={0.5}
            value={[strokeWidth]}
            onValueChange={([v]) => onStrokeWidthChange(v)}
          />
        </Row>

        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium text-foreground/80">Show grid</Label>
          <Switch checked={showGrid} onCheckedChange={onShowGridChange} />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div>
            <Label className="text-sm font-medium text-foreground/80">Loop redraw</Label>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">Continuously redraws</p>
          </div>
          <Switch checked={loopAnimation} onCheckedChange={onLoopAnimationChange} />
        </div>

        {/* Factor Info */}
        <SectionLabel>Factor Analysis</SectionLabel>

        <div className="bg-accent rounded p-3 mb-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground font-mono">Divisors of {config.n}</span>
            <span className="font-mono text-primary">{factors.length}</span>
          </div>
          <div className="font-mono text-xs text-foreground/50 break-all leading-relaxed">
            {factors.join(", ")}
          </div>
          <div className="border-t border-border pt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground font-mono">Turn-right steps</span>
              <span className="font-mono text-primary">{factorSteps.length}</span>
            </div>
            <div className="font-mono text-xs text-foreground/70 break-all leading-relaxed">
              {factorSteps.join(", ")}
            </div>
          </div>
          <div className="border-t border-border pt-2 flex justify-between text-xs">
            <span className="text-muted-foreground font-mono">Closed loop</span>
            <span className={`font-mono font-semibold ${isClosed ? "text-green-400" : "text-yellow-400"}`}>
              {isClosed ? `✓ after ${closedAfterCycles} cycle${closedAfterCycles === 1 ? "" : "s"}` : "open"}
            </span>
          </div>
        </div>
      </div>

      {/* Preset experiments */}
      <SuggestionsPanel onApply={onApplyPreset} />

      {/* Action buttons */}
      <div className="px-5 py-4 border-t border-border space-y-2">
        <Button
          className="w-full gap-2 btn-pulse"
          onClick={onGenerate}
          disabled={isAnimating}
        >
          <Play size={14} />
          Generate
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="gap-1.5 text-xs" onClick={onReset}>
            <RotateCcw size={12} />
            Reset
          </Button>
          <Button variant="outline" className="gap-1.5 text-xs" onClick={onExport}>
            <Download size={12} />
            Export SVG
          </Button>
        </div>
      </div>
    </aside>
  );
}
