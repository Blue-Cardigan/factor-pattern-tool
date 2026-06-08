/*
 * lib/automata/types.ts — Shared grid + simulation types for the cellular
 * automata feature (turmites & Game of Life). Pure data, no React.
 */

/** A square grid of integer cell states, stored row-major in a flat Uint array. */
export interface Grid {
  rows: number;
  cols: number;
  /** Length rows*cols; cell (r,c) lives at r*cols + c. */
  cells: Uint8Array;
  /** Per-cell "age" since last change, for glow/fade colouring. */
  age: Uint16Array;
}

export function makeGrid(rows: number, cols: number): Grid {
  return {
    rows,
    cols,
    cells: new Uint8Array(rows * cols),
    age: new Uint16Array(rows * cols),
  };
}

export function idx(grid: Grid, r: number, c: number): number {
  return r * grid.cols + c;
}

/** Turn directions an ant can apply when it reads a cell state. */
export type Turn = "L" | "R" | "U" | "N"; // left, right, u-turn, none(straight)

/** Heading as a unit step on the grid; 0=up,1=right,2=down,3=left. */
export type Heading = 0 | 1 | 2 | 3;

/** One ant/turmite walking the grid. */
export interface Ant {
  r: number;
  c: number;
  heading: Heading;
  hue: number;
}

/**
 * A turmite turn table: for each cell state s (0..numStates-1) it gives the
 * turn the ant makes AND the new state to write into the cell. Classic
 * Langton's ant is numStates=2, table [{turn:"R",write:1},{turn:"L",write:0}].
 */
export interface TurnRule {
  turn: Turn;
  write: number;
}

export interface TurmiteSpec {
  numStates: number;
  table: TurnRule[];
}
