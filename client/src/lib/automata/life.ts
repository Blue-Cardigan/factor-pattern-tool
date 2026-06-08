/*
 * lib/automata/life.ts — Conway's Game of Life (B3/S23) on a toroidal grid,
 * plus seed generators including a factor-derived initial pattern.
 */

import { sharesFactor } from "@/lib/core/numberTheory";
import { Grid, makeGrid } from "./types";

/**
 * One Life generation, toroidal. Returns a NEW grid (double-buffer) and bumps
 * age on surviving cells. Birth rule B3, survival S23.
 */
export function stepLife(grid: Grid): Grid {
  const { rows, cols, cells, age } = grid;
  const next = makeGrid(rows, cols);
  for (let r = 0; r < rows; r++) {
    const up = (r - 1 + rows) % rows;
    const down = (r + 1) % rows;
    for (let c = 0; c < cols; c++) {
      const left = (c - 1 + cols) % cols;
      const right = (c + 1) % cols;
      const n =
        cells[up * cols + left] +
        cells[up * cols + c] +
        cells[up * cols + right] +
        cells[r * cols + left] +
        cells[r * cols + right] +
        cells[down * cols + left] +
        cells[down * cols + c] +
        cells[down * cols + right];
      const alive = cells[r * cols + c] === 1;
      const here = r * cols + c;
      if (alive && (n === 2 || n === 3)) {
        next.cells[here] = 1;
        next.age[here] = Math.min(0xffff, age[here] + 1);
      } else if (!alive && n === 3) {
        next.cells[here] = 1;
        next.age[here] = 0;
      } else {
        next.cells[here] = 0;
        next.age[here] = 0;
      }
    }
  }
  return next;
}

/** Fill the grid randomly with the given alive-probability (0..1). */
export function seedRandom(grid: Grid, p = 0.28): void {
  for (let i = 0; i < grid.cells.length; i++) {
    grid.cells[i] = Math.random() < p ? 1 : 0;
    grid.age[i] = 0;
  }
}

/** Stamp a relative cell list at an origin, with toroidal wrap. */
function stamp(grid: Grid, originR: number, originC: number, rel: [number, number][]) {
  for (const [dr, dc] of rel) {
    const r = (originR + dr + grid.rows) % grid.rows;
    const c = (originC + dc + grid.cols) % grid.cols;
    grid.cells[r * grid.cols + c] = 1;
  }
}

const GLIDER: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 0],
  [2, 1],
  [2, 2],
];

/** Gosper glider gun (canonical 36-wide pattern). */
const GLIDER_GUN: [number, number][] = [
  [0, 24],
  [1, 22],
  [1, 24],
  [2, 12],
  [2, 13],
  [2, 20],
  [2, 21],
  [2, 34],
  [2, 35],
  [3, 11],
  [3, 15],
  [3, 20],
  [3, 21],
  [3, 34],
  [3, 35],
  [4, 0],
  [4, 1],
  [4, 10],
  [4, 16],
  [4, 20],
  [4, 21],
  [5, 0],
  [5, 1],
  [5, 10],
  [5, 14],
  [5, 16],
  [5, 17],
  [5, 22],
  [5, 24],
  [6, 10],
  [6, 16],
  [6, 24],
  [7, 11],
  [7, 15],
  [8, 12],
  [8, 13],
];

/** Seed a single glider near the top-left. */
export function seedGlider(grid: Grid): void {
  clear(grid);
  stamp(grid, 2, 2, GLIDER);
}

/** Seed a Gosper glider gun. Needs >= ~38x12 to run; wraps otherwise. */
export function seedGliderGun(grid: Grid): void {
  clear(grid);
  stamp(grid, 2, 2, GLIDER_GUN);
}

/** Clear all cells & age. */
export function clear(grid: Grid): void {
  grid.cells.fill(0);
  grid.age.fill(0);
}

/**
 * Factor-derived Life seed: cell (r,c) starts ALIVE when gcd(r+1,c+1) shares a
 * factor with N — i.e. (r+1) and (c+1) and N have common structure. This paints
 * a symmetric arithmetic lattice that Life then dissolves into gliders/oscillators.
 */
export function seedFactor(grid: Grid, n: number): void {
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const g = gcd3(r + 1, c + 1);
      grid.cells[r * grid.cols + c] = sharesFactor(g, n) ? 1 : 0;
      grid.age[r * grid.cols + c] = 0;
    }
  }
}

function gcd3(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export { makeGrid };
