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

/** Returns a GIF blob + suggested filename. Reports 0..1-style progress. */
export type GifProvider = (
  onProgress: (done: number, total: number) => void
) => Promise<{ blob: Blob; filename: string }>;

export interface ModeContextValue {
  /** Load a preset into the Canvas mode and switch to it. */
  loadIntoCanvas: (preset: CanvasPreset) => void;
  /** Switch the active mode by id. */
  goToMode: (id: string) => void;
  /** Register (or clear with null) the active mode's GIF provider. */
  setGifProvider: (provider: GifProvider | null) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export const ModeProvider = ModeContext.Provider;

export function useModeContext(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    // Safe no-op fallback so a feature rendered outside the shell never crashes.
    return { loadIntoCanvas: () => {}, goToMode: () => {}, setGifProvider: () => {} };
  }
  return ctx;
}
