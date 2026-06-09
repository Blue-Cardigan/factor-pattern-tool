/*
 * lib/gif/frames.ts — format-agnostic frame sources for the recorder.
 *
 * A FrameRenderer knows its dimensions, frame count and per-frame delay, and can
 * paint any frame index onto a 2D context. The GIF and MP4 encoders both consume
 * it, so the draw-loop / live-capture logic lives in exactly one place.
 */

import type { PatternResult } from "@/lib/patternEngine";
import { cycleHue, hslString } from "@/lib/patternEngine";

export interface FrameRenderer {
  /** Output width in px (always even, so H.264 4:2:0 is happy). */
  width: number;
  /** Output height in px (always even). */
  height: number;
  frameCount: number;
  /** Per-frame delay in ms (defines playback frame rate). */
  delayMs: number;
  /** Solid background colour the encoder can assume each frame is opaque over. */
  background: string;
  /** Paint frame `f` onto `ctx`; fills its own background. May await (live capture). */
  renderFrame: (ctx: CanvasRenderingContext2D, f: number) => void | Promise<void>;
}

/** Round down to the nearest even integer (≥ 2). */
const even = (n: number) => Math.max(2, Math.floor(n) & ~1);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ pattern replay ------------------------------ */

export type GifColorMode = "hue-cycle" | "factor-highlight" | "monochrome";

export interface PatternRenderOptions {
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

/** Replay the pattern's stroke-draw reveal as deterministic frames. */
export function createPatternRenderer(
  result: PatternResult,
  opts: PatternRenderOptions = {}
): FrameRenderer {
  const size = even(opts.size ?? 512);
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

  const totalCycles = segments.reduce((m, s) => Math.max(m, s.cycle), 0) + 1;

  const drawUpTo = (ctx: CanvasRenderingContext2D, count: number) => {
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

  return {
    width: size,
    height: size,
    frameCount: revealFrames + holdFrames,
    delayMs: delay,
    background,
    renderFrame: (ctx, f) => {
      const reveal =
        f < revealFrames
          ? Math.max(1, Math.round(((f + 1) / revealFrames) * segments.length))
          : segments.length;
      drawUpTo(ctx, reveal);
    },
  };
}

/* --------------------------- generic live capture --------------------------- */

export interface CaptureRenderOptions {
  /** Total seconds of animation to record. */
  durationMs?: number;
  fps?: number;
  /** Longest output edge in px (aspect preserved). */
  maxSize?: number;
  background?: string;
}

function fitSize(w: number, h: number, maxSize: number): [number, number] {
  const ar = w > 0 && h > 0 ? w / h : 1;
  let ow: number, oh: number;
  if (w >= h) {
    ow = Math.min(maxSize, Math.round(w));
    oh = Math.round(ow / ar);
  } else {
    oh = Math.min(maxSize, Math.round(h));
    ow = Math.round(oh * ar);
  }
  return [even(ow), even(oh)];
}

/** Sample a live <canvas> (2D or WebGL w/ preserveDrawingBuffer) in real time. */
export function createCanvasRenderer(
  source: HTMLCanvasElement,
  opts: CaptureRenderOptions = {}
): FrameRenderer {
  const durationMs = opts.durationMs ?? 2600;
  const fps = opts.fps ?? 18;
  const maxSize = opts.maxSize ?? 512;
  const background = opts.background ?? "#000000";
  const frameCount = Math.max(2, Math.round((durationMs / 1000) * fps));
  const delay = Math.round(1000 / fps);
  const [w, h] = fitSize(source.width || source.clientWidth, source.height || source.clientHeight, maxSize);

  return {
    width: w,
    height: h,
    frameCount,
    delayMs: delay,
    background,
    renderFrame: async (ctx) => {
      await sleep(delay); // sample the live animation in real time
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      try {
        ctx.drawImage(source, 0, 0, w, h);
      } catch {
        /* tainted/unavailable frame — leave background */
      }
    },
  };
}

/** Sample a live <svg> (re-serialized each frame) in real time. */
export function createSvgRenderer(svg: SVGSVGElement, opts: CaptureRenderOptions = {}): FrameRenderer {
  const durationMs = opts.durationMs ?? 2600;
  const fps = opts.fps ?? 12;
  const maxSize = opts.maxSize ?? 512;
  const background = opts.background ?? "#000000";
  const frameCount = Math.max(2, Math.round((durationMs / 1000) * fps));
  const delay = Math.round(1000 / fps);
  const rect = svg.getBoundingClientRect();
  const [w, h] = fitSize(rect.width, rect.height, maxSize);

  const snapshot = (): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(w));
      clone.setAttribute("height", String(h));
      const str = new XMLSerializer().serializeToString(clone);
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("svg snapshot failed"));
      img.src = url;
    });

  return {
    width: w,
    height: h,
    frameCount,
    delayMs: delay,
    background,
    renderFrame: async (ctx) => {
      await sleep(delay);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      try {
        const img = await snapshot();
        ctx.drawImage(img, 0, 0, w, h);
      } catch {
        /* skip frame on snapshot failure */
      }
    },
  };
}
