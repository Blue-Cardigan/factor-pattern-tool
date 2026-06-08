/*
 * DESIGN PHILOSOPHY: Dark Generative Art Studio
 * Explorer.tsx — Systematic closed-loop scanner and structure browser
 *
 * Layout: top control bar → scan results grid (mini SVG previews) → structure sidebar
 * Keyboard: ←/→/↑/↓ to move through the grid, Enter to load in Canvas
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  ScanResult, ScanConfig, DEFAULT_SCAN_CONFIG, runScan,
  CANONICAL_ANGLES, StructureTag,
} from "@/lib/scanEngine";
import { PatternConfig } from "@/lib/patternEngine";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, ChevronRight, BarChart2, Layers, X, ArrowRight } from "lucide-react";
import MiniPattern from "@/components/MiniPattern";

// ── Tag colours ──────────────────────────────────────────────────────────────

const TAG_STYLE: Record<StructureTag, string> = {
  "square":           "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "hexagonal":        "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "triangular":       "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "bilateral":        "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "balanced":         "bg-green-500/20 text-green-300 border-green-500/30",
  "dense":            "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "sparse":           "bg-slate-500/20 text-slate-300 border-slate-500/30",
  "compact":          "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "elongated":        "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "prime":            "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "highly-composite": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "perfect":          "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "power-of-2":       "bg-sky-500/20 text-sky-300 border-sky-500/30",
  "simple":           "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  "complex":          "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
};

function Tag({ tag }: { tag: StructureTag }) {
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${TAG_STYLE[tag]}`}>
      {tag}
    </span>
  );
}

function scoreColor(score: number): string {
  if (score < 20) return `oklch(0.18 0.02 265)`;
  if (score < 40) return `oklch(0.28 0.12 280)`;
  if (score < 55) return `oklch(0.38 0.18 285)`;
  if (score < 70) return `oklch(0.48 0.22 290)`;
  if (score < 82) return `oklch(0.55 0.22 290)`;
  return `oklch(0.62 0.2 200)`;
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${score}%`, background: scoreColor(score) }}
      />
    </div>
  );
}

// ── Mini preview cell with shape thumbnail ────────────────────────────────────

function ResultCell({
  r,
  selected,
  onClick,
  cellRef,
}: {
  r: ScanResult;
  selected: boolean;
  onClick: () => void;
  cellRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={cellRef}
      onClick={onClick}
      title={`N=${r.n}, ${r.angle}° — score ${r.complexityScore}`}
      className="relative group focus:outline-none"
      style={{ transition: "transform 120ms cubic-bezier(0.23,1,0.32,1)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.06)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
    >
      <MiniPattern result={r} size={76} selected={selected} />
      {/* Label overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-1 pb-1 flex justify-between items-end pointer-events-none">
        <span
          className="font-mono text-[10px] font-bold leading-none"
          style={{ color: selected ? "white" : "rgba(255,255,255,0.75)", textShadow: "0 1px 3px #000" }}
        >
          {r.n}
        </span>
        <span
          className="font-mono text-[9px] leading-none"
          style={{ color: "rgba(255,255,255,0.45)", textShadow: "0 1px 3px #000" }}
        >
          {r.angle}°
        </span>
      </div>
      {/* Cycle count badge */}
      {r.cyclesUntilClosed && (
        <div
          className="absolute top-1 right-1 font-mono text-[8px] leading-none rounded px-0.5 py-px"
          style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.5)" }}
        >
          ×{r.cyclesUntilClosed}
        </div>
      )}
    </button>
  );
}

// ── Structure analysis panel ──────────────────────────────────────────────────

