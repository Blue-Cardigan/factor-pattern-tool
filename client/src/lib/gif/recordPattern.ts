/*
 * lib/gif/recordPattern.ts — encode a looping GIF of the Canvas draw animation.
 *
 * Replays the stroke-draw reveal (the same "loop" you see on screen) onto an
 * offscreen canvas, capturing one frame per reveal step, then encodes a looping
 * GIF with gifenc (no worker). Dynamically imported by the Canvas so gifenc stays
 * out of the initial bundle.
 */

import { GIFEncoder, quantize, applyPalette } from "gifenc";
import type { PatternResult } from "@/lib/patternEngine";
import { cycleHue, hslString } from "@/lib/patternEngine";

export type GifColorMode = "hue-cycle" | "factor-highlight" | "monochrome";

export interface GifOptions {
  /** Output square size in px. */
  size?: number;
  /** Frames spent revealing the pattern. */
  revealFrames?: number;
  /** Frames holding the completed pattern before the loop restarts. */
  holdFrames?: number;
  /** Per-frame delay in ms. */
  delayMs?: number;
  strokeWidth?: number;
  colorMode?: GifColorMode;
  /** Neon glow (canvas shadow). Slightly slower to encode. */
  glow?: boolean;
  background?: string;
  onProgress?: (done: number, total: number) => void;
}

function colorForSegment(
  seg: PatternResult["segments"][number],
  totalCycles: number,
  colorMode: GifColorMode
): string {
  if (colorMode === "factor-highlight") {
    return seg.isFactor ? "hsl(340, 90%, 65%)" : "hsl(200, 80%, 60%)";
  }
  if (colorMode === "monochrome") return "hsl(270, 50%, 70%)";
  return hslString(cycleHue(seg.cycle, Math.max(totalCycles, 1)), 80, 62);
}

/** Encode the pattern's draw-loop into a GIF Blob. */
export async function encodePatternGif(result: PatternResult, opts: GifOptions = {}): Promise<Blob> {
  const size = opts.size ?? 512;
  const revealFrames = Math.max(2, opts.revealFrames ?? 48);
  const holdFrames = Math.max(0, opts.holdFrames ?? 12);
  const delay = opts.delayMs ?? 50;
  const sw = opts.strokeWidth ?? 2;
  const colorMode = opts.colorMode ?? "hue-cycle";
  const glow = opts.glow ?? true;
  const background = opts.background ?? "#000000";

  const { segments, bounds } = result;
  if (!segments.length) throw new Error("Nothing to record");

  const pad = Math.round(size * 0.06) + 8;
  const bw = bounds.maxX - bounds.minX || 1;
  const bh = bounds.maxY - bounds.minY || 1;
  const scale = Math.min((size - pad * 2) / bw, (size - pad * 2) / bh);
  const ox = (size - bw * scale) / 2 - bounds.minX * scale;
  const oy = (size - bh * scale) / 2 - bounds.minY * scale;
  const tx = (x: number) => x * scale + ox;
  const ty = (y: number) => y * scale + oy;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");

  const totalCycles = segments.reduce((m, s) => Math.max(m, s.cycle), 0) + 1;

  const drawUpTo = (count: number) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
    ctx.lineWidth = sw;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = glow ? sw * 2.2 : 0;

    // Draw runs of same-colour segments as single polylines (one per cycle).
    let i = 0;
    while (i < count) {
      const color = colorForSegment(segments[i], totalCycles, colorMode);
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(tx(segments[i].from.x), ty(segments[i].from.y));
      let j = i;
      while (j < count && colorForSegment(segments[j], totalCycles, colorMode) === color) {
        ctx.lineTo(tx(segments[j].to.x), ty(segments[j].to.y));
        j++;
      }
      ctx.stroke();
      i = j;
    }
    ctx.shadowBlur = 0;
  };

  const gif = GIFEncoder();
  const totalFrames = revealFrames + holdFrames;

  for (let f = 0; f < totalFrames; f++) {
    const reveal =
      f < revealFrames
        ? Math.max(1, Math.round(((f + 1) / revealFrames) * segments.length))
        : segments.length;
    drawUpTo(reveal);
    const { data } = ctx.getImageData(0, 0, size, size);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, size, size, { palette, delay });
    opts.onProgress?.(f + 1, totalFrames);
    // Yield so the UI stays responsive during encoding.
    await new Promise((r) => setTimeout(r, 0));
  }

  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
