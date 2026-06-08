/*
 * lib/lenses/relations.ts — pure relation + geometry helpers for the Lenses mode.
 *
 * Lenses render the *same number stream* (0..n-1) through alternate visualisations:
 *   - Chord diagrams: map each i -> f(i) and draw a chord on a circle.
 *   - Heatmap matrix: colour cell (r,c) by a binary/scalar relation.
 *
 * Everything here is dependency-light and pure so the React layer can memoise
 * freely and so the math stays testable. Number-theory primitives are reused
 * from the core seam (do not re-implement gcd/phi/etc.).
 */

import { gcd } from "@/lib/core/numberTheory";

// ─────────────────────────────────────────────────────────────────────────────
// Chord maps:  f : {0..n-1} -> {0..n-1}
// ─────────────────────────────────────────────────────────────────────────────

export type ChordMapId = "times" | "square" | "power";

export interface ChordMapDef {
  id: ChordMapId;
  label: string;
  /** Short human description for helper text. */
  blurb: string;
  /** True if this map uses the `mult` knob (the animatable one). */
  usesMult: boolean;
  /** True if this map uses the `exp` (exponent) knob. */
  usesExp: boolean;
}

export const CHORD_MAPS: ChordMapDef[] = [
  {
    id: "times",
    label: "Times table  ·  i·m mod n",
    blurb: "The classic cardioid / nephroid family. Animate m to watch it morph.",
    usesMult: true,
    usesExp: false,
  },
  {
    id: "square",
    label: "Square  ·  i² mod n",
    blurb: "Quadratic residues fold the circle into a lacework of arcs.",
    usesMult: false,
    usesExp: false,
  },
  {
    id: "power",
    label: "Power  ·  iᵏ mod n",
    blurb: "Higher powers wind the residues tighter. Sweep the exponent k.",
    usesMult: false,
    usesExp: true,
  },
];

/** Modular exponentiation iᵏ mod n (BigInt-safe for large k). */
export function modPow(base: number, exp: number, mod: number): number {
  if (mod <= 1) return 0;
  let result = 1n;
  let b = BigInt(((base % mod) + mod) % mod);
  let e = BigInt(Math.max(0, Math.floor(exp)));
  const m = BigInt(mod);
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return Number(result % m);
}

