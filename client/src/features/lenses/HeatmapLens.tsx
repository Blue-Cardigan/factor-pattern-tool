/*
 * features/lenses/HeatmapLens.tsx — n×n relation matrix on a canvas.
 *
 * Cell (r,c) is coloured by a selectable relation (gcd, product mod n,
 * coprimality, divisibility). Canvas keeps it fast for large N. A hover readout
 * reports the exact r, c and relation value under the pointer.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  HEAT_RELATIONS,
  rgbString,
  schemeRGB,
  SCHEMES,
} from "@/lib/lenses/index";
import type { HeatRelationId, SchemeId } from "@/lib/lenses/relations";
import { HEAT_PRESETS, type HeatPreset } from "@/lib/lenses/presets";

interface Hover {
  r: number;
  c: number;
}

export default function HeatmapLens() {
  const [n, setN] = useState(60);
  const [relationId, setRelationId] = useState<HeatRelationId>("coprime");
  const [scheme, setScheme] = useState<SchemeId>("violet");
  const [hover, setHover] = useState<Hover | null>(null);
  const [resizeTick, setResizeTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const relation = useMemo(
    () => HEAT_RELATIONS.find((r) => r.id === relationId)!,
    [relationId],
  );

  // ── draw ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const size = Math.max(120, Math.min(wrap.clientWidth, wrap.clientHeight));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#07060e";
    ctx.fillRect(0, 0, size, size);

    const cell = size / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const t = relation.norm(r, c, n);
        ctx.fillStyle = rgbString(schemeRGB(scheme, t));
        // +1px overdraw avoids seams between cells at fractional sizes
        ctx.fillRect(c * cell, r * cell, cell + 0.6, cell + 0.6);
      }
    }
  }, [n, relation, scheme, resizeTick]);

  // redraw on resize
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => setResizeTick((t) => t + 1));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cell = rect.width / n;
    const c = Math.floor((e.clientX - rect.left) / cell);
    const r = Math.floor((e.clientY - rect.top) / cell);
    if (r >= 0 && r < n && c >= 0 && c < n) setHover({ r, c });
    else setHover(null);
  };

  const applyPreset = (p: HeatPreset) => {
    setN(p.n);
    setRelationId(p.relationId);
    setScheme(p.scheme);
  };

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-auto p-3 lg:flex-row">
      {/* Canvas */}
      <div
        ref={wrapRef}
        className="relative flex aspect-square min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-violet-500/20 bg-[#07060e]"
      >
        <canvas
          ref={canvasRef}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          className="cursor-crosshair"
        />
        <div className="pointer-events-none absolute left-3 top-3 font-mono text-xs text-violet-300/70">
          {n}×{n} · {relation.label}
        </div>
        {hover && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-violet-500/30 bg-[#0c0a16]/90 px-2.5 py-1.5 font-mono text-xs text-violet-100">
            r={hover.r} · c={hover.c} · {relation.readout(hover.r, hover.c, n)}
          </div>
        )}
      </div>

      {/* Controls */}
      <Card className="w-full shrink-0 border-violet-500/20 bg-[#0c0a16]/80 lg:w-80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Heatmap matrix</CardTitle>
          <CardDescription>{relation.blurb}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Presets */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-violet-300/60">
              Presets
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {HEAT_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  size="sm"
                  variant="outline"
                  className="h-7 border-violet-500/30 px-2 text-xs hover:bg-violet-500/15"
                  title={p.hint}
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Relation */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-violet-300/60">
              Relation
            </Label>
            <Select
              value={relationId}
              onValueChange={(v) => setRelationId(v as HeatRelationId)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEAT_RELATIONS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* N */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-violet-300/60">
                Size N
              </Label>
              <span className="font-mono text-xs text-violet-200">{n}</span>
            </div>
            <Slider
              min={6}
              max={300}
              step={1}
              value={[n]}
              onValueChange={([v]) => setN(v)}
            />
          </div>

          {/* Scheme */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-violet-300/60">
              Colour scheme
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {SCHEMES.map((s) => {
                const active = s.id === scheme;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScheme(s.id)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                      active
                        ? "border-violet-400 bg-violet-500/20 text-violet-100"
                        : "border-violet-500/20 text-violet-300/70 hover:bg-violet-500/10"
                    }`}
                  >
                    <span
                      className="h-3 w-6 rounded-sm"
                      style={{
                        background: `linear-gradient(90deg, ${rgbString(
                          schemeRGB(s.id, 0),
                        )}, ${rgbString(schemeRGB(s.id, 0.5))}, ${rgbString(
                          schemeRGB(s.id, 1),
                        )})`,
                      }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-violet-300/60">
              Legend
            </Label>
            <div
              className="h-3 w-full rounded-sm"
              style={{
                background: `linear-gradient(90deg, ${rgbString(
                  schemeRGB(scheme, 0),
                )}, ${rgbString(schemeRGB(scheme, 0.5))}, ${rgbString(
                  schemeRGB(scheme, 1),
                )})`,
              }}
            />
            <div className="flex justify-between font-mono text-[10px] text-violet-300/60">
              <span>low</span>
              <span>high</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
