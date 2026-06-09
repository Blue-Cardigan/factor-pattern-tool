/*
 * lib/gif/recordPattern.ts — encode a FrameRenderer into a looping GIF.
 *
 * The frame production (pattern draw-loop, live canvas/svg capture) lives in
 * ./frames; this module just drives gifenc over those frames. Dynamically
 * imported by the recorder so gifenc stays out of the initial bundle.
 */

import { GIFEncoder, quantize, applyPalette } from "gifenc";
import type { PatternResult } from "@/lib/patternEngine";
import {
  createPatternRenderer,
  createCanvasRenderer,
  createSvgRenderer,
  type FrameRenderer,
  type PatternRenderOptions,
  type CaptureRenderOptions,
  type GifColorMode,
} from "./frames";

export type { GifColorMode } from "./frames";

export interface EncodeOptions {
  onProgress?: (done: number, total: number) => void;
}

/** Drive gifenc over a FrameRenderer, returning a looping GIF Blob. */
export async function encodeGif(r: FrameRenderer, opts: EncodeOptions = {}): Promise<Blob> {
  const { width, height, frameCount, delayMs } = r;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");

  const gif = GIFEncoder();
  for (let f = 0; f < frameCount; f++) {
    await r.renderFrame(ctx, f);
    const { data } = ctx.getImageData(0, 0, width, height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, { palette, delay: delayMs });
    opts.onProgress?.(f + 1, frameCount);
    // Yield so the UI stays responsive during encoding.
    await new Promise((res) => setTimeout(res, 0));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

/* ----------------------------- convenience wrappers ----------------------------- */

export type GifOptions = PatternRenderOptions & EncodeOptions;
export type CaptureOptions = CaptureRenderOptions & EncodeOptions;
export type { GifColorMode as ColorMode };

/** Encode the pattern's draw-loop into a GIF Blob. */
export function encodePatternGif(result: PatternResult, opts: GifOptions = {}): Promise<Blob> {
  return encodeGif(createPatternRenderer(result, opts), opts);
}

/** Record a live <canvas> into a GIF. */
export function captureCanvasGif(source: HTMLCanvasElement, opts: CaptureOptions = {}): Promise<Blob> {
  return encodeGif(createCanvasRenderer(source, opts), opts);
}

/** Record a live <svg> into a GIF. */
export function captureSvgGif(svg: SVGSVGElement, opts: CaptureOptions = {}): Promise<Blob> {
  return encodeGif(createSvgRenderer(svg, opts), opts);
}
