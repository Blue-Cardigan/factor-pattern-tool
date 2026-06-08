/*
 * features/search/SearchView.tsx — INVERSE DESIGN / SEARCH mode.
 *
 * Describe a TARGET shape (symmetry, complexity, tags, elongation, density,
 * closed-only) and the tool scans the (N × angle) space, scores each candidate
 * against the target (lib/search), and shows the top matches as live SVG
 * thumbnails. Click a result to load it into the Canvas.
 *
 * The scan is chunked/async (lib/search/runSearch) so the page never freezes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Sparkles, Loader2, X, ArrowRight } from "lucide-react";

import { useModeContext } from "@/features/ModeContext";
import type { StructureTag } from "@/lib/scanEngine";
import {
  DEFAULT_TARGET,
  type SearchTarget,
  type TargetSymmetry,
  type ScoredCandidate,
} from "@/lib/search/scoring";
import {
  runSearch,
  DEFAULT_SPACE,
  FINE_ANGLES,
  type SearchProgress,
} from "@/lib/search/runSearch";
import { CANONICAL_ANGLES } from "@/lib/scanEngine";
import { TARGET_PRESETS } from "@/lib/search/presets";
import Thumbnail from "./Thumbnail";

const ALL_TAGS: StructureTag[] = [
  "square",
  "hexagonal",
  "triangular",
  "bilateral",
  "balanced",
  "dense",
  "sparse",
  "compact",
  "elongated",
  "prime",
  "highly-composite",
];

const SYMMETRY_OPTIONS: { value: string; label: string }[] = [
  { value: "any", label: "Any symmetry" },
  { value: "2", label: "2-fold (bilateral)" },
  { value: "3", label: "3-fold (triangular)" },
  { value: "4", label: "4-fold (square)" },
  { value: "6", label: "6-fold (hexagonal)" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2 mt-5 first:mt-0">
      {children}
    </div>
  );
}

function symmetryToString(s: TargetSymmetry): string {
  return s === "any" ? "any" : String(s);
}
function stringToSymmetry(v: string): TargetSymmetry {
  return v === "any" ? "any" : (Number(v) as TargetSymmetry);
}

export default function SearchView() {
  const { loadIntoCanvas } = useModeContext();

  const [target, setTarget] = useState<SearchTarget>(DEFAULT_TARGET);
  const [fineAngles, setFineAngles] = useState(false);
  const [nRange, setNRange] = useState<[number, number]>([
    DEFAULT_SPACE.nMin,
    DEFAULT_SPACE.nMax,
  ]);

  const [results, setResults] = useState<ScoredCandidate[]>([]);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [matched, setMatched] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const patch = (p: Partial<SearchTarget>) => setTarget((t) => ({ ...t, ...p }));

  const toggleTag = (tag: StructureTag) =>
    setTarget((t) => ({
      ...t,
      desiredTags: t.desiredTags.includes(tag)
        ? t.desiredTags.filter((x) => x !== tag)
        : [...t.desiredTags, tag],
    }));

  const handleSearch = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setHasSearched(true);
    setResults([]);
    setProgress({ scanned: 0, total: 0, matches: 0 });
    setMatched(null);

    try {
      const res = await runSearch(
        target,
        {
          nMin: nRange[0],
          nMax: nRange[1],
          angles: fineAngles ? FINE_ANGLES : CANONICAL_ANGLES,
        },
        {
          topK: 48,
          chunkSize: 180,
          signal: controller.signal,
          onProgress: setProgress,
        }
      );
      if (!controller.signal.aborted) {
        setResults(res.candidates);
        setMatched(res.matched);
      }
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") throw e;
    } finally {
      if (abortRef.current === controller) {
        setRunning(false);
        abortRef.current = null;
      }
    }
  }, [target, nRange, fineAngles]);

  const handleCancel = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  const applyPreset = (t: SearchTarget) => {
    setTarget(t);
  };

  const pct = progress && progress.total > 0
    ? Math.round((progress.scanned / progress.total) * 100)
    : 0;

  // Live preview of where the bar of the complexity window sits.
  const complexityLabel = useMemo(
    () => `${target.complexityMin}–${target.complexityMax}`,
    [target.complexityMin, target.complexityMax]
  );

  return (
    <div className="h-full w-full flex bg-background text-foreground overflow-hidden">
      {/* ----- Target controls ----- */}
      <aside className="w-80 shrink-0 h-full flex flex-col bg-card border-r border-border overflow-y-auto">
        <div className="px-5 py-4 border-b border-border">
          <h1
            className="text-lg font-bold tracking-tight flex items-center gap-2"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            <Search size={18} className="text-primary" />
            Find by shape
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            Describe a target — we'll hunt the (N × angle) space for matches.
          </p>
        </div>

        <div className="px-5 py-4 flex-1">
          {/* Presets */}
          <SectionLabel>Quick targets</SectionLabel>
          <div className="grid grid-cols-2 gap-2 mb-1">
            {TARGET_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.target)}
                className="text-left rounded-md border border-border bg-accent/40 hover:border-primary/60 hover:bg-accent transition-all duration-150 px-3 py-2"
              >
                <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Sparkles size={11} className="text-primary shrink-0" />
                  {p.label}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono leading-snug mt-0.5">
                  {p.blurb}
                </div>
              </button>
            ))}
          </div>

          {/* Symmetry */}
          <SectionLabel>Rotational symmetry</SectionLabel>
          <Select
            value={symmetryToString(target.symmetry)}
            onValueChange={(v) => patch({ symmetry: stringToSymmetry(v) })}
          >
            <SelectTrigger className="w-full font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYMMETRY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="font-mono text-sm">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground font-mono mt-1.5">
            {target.symmetry === "any"
              ? "No constraint — symmetry only affects ranking via tags."
              : "Hard filter: only this exact order is returned."}
          </p>

          {/* Closed only */}
          <div className="flex items-center justify-between mt-4 mb-1">
            <div>
              <Label className="text-sm font-medium text-foreground/80">Closed loops only</Label>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                Path returns to its start
              </p>
            </div>
            <Switch
              checked={target.closedOnly}
              onCheckedChange={(v) => patch({ closedOnly: v })}
            />
          </div>

          {/* Complexity range */}
          <SectionLabel>Complexity</SectionLabel>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-sm font-medium text-foreground/80">Score window</Label>
            <span className="font-mono text-xs text-primary">{complexityLabel}</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[target.complexityMin, target.complexityMax]}
            onValueChange={([a, b]) =>
              patch({ complexityMin: Math.min(a, b), complexityMax: Math.max(a, b) })
            }
          />

          {/* Factor density */}
          <SectionLabel>Factor density</SectionLabel>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-sm font-medium text-foreground/80">Density window</Label>
            <span className="font-mono text-xs text-primary">
              {target.densityMin.toFixed(2)}–{target.densityMax.toFixed(2)}
            </span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[target.densityMin, target.densityMax]}
            onValueChange={([a, b]) =>
              patch({ densityMin: Math.min(a, b), densityMax: Math.max(a, b) })
            }
          />

          {/* Elongation */}
          <SectionLabel>Shape</SectionLabel>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-sm font-medium text-foreground/80">Elongation</Label>
            <span className="font-mono text-xs text-primary">
              {target.elongation === 0
                ? "no pref"
                : target.elongation < 0
                  ? "compact"
                  : "elongated"}
            </span>
          </div>
          <Slider
            min={-1}
            max={1}
            step={0.1}
            value={[target.elongation]}
            onValueChange={([v]) => patch({ elongation: v })}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
            <span>compact</span>
            <span>elongated</span>
          </div>

          {/* Tags */}
          <SectionLabel>Desired tags</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TAGS.map((tag) => {
              const active = target.desiredTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`font-mono text-[11px] px-2 py-0.5 rounded-full border transition-all duration-100 ${
                    active
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          {/* Search space */}
          <SectionLabel>Search space</SectionLabel>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-sm font-medium text-foreground/80">N range</Label>
            <span className="font-mono text-xs text-primary">
              {nRange[0]}–{nRange[1]}
            </span>
          </div>
          <Slider
            min={2}
            max={200}
            step={1}
            value={nRange}
            onValueChange={([a, b]) => setNRange([Math.min(a, b), Math.max(a, b)])}
          />
          <div className="flex items-center justify-between mt-3 mb-1">
            <div>
              <Label className="text-sm font-medium text-foreground/80">Fine angle set</Label>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                {fineAngles ? FINE_ANGLES.length : CANONICAL_ANGLES.length} angles per N
              </p>
            </div>
            <Switch checked={fineAngles} onCheckedChange={setFineAngles} />
          </div>
        </div>

        {/* Search button */}
        <div className="px-5 py-4 border-t border-border space-y-2 sticky bottom-0 bg-card">
          {running ? (
            <Button variant="outline" className="w-full gap-2" onClick={handleCancel}>
              <X size={14} />
              Cancel
            </Button>
          ) : (
            <Button className="w-full gap-2 btn-pulse" onClick={handleSearch}>
              <Search size={14} />
              Search
            </Button>
          )}
          {progress && (
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-accent overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>
                  {progress.scanned.toLocaleString()} / {progress.total.toLocaleString()} scanned
                </span>
                <span className="text-primary">{progress.matches} matches</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ----- Results grid ----- */}
      <main className="flex-1 h-full overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10">
          <div>
            <h2
              className="text-base font-semibold"
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {running ? "Searching…" : hasSearched ? "Top matches" : "Results"}
            </h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {running ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" /> scanning candidates
                </span>
              ) : matched !== null ? (
                `${results.length} shown · ${matched.toLocaleString()} passed filters`
              ) : (
                "Set a target and hit Search"
              )}
            </p>
          </div>
        </div>

        {!hasSearched ? (
          <EmptyState />
        ) : results.length === 0 && !running ? (
          <NoMatches />
        ) : (
          <div className="p-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {results.map(({ result, score }) => (
              <button
                key={`${result.n}-${result.angle}`}
                onClick={() =>
                  loadIntoCanvas({
                    rulesetId: "classic-factor",
                    n: result.n,
                    angleA: result.angle,
                    angleB: result.angle,
                    factorTurnsRight: true,
                    stepLength: 10,
                    repetitions: result.cyclesUntilClosed ?? 12,
                  })
                }
                className="group relative rounded-lg border border-border bg-card hover:border-primary/70 hover:shadow-[0_0_0_1px_var(--color-primary)] transition-all duration-150 overflow-hidden text-left"
                title={`N=${result.n} · ${result.angle}° · score ${Math.round(score)}`}
              >
                <div className="aspect-square w-full grid place-items-center bg-black/40 p-2">
                  <Thumbnail n={result.n} angle={result.angle} size={130} />
                </div>
                <div className="px-2.5 py-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-foreground">
                      N={result.n} · {result.angle}°
                    </span>
                    <span className="font-mono text-[11px] text-primary font-semibold">
                      {Math.round(score)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5 min-h-[18px]">
                    {result.tags.slice(0, 3).map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="px-1.5 py-0 text-[9px] font-mono leading-tight"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-150 bg-primary text-primary-foreground text-[10px] font-mono px-2.5 py-1 flex items-center justify-center gap-1">
                  Open in Canvas <ArrowRight size={10} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-[calc(100%-65px)] grid place-items-center px-6">
      <div className="text-center max-w-sm">
        <Search size={32} className="text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Inverse design
        </h3>
        <p className="text-xs text-muted-foreground font-mono mt-2 leading-relaxed">
          Pick a quick target on the left, or dial in symmetry, complexity and tags
          yourself. Hit Search to scan thousands of (N, angle) pairs and surface the
          closest matches as previews.
        </p>
      </div>
    </div>
  );
}

function NoMatches() {
  return (
    <div className="h-[calc(100%-65px)] grid place-items-center px-6">
      <div className="text-center max-w-sm">
        <X size={28} className="text-muted-foreground/40 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Outfit', sans-serif" }}>
          No matches
        </h3>
        <p className="text-xs text-muted-foreground font-mono mt-2 leading-relaxed">
          Nothing passed the hard filters. Try loosening "closed loops only", widening
          the N range, or removing the exact symmetry constraint.
        </p>
      </div>
    </div>
  );
}
