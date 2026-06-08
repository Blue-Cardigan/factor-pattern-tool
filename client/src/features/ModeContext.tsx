/*
 * features/ModeContext.tsx — lets any mode push a pattern into the Canvas and
 * switch the active mode, without prop-drilling through the shell.
 *
 * Usage inside a feature component:
 *   const { loadIntoCanvas } = useModeContext();
 *   loadIntoCanvas({ rulesetId: "classic-factor", n: 24, angleA: 90 });
 */

import { createContext, useContext } from "react";
import type { CanvasPreset } from "./types";

export interface ModeContextValue {
  /** Load a preset into the Canvas mode and switch to it. */
  loadIntoCanvas: (preset: CanvasPreset) => void;
  /** Switch the active mode by id. */
  goToMode: (id: string) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export const ModeProvider = ModeContext.Provider;

export function useModeContext(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    // Safe no-op fallback so a feature rendered outside the shell never crashes.
    return { loadIntoCanvas: () => {}, goToMode: () => {} };
  }
  return ctx;
}
