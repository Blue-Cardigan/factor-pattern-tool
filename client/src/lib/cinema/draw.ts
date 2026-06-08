/*
 * lib/cinema/draw.ts — render a ComputedFrame to a 2D canvas.
 *
 * Fits the pattern to the canvas using the turtle's bounds, colours segments by
 * cycle hue, supports a crossfade between primary/secondary layers, and an
 * optional motion-trail fade (caller draws a translucent black rect instead of
 * clearing). Pure imperative drawing — no React.
 */

import type { TurtleResult, Segment } from "@/lib/core/turtle";
import { cycleHue, hslString } from "@/lib/patternEngine";
import type { ComputedFrame } from "./frames";

const PAD = 0.08; // fraction of the smaller dimension kept as margin

function fit(
  bounds: TurtleResult["bounds"],
  w: number,
  h: number,
): { scale: number; ox: number; oy: number } {
  const bw = Math.max(1e-6, bounds.maxX - bounds.minX);
  const bh = Math.max(1e-6, bounds.maxY - bounds.minY);
  const pad = Math.min(w, h) * PAD;
  const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
  const ox = (w - bw * scale) / 2 - bounds.minX * scale;
  const oy = (h - bh * scale) / 2 - bounds.minY * scale;
  return { scale, ox, oy };
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  result: TurtleResult,
  w: number,
  h: number,
  alpha: number,
  totalCycles: number,
): void {
  if (!result.segments.length || alpha <= 0) return;
  const { scale, ox, oy } = fit(result.bounds, w, h);
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.globalAlpha = alpha;

  let prevKlassHue = -1;
  ctx.beginPath();
  for (let i = 0; i < result.segments.length; i++) {
    const s: Segment = result.segments[i];
    const hue = cycleHue(s.cycle, totalCycles);
    if (hue !== prevKlassHue) {
      if (i > 0) ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = hslString(hue, 78, s.klass === 1 ? 64 : 55);
      prevKlassHue = hue;
    }
    ctx.moveTo(s.from.x * scale + ox, s.from.y * scale + oy);
    ctx.lineTo(s.to.x * scale + ox, s.to.y * scale + oy);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export interface DrawOptions {
  /** When true, fade the previous frame instead of clearing (motion trails). */
  trails?: boolean;
  /** Trail decay alpha per frame, 0..1 (lower = longer trails). */
  trailFade?: number;
  /** Canvas background colour (used when clearing). */
  bg?: string;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: ComputedFrame,
  w: number,
  h: number,
  opts: DrawOptions = {},
): void {
  const { trails = false, trailFade = 0.18, bg = "#0a0813" } = opts;

  if (trails) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = trailFade;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  } else {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  const totalCycles = Math.max(
    1,
    frame.primary.segments.length
      ? frame.primary.segments[frame.primary.segments.length - 1].cycle + 1
      : 1,
  );

  const blend = frame.blend;
  drawLayer(ctx, frame.primary, w, h, 1 - blend, totalCycles);
  if (frame.secondary && blend > 0) {
    const secCycles = Math.max(
      1,
      frame.secondary.segments.length
        ? frame.secondary.segments[frame.secondary.segments.length - 1].cycle + 1
        : 1,
    );
    drawLayer(ctx, frame.secondary, w, h, blend, secCycles);
  }
}
