/*
 * DESIGN PHILOSOPHY: Dark Generative Art Studio
 * SuggestionsPanel.tsx — Collapsible panel of preset experiments
 */

import React, { useState } from "react";
import { PatternConfig } from "@/lib/patternEngine";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

interface Preset {
  name: string;
  description: string;
  config: Partial<PatternConfig>;
  tag: "closed" | "spiral" | "open" | "star";
}

const PRESETS: Preset[] = [
  {
    name: "Classic 15",
    description: "The original example — 4-fold symmetry, closes after 4 cycles.",
    config: { n: 15, factorAngle: 90, nonFactorAngle: 90, repetitions: 8, factorTurnsRight: true, stepLength: 10 },
    tag: "closed",
  },
  {
    name: "12-fold Star",
    description: "N=12 at 30° turns — produces a 12-pointed star-like closed form.",
    config: { n: 12, factorAngle: 30, nonFactorAngle: 30, repetitions: 24, factorTurnsRight: true, stepLength: 10 },
    tag: "star",
  },
  {
    name: "Pentagonal N=10",
    description: "N=10 with 72° turns — 5-fold symmetry.",
    config: { n: 10, factorAngle: 72, nonFactorAngle: 72, repetitions: 10, factorTurnsRight: true, stepLength: 12 },
    tag: "closed",
  },
  {
    name: "Asymmetric Spiral",
    description: "Different angles for factor vs non-factor — creates an outward spiral.",
    config: { n: 20, factorAngle: 90, nonFactorAngle: 91, repetitions: 16, factorTurnsRight: true, stepLength: 8 },
    tag: "spiral",
  },
  {
    name: "Prime-rich N=30",
    description: "N=30 has many factors — dense, intricate 4-fold pattern.",
    config: { n: 30, factorAngle: 90, nonFactorAngle: 90, repetitions: 8, factorTurnsRight: true, stepLength: 8 },
    tag: "closed",
  },
  {
    name: "Hexagonal N=6",
    description: "N=6 with 60° turns — classic hexagonal tiling.",
    config: { n: 6, factorAngle: 60, nonFactorAngle: 60, repetitions: 12, factorTurnsRight: true, stepLength: 14 },
    tag: "closed",
  },
  {
    name: "Obtuse Wander",
    description: "120° turns on factors, 60° on others — wandering open path.",
    config: { n: 17, factorAngle: 120, nonFactorAngle: 60, repetitions: 6, factorTurnsRight: true, stepLength: 10 },
    tag: "open",
  },
  {
    name: "Reversed Turns",
    description: "Same as Classic 15 but factors turn left — mirror image.",
    config: { n: 15, factorAngle: 90, nonFactorAngle: 90, repetitions: 8, factorTurnsRight: false, stepLength: 10 },
    tag: "closed",
  },
  {
    name: "Fine Lace N=24",
    description: "N=24 (highly composite) at 15° — delicate lace-like form.",
    config: { n: 24, factorAngle: 15, nonFactorAngle: 15, repetitions: 24, factorTurnsRight: true, stepLength: 10 },
    tag: "star",
  },
  {
    name: "Tight Spiral N=7",
    description: "Prime N=7 — few factors, mostly left turns, creates a tight coil.",
    config: { n: 7, factorAngle: 90, nonFactorAngle: 90, repetitions: 12, factorTurnsRight: true, stepLength: 10 },
    tag: "spiral",
  },
];

const TAG_COLORS: Record<Preset["tag"], string> = {
  closed: "text-green-400 bg-green-400/10 border-green-400/20",
  star: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  spiral: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  open: "text-orange-400 bg-orange-400/10 border-orange-400/20",
};

interface SuggestionsPanelProps {
  onApply: (config: Partial<PatternConfig>) => void;
}

export default function SuggestionsPanel({ onApply }: SuggestionsPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border/50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          Preset Experiments
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-2 max-h-72 overflow-y-auto">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => onApply(p.config)}
              className="w-full text-left p-3 rounded bg-accent hover:bg-accent/70 transition-all duration-150 group"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  {p.name}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${TAG_COLORS[p.tag]}`}>
                  {p.tag}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{p.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