function StructurePanel({
  results,
  onLoadPattern,
}: {
  results: ScanResult[];
  onLoadPattern: (r: ScanResult) => void;
}) {
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of results) {
      for (const t of r.tags) counts[t] = (counts[t] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [results]);

  const angleCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const r of results) counts[r.angle] = (counts[r.angle] || 0) + 1;
    return Object.entries(counts)
      .map(([a, c]) => ({ angle: Number(a), count: c }))
      .sort((a, b) => b.count - a.count);
  }, [results]);

  const multiAngleN = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const r of results) counts[r.n] = (counts[r.n] || 0) + 1;
    return Object.entries(counts)
      .map(([n, c]) => ({ n: Number(n), count: c }))
      .filter((x) => x.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [results]);

  const topResults = useMemo(() => results.slice(0, 8), [results]);

  return (
    <div className="w-72 shrink-0 border-l border-border bg-card flex flex-col overflow-y-auto">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <BarChart2 size={14} className="text-primary" />
        <span className="text-sm font-semibold">Structure Analysis</span>
      </div>

      <div className="px-4 py-3 space-y-4 flex-1">
        {/* Top complex results */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Highest Complexity
          </div>
          <div className="space-y-1">
            {topResults.map((r) => (
              <button
                key={`${r.n}-${r.angle}`}
                onClick={() => onLoadPattern(r)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-left group"
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: scoreColor(r.complexityScore) }} />
                <span className="font-mono text-xs text-foreground/80 flex-1">N={r.n}, {r.angle}°</span>
                <span className="font-mono text-[10px] text-primary">{r.complexityScore}</span>
                <ChevronRight size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>

        {/* Angles → closed loops */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Angles → Closed Loops
          </div>
          <div className="space-y-1">
            {angleCounts.map(({ angle, count }) => (
              <div key={angle} className="flex items-center gap-2">
                <span className="font-mono text-xs text-foreground/60 w-8">{angle}°</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(count / (angleCounts[0]?.count || 1)) * 100}%`, background: "oklch(0.55 0.22 290)" }}
                  />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground w-5 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* N values robust across many angles */}
        {multiAngleN.length > 0 && (
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              N values closing at ≥3 angles
            </div>
            <div className="flex flex-wrap gap-1">
              {multiAngleN.map(({ n, count }) => (
                <span key={n} className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary" title={`${count} angles`}>
                  {n} <span className="text-primary/50">×{count}</span>
                </span>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              These N values form closed loops regardless of angle — likely driven by arithmetic structure.
            </p>
          </div>
        )}

        {/* Universal closers */}
        {(() => {
          const angleSets: Record<number, Set<number>> = {};
          for (const r of results) {
            if (!angleSets[r.n]) angleSets[r.n] = new Set();
            angleSets[r.n].add(r.angle);
          }
          const totalAngles = new Set(results.map((r) => r.angle)).size;
          const universal = Object.entries(angleSets)
            .filter(([, s]) => s.size === totalAngles)
            .map(([n]) => Number(n))
            .sort((a, b) => a - b);
          if (universal.length === 0) return null;
          return (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                Universal Closers (all {totalAngles} angles)
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                {universal.map((n) => (
                  <span key={n} className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-cyan-400/40 bg-cyan-400/10 text-cyan-300">{n}</span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Strongest structural signal — closes at every tested angle.
              </p>
            </div>
          );
        })()}

        {/* Tag frequency */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Tag Frequency</div>
          <div className="flex flex-wrap gap-1">
            {tagCounts.map(([tag, count]) => (
              <span key={tag} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${TAG_STYLE[tag as StructureTag]}`} title={`${count} results`}>
                {tag} <span className="opacity-50">({count})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Observations */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Observations</div>
          <div className="text-[11px] text-muted-foreground leading-relaxed space-y-2">
            <p><span className="text-foreground/70">Highly composite numbers</span> (12, 24, 60…) close at the most angles.</p>
            <p><span className="text-foreground/70">Primes</span> close only when 360/(p−1) is divisible by the angle.</p>
            <p><span className="text-foreground/70">Powers of 2</span> close reliably at 90° and 45°.</p>
            <p><span className="text-foreground/70">Closure condition:</span> net turn per cycle must be 0 mod 360°.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Explorer component ───────────────────────────────────────────────────

interface ExplorerProps {
  onLoadPattern: (config: Partial<PatternConfig>) => void;
}

const ALL_ANGLES = CANONICAL_ANGLES;
const CELL_SIZE = 76;

export default function Explorer({ onLoadPattern }: ExplorerProps) {
  const [scanConfig, setScanConfig] = useState<ScanConfig>({
    ...DEFAULT_SCAN_CONFIG,
    angles: [30, 45, 60, 72, 90, 120],
  });
  const [results, setResults] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [filterTag, setFilterTag] = useState<StructureTag | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState<"score" | "n" | "cycles">("score");
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const handleScan = useCallback(() => {
    setScanning(true);
    setProgress(0);
    setResults([]);
    setSelectedIdx(0);

    setTimeout(() => {
      const r = runScan(scanConfig, (done, total) => {
        setProgress(Math.round((done / total) * 100));
      });
      setResults(r);
      setScanning(false);
    }, 20);
  }, [scanConfig]);

  // Auto-scan on mount
  useEffect(() => { handleScan(); }, []);

  const filteredResults = useMemo(() => {
    let r = results.filter((x) => x.complexityScore >= minScore);
    if (filterTag) r = r.filter((x) => x.tags.includes(filterTag));
    if (sortBy === "n") r = [...r].sort((a, b) => a.n - b.n || a.angle - b.angle);
    if (sortBy === "cycles") r = [...r].sort((a, b) => (a.cyclesUntilClosed ?? 99) - (b.cyclesUntilClosed ?? 99));
    return r;
  }, [results, filterTag, minScore, sortBy]);

  // Clamp selectedIdx when results change
  useEffect(() => {
    setSelectedIdx((i) => Math.min(i, Math.max(0, filteredResults.length - 1)));
  }, [filteredResults.length]);

  // Group by angle for grouped view
  const byAngle = useMemo(() => {
    const map = new Map<number, ScanResult[]>();
    for (const r of filteredResults) {
      if (!map.has(r.angle)) map.set(r.angle, []);
      map.get(r.angle)!.push(r);
    }
    map.forEach((v, k) => map.set(k, v.sort((a, b) => a.n - b.n)));
    return map;
  }, [filteredResults]);

  const allTags = useMemo(() => {
    const s = new Set<StructureTag>();
    results.forEach((r) => r.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [results]);

  const selected = filteredResults[selectedIdx] ?? null;

  // Scroll selected cell into view
  useEffect(() => {
    const el = cellRefs.current.get(selectedIdx);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selectedIdx]);

  // Keyboard navigation — scoped to the grid container
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!filteredResults.length) return;

    // Estimate columns from container width and cell size
    const containerWidth = gridRef.current?.clientWidth ?? 600;
    const cols = Math.max(1, Math.floor((containerWidth - 32) / (CELL_SIZE + 8)));

    let next = selectedIdx;
    if (e.key === "ArrowRight") { next = Math.min(selectedIdx + 1, filteredResults.length - 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { next = Math.max(selectedIdx - 1, 0); e.preventDefault(); }
    else if (e.key === "ArrowDown") { next = Math.min(selectedIdx + cols, filteredResults.length - 1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { next = Math.max(selectedIdx - cols, 0); e.preventDefault(); }
    else if (e.key === "Enter" && selected) {
      onLoadPattern({
        n: selected.n,
        factorAngle: selected.angle,
        nonFactorAngle: selected.angle,
        repetitions: Math.min((selected.cyclesUntilClosed ?? 4) + 2, 20),
      });
      e.preventDefault();
      return;
    } else return;

    setSelectedIdx(next);
  }, [selectedIdx, filteredResults.length, selected, onLoadPattern]);

  const handleLoadSelected = useCallback(() => {
    if (!selected) return;
    onLoadPattern({
      n: selected.n,
      factorAngle: selected.angle,
      nonFactorAngle: selected.angle,
      repetitions: Math.min((selected.cyclesUntilClosed ?? 4) + 2, 20),
    });
  }, [selected, onLoadPattern]);

  return (
    <div className="flex flex-col h-full overflow-hidden" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-card/50 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground font-mono">N</span>
          <input
            type="number" min={2} max={200} value={scanConfig.nMin}
            onChange={(e) => setScanConfig((c) => ({ ...c, nMin: Math.max(2, +e.target.value) }))}
            className="w-14 font-mono text-xs bg-input border border-border rounded px-2 py-1 text-foreground"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="number" min={2} max={200} value={scanConfig.nMax}
            onChange={(e) => setScanConfig((c) => ({ ...c, nMax: Math.min(200, +e.target.value) }))}
            className="w-14 font-mono text-xs bg-input border border-border rounded px-2 py-1 text-foreground"
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-mono mr-1">Angles:</span>
          {ALL_ANGLES.map((a) => {
            const active = scanConfig.angles.includes(a);
            return (
              <button
                key={a}
                onClick={() =>
                  setScanConfig((c) => ({
                    ...c,
                    angles: active
                      ? c.angles.filter((x) => x !== a)
                      : [...c.angles, a].sort((x, y) => x - y),
                  }))
                }
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                  active ? "bg-primary/20 border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                {a}°
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <Switch checked={scanConfig.onlyClosedLoops} onCheckedChange={(v) => setScanConfig((c) => ({ ...c, onlyClosedLoops: v }))} />
          <Label className="text-xs text-muted-foreground">Closed only</Label>
        </div>

        <Button size="sm" onClick={handleScan} disabled={scanning} className="gap-1.5 ml-auto">
          <Search size={12} />
          {scanning ? `Scanning… ${progress}%` : "Scan"}
        </Button>
      </div>

      {/* Filter bar */}
      {results.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 border-b border-border/50 bg-black/20 flex-wrap">
          <span className="text-[10px] font-mono text-muted-foreground">
            {filteredResults.length} / {results.length}
          </span>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-mono">min score</span>
            <input type="range" min={0} max={80} step={5} value={minScore}
              onChange={(e) => setMinScore(+e.target.value)} className="w-20" />
            <span className="font-mono text-primary w-6">{minScore}</span>
          </div>

          <div className="flex items-center gap-1">
            {(["score", "n", "cycles"] as const).map((s) => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-all ${
                  sortBy === s ? "bg-primary/20 border-primary/50 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                }`}
              >{s}</button>
            ))}
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {filterTag && (
              <button onClick={() => setFilterTag(null)}
                className="flex items-center gap-0.5 font-mono text-[10px] px-1.5 py-0.5 rounded border border-primary/50 bg-primary/10 text-primary">
                <X size={8} /> clear
              </button>
            )}
            {allTags.map((t) => (
              <button key={t} onClick={() => setFilterTag(filterTag === t ? null : t)}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-all ${
                  filterTag === t ? TAG_STYLE[t] : "border-border/50 text-muted-foreground hover:border-border"
                }`}
              >{t}</button>
            ))}
          </div>

          {/* Keyboard hint */}
          <span className="ml-auto text-[10px] font-mono text-muted-foreground/50 hidden sm:block">
            ← → ↑ ↓ navigate · Enter load
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Grid area */}
        <div ref={gridRef} className="flex-1 overflow-y-auto px-5 py-4 focus:outline-none">
          {scanning && (
            <div className="flex items-center justify-center h-32 text-muted-foreground font-mono text-sm">
              Scanning {scanConfig.nMin}–{scanConfig.nMax} × {scanConfig.angles.length} angles… {progress}%
            </div>
          )}

          {!scanning && filteredResults.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground font-mono text-sm">
              No results. Try adjusting the filters or running a scan.
            </div>
          )}

          {!scanning && sortBy === "n" && (
            <div className="flex flex-wrap gap-2">
              {filteredResults.map((r, i) => (
                <ResultCell
                  key={`${r.n}-${r.angle}`}
                  r={r}
                  selected={i === selectedIdx}
                  onClick={() => setSelectedIdx(i)}
                  cellRef={(el) => {
                    if (el) cellRefs.current.set(i, el);
                    else cellRefs.current.delete(i);
                  }}
                />
              ))}
            </div>
          )}

          {!scanning && sortBy !== "n" && (
            <div className="space-y-5">
              {Array.from(byAngle.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([angle, rows]) => {
                  // Find global indices for this angle group
                  return (
                    <div key={angle}>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                        {angle}° — {rows.length} closed loop{rows.length !== 1 ? "s" : ""}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {rows.map((r) => {
                          const i = filteredResults.findIndex((x) => x.n === r.n && x.angle === r.angle);
                          return (
                            <ResultCell
                              key={`${r.n}-${r.angle}`}
                              r={r}
                              selected={i === selectedIdx}
                              onClick={() => setSelectedIdx(i)}
                              cellRef={(el) => {
                                if (el) cellRefs.current.set(i, el);
                                else cellRefs.current.delete(i);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Detail panel for selected */}
        {selected && (
          <div className="w-64 shrink-0 border-l border-border bg-card/80 overflow-y-auto">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-mono text-sm font-semibold">N={selected.n}, {selected.angle}°</span>
            </div>
            <div className="px-4 py-3 space-y-3">
              {/* Larger preview */}
              <div className="flex justify-center">
                <MiniPattern result={selected} size={180} selected={false} />
              </div>

              {/* Score */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground font-mono">Complexity</span>
                  <span className="font-mono text-primary font-bold">{selected.complexityScore}</span>
                </div>
                <ScoreBar score={selected.complexityScore} />
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {selected.tags.map((t) => <Tag key={t} tag={t} />)}
              </div>

              {/* Metrics */}
              <div className="space-y-1.5 text-xs font-mono">
                {[
                  ["Cycles to close", selected.cyclesUntilClosed ?? "open"],
                  ["Factor density", (selected.factorDensity * 100).toFixed(0) + "%"],
                  ["Turn balance", (selected.turnBalance * 100).toFixed(0) + "% imbalance"],
                  ["BB ratio", selected.boundingBoxRatio.toFixed(2)],
                  ["Rot. symmetry", `${selected.rotationalSymmetry}-fold`],
                  ["Unique vertices", selected.uniqueVertices],
                  ["φ(N)", selected.phi],
                  ["Segments", selected.totalSegments],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground/80">{v}</span>
                  </div>
                ))}
              </div>

              <Button className="w-full gap-2 mt-2" size="sm" onClick={handleLoadSelected}>
                <Layers size={12} />
                Load in Canvas
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">or press Enter</p>
            </div>
          </div>
        )}

        {/* Structure analysis panel — shown when nothing is selected */}
        {results.length > 0 && !selected && (
          <StructurePanel
            results={filteredResults}
            onLoadPattern={(r) => {
              const i = filteredResults.findIndex((x) => x.n === r.n && x.angle === r.angle);
              if (i >= 0) setSelectedIdx(i);
              onLoadPattern({
                n: r.n,
                factorAngle: r.angle,
                nonFactorAngle: r.angle,
                repetitions: Math.min((r.cyclesUntilClosed ?? 4) + 2, 20),
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
