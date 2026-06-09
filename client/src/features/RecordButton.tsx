/*
 * features/RecordButton.tsx — global "record this view" control, floated over the
 * active mode's output. Exports an MP4 (recommended — messengers like WhatsApp
 * animate MP4 but show a standalone GIF as a frozen first frame) or a GIF.
 *
 * Prefers a mode-registered frame source (deterministic, high quality); otherwise
 * live-captures the largest <canvas>, or falls back to re-serializing the largest
 * <svg>. The same frame source feeds either encoder.
 */

import { useState } from "react";
import { Film, Video, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { RecordProvider, RecordSource } from "./ModeContext";
import { createCanvasRenderer, createSvgRenderer } from "@/lib/gif/frames";

type Format = "mp4" | "gif";

const MP4_SUPPORTED = typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;

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

/** Build a frame source from whatever's on screen when no provider is registered. */
function fallbackSource(main: HTMLElement | null): RecordSource | null {
  const canvas = largestCanvas(main);
  if (canvas && canvas.clientWidth > 0) {
    return { renderer: createCanvasRenderer(canvas), baseName: "factor-pattern" };
  }
  const svg = largestSvg(main);
  if (svg) return { renderer: createSvgRenderer(svg), baseName: "factor-pattern" };
  return null;
}

export default function RecordButton({
  mainRef,
  providerRef,
}: {
  mainRef: React.RefObject<HTMLElement | null>;
  providerRef: React.MutableRefObject<RecordProvider | null>;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [activeFormat, setActiveFormat] = useState<Format | null>(null);
  const busy = progress !== null;

  const run = async (format: Format) => {
    if (busy) return;
    setActiveFormat(format);
    setProgress(0);
    const onProgress = (d: number, t: number) => setProgress(Math.round((d / t) * 100));
    try {
      const provider = providerRef.current;
      const source = provider ? provider() : fallbackSource(mainRef.current);
      if (!source) {
        toast.error("Nothing animated to record here");
        return;
      }

      let blob: Blob;
      if (format === "mp4") {
        const { encodeMp4 } = await import("@/lib/gif/recordMp4");
        blob = await encodeMp4(source.renderer, { onProgress });
      } else {
        const { encodeGif } = await import("@/lib/gif/recordPattern");
        blob = await encodeGif(source.renderer, { onProgress });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${source.baseName}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} exported!`);
    } catch (e) {
      toast.error(`${format.toUpperCase()} export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setActiveFormat(null);
      setProgress(null);
    }
  };

  const pill =
    "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors disabled:opacity-70";

  return (
    <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 rounded-full border border-border bg-card/90 p-1 shadow-lg backdrop-blur">
      {busy ? (
        <span className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-foreground">
          <Loader2 size={14} className="animate-spin" />
          {activeFormat?.toUpperCase()} {progress}%
        </span>
      ) : (
        <>
          {MP4_SUPPORTED && (
            <button
              onClick={() => run("mp4")}
              title="Export a looping MP4 (best for WhatsApp, iMessage & social)"
              className={`${pill} bg-primary/10 text-primary hover:bg-primary/20`}
            >
              <Video size={14} />
              MP4
            </button>
          )}
          <button
            onClick={() => run("gif")}
            title="Export a looping GIF (best for embeds & Slack)"
            className={`${pill} text-foreground hover:text-primary`}
          >
            <Film size={14} />
            GIF
          </button>
        </>
      )}
    </div>
  );
}
