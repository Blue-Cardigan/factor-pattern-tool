/*
 * features/lenses/ChordLens.tsx — the modular-multiplication "times-table cardioid".
 *
 * Renders the same number stream 0..n-1 as points on a circle and draws a chord
 * from each i to f(i). SVG keeps the lines crisp at any zoom. A Play button
 * auto-increments the multiplier so the cardioid morphs live.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Send, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useModeContext } from "@/features/ModeContext";
import {
  buildChords,
  CHORD_COLORS,
  CHORD_MAPS,
  hslFromHue,
  rgbString,
  schemeHue,
  SCHEMES,
} from "@/lib/lenses/index";
import type {
  ChordColorId,
  ChordMapId,
  SchemeId,
} from "@/lib/lenses/relations";
import { CHORD_PRESETS, type ChordPreset } from "@/lib/lenses/presets";

const VIEW = 760; // SVG viewBox size

export default function ChordLens() {
  const { loadIntoCanvas } = useModeContext();

  const [n, setN] = useState(200);
  const [mapId, setMapId] = useState<ChordMapId>("times");
  const [mult, setMult] = useState(2);
  const [exp, setExp] = useState(3);
  const [colorId, setColorId] = useState<ChordColorId>("index");
  const [scheme, setScheme] = useState<SchemeId>("violet");
  const [playing, setPlaying] = useState(false);

  const mapDef = CHORD_MAPS.find((m) => m.id === mapId)!;

  // ── animation loop: drift the multiplier ───────────────────────────────────
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      accRef.current += dt * 0.6; // ~0.6 mult-steps per second
      if (accRef.current >= 1) {
        const steps = Math.floor(accRef.current);
        accRef.current -= steps;
        setMult((m) => {
          const next = m + steps;
          return next >= n ? 2 : next; // wrap to keep it lively
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, n]);

  const cx = VIEW / 2;
  const cy = VIEW / 2;
  const radius = VIEW / 2 - 36;

  const chords = useMemo(
    () => buildChords({ n, mapId, mult, exp, colorId, cx, cy, radius }),
    [n, mapId, mult, exp, colorId, cx, cy, radius],
  );

  const applyPreset = (p: ChordPreset) => {
    setPlaying(false);
    setN(p.n);
    setMapId(p.mapId);
    setMult(p.mult);
    setExp(p.exp);
    setColorId(p.colorId);
    setScheme(p.scheme);
  };

  const sendToCanvas = () => {
    // Map the chord family onto a classic-factor canvas: multiplier -> angleA spread.
    loadIntoCanvas({
      rulesetId: "classic-factor",
      n,
      angleA: (360 * mult) / n,
      angleB: 90,
      knobs: { mult, lensMap: mapId === "times" ? 0 : mapId === "square" ? 1 : 2 },
    });
  };

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-auto p-3 lg:flex-row">
      {/* Canvas */}
      <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-violet-500/20 bg-[#07060e]">
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="h-full max-h-[80vh] w-full max-w-[80vh]"
          preserveAspectRatio="xMidYMid meet"
        >
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(139,92,246,0.18)"
            strokeWidth={1}
          />
          <g>
            {chords.map((ch, idx) => {
              const hue = schemeHue(scheme, ch.t);
              const stroke = hslFromHue(hue, 78, 62, n > 400 ? 0.4 : 0.6);
              return (
                <line
                  key={idx}
                  x1={ch.from.x}
                  y1={ch.from.y}
                  x2={ch.to.x}
                  y2={ch.to.y}
                  stroke={stroke}
                  strokeWidth={n > 600 ? 0.4 : n > 300 ? 0.6 : 0.9}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute left-3 top-3 font-mono text-xs text-violet-300/70">
          N={n} · ×{mult} · {chords.length} chords
        </div>
      </div>

      {/* Controls */}
      <Card className="w-full shrink-0 border-violet-500/20 bg-[#0c0a16]/80 lg:w-80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chord diagram</CardTitle>
          <CardDescription>{mapDef.blurb}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Presets */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-violet-300/60">
              Presets
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {CHORD_PRESETS.map((p) => (
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

          {/* Map function */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-violet-300/60">
              Function f(i)
            </Label>
            <Select value={mapId} onValueChange={(v) => setMapId(v as ChordMapId)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHORD_MAPS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* N */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-violet-300/60">
                Points N
              </Label>
              <span className="font-mono text-xs text-violet-200">{n}</span>
            </div>
            <Slider
              min={10}
              max={720}
              step={1}
              value={[n]}
              onValueChange={([v]) => setN(v)}
            />
          </div>

          {/* Multiplier — only when relevant */}
          {mapDef.usesMult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-violet-300/60">
                  Multiplier m
                </Label>
                <span className="font-mono text-xs text-violet-200">{mult}</span>
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  min={2}
                  max={Math.max(2, n)}
                  step={1}
                  value={[Math.min(mult, n)]}
                  onValueChange={([v]) => setMult(v)}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  variant={playing ? "default" : "outline"}
                  className="h-8 w-8 shrink-0 border-violet-500/30"
                  onClick={() => setPlaying((p) => !p)}
                  title={playing ? "Pause" : "Play — auto-morph m"}
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Exponent — only for power map */}
          {mapDef.usesExp && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-violet-300/60">
                  Exponent k
                </Label>
                <span className="font-mono text-xs text-violet-200">{exp}</span>
              </div>
              <Slider
                min={2}
                max={12}
                step={1}
                value={[exp]}
                onValueChange={([v]) => setExp(v)}
              />
            </div>
          )}

          {/* Colour by */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-violet-300/60">
              Colour by
            </Label>
            <Select
              value={colorId}
              onValueChange={(v) => setColorId(v as ChordColorId)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHORD_COLORS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheme */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-violet-300/60">
              Colour scheme
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {SCHEMES.map((s) => {
                const active = s.id === scheme;
                const swatch = rgbString(schemeSwatch(s.id));
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
                      className="h-3 w-3 rounded-full"
                      style={{ background: swatch }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-violet-500/30"
              onClick={() => {
                setN(Math.floor(60 + Math.random() * 600));
                setMult(2 + Math.floor(Math.random() * 12));
              }}
            >
              <Shuffle className="mr-1.5 h-3.5 w-3.5" /> Surprise
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-violet-600 hover:bg-violet-500"
              onClick={sendToCanvas}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" /> To Canvas
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Representative mid-scheme colour for the swatch chips.
function schemeSwatch(id: SchemeId): [number, number, number] {
  switch (id) {
    case "violet":
      return [124, 70, 230];
    case "aurora":
      return [40, 180, 165];
    case "ember":
      return [220, 90, 130];
    case "ice":
      return [110, 160, 230];
    default:
      return [128, 128, 128];
  }
}
