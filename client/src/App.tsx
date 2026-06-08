/*
 * DESIGN PHILOSOPHY: Dark Generative Art Studio
 * App.tsx — Top-level routing: Canvas tab + Explorer tab
 * Shared state: config flows from Explorer → Canvas
 */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Explorer from "./pages/Explorer";
import { useState, useCallback } from "react";
import { PatternConfig, DEFAULT_CONFIG } from "./lib/patternEngine";
import { Grid2x2, Pencil } from "lucide-react";

function App() {
  const [tab, setTab] = useState<"canvas" | "explorer">("canvas");
  const [pendingConfig, setPendingConfig] = useState<Partial<PatternConfig> | null>(null);

  const handleLoadPattern = useCallback((patch: Partial<PatternConfig>) => {
    setPendingConfig(patch);
    setTab("canvas");
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
            {/* Tab bar */}
            <nav className="flex items-center gap-0 border-b border-border bg-card shrink-0 px-4">
              <button
                onClick={() => setTab("canvas")}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === "canvas"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Pencil size={13} />
                Canvas
              </button>
              <button
                onClick={() => setTab("explorer")}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === "explorer"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Grid2x2 size={13} />
                Explorer
              </button>
              <div className="ml-auto font-mono text-[10px] text-muted-foreground tracking-widest uppercase py-2.5">
                Factor Pattern Tool
              </div>
            </nav>

            {/* Views */}
            <div className="flex-1 overflow-hidden">
              <div className={tab === "canvas" ? "h-full" : "hidden h-full"}>
                <Home externalConfig={pendingConfig} onExternalConfigApplied={() => setPendingConfig(null)} />
              </div>
              <div className={tab === "explorer" ? "h-full" : "hidden h-full"}>
                <Explorer onLoadPattern={handleLoadPattern} />
              </div>
            </div>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
