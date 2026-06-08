/*
 * features/GifRecorderButton.tsx — global "record this view as a GIF" button,
 * floated over the active mode's output. Prefers a mode-registered GIF provider
 * (deterministic, high quality); otherwise live-captures the largest <canvas>,
 * or falls back to re-serializing the largest <svg>.
 */

import { useState } from "react";
import { Film, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { GifProvider } from "./ModeContext";

function largestCanvas(root: HTMLElement | null): HTMLCanvasElement | null {
  if (!root) return null;
  let best: HTMLCanvasElement | null = null;
  let bestArea = 0;
  root.querySelectorAll("canvas").forEach((c) => {
    const el = c as HTMLCanvasElement;
    const area = el.clientWidth * el.clientHeight;
    if (area > bestArea) {
      bestArea = area;
      best = el;
    }
  });
  return best;
}

function largestSvg(root: HTMLElement | null): SVGSVGElement | null {
  if (!root) return null;
  let best: SVGSVGElement | null = null;
  let bestArea = 0;
  root.querySelectorAll("svg").forEach((s) => {
    const el = s as unknown as SVGSVGElement;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea) {
      bestArea = area;
      best = el;
    }
  });
  return best;
}

export default function GifRecorderButton({
  mainRef,
  providerRef,
}: {
  mainRef: React.RefObject<HTMLElement | null>;
  providerRef: React.MutableRefObject<GifProvider | null>;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const busy = progress !== null;

  const run = async () => {
    if (busy) return;
    setProgress(0);
    const onProgress = (d: number, t: number) => setProgress(Math.round((d / t) * 100));
    try {
      let blob: Blob;
      let filename = "factor-pattern.gif";

      const provider = providerRef.current;
      if (provider) {
        const r = await provider(onProgress);
        blob = r.blob;
        filename = r.filename;
      } else {
        const main = mainRef.current;
        const canvas = largestCanvas(main);
        const mod = await import("@/lib/gif/recordPattern");
        if (canvas && canvas.clientWidth > 0) {
          blob = await mod.captureCanvasGif(canvas, { onProgress });
        } else {
          const svg = largestSvg(main);
          if (!svg) {
            toast.error("Nothing animated to record here");
            setProgress(null);
            return;
          }
          blob = await mod.captureSvgGif(svg, { onProgress });
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("GIF exported!");
    } catch (e) {
      toast.error(`GIF export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProgress(null);
    }
  };

  return (
    <button
      onClick={run}
      disabled={busy}
      title="Record a looping GIF of this view"
      className="absolute bottom-4 right-4 z-30 flex items-center gap-1.5 rounded-full border border-border bg-card/90 backdrop-blur px-3.5 py-2 text-xs font-medium text-foreground shadow-lg hover:border-primary/60 hover:text-primary transition-colors disabled:opacity-70"
    >
      {busy ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          Recording {progress}%
        </>
      ) : (
        <>
          <Film size={14} />
          GIF
        </>
      )}
    </button>
  );
}