/** Evaluate the selected chord map at index i. */
export function chordTarget(
  mapId: ChordMapId,
  i: number,
  n: number,
  mult: number,
  exp: number,
): number {
  if (n <= 0) return 0;
  switch (mapId) {
    case "times":
      return ((i * Math.round(mult)) % n + n) % n;
    case "square":
      return modPow(i, 2, n);
    case "power":
      return modPow(i, exp, n);
    default:
      return i;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chord colouring
// ─────────────────────────────────────────────────────────────────────────────

export type ChordColorId = "index" | "gcd" | "length" | "mono";

export interface ChordColorDef {
  id: ChordColorId;
  label: string;
}

export const CHORD_COLORS: ChordColorDef[] = [
  { id: "index", label: "Hue by index i" },
  { id: "gcd", label: "Hue by gcd(i, f(i))" },
  { id: "length", label: "Hue by chord span" },
  { id: "mono", label: "Monochrome violet" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Heatmap relations:  g : (r,c) -> scalar  (normalised 0..1 for colouring)
// ─────────────────────────────────────────────────────────────────────────────

export type HeatRelationId = "gcd" | "product" | "coprime" | "divides";

export interface HeatRelationDef {
  id: HeatRelationId;
  label: string;
  blurb: string;
  /** Human-readable value at (r,c) for the hover readout. */
  readout: (r: number, c: number, n: number) => string;
  /** Raw scalar value at (r,c). */
  value: (r: number, c: number, n: number) => number;
  /** Normalised 0..1 intensity for colour mapping. */
  norm: (r: number, c: number, n: number) => number;
}

export const HEAT_RELATIONS: HeatRelationDef[] = [
  {
    id: "gcd",
    label: "gcd(r, c)",
    blurb: "Bright diagonals trace the common divisors. Composite n blooms; primes go dark.",
    value: (r, c) => gcd(r, c),
    readout: (r, c) => `gcd = ${gcd(r, c)}`,
    norm: (r, c, n) => {
      const g = gcd(r, c);
      return n <= 1 ? 0 : Math.min(1, Math.log2(1 + g) / Math.log2(n));
    },
  },
  {
    id: "product",
    label: "(r · c) mod n",
    blurb: "The full multiplication table folded modulo n — a moiré of residues.",
    value: (r, c, n) => (n <= 0 ? 0 : (r * c) % n),
    readout: (r, c, n) => `(r·c) mod n = ${n <= 0 ? 0 : (r * c) % n}`,
    norm: (r, c, n) => (n <= 1 ? 0 : ((r * c) % n) / (n - 1)),
  },
  {
    id: "coprime",
    label: "coprime?  gcd = 1",
    blurb: "Coprimality lattice — the structure behind Euler's totient.",
    value: (r, c) => (gcd(r, c) === 1 ? 1 : 0),
    readout: (r, c) => (gcd(r, c) === 1 ? "coprime (gcd = 1)" : `not coprime (gcd = ${gcd(r, c)})`),
    norm: (r, c) => (gcd(r, c) === 1 ? 1 : 0),
  },
  {
    id: "divides",
    label: "r divides c?",
    blurb: "Divisibility curtain — vertical streaks where r ∣ c.",
    value: (r, c) => (r > 0 && c % r === 0 ? 1 : 0),
    readout: (r, c) => (r > 0 && c % r === 0 ? `${r} ∣ ${c}` : `${r} ∤ ${c}`),
    norm: (r, c) => (r > 0 && c % r === 0 ? 1 : 0),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Colour schemes — t in 0..1 -> CSS rgb string. Dark / violet leaning.
// ─────────────────────────────────────────────────────────────────────────────

export type SchemeId = "violet" | "aurora" | "ember" | "ice";

export interface SchemeDef {
  id: SchemeId;
  label: string;
}

export const SCHEMES: SchemeDef[] = [
  { id: "violet", label: "Violet" },
  { id: "aurora", label: "Aurora" },
  { id: "ember", label: "Ember" },
  { id: "ice", label: "Ice" },
];

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Sample a scheme at t in 0..1, returning [r,g,b] each 0..255. */
export function schemeRGB(scheme: SchemeId, t: number): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  switch (scheme) {
    case "violet": {
      // near-black -> deep indigo -> electric violet -> pale lilac
      if (u < 0.5) return mix([10, 8, 22], [88, 44, 196], u / 0.5);
      return mix([88, 44, 196], [216, 188, 255], (u - 0.5) / 0.5);
    }
    case "aurora": {
      // indigo -> teal -> green
      if (u < 0.5) return mix([34, 20, 90], [22, 160, 170], u / 0.5);
      return mix([22, 160, 170], [120, 240, 160], (u - 0.5) / 0.5);
    }
    case "ember": {
      // deep plum -> magenta -> amber
      if (u < 0.5) return mix([24, 8, 30], [200, 40, 120], u / 0.5);
      return mix([200, 40, 120], [255, 196, 90], (u - 0.5) / 0.5);
    }
    case "ice": {
      // midnight -> steel blue -> white
      if (u < 0.5) return mix([8, 12, 28], [70, 120, 210], u / 0.5);
      return mix([70, 120, 210], [225, 240, 255], (u - 0.5) / 0.5);
    }
    default:
      return [u * 255, u * 255, u * 255];
  }
}

/** Hue (0..360) sampled along a scheme — used for SVG stroke colours. */
export function schemeHue(scheme: SchemeId, t: number): number {
  switch (scheme) {
    case "violet":
      return 250 + t * 40; // indigo -> violet
    case "aurora":
      return 260 - t * 130; // indigo -> green
    case "ember":
      return 320 - t * 280; // magenta -> amber
    case "ice":
      return 220 - t * 20;
    default:
      return t * 360;
  }
}

export function rgbString([r, g, b]: [number, number, number], a = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

/** Compact HSL(A) string from a raw hue (degrees) — used for SVG strokes. */
export function hslFromHue(h: number, s = 78, l = 62, a = 1): string {
  return `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chord geometry
// ─────────────────────────────────────────────────────────────────────────────

export interface ChordPoint {
  x: number;
  y: number;
}

export interface Chord {
  i: number;
  j: number;
  from: ChordPoint;
  to: ChordPoint;
  /** Normalised colour key 0..1 (meaning depends on selected colour mode). */
  t: number;
}

/** Position of index i on a unit-ish circle of given radius, centred at (cx,cy). */
export function pointOnCircle(i: number, n: number, cx: number, cy: number, radius: number): ChordPoint {
  // Start at top (-90°) and go clockwise so it reads like a clock face.
  const theta = (i / n) * Math.PI * 2 - Math.PI / 2;
  return { x: cx + Math.cos(theta) * radius, y: cy + Math.sin(theta) * radius };
}

/** Build all chords for the current settings. Self-loops (i===j) are dropped. */
export function buildChords(opts: {
  n: number;
  mapId: ChordMapId;
  mult: number;
  exp: number;
  colorId: ChordColorId;
  cx: number;
  cy: number;
  radius: number;
}): Chord[] {
  const { n, mapId, mult, exp, colorId, cx, cy, radius } = opts;
  const chords: Chord[] = [];
  if (n < 2) return chords;
  for (let i = 0; i < n; i++) {
    const j = chordTarget(mapId, i, n, mult, exp);
    if (j === i) continue;
    const from = pointOnCircle(i, n, cx, cy, radius);
    const to = pointOnCircle(j, n, cx, cy, radius);
    let t: number;
    switch (colorId) {
      case "index":
        t = i / n;
        break;
      case "gcd": {
        const g = gcd(i, j);
        t = n <= 1 ? 0 : Math.min(1, Math.log2(1 + g) / Math.log2(n));
        break;
      }
      case "length": {
        // angular span between i and j, normalised to 0..1
        const d = Math.abs(i - j);
        const span = Math.min(d, n - d) / (n / 2);
        t = span;
        break;
      }
      case "mono":
      default:
        t = 0.65;
        break;
    }
    chords.push({ i, j, from, to, t });
  }
  return chords;
}
