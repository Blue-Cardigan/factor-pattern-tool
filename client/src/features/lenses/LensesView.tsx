/*
 * features/lenses/LensesView.tsx — "Lenses" mode entry point.
 *
 * Alternate renderers over the same number stream (no turtle):
 *   · Chord diagram — modular-multiplication cardioid family (SVG, crisp).
 *   · Heatmap matrix — n×n relation field (canvas, fast at large N).
 *
 * Switchable via tabs. Each lens is self-contained with its own controls,
 * presets and colour schemes.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChordLens from "./ChordLens";
import HeatmapLens from "./HeatmapLens";

export default function LensesView() {
  return (
    <div className="flex h-full w-full flex-col bg-[#08070f]">
      <Tabs defaultValue="chord" className="flex h-full w-full flex-col gap-0">
        <div className="flex items-center justify-between border-b border-violet-500/15 px-4 py-2.5">
          <div className="flex flex-col">
            <h2 className="font-[Outfit,sans-serif] text-sm font-semibold text-violet-100">
              Lenses
            </h2>
            <p className="text-xs text-violet-300/55">
              Same numbers, different geometry. Pick a lens and play.
            </p>
          </div>
          <TabsList className="bg-violet-500/10">
            <TabsTrigger value="chord">Chords</TabsTrigger>
            <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chord" className="m-0 min-h-0 flex-1">
          <ChordLens />
        </TabsContent>
        <TabsContent value="heatmap" className="m-0 min-h-0 flex-1">
          <HeatmapLens />
        </TabsContent>
      </Tabs>
    </div>
  );
}
