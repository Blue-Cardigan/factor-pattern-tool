/*
 * lib/gif/recordMp4.ts — encode a FrameRenderer into a universally-shareable MP4
 * (H.264 / AAC-less) via WebCodecs + mp4-muxer.
 *
 * WhatsApp, iMessage and most messengers will not animate a standalone .gif —
 * they show the first frame static. A short, silent H.264 MP4 is the format they
 * recognise and auto-loop as a "GIF". This module produces exactly that.
 *
 * Dynamically imported by the recorder so mp4-muxer stays out of the initial
 * bundle and WebCodecs is only touched on browsers that have it.
 */

import type { PatternResult } from "@/lib/patternEngine";
import {
  createPatternRenderer,
  createCanvasRenderer,
  createSvgRenderer,
  type FrameRenderer,
  type PatternRenderOptions,
  type CaptureRenderOptions,
} from "./frames";
import type { EncodeOptions } from "./recordPattern";

/** True when the browser can encode H.264 in-page (WebCodecs VideoEncoder). */
export function mp4Supported(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
}

// H.264 codec strings to try, most-compatible first. Baseline 3.1 covers ≤720p
// and is decoded by virtually everything (iOS/Android WhatsApp included); Main
// 4.0 is the fallback if a platform only exposes hardware Main-profile encoding.
const CODEC_CANDIDATES = ["avc1.42E01F", "avc1.4D0028", "avc1.640028"];

async function pickCodec(width: number, height: number, framerate: number, bitrate: number): Promise<string> {
  for (const codec of CODEC_CANDIDATES) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec, width, height, framerate, bitrate });
      if (supported) return codec;
    } catch {
      /* isConfigSupported may reject on malformed strings — try the next */
    }
  }
  throw new Error("No supported H.264 encoder configuration in this browser");
}

/** Drive WebCodecs over a FrameRenderer, returning a silent looping-friendly MP4 Blob. */
export async function encodeMp4(r: FrameRenderer, opts: EncodeOptions = {}): Promise<Blob> {
  if (!mp4Supported()) throw new Error("MP4 export isn't supported in this browser");

  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");

  const width = r.width - (r.width % 2);
  const height = r.height - (r.height % 2);
  const fps = Math.max(1, Math.round(1000 / r.delayMs));
  // Patterns are flat-colour line art, so a modest bitrate is plenty; clamp to a
  // floor so small canvases still look clean.
  const bitrate = Math.max(1_500_000, Math.round(width * height * fps * 0.18));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height },
    fastStart: "in-memory", // moov atom up front → players (and WhatsApp) can start immediately
  });

  let encodeError: unknown = null;
  const codec = await pickCodec(width, height, fps, bitrate);
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e;
    },
  });
  encoder.configure({ codec, width, height, framerate: fps, bitrate });

  const frameDurUs = Math.round(1_000_000 / fps);
  for (let f = 0; f < r.frameCount; f++) {
    if (encodeError) break;
    await r.renderFrame(ctx, f);
    const frame = new VideoFrame(canvas, { timestamp: f * frameDurUs, duration: frameDurUs });
    // Keyframe every second keeps seeking/looping snappy and the file robust.
    encoder.encode(frame, { keyFrame: f % fps === 0 });
    frame.close();
    opts.onProgress?.(f + 1, r.frameCount);
    // Relieve encoder backpressure and keep the UI responsive.
    if (encoder.encodeQueueSize > 8) await new Promise((res) => setTimeout(res, 0));
  }

  await encoder.flush();
  encoder.close();
  if (encodeError) throw encodeError instanceof Error ? encodeError : new Error(String(encodeError));
  muxer.finalize();

  return new Blob([target.buffer], { type: "video/mp4" });
}

/* ----------------------------- convenience wrappers ----------------------------- */

export type Mp4PatternOptions = PatternRenderOptions & EncodeOptions;
export type Mp4CaptureOptions = CaptureRenderOptions & EncodeOptions;

/** Encode the pattern's draw-loop into an MP4 Blob. */
export function encodePatternMp4(result: PatternResult, opts: Mp4PatternOptions = {}): Promise<Blob> {
  return encodeMp4(createPatternRenderer(result, opts), opts);
}

/** Record a live <canvas> into an MP4. */
export function captureCanvasMp4(source: HTMLCanvasElement, opts: Mp4CaptureOptions = {}): Promise<Blob> {
  return encodeMp4(createCanvasRenderer(source, opts), opts);
}

/** Record a live <svg> into an MP4. */
export function captureSvgMp4(svg: SVGSVGElement, opts: Mp4CaptureOptions = {}): Promise<Blob> {
  return encodeMp4(createSvgRenderer(svg, opts), opts);
}
