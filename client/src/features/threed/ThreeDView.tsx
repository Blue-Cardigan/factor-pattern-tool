/*
 * features/threed/ThreeDView.tsx — Direction 2: a TRUE 3D factor pattern.
 *
 * We take a yaw-only factor ruleset and inject a per-step PITCH derived from a
 * number-theoretic property of each step (ω, Ω, gcd buckets, τ, or an alternating
 * saw). Feeding both into runTurtle3D lifts the classic 2D factor walk into a
 * helix / tower / shell that you can orbit around.
 */

import { useMemo, useState, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, Grid, GizmoHelper, GizmoViewport } from "@react-three/drei";

import { runTurtle3D, Segment3 } from "@/lib/core/turtle";
import { allRulesets, DEFAULT_RULESET_ID } from "@/lib/core/rulesets";
import { RulesetParams } from "@/lib/core/types";
import { build3DSteps, PITCH_MODES, PitchMode } from "@/lib/threed/build3d";
import { cycleHue, hslString } from "@/lib/patternEngine";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_SEGMENTS = 20000;
const OUTFIT = { fontFamily: "'Outfit', sans-serif" } as const;

interface Config {
  rulesetId: string;
  n: number;
  yawAngle: number;
  pitchAngle: number;
  pitchMode: PitchMode;
  repetitions: number;
  stepLength: number;
  factorTurnsRight: boolean;
}

const DEFAULT_CONFIG: Config = {
  rulesetId: DEFAULT_RULESET_ID,
  n: 12,
  yawAngle: 90,
  pitchAngle: 14,
  pitchMode: "omega",
  repetitions: 24,
  stepLength: 8,
  factorTurnsRight: true,
};

const PRESETS: { name: string; config: Partial<Config> }[] = [
  { name: "Helix N=12", config: { n: 12, yawAngle: 30, pitchAngle: 10, pitchMode: "alternate", repetitions: 40, stepLength: 7 } },
  { name: "Tower N=24", config: { n: 24, yawAngle: 90, pitchAngle: 22, pitchMode: "omega", repetitions: 30, stepLength: 8 } },
  { name: "Sphere-ish N=30", config: { n: 30, yawAngle: 137, pitchAngle: 18, pitchMode: "gcd", repetitions: 36, stepLength: 9 } },
  { name: "Tangle N=18", config: { n: 18, yawAngle: 154, pitchAngle: 26, pitchMode: "tau", repetitions: 28, stepLength: 8 } },
];

/* One <Line> per cycle, hue-cycled, with a faint additive glow underneath. */
function CycleLine({ pts, hue }: { pts: [number, number, number][]; hue: number }) {
  if (pts.length < 2) return null;
  return (
    <group>
      <Line points={pts} color={hslString(hue, 75, 35)} lineWidth={6} transparent opacity={0.35} />
      <Line points={pts} color={hslString(hue, 90, 62)} lineWidth={2.4} />
    </group>
  );
}

function Scene({ segments, center, radius, autoRotate, controlsRef }: {
  segments: Segment3[];
  center: [number, number, number];
  radius: number;
  autoRotate: boolean;
  controlsRef: React.RefObject<any>;
}) {
  // Group segments by cycle into contiguous point-strips (turtle Z -> scene up).
  const cycles = useMemo(() => {
    const byCycle = new Map<number, [number, number, number][]>();
    let maxCycle = 0;
    for (const s of segments) {
      maxCycle = Math.max(maxCycle, s.cycle);
      let arr = byCycle.get(s.cycle);
      if (!arr) {
        arr = [[s.from.x, s.from.z, -s.from.y]];
        byCycle.set(s.cycle, arr);
      }
      arr.push([s.to.x, s.to.z, -s.to.y]);
    }
    const total = maxCycle + 1;
    return Array.from(byCycle.entries()).map(([cycle, pts]) => ({
      cycle,
      pts,
      hue: cycleHue(cycle, total),
    }));
  }, [segments]);

  return (
    <>
      <color attach="background" args={["#0a0a0f"]} />
      <fog attach="fog" args={["#0a0a0f", radius * 2.2, radius * 6]} />
      <ambientLight intensity={0.6} />
      <pointLight position={[radius, radius, radius]} intensity={0.8} />

      <Grid
        position={[center[0], center[1] - radius * 0.85, center[2]]}
        args={[radius * 6, radius * 6]}
        cellSize={radius * 0.25}
        cellColor="#22222e"
        sectionSize={radius}
        sectionColor="#3a2a5a"
        fadeDistance={radius * 7}
        fadeStrength={1.5}
        infiniteGrid
      />

      <group position={[-center[0], -center[1], -center[2]]}>
        {cycles.map((c) => (
          <CycleLine key={c.cycle} pts={c.pts} hue={c.hue} />
        ))}
      </group>

      <OrbitControls
        ref={controlsRef}
        autoRotate={autoRotate}
        autoRotateSpeed={0.8}
        enableDamping
        dampingFactor={0.08}
        target={[0, 0, 0]}
      />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport axisColors={["#7c3aed", "#a78bfa", "#4c1d95"]} labelColor="white" />
      </GizmoHelper>
    </>
  );
}

