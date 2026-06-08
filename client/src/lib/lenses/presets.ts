/*
 * lib/lenses/presets.ts — curated starting points for the Lenses mode.
 * Each preset fully configures one lens so a casual user gets an instant payoff.
 */

import type { ChordColorId, ChordMapId, HeatRelationId, SchemeId } from "./relations";

export interface ChordPreset {
  kind: "chord";
  label: string;
  hint: string;
  n: number;
  mapId: ChordMapId;
  mult: number;
  exp: number;
  colorId: ChordColorId;
  scheme: SchemeId;
}

export interface HeatPreset {
  kind: "heat";
  label: string;
  hint: string;
  n: number;
  relationId: HeatRelationId;
  scheme: SchemeId;
}

export type LensPreset = ChordPreset | HeatPreset;

export const CHORD_PRESETS: ChordPreset[] = [
  {
    kind: "chord",
    label: "Cardioid ×2",
    hint: "The famous heart curve — i·2 mod 200.",
    n: 200,
    mapId: "times",
    mult: 2,
    exp: 3,
    colorId: "index",
    scheme: "violet",
  },
  {
    kind: "chord",
    label: "Nephroid ×3",
    hint: "Two-lobed kidney curve at multiplier 3.",
    n: 240,
    mapId: "times",
    mult: 3,
    exp: 3,
    colorId: "length",
    scheme: "aurora",
  },
  {
    kind: "chord",
    label: "Quadratic lace",
    hint: "i² mod 180 — quadratic residues.",
    n: 180,
    mapId: "square",
    mult: 2,
    exp: 2,
    colorId: "gcd",
    scheme: "ember",
  },
];

export const HEAT_PRESETS: HeatPreset[] = [
  {
    kind: "heat",
    label: "Coprimality N=60",
    hint: "The lattice behind Euler's totient.",
    n: 60,
    relationId: "coprime",
    scheme: "violet",
  },
  {
    kind: "heat",
    label: "gcd field N=96",
    hint: "Common-divisor diagonals over a composite N.",
    n: 96,
    relationId: "gcd",
    scheme: "aurora",
  },
  {
    kind: "heat",
    label: "Mult table N=120",
    hint: "(r·c) mod 120 moiré.",
    n: 120,
    relationId: "product",
    scheme: "ice",
  },
];
