/*
 * lib/search/presets.ts — Quick target presets for inverse design.
 */

import type { SearchTarget } from "./scoring";
import { DEFAULT_TARGET } from "./scoring";

export interface TargetPreset {
  id: string;
  label: string;
  blurb: string;
  target: SearchTarget;
}

export const TARGET_PRESETS: TargetPreset[] = [
  {
    id: "six-fold-star",
    label: "6-fold star",
    blurb: "Closed hexagonal symmetry",
    target: {
      ...DEFAULT_TARGET,
      symmetry: 6,
      closedOnly: true,
      complexityMin: 45,
      complexityMax: 100,
      desiredTags: ["hexagonal"],
      elongation: -0.5,
    },
  },
  {
    id: "compact-dense-loop",
    label: "Compact dense loop",
    blurb: "Tight, busy, square-ish",
    target: {
      ...DEFAULT_TARGET,
      symmetry: "any",
      closedOnly: true,
      complexityMin: 50,
      complexityMax: 100,
      desiredTags: ["compact", "dense"],
      elongation: -0.8,
      densityMin: 0.55,
      densityMax: 1,
    },
  },
  {
    id: "elongated-sparse",
    label: "Elongated sparse",
    blurb: "Wandering, stretched lines",
    target: {
      ...DEFAULT_TARGET,
      symmetry: "any",
      closedOnly: false,
      complexityMin: 20,
      complexityMax: 70,
      desiredTags: ["elongated", "sparse"],
      elongation: 0.8,
      densityMin: 0,
      densityMax: 0.35,
    },
  },
  {
    id: "max-complexity",
    label: "Maximum complexity",
    blurb: "Richest closed structures",
    target: {
      ...DEFAULT_TARGET,
      symmetry: "any",
      closedOnly: true,
      complexityMin: 80,
      complexityMax: 100,
      desiredTags: [],
      elongation: 0,
    },
  },
];