export default function ThreeDView() {
  const [cfg, setCfg] = useState<Config>(DEFAULT_CONFIG);
  const [autoRotate, setAutoRotate] = useState(true);
  const controlsRef = useRef<any>(null);

  const set = useCallback(<K extends keyof Config>(key: K, value: Config[K]) => {
    setCfg((c) => ({ ...c, [key]: value }));
  }, []);

  const applyPreset = useCallback((p: Partial<Config>) => {
    setCfg((c) => ({ ...c, ...p }));
  }, []);

  const rulesets = useMemo(() => allRulesets(), []);

  const { segments, center, radius, capped, totalSteps } = useMemo(() => {
    const params: RulesetParams = {
      n: cfg.n,
      angleA: cfg.yawAngle,
      angleB: cfg.yawAngle,
      factorTurnsRight: cfg.factorTurnsRight,
    };
    const steps = build3DSteps({
      rulesetId: cfg.rulesetId,
      params,
      pitchMode: cfg.pitchMode,
      pitchAngle: cfg.pitchAngle,
    });
    const res = runTurtle3D({ steps, stepLength: cfg.stepLength, repetitions: cfg.repetitions });
    let segs = res.segments;
    const isCapped = segs.length > MAX_SEGMENTS;
    if (isCapped) segs = segs.slice(0, MAX_SEGMENTS);

    const b = res.bounds;
    // turtle Z -> scene up when computing center/radius
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minZ + b.maxZ) / 2;
    const cz = -(b.minY + b.maxY) / 2;
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ, 1);
    return {
      segments: segs,
      center: [cx, cy, cz] as [number, number, number],
      radius: span / 2 || 50,
      capped: isCapped,
      totalSteps: res.totalSteps,
    };
  }, [cfg]);

  const resetView = useCallback(() => {
    controlsRef.current?.reset?.();
  }, []);

  const camDist = radius * 2.6;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0f] text-zinc-100">
      <Canvas
        key={radius.toFixed(1)}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [camDist, camDist * 0.7, camDist], fov: 45, near: 0.1, far: radius * 40 }}
        dpr={[1, 2]}
      >
        <Scene
          segments={segments}
          center={center}
          radius={radius}
          autoRotate={autoRotate}
          controlsRef={controlsRef}
        />
      </Canvas>

      {/* Controls panel */}
      <div className="absolute left-4 top-4 z-10 flex max-h-[calc(100%-2rem)] w-72 flex-col gap-4 overflow-y-auto rounded-xl border border-white/10 bg-black/55 p-4 backdrop-blur-md">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-primary" style={OUTFIT}>
            3D Factor Walk
          </h2>
          <p className="mt-1 text-xs leading-snug text-zinc-400">
            The classic factor turn drives yaw; a number-theory quantity lifts each
            step into a helix, tower or shell. Drag to orbit.
          </p>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.name}
              variant="outline"
              size="sm"
              className="h-7 border-white/15 bg-white/5 px-2 text-[11px] hover:bg-primary/20 hover:text-primary"
              onClick={() => applyPreset(p.config)}
            >
              {p.name}
            </Button>
          ))}
        </div>

        {/* Ruleset */}
        <Field label="Ruleset">
          <Select value={cfg.rulesetId} onValueChange={(v) => set("rulesetId", v)}>
            <SelectTrigger className="h-8 border-white/15 bg-white/5 text-xs">
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
        </Field>

        {/* Pitch mode */}
        <Field label="Pitch driver">
          <Select value={cfg.pitchMode} onValueChange={(v) => set("pitchMode", v as PitchMode)}>
            <SelectTrigger className="h-8 border-white/15 bg-white/5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PITCH_MODES.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <NumberSlider label="N" value={cfg.n} min={2} max={120} step={1} onChange={(v) => set("n", v)} />
        <NumberSlider label="Yaw angle" value={cfg.yawAngle} min={1} max={179} step={1} unit="°" onChange={(v) => set("yawAngle", v)} />
        <NumberSlider label="Pitch angle" value={cfg.pitchAngle} min={0} max={45} step={1} unit="°" onChange={(v) => set("pitchAngle", v)} />
        <NumberSlider label="Repetitions" value={cfg.repetitions} min={1} max={120} step={1} onChange={(v) => set("repetitions", v)} />
        <NumberSlider label="Step length" value={cfg.stepLength} min={1} max={20} step={1} onChange={(v) => set("stepLength", v)} />

        <Row>
          <Label className="text-xs text-zinc-300">Factor turns right</Label>
          <Switch checked={cfg.factorTurnsRight} onCheckedChange={(v) => set("factorTurnsRight", v)} />
        </Row>
        <Row>
          <Label className="text-xs text-zinc-300">Auto-rotate</Label>
          <Switch checked={autoRotate} onCheckedChange={setAutoRotate} />
        </Row>

        <Button
          variant="outline"
          size="sm"
          className="h-8 border-primary/40 bg-primary/10 text-xs text-primary hover:bg-primary/25"
          onClick={resetView}
        >
          Reset view
        </Button>

        <p className="font-mono text-[10px] leading-tight text-zinc-500">
          {totalSteps.toLocaleString()} steps{capped ? ` · showing first ${MAX_SEGMENTS.toLocaleString()}` : ""}
        </p>
      </div>
    </div>
  );
}

/* ----------------------------- small UI bits ----------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-zinc-300">{label}</Label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between">{children}</div>;
}

function NumberSlider({ label, value, min, max, step, unit, onChange }: {
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
        <Label className="text-xs text-zinc-300">{label}</Label>
        <span className="font-mono text-xs text-primary">{value}{unit ?? ""}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}
