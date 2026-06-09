/*
 * features/ModeContext.tsx — lets any mode push a pattern into the Canvas, switch
 * modes, and register a high-quality GIF provider for the global recorder.
 *
 *   const { loadIntoCanvas } = useModeContext();
 *   loadIntoCanvas({ rulesetId: "classic-factor", n: 24, angleA: 90 });
 *
 * A mode whose on-screen animation can't be captured well by live screen-grab
 * (e.g. the SVG draw-loop) can register a provider that renders frames
 * deterministically; the global GIF button prefers it over generic capture.
 */

import { createContext, useContext } from "react";
import type { CanvasPreset } from "./types";
import type { FrameRenderer } from "@/lib/gif/frames";

/**
 * A deterministic frame source for the recorder plus a base filename (no
 * extension — the recorder appends .gif / .mp4). Format-agnostic so the same
 * provider feeds both the GIF and MP4 encoders.
 */
export interface RecordSource {
  renderer: FrameRenderer;
  baseName: string;
}
export type RecordProvider = () => RecordSource;

export interface ModeContextValue {
  /** Load a preset into the Canvas mode and switch to it. */
  loadIntoCanvas: (preset: CanvasPreset) => void;
  /** Switch the active mode by id. */
  goToMode: (id: string) => void;
  /** Register (or clear with null) the active mode's recorder frame source. */
  setRecordProvider: (provider: RecordProvider | null) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export const ModeProvider = ModeContext.Provider;

export function useModeContext(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    // Safe no-op fallback so a feature rendered outside the shell never crashes.
    return { loadIntoCanvas: () => {}, goToMode: () => {}, setRecordProvider: () => {} };
  }
  return ctx;
}
