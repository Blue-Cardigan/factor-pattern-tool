/*
 * lib/automata/turmite.ts — Langton's-ant / multi-state turmite engine, plus
 * factor-derived turn tables.
 *
 * The factor twist: we build the per-state turn table from the classic factor
 * rule's StepInstruction[] for a chosen N. Each cell state s maps to step
 * i = s+1 (1..numStates); the sign of that step's yaw (klass) decides L vs R.
 * So the ant's behaviour is literally seeded by N's coprime/shares-factor
 * structure. Emergent highways still appear, but their grammar is N's.
 */

import { classicFactorRule } from "@/lib/core/rulesets";
import { divisors } from "@/lib/core/numberTheory";
import {
  Ant,
  Grid,
  Heading,
  TurmiteSpec,
  TurnRule,
  idx,
  makeGrid,
} from "./types";

/** Step deltas indexed by Heading (0=up,1=right,2=down,3=left). */
const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

function applyTurn(h: Heading, turn: TurnRule["turn"]): Heading {
  switch (turn) {
    case "L":
      return ((h + 3) % 4) as Heading;
    case "R":
      return ((h + 1) % 4) as Heading;
    case "U":
      return ((h + 2) % 4) as Heading;
    default:
      return h;
  }
}

/**
 * Classic 2-state Langton's ant: on white(0) turn right & paint black(1);
 * on black(1) turn left & paint white(0). Produces the famous ~10k-step highway.
 */
export function langtonSpec(): TurmiteSpec {
  return {
    numStates: 2,
    table: [
      { turn: "R", write: 1 },
      { turn: "L", write: 0 },
    ],
  };
}

/**
 * Factor-derived turmite for N. numStates = clamp(N, 2..12). For state s we read
 * the classic factor rule's step (s+1): if it shares a factor with N (klass 1,
 * positive yaw with factorTurnsRight) the ant turns Right, else Left. The cell is
 * advanced to the next state cyclically, giving a multi-colour trail whose
 * branching mirrors N's divisor texture.
 */
export function factorTurmiteSpec(n: number): TurmiteSpec {
  const numStates = Math.max(2, Math.min(12, n));
  const steps = classicFactorRule.generate({
    n: numStates,
    angleA: 90,
    angleB: 90,
    factorTurnsRight: true,
  });
  const table: TurnRule[] = [];
  for (let s = 0; s < numStates; s++) {
    const step = steps[s]; // step for i = s+1
    const turn = step && step.yaw >= 0 ? "R" : "L";
    table.push({ turn, write: (s + 1) % numStates });
  }
  return { numStates, table };
}

/**
 * Divisor-structured turmite: turn directions come straight from N's divisor
 * list. Each state corresponds to a divisor d of N; if d is even the ant turns
 * one way, odd the other, with a U-turn injected on the largest proper divisor
 * to seed richer structure. Distinct from factorTurmiteSpec — coarser, blockier.
 */
export function divisorTurmiteSpec(n: number): TurmiteSpec {
  const ds = divisors(n).filter((d) => d > 1); // drop trivial 1
  const numStates = Math.max(2, Math.min(12, ds.length || 2));
  const table: TurnRule[] = [];
  for (let s = 0; s < numStates; s++) {
    const d = ds[s] ?? s + 2;
    let turn: TurnRule["turn"] = d % 2 === 0 ? "R" : "L";
    if (s === numStates - 1) turn = "U";
    table.push({ turn, write: (s + 1) % numStates });
  }
  return { numStates, table };
}

/** Spawn one ant centred on the grid heading up. */
export function centerAnt(grid: Grid, hue = 280): Ant {
  return {
    r: Math.floor(grid.rows / 2),
    c: Math.floor(grid.cols / 2),
    heading: 0 as Heading,
    hue,
  };
}

/**
 * Advance every ant by one turmite step (read cell -> turn -> write -> move).
 * Mutates grid in place. Ants that step off-grid wrap toroidally so the system
 * keeps running. Returns the grid for chaining.
 */
export function stepTurmite(grid: Grid, ants: Ant[], spec: TurmiteSpec): Grid {
  const { rows, cols } = grid;
  for (const ant of ants) {
    const here = idx(grid, ant.r, ant.c);
    const state = grid.cells[here] % spec.numStates;
    const rule = spec.table[state];
    ant.heading = applyTurn(ant.heading, rule.turn);
    grid.cells[here] = rule.write;
    grid.age[here] = 0;
    // step forward with toroidal wrap
    ant.r = (ant.r + DR[ant.heading] + rows) % rows;
    ant.c = (ant.c + DC[ant.heading] + cols) % cols;
  }
  return grid;
}

/** Increment age on every live (non-zero) cell — call once per generation. */
export function ageGrid(grid: Grid): void {
  const { cells, age } = grid;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 0 && age[i] < 0xffff) age[i]++;
  }
}

export { makeGrid };
