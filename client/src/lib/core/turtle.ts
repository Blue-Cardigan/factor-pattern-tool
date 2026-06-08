/*
 * core/turtle.ts — Walk a StepInstruction[] into geometry.
 *
 * runTurtle2D reproduces the original engine exactly (heading starts at 0° = +x,
 * the very first step of the very first cycle draws straight, every other step
 * applies its yaw BEFORE drawing). runTurtle3D extends the same idea into space
 * with a yaw+pitch heading vector.
 *
 * Closure detection: after each completed cycle we check whether we are back near
 * the origin. This matches the scan engine's notion of a "closed loop".
 */

import { Point, Point3, StepInstruction } from "./types";

const DEG = Math.PI / 180;

export interface Segment {
  from: Point;
  to: Point;
  cycle: number;
  step: number;
  klass: number;
  value?: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TurtleResult {
  segments: Segment[];
  bounds: Bounds;
  isClosed: boolean;
  closedAfterCycles: number | null;
  totalSteps: number;
}

export interface TurtleOptions {
  steps: StepInstruction[];
  stepLength: number;
  repetitions: number;
}

function approxEqual2(ax: number, ay: number, bx: number, by: number, eps = 0.5): boolean {
  return Math.abs(ax - bx) < eps && Math.abs(ay - by) < eps;
}

export function runTurtle2D({ steps, stepLength, repetitions }: TurtleOptions): TurtleResult {
  const segments: Segment[] = [];
  let x = 0;
  let y = 0;
  let angle = 0; // degrees, 0 = +x
  let isClosed = false;
  let closedAfterCycles: number | null = null;

  for (let cycle = 0; cycle < repetitions; cycle++) {
    for (let s = 0; s < steps.length; s++) {
      const instr = steps[s];
      const first = cycle === 0 && s === 0;
      if (!first) angle += instr.yaw;
      const rad = angle * DEG;
      const len = stepLength * (instr.stepScale ?? 1);
      const nx = x + len * Math.cos(rad);
      const ny = y + len * Math.sin(rad);
      segments.push({
        from: { x, y },
        to: { x: nx, y: ny },
        cycle,
        step: instr.i,
        klass: instr.klass,
        value: instr.value,
      });
      x = nx;
      y = ny;
    }
    if (!isClosed && approxEqual2(x, y, 0, 0)) {
      isClosed = true;
      closedAfterCycles = cycle + 1;
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const seg of segments) {
    for (const pt of [seg.from, seg.to]) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }
  if (!segments.length) {
    minX = maxX = minY = maxY = 0;
  }

  return {
    segments,
    bounds: { minX, maxX, minY, maxY },
    isClosed,
    closedAfterCycles,
    totalSteps: segments.length,
  };
}

/* ----------------------------- 3D variant ----------------------------- */

export interface Segment3 {
  from: Point3;
  to: Point3;
  cycle: number;
  step: number;
  klass: number;
  value?: number;
}

export interface Bounds3 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface Turtle3DResult {
  segments: Segment3[];
  bounds: Bounds3;
  isClosed: boolean;
  closedAfterCycles: number | null;
  totalSteps: number;
}

/**
 * 3D turtle: heading tracked as yaw (around Z) + pitch (toward Z). Each step's
 * `yaw`/`pitch` rotate the heading, then we advance. Pitch defaults to 0, so a
 * ruleset that only sets yaw produces a flat path in 3D space (handy for "lift"
 * comparisons).
 */
export function runTurtle3D({ steps, stepLength, repetitions }: TurtleOptions): Turtle3DResult {
  const segments: Segment3[] = [];
  let x = 0, y = 0, z = 0;
  let yaw = 0; // around vertical
  let pitch = 0; // elevation
  let isClosed = false;
  let closedAfterCycles: number | null = null;

  for (let cycle = 0; cycle < repetitions; cycle++) {
    for (let s = 0; s < steps.length; s++) {
      const instr = steps[s];
      const first = cycle === 0 && s === 0;
      if (!first) {
        yaw += instr.yaw;
        pitch += instr.pitch ?? 0;
      }
      const yr = yaw * DEG;
      const pr = pitch * DEG;
      const len = stepLength * (instr.stepScale ?? 1);
      const cp = Math.cos(pr);
      const nx = x + len * Math.cos(yr) * cp;
      const ny = y + len * Math.sin(yr) * cp;
      const nz = z + len * Math.sin(pr);
      segments.push({
        from: { x, y, z },
        to: { x: nx, y: ny, z: nz },
        cycle,
        step: instr.i,
        klass: instr.klass,
        value: instr.value,
      });
      x = nx; y = ny; z = nz;
    }
    if (!isClosed && Math.hypot(x, y, z) < 0.5) {
      isClosed = true;
      closedAfterCycles = cycle + 1;
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const seg of segments) {
    for (const pt of [seg.from, seg.to]) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
      if (pt.z < minZ) minZ = pt.z;
      if (pt.z > maxZ) maxZ = pt.z;
    }
  }
  if (!segments.length) {
    minX = maxX = minY = maxY = minZ = maxZ = 0;
  }

  return {
    segments,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    isClosed,
    closedAfterCycles,
    totalSteps: segments.length,
  };
}
