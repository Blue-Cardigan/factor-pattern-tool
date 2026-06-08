/*
 * features/automata/AutomataView.tsx — Direction 3: Game-of-Life-inspired
 * cellular systems on a canvas, with two modes (Turmite / Life), factor-driven
 * seeding, and presets. Pure sim logic lives in @/lib/automata.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  StepForward,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cycleHue, hslString } from "@/lib/patternEngine";

import {
  Ant,
  Grid,
  TurmiteSpec,
  makeGrid,
} from "@/lib/automata/types";
import {
  ageGrid,
  centerAnt,
  divisorTurmiteSpec,
  factorTurmiteSpec,
  langtonSpec,
  stepTurmite,
} from "@/lib/automata/turmite";
import {
  seedFactor,
  seedGlider,
  seedGliderGun,
  seedRandom,
  stepLife,
} from "@/lib/automata/life";

type Mode = "turmite" | "life";
type TurmiteKind = "langton" | "factor" | "divisor";
type LifeSeed = "random" | "glider" | "gun" | "factor";

interface Preset {
  label: string;
  mode: Mode;
  gridSize: number;
  n: number;
  speed: number;
  turmiteKind?: TurmiteKind;
  lifeSeed?: LifeSeed;
}

const PRESETS: Preset[] = [
  { label: "Langton highway", mode: "turmite", gridSize: 120, n: 12, speed: 90, turmiteKind: "langton" },
  { label: "Factor ant N=12", mode: "turmite", gridSize: 120, n: 12, speed: 80, turmiteKind: "factor" },
  { label: "Divisor ant N=24", mode: "turmite", gridSize: 120, n: 24, speed: 80, turmiteKind: "divisor" },
  { label: "Glider gun", mode: "life", gridSize: 90, n: 12, speed: 18, lifeSeed: "gun" },
  { label: "Factor seed Life N=30", mode: "life", gridSize: 90, n: 30, speed: 14, lifeSeed: "factor" },
];

export default function AutomataView() {
  const [mode, setMode] = useState<Mode>("turmite");
  const [gridSize, setGridSize] = useState(120);
  const [n, setN] = useState(12);
  const [speed, setSpeed] = useState(80); // steps-ish per second
  const [running, setRunning] = useState(false);
  const [turmiteKind, setTurmiteKind] = useState<TurmiteKind>("factor");
  const [lifeSeed, setLifeSeed] = useState<LifeSeed>("factor");
  const [generation, setGeneration] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridRef = useRef<Grid>(makeGrid(gridSize, gridSize));
  const antsRef = useRef<Ant[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const accRef = useRef(0);

  const turmiteSpec: TurmiteSpec = useMemo(() => {
    if (turmiteKind === "langton") return langtonSpec();
    if (turmiteKind === "divisor") return divisorTurmiteSpec(n);
    return factorTurmiteSpec(n);
  }, [turmiteKind, n]);
  const turmiteSpecRef = useRef(turmiteSpec);
  turmiteSpecRef.current = turmiteSpec;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  /* ---- seeding / reset ---- */
  const reset = useCallback(() => {
    const g = makeGrid(gridSize, gridSize);
    gridRef.current = g;
    setGeneration(0);
    if (mode === "turmite") {
      // Langton ant runs longest with a single ant; factor/divisor get a few.
      const count = turmiteKind === "langton" ? 1 : 3;
      const ants: Ant[] = [];
      for (let k = 0; k < count; k++) {
        const a = centerAnt(g, cycleHue(k, count));
        a.r = Math.floor(g.rows / 2) + (k - 1) * 2;
        a.c = Math.floor(g.cols / 2) + (k - 1) * 2;
        a.heading = (k % 4) as Ant["heading"];
        ants.push(a);
      }
      antsRef.current = ants;
    } else {
      antsRef.current = [];
      if (lifeSeed === "random") seedRandom(g);
      else if (lifeSeed === "glider") seedGlider(g);
      else if (lifeSeed === "gun") seedGliderGun(g);
      else seedFactor(g, n);
    }
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSize, mode, n, turmiteKind, lifeSeed]);

  const randomize = useCallback(() => {
    const g = gridRef.current;
    if (mode === "life") {
      seedRandom(g);
      setGeneration(0);
      draw();
    } else {
      // scatter ants randomly
      const count = turmiteKind === "langton" ? 1 : 4;
      const ants: Ant[] = [];
      for (let k = 0; k < count; k++) {
        const a = centerAnt(g, cycleHue(k, count));
        a.r = Math.floor(Math.random() * g.rows);
        a.c = Math.floor(Math.random() * g.cols);
        a.heading = Math.floor(Math.random() * 4) as Ant["heading"];
        ants.push(a);
      }
      antsRef.current = ants;
      draw();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, turmiteKind]);

  /* ---- one simulation generation ---- */
  const advance = useCallback((times = 1) => {
    for (let t = 0; t < times; t++) {
      if (modeRef.current === "turmite") {
        // run several turmite steps per generation so highways form fast
        const sub = 6;
        for (let s = 0; s < sub; s++) {
          stepTurmite(gridRef.current, antsRef.current, turmiteSpecRef.current);
        }
        ageGrid(gridRef.current);
      } else {
        gridRef.current = stepLife(gridRef.current);
      }
    }
    setGeneration((x) => x + times);
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- rendering ---- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const g = gridRef.current;
    const W = canvas.width;
    const H = canvas.height;
    const cw = W / g.cols;
    const ch = H / g.rows;

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, W, H);

    const isTurmite = modeRef.current === "turmite";
    const numStates = turmiteSpecRef.current.numStates;

    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const i = r * g.cols + c;
        const state = g.cells[i];
        if (state === 0) continue;
        let hue: number;
        let light: number;
        if (isTurmite) {
          hue = (state / numStates) * 300 + 260; // violet-ward spread
          const a = g.age[i];
          light = 38 + Math.min(28, a * 0.4);
        } else {
          const a = g.age[i];
          hue = 270 + Math.min(80, a * 4); // young=violet, old drifts to magenta/cyan
          light = 48 + Math.min(22, a * 1.5);
        }
        ctx.fillStyle = hslString(hue, 85, light);
        ctx.fillRect(c * cw, r * ch, Math.ceil(cw), Math.ceil(ch));
      }
    }

    // subtle glow pass for Life (additive bloom on bright cells)
    if (!isTurmite) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.12;
      for (let r = 0; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++) {
          const i = r * g.cols + c;
          if (g.cells[i] === 0) continue;
          ctx.fillStyle = hslString(280, 90, 60);
          ctx.fillRect(c * cw - cw, r * ch - ch, cw * 3, ch * 3);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // draw ants
    if (isTurmite) {
      for (const ant of antsRef.current) {
        ctx.fillStyle = hslString(ant.hue, 95, 70);
        ctx.shadowColor = hslString(ant.hue, 95, 65);
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(
          ant.c * cw + cw / 2,
          ant.r * ch + ch / 2,
          Math.max(2, cw * 0.6),
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, []);

  /* ---- raf loop ---- */
  useEffect(() => {
    if (!running) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTimeRef.current = performance.now();
    accRef.current = 0;
    const loop = (now: number) => {
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;
      accRef.current += dt;
      const interval = 1000 / Math.max(1, speed);
      let steps = 0;
      while (accRef.current >= interval && steps < 20) {
        advance(1);
        accRef.current -= interval;
        steps++;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, speed, advance]);

  /* ---- resize canvas to its box ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const size = Math.floor(Math.min(parent.clientWidth, parent.clientHeight));
      canvas.width = size;
      canvas.height = size;
      draw();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [draw]);

  /* ---- re-seed whenever structural knobs change ---- */
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSize, mode, n, turmiteKind, lifeSeed]);

  const applyPreset = useCallback((p: Preset) => {
    setRunning(false);
    setMode(p.mode);
    setGridSize(p.gridSize);
    setN(p.n);
    setSpeed(p.speed);
    if (p.turmiteKind) setTurmiteKind(p.turmiteKind);
    if (p.lifeSeed) setLifeSeed(p.lifeSeed);
  }, []);

  return (
    <div className="flex h-full w-full flex-col gap-4 bg-[#06060a] p-4 text-zinc-200 lg:flex-row">
      {/* canvas stage */}
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-violet-500/20 bg-[#0a0a0f] p-3 shadow-[0_0_60px_-20px] shadow-violet-600/40">
        <div className="flex aspect-square h-full max-h-full w-full max-w-full items-center justify-center">
          <canvas
            ref={canvasRef}
            className="rounded-lg"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      </div>

      {/* control panel */}
      <div className="flex w-full shrink-0 flex-col gap-5 overflow-y-auto rounded-xl border border-violet-500/15 bg-[#0c0c12] p-5 lg:w-80">
        <div>
          <h2
            className="text-lg font-semibold tracking-tight text-violet-200"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Cellular Automata
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Walk factor-driven ants, or run Conway&apos;s Life seeded by N&apos;s
            arithmetic. Pick a preset to start.
          </p>
        </div>

        {/* mode tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="w-full bg-violet-950/40">
            <TabsTrigger value="turmite">Turmite</TabsTrigger>
            <TabsTrigger value="life">Game of Life</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* presets */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs uppercase tracking-wide text-violet-300/70">
            Presets
          </Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                size="sm"
                variant="outline"
                onClick={() => applyPreset(p)}
                className="border-violet-500/30 bg-violet-500/5 text-xs text-violet-200 hover:bg-violet-500/15"
              >
                <Sparkles className="size-3" /> {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* mode-specific seed selector */}
        {mode === "turmite" ? (
          <div className="flex flex-col gap-2">
            <Label className="text-xs uppercase tracking-wide text-violet-300/70">
              Ant rule
            </Label>
            <Select
              value={turmiteKind}
              onValueChange={(v) => setTurmiteKind(v as TurmiteKind)}
            >
              <SelectTrigger className="border-violet-500/25 bg-violet-950/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="langton">Langton (classic 2-state)</SelectItem>
                <SelectItem value="factor">Factor table (from N)</SelectItem>
                <SelectItem value="divisor">Divisor structure (from N)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label className="text-xs uppercase tracking-wide text-violet-300/70">
              Seed
            </Label>
            <Select
              value={lifeSeed}
              onValueChange={(v) => setLifeSeed(v as LifeSeed)}
            >
              <SelectTrigger className="border-violet-500/25 bg-violet-950/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="factor">Factor lattice (from N)</SelectItem>
                <SelectItem value="random">Random soup</SelectItem>
                <SelectItem value="glider">Single glider</SelectItem>
                <SelectItem value="gun">Gosper glider gun</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* N */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-violet-300/70">
              N (factor seed)
            </Label>
            <span className="font-mono text-sm text-violet-200">{n}</span>
          </div>
          <Slider
            value={[n]}
            min={2}
            max={60}
            step={1}
            onValueChange={([v]) => setN(v)}
          />
        </div>

        {/* grid size */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-violet-300/70">
              Grid size
            </Label>
            <span className="font-mono text-sm text-violet-200">
              {gridSize}&times;{gridSize}
            </span>
          </div>
          <Slider
            value={[gridSize]}
            min={40}
            max={200}
            step={10}
            onValueChange={([v]) => setGridSize(v)}
          />
        </div>

        {/* speed */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-violet-300/70">
              Speed
            </Label>
            <span className="font-mono text-sm text-violet-200">{speed}/s</span>
          </div>
          <Slider
            value={[speed]}
            min={1}
            max={120}
            step={1}
            onValueChange={([v]) => setSpeed(v)}
          />
        </div>

        {/* transport */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setRunning((r) => !r)}
            className="flex-1 bg-violet-600 text-white hover:bg-violet-500"
          >
            {running ? (
              <>
                <Pause className="size-4" /> Pause
              </>
            ) : (
              <>
                <Play className="size-4" /> Play
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setRunning(false);
              advance(1);
            }}
            className="border-violet-500/30 text-violet-200"
          >
            <StepForward className="size-4" /> Step
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setRunning(false);
              reset();
            }}
            className="flex-1 border-violet-500/30 text-violet-200"
          >
            <RotateCcw className="size-4" /> Reset
          </Button>
          <Button
            variant="outline"
            onClick={randomize}
            className="flex-1 border-violet-500/30 text-violet-200"
          >
            <Shuffle className="size-4" /> Randomize
          </Button>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-violet-500/10 pt-3 text-xs text-zinc-500">
          <span>gen</span>
          <span className="font-mono text-violet-300">{generation}</span>
        </div>
      </div>
    </div>
  );
}
