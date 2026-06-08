/*
 * features/cinema/CinemaView.tsx — Parameter-space cinematography.
 *
 * Animate a parameter continuously, recomputing & redrawing the 2D pattern each
 * frame to a <canvas>. Three modes (angle sweep, N bloom, A↔B morph), a
 * scrubbable timeline, play/pause/loop, speed, ruleset + range controls, motion
 * trails, presets, and "Send current frame to Canvas".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Film, Send, Repeat, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { allRulesets } from "@/lib/core/rulesets";
import { useModeContext } from "@/features/ModeContext";

import {
  computeFrame,
  frameLabel,
  type CinemaMode,
  type CinemaSpec,
} from "@/lib/cinema/frames";
import { drawFrame } from "@/lib/cinema/draw";
import { CINEMA_PRESETS } from "@/lib/cinema/presets";

const MODE_LABELS: Record<CinemaMode, string> = {
  angle: "Angle sweep",
  bloom: "N bloom",
  morph: "Morph A↔B",
};

export default function CinemaView() {
  const { loadIntoCanvas } = useModeContext();
  const rulesets = useMemo(() => allRulesets(), []);

  // The active animation spec (seeded from a preset, then editable).
  const [spec, setSpec] = useState<CinemaSpec>(() =>
    structuredClone(CINEMA_PRESETS[0].spec),
  );
  const [presetId, setPresetId] = useState<string>(CINEMA_PRESETS[0].id);

  // Playback state.
  const [t, setT] = useState(0); // normalised time 0..1
  const [playing, setPlaying] = useState(true);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(0.12); // cycles per second
  const [trails, setTrails] = useState(false);

  // Refs the rAF loop reads without re-subscribing.
  const tRef = useRef(t);
  const playingRef = useRef(playing);
  const loopRef = useRef(loop);
  const speedRef = useRef(speed);
  const specRef = useRef(spec);
  const trailsRef = useRef(trails);
  tRef.current = t;
  playingRef.current = playing;
  loopRef.current = loop;
  speedRef.current = speed;
  specRef.current = spec;
  trailsRef.current = trails;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState("");

  // Live frame for the "send to canvas" action (kept in a ref to avoid churn).
  const liveValuesRef = useRef(computeFrame(spec, t).values);

  const renderAt = useCallback((time: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const frame = computeFrame(specRef.current, time);
    liveValuesRef.current = frame.values;
    drawFrame(ctx, frame, cv.width, cv.height, {
      trails: trailsRef.current,
      bg: "#0a0813",
    });
    setHud(frameLabel(specRef.current, frame));
  }, []);

  // Resize canvas to its container (devicePixelRatio aware).
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const parent = cv.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      cv.width = Math.max(1, Math.floor(w * dpr));
      cv.height = Math.max(1, Math.floor(h * dpr));
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      renderAt(tRef.current);
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [renderAt]);

  // The animation loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (playingRef.current) {
        let next = tRef.current + dt * speedRef.current;
        if (next >= 1) {
          if (loopRef.current) next = next % 1;
          else {
            next = 1;
            playingRef.current = false;
            setPlaying(false);
          }
        }
        tRef.current = next;
        setT(next);
        renderAt(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [renderAt]);

  // Re-render when the spec changes while paused (so edits show immediately).
  useEffect(() => {
    renderAt(tRef.current);
  }, [spec, trails, renderAt]);

  /* ----------------------------- spec editing ----------------------------- */

  const setMode = (mode: CinemaMode) => {
    setSpec((prev) => ({
      ...prev,
      mode,
      // Ensure the target mode's block exists so its controls + the frame
      // computation have values to read.
      angle:
        mode === "angle"
          ? prev.angle ?? { angleAMin: 30, angleAMax: 150 }
          : prev.angle,
      bloom:
        mode === "bloom"
          ? prev.bloom ?? { nMin: 6, nMax: 60, crossfade: 0.35 }
          : prev.bloom,
      configB:
        mode === "morph"
          ? prev.configB ?? { ...prev.base, n: prev.base.n + 6 }
          : prev.configB,
    }));
  };

  const setBase = (patch: Partial<CinemaSpec["base"]>) =>
    setSpec((prev) => ({ ...prev, base: { ...prev.base, ...patch } }));

  const setAngle = (patch: Partial<NonNullable<CinemaSpec["angle"]>>) =>
    setSpec((prev) => ({
      ...prev,
      angle: {
        angleAMin: prev.angle?.angleAMin ?? 30,
        angleAMax: prev.angle?.angleAMax ?? 150,
        ...prev.angle,
        ...patch,
      },
    }));

  const setBloom = (patch: Partial<NonNullable<CinemaSpec["bloom"]>>) =>
    setSpec((prev) => ({
      ...prev,
      bloom: {
        nMin: prev.bloom?.nMin ?? 6,
        nMax: prev.bloom?.nMax ?? 60,
        crossfade: prev.bloom?.crossfade ?? 0.35,
        ...prev.bloom,
        ...patch,
      },
    }));

  const applyPreset = (id: string) => {
    const p = CINEMA_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    setSpec(structuredClone(p.spec));
    setT(0);
    tRef.current = 0;
    setPlaying(true);
  };

  const sendToCanvas = () => {
    const v = liveValuesRef.current;
    loadIntoCanvas({
      rulesetId: v.rulesetId,
      n: v.n,
      angleA: Math.round(v.angleA * 10) / 10,
      angleB: Math.round(v.angleB * 10) / 10,
      factorTurnsRight: v.factorTurnsRight,
      stepLength: v.stepLength,
      repetitions: v.repetitions,
    });
  };

  const mode = spec.mode;

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        <Film className="h-5 w-5 text-violet-400" />
        <span
          className="text-lg font-semibold tracking-tight"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Cinema
        </span>
        <span className="text-xs text-muted-foreground font-mono ml-1">
          parameter-space cinematography
        </span>
        <div className="flex-1" />
        <Select value={presetId} onValueChange={applyPreset}>
          <SelectTrigger className="w-[230px] h-8 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <SelectValue placeholder="Presets" />
          </SelectTrigger>
          <SelectContent>
            {CINEMA_PRESETS.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Canvas stage */}
        <div className="relative flex-1 min-w-0 bg-[#0a0813]">
          <canvas ref={canvasRef} className="block h-full w-full" />
          {/* Live HUD */}
          <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-md bg-black/50 backdrop-blur-sm border border-violet-500/20">
            <span className="text-[11px] font-mono text-violet-200">{hud}</span>
          </div>
          <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-md bg-black/50 backdrop-blur-sm border border-violet-500/20">
            <span className="text-[11px] font-mono text-muted-foreground">
              t {t.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Controls panel */}
        <div className="w-[300px] shrink-0 border-l border-border/60 overflow-y-auto p-4 flex flex-col gap-5">
          {/* Mode selector */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Animation mode
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(MODE_LABELS) as CinemaMode[]).map((m) => (
                <Button
                  key={m}
                  variant={mode === m ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-[11px] px-1"
                  onClick={() => setMode(m)}
                >
                  {MODE_LABELS[m]}
                </Button>
              ))}
            </div>
          </div>

          {/* Ruleset */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Ruleset
            </Label>
            <Select
              value={spec.base.rulesetId}
              onValueChange={(id) => setBase({ rulesetId: id })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rulesets.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode-specific range controls */}
          {mode === "angle" && (
            <div className="flex flex-col gap-4">
              <RangeRow
                label="angleA min"
                value={spec.angle?.angleAMin ?? 30}
                min={0}
                max={359}
                step={0.5}
                unit="°"
                onChange={(v) => setAngle({ angleAMin: v })}
              />
              <RangeRow
                label="angleA max"
                value={spec.angle?.angleAMax ?? 150}
                min={0}
                max={359}
                step={0.5}
                unit="°"
                onChange={(v) => setAngle({ angleAMax: v })}
              />
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Sweep angleB too</Label>
                <Switch
                  checked={spec.angle?.angleBMin != null}
                  onCheckedChange={(on) =>
                    setAngle(
                      on
                        ? { angleBMin: spec.base.angleB, angleBMax: spec.base.angleB + 60 }
                        : { angleBMin: undefined, angleBMax: undefined },
                    )
                  }
                />
              </div>
              {spec.angle?.angleBMin != null && (
                <>
                  <RangeRow
                    label="angleB min"
                    value={spec.angle.angleBMin}
                    min={0}
                    max={359}
                    step={0.5}
                    unit="°"
                    onChange={(v) => setAngle({ angleBMin: v })}
                  />
                  <RangeRow
                    label="angleB max"
                    value={spec.angle.angleBMax ?? 0}
                    min={0}
                    max={359}
                    step={0.5}
                    unit="°"
                    onChange={(v) => setAngle({ angleBMax: v })}
                  />
                </>
              )}
              <RangeRow
                label="N"
                value={spec.base.n}
                min={2}
                max={120}
                step={1}
                onChange={(v) => setBase({ n: v })}
              />
            </div>
          )}

          {mode === "bloom" && (
            <div className="flex flex-col gap-4">
              <RangeRow
                label="N min"
                value={spec.bloom?.nMin ?? 6}
                min={2}
                max={120}
                step={1}
                onChange={(v) => setBloom({ nMin: v })}
              />
              <RangeRow
                label="N max"
                value={spec.bloom?.nMax ?? 60}
                min={2}
                max={120}
                step={1}
                onChange={(v) => setBloom({ nMax: v })}
              />
              <RangeRow
                label="crossfade"
                value={spec.bloom?.crossfade ?? 0.35}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => setBloom({ crossfade: v })}
              />
              <RangeRow
                label="angleA"
                value={spec.base.angleA}
                min={0}
                max={359}
                step={0.5}
                unit="°"
                onChange={(v) => setBase({ angleA: v })}
              />
            </div>
          )}

          {mode === "morph" && (
            <div className="flex flex-col gap-4">
              <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                Interpolates A → B. Edit config A here; config B comes from the
                preset. Pick a morph preset for a full A↔B pair.
              </p>
              <RangeRow
                label="A · N"
                value={spec.base.n}
                min={2}
                max={120}
                step={1}
                onChange={(v) => setBase({ n: v })}
              />
              <RangeRow
                label="A · angleA"
                value={spec.base.angleA}
                min={0}
                max={359}
                step={0.5}
                unit="°"
                onChange={(v) => setBase({ angleA: v })}
              />
              <RangeRow
                label="A · angleB"
                value={spec.base.angleB}
                min={0}
                max={359}
                step={0.5}
                unit="°"
                onChange={(v) => setBase({ angleB: v })}
              />
              {spec.configB && (
                <div className="text-[11px] font-mono text-muted-foreground border-t border-border/40 pt-3">
                  B · N {spec.configB.n} · angleA {spec.configB.angleA}° · angleB{" "}
                  {spec.configB.angleB}°
                </div>
              )}
            </div>
          )}

          {/* Render options */}
          <div className="flex flex-col gap-4 border-t border-border/40 pt-4">
            <RangeRow
              label="step length"
              value={spec.base.stepLength}
              min={1}
              max={20}
              step={0.5}
              onChange={(v) => setBase({ stepLength: v })}
            />
            <RangeRow
              label="repetitions"
              value={spec.base.repetitions}
              min={1}
              max={60}
              step={1}
              onChange={(v) => setBase({ repetitions: v })}
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Motion trails</Label>
              <Switch checked={trails} onCheckedChange={setTrails} />
            </div>
          </div>

          <Button onClick={sendToCanvas} className="w-full mt-1" size="sm">
            <Send className="h-3.5 w-3.5" />
            Send current frame to Canvas
          </Button>
        </div>
      </div>

      {/* Transport bar */}
      <div className="border-t border-border/60 px-4 py-3 flex items-center gap-3">
        <Button
          size="icon"
          variant="default"
          className="h-9 w-9 shrink-0"
          onClick={() => {
            if (!playing && tRef.current >= 1) {
              setT(0);
              tRef.current = 0;
            }
            setPlaying((p) => !p);
          }}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button
          size="icon"
          variant={loop ? "default" : "outline"}
          className="h-9 w-9 shrink-0"
          onClick={() => setLoop((l) => !l)}
          title="Loop"
        >
          <Repeat className="h-4 w-4" />
        </Button>

        {/* Timeline scrubber */}
        <div className="flex-1 flex items-center gap-3">
          <Slider
            value={[t]}
            min={0}
            max={1}
            step={0.001}
            onValueChange={([v]) => {
              tRef.current = v;
              setT(v);
              renderAt(v);
            }}
            className="flex-1"
          />
          <span className="text-[11px] font-mono text-muted-foreground w-12 text-right">
            {(t * 100).toFixed(0)}%
          </span>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-2 w-40 shrink-0">
          <Label className="text-[11px] text-muted-foreground shrink-0">speed</Label>
          <Slider
            value={[speed]}
            min={0.02}
            max={0.6}
            step={0.01}
            onValueChange={([v]) => setSpeed(v)}
            className="flex-1"
          />
          <span className="text-[11px] font-mono text-muted-foreground w-9 text-right">
            {speed.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- range row control ---------------------------- */

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-[11px] font-mono text-violet-200">
          {Number.isInteger(step) ? value.toFixed(0) : value.toFixed(1)}
          {unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
