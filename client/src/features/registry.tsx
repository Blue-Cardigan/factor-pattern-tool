/*
 * features/registry.tsx — the single list of app modes.
 *
 * Add a mode here and it appears in the nav rail automatically. Each mode's
 * render() returns a small wrapper that bridges the shell context to the
 * feature component's props. Feature components themselves stay self-contained
 * and zero-prop where possible (they read core lib + ModeContext directly).
 */

import { lazy } from "react";
import { Pencil, Boxes, Grid3x3, Aperture, Film, Search, LibraryBig, Music } from "lucide-react";
import type { FeatureMode, CanvasPreset } from "./types";
import { useModeContext } from "./ModeContext";

// Canvas is the default mode — keep it eager. Everything else (esp. the
// three.js-heavy 3D view) is code-split so it only loads when first opened.
import StudioView from "./studio/StudioView";
const Explorer = lazy(() => import("@/pages/Explorer"));
const ThreeDView = lazy(() => import("./threed/ThreeDView"));
const AutomataView = lazy(() => import("./automata/AutomataView"));
const SonifyView = lazy(() => import("./sonify/SonifyView"));
const LensesView = lazy(() => import("./lenses/LensesView"));
const CinemaView = lazy(() => import("./cinema/CinemaView"));
const SearchView = lazy(() => import("./search/SearchView"));

import type { PatternConfig } from "@/lib/patternEngine";

/** Map the cross-feature CanvasPreset onto the classic PatternConfig fields. */
export function presetToPatternConfig(p: CanvasPreset): Partial<PatternConfig> {
  const patch: Partial<PatternConfig> = {};
  if (p.n !== undefined) patch.n = p.n;
  if (p.angleA !== undefined) patch.factorAngle = p.angleA;
  if (p.angleB !== undefined) patch.nonFactorAngle = p.angleB;
  if (p.stepLength !== undefined) patch.stepLength = p.stepLength;
  if (p.repetitions !== undefined) patch.repetitions = p.repetitions;
  if (p.factorTurnsRight !== undefined) patch.factorTurnsRight = p.factorTurnsRight;
  return patch;
}

function ExplorerMode() {
  const { loadIntoCanvas } = useModeContext();
  return (
    <Explorer
      onLoadPattern={(patch) => {
        // Explorer scans a chosen rule symmetrically (angleA === angleB).
        loadIntoCanvas({
          rulesetId: patch.rulesetId ?? "classic-factor",
          n: patch.n,
          angleA: patch.factorAngle,
          angleB: patch.nonFactorAngle,
          stepLength: patch.stepLength,
          repetitions: patch.repetitions,
          factorTurnsRight: patch.factorTurnsRight,
        });
      }}
    />
  );
}

export const MODES: FeatureMode[] = [
  {
    id: "canvas",
    label: "Canvas",
    blurb: "Draw a factor pattern and tune its rules live.",
    group: "create",
    icon: Pencil,
    recordable: true,
    render: ({ pendingPreset, clearPending }) => (
      <StudioView
        externalPreset={pendingPreset}
        onExternalConfigApplied={clearPending}
      />
    ),
  },
  {
    id: "threed",
    label: "3D",
    blurb: "Lift the pattern into space — a turtle that climbs.",
    group: "create",
    icon: Boxes,
    recordable: true,
    render: () => <ThreeDView />,
  },
  {
    id: "automata",
    label: "Automata",
    blurb: "Factor-driven ants & life — watch patterns interact.",
    group: "create",
    icon: Grid3x3,
    recordable: true,
    render: () => <AutomataView />,
  },
  {
    id: "sound",
    label: "Sound",
    blurb: "Hear the turn sequence as a melody.",
    group: "create",
    icon: Music,
    recordable: true,
    render: () => <SonifyView />,
  },
  {
    id: "lenses",
    label: "Lenses",
    blurb: "Same numbers, new views: chords & heatmaps.",
    group: "explore",
    icon: Aperture,
    recordable: true,
    render: () => <LensesView />,
  },
  {
    id: "cinema",
    label: "Cinema",
    blurb: "Animate N and angle — watch patterns morph.",
    group: "explore",
    icon: Film,
    recordable: true,
    render: () => <CinemaView />,
  },
  {
    id: "find",
    label: "Find",
    blurb: "Search for a pattern by symmetry or shape.",
    group: "explore",
    icon: Search,
    render: () => <SearchView />,
  },
  {
    id: "gallery",
    label: "Gallery",
    blurb: "Auto-scan closed loops, graded by complexity.",
    group: "explore",
    icon: LibraryBig,
    render: () => <ExplorerMode />,
  },
];

export const DEFAULT_MODE_ID = "canvas";
