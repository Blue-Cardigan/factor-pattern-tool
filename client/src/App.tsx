/*
 * DESIGN PHILOSOPHY: Dark Generative Art Studio
 * App.tsx — Mode-based shell. A left icon rail lists every feature mode
 * (grouped Create / Explore); the active mode renders to the right. Any mode can
 * push a pattern into Canvas and switch to it via ModeContext.
 *
 * Modes are declared in features/registry.tsx — add one there and it shows up
 * here automatically.
 */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { useState, useCallback, useMemo, useRef, Suspense } from "react";
import { MODES, DEFAULT_MODE_ID } from "./features/registry";
import { ModeProvider, type GifProvider } from "./features/ModeContext";
import GifRecorderButton from "./features/GifRecorderButton";
import type { CanvasPreset, ModeGroup } from "./features/types";

const GROUP_LABELS: Record<ModeGroup, string> = {
  create: "Create",
  explore: "Explore",
};

function App() {
  const [activeId, setActiveId] = useState<string>(DEFAULT_MODE_ID);
  const [pendingPreset, setPendingPreset] = useState<CanvasPreset | null>(null);

  const loadIntoCanvas = useCallback((preset: CanvasPreset) => {
    setPendingPreset(preset);
    setActiveId("canvas");
  }, []);

  const goToMode = useCallback((id: string) => setActiveId(id), []);
  const clearPending = useCallback(() => setPendingPreset(null), []);

  const mainRef = useRef<HTMLElement>(null);
  const gifProviderRef = useRef<GifProvider | null>(null);
  const setGifProvider = useCallback((p: GifProvider | null) => {
    gifProviderRef.current = p;
  }, []);

  const ctxValue = useMemo(
    () => ({ loadIntoCanvas, goToMode, setGifProvider }),
    [loadIntoCanvas, goToMode, setGifProvider]
  );

  const groups = useMemo(() => {
    const g: Record<ModeGroup, typeof MODES> = { create: [], explore: [] };
    for (const m of MODES) g[m.group].push(m);
    return g;
  }, []);

  const active = MODES.find((m) => m.id === activeId) ?? MODES[0];

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider delayDuration={200}>
          <Toaster />
          <ModeProvider value={ctxValue}>
            <div className="flex h-screen w-screen overflow-hidden bg-background">
              {/* Left nav rail */}
              <nav className="w-[68px] shrink-0 h-full flex flex-col items-center gap-1 border-r border-border bg-card py-3 overflow-y-auto">
                <div className="mb-2 px-1 text-center">
                  <div
                    className="text-[10px] font-bold leading-tight text-primary"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    FACTOR
                  </div>
                  <div className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
                    lab
                  </div>
                </div>

                {(["create", "explore"] as ModeGroup[]).map((group) => (
                  <div key={group} className="w-full flex flex-col items-center">
                    <div className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground/60 mt-3 mb-1">
                      {GROUP_LABELS[group]}
                    </div>
                    {groups[group].map((m) => {
                      const Icon = m.icon;
                      const isActive = m.id === activeId;
                      return (
                        <Tooltip key={m.id}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setActiveId(m.id)}
                              className={`group relative w-[52px] h-[46px] my-0.5 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors ${
                                isActive
                                  ? "bg-primary/15 text-primary"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                              }`}
                            >
                              {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-primary" />
                              )}
                              <Icon size={17} />
                              <span className="text-[9px] font-medium leading-none">{m.label}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[220px]">
                            <div className="font-semibold text-xs">{m.label}</div>
                            <div className="text-[11px] text-muted-foreground">{m.blurb}</div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Active mode */}
              <main ref={mainRef} className="relative flex-1 h-full overflow-hidden">
                <Suspense
                  fallback={
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                      Loading {active.label}…
                    </div>
                  }
                >
                  {active.render({ pendingPreset, clearPending })}
                </Suspense>
                {active.recordable && (
                  <GifRecorderButton mainRef={mainRef} providerRef={gifProviderRef} />
                )}
              </main>
            </div>
          </ModeProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
