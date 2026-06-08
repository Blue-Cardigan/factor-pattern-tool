/*
 * features/types.ts — Cross-feature contracts for the mode-based app shell.
 *
 * The app is organised as a set of "modes" (Canvas, 3D, Automata, Lenses,
 * Cinema, Find, Gallery). Any mode can hand a pattern to the Canvas via the
 * ModeContext (see ModeContext.tsx). CanvasPreset is the lingua franca for that
 * handoff — a superset of the classic config plus a ruleset id + arbitrary knob
 * values, so newer rulesets survive the round-trip.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface CanvasPreset {
  rulesetId?: string;
  n?: number;
  angleA?: number;
  angleB?: number;
  factorTurnsRight?: boolean;
  stepLength?: number;
  repetitions?: number;
  knobs?: Record<string, number | boolean>;
}

export type ModeGroup = "create" | "explore";

export interface FeatureMode {
  id: string;
  label: string;
  /** One-line, casual-user-friendly description shown under the label. */
  blurb: string;
  group: ModeGroup;
  icon: LucideIcon;
  /** Whether the global GIF recorder button should appear for this mode. */
  recordable?: boolean;
  /** Render the mode. ctx is supplied by the shell. */
  render: (ctx: ModeRenderContext) => ReactNode;
}

export interface ModeRenderContext {
  /** Config the Canvas should adopt when it next mounts/activates (or null). */
  pendingPreset: CanvasPreset | null;
  /** Canvas calls this once it has consumed pendingPreset. */
  clearPending: () => void;
}
