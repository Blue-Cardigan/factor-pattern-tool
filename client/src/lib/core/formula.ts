/*
 * core/formula.ts — A SAFE recursive-descent expression evaluator + Ruleset.
 *
 * No eval / no new Function. The expression is compiled once into a closure
 * (i, n) => number. Parse errors never throw at runtime: compile() returns a
 * function that yields 0 (and exposes the parse error via compileExpr()).
 *
 * Grammar (lowest -> highest precedence):
 *   ternary  := or ( "?" ternary ":" ternary )?
 *   or       := and ( "||" and )*
 *   and      := cmp ( "&&" cmp )*
 *   cmp      := add ( ("<"|">"|"<="|">="|"=="|"!=") add )*
 *   add      := mul ( ("+"|"-") mul )*
 *   mul      := pow ( ("*"|"/"|"%") pow )*
 *   pow      := unary ( "^" pow )?            // right-assoc
 *   unary    := ("-"|"+"|"!") unary | atom
 *   atom     := number | ident | call | "(" ternary ")"
 *   call     := ident "(" args? ")"
 *
 * Vars: i, n, pi, e, tau.
 * Functions: gcd, lcm, isprime, omega, Omega, tau, sigma, phi, mu, mod,
 *            abs, floor, ceil, round, min, max, sqrt, sin, cos, sign, log, pow.
 */

import {
  Ruleset,
  RulesetParams,
  StepInstruction,
} from "./types";
import {
  gcd,
  lcm,
  isPrime,
  omega,
  bigOmega,
  tau as tauFn,
  sigma,
  phi,
  mobius,
} from "./numberTheory";

export interface CompileResult {
  /** (i, n) => degrees. Always callable; yields 0 if the expr failed to parse. */
  fn: (i: number, n: number) => number;
  /** true if the expression parsed cleanly. */
  ok: boolean;
  /** Human-readable parse error, or null when ok. */
  error: string | null;
}

/* ----------------------------- AST nodes ----------------------------- */

type Node =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "unary"; op: string; a: Node }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "ternary"; cond: Node; a: Node; b: Node }
  | { t: "call"; name: string; args: Node[] };

/* ----------------------------- tokenizer ----------------------------- */

type Tok =
  | { k: "num"; v: number }
  | { k: "ident"; v: string }
  | { k: "op"; v: string }
  | { k: "lp" }
  | { k: "rp" }
  | { k: "comma" }
  | { k: "q" }
  | { k: "colon" };

const MULTI_OPS = ["<=", ">=", "==", "!=", "&&", "||"];

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let p = 0;
  while (p < src.length) {
    const c = src[p];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      p++;
      continue;
    }
    // number (int or float, optional exponent)
    if ((c >= "0" && c <= "9") || (c === "." && src[p + 1] >= "0" && src[p + 1] <= "9")) {
      let j = p;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      if (src[j] === "e" || src[j] === "E") {
        j++;
        if (src[j] === "+" || src[j] === "-") j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      const numStr = src.slice(p, j);
      const v = Number(numStr);
      if (!Number.isFinite(v)) throw new Error(`bad number "${numStr}"`);
      toks.push({ k: "num", v });
      p = j;
      continue;
    }
    // identifier
    if (/[a-zA-Z_]/.test(c)) {
      let j = p;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      toks.push({ k: "ident", v: src.slice(p, j) });
      p = j;
      continue;
    }
    // two-char operators
    const two = src.slice(p, p + 2);
    if (MULTI_OPS.includes(two)) {
      toks.push({ k: "op", v: two });
      p += 2;
      continue;
    }
    switch (c) {
      case "(":
        toks.push({ k: "lp" });
        p++;
        continue;
      case ")":
        toks.push({ k: "rp" });
        p++;
        continue;
      case ",":
        toks.push({ k: "comma" });
        p++;
        continue;
      case "?":
        toks.push({ k: "q" });
        p++;
        continue;
      case ":":
        toks.push({ k: "colon" });
        p++;
        continue;
      case "+":
      case "-":
      case "*":
      case "/":
      case "%":
      case "^":
      case "<":
      case ">":
      case "!":
        toks.push({ k: "op", v: c });
        p++;
        continue;
      default:
        throw new Error(`unexpected character "${c}"`);
    }
  }
  return toks;
}

/* ----------------------------- parser ----------------------------- */

class Parser {
  private pos = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok | undefined {
    return this.toks[this.pos];
  }
  private next(): Tok | undefined {
    return this.toks[this.pos++];
  }
  private expect(pred: (t: Tok | undefined) => boolean, msg: string): Tok {
    const t = this.peek();
    if (!pred(t)) throw new Error(msg);
    this.pos++;
    return t as Tok;
  }

  parse(): Node {
    const node = this.ternary();
    if (this.pos !== this.toks.length) throw new Error("unexpected trailing tokens");
    return node;
  }

  private ternary(): Node {
    const cond = this.or();
    const t = this.peek();
    if (t && t.k === "q") {
      this.next();
      const a = this.ternary();
      this.expect((x) => !!x && x.k === "colon", 'expected ":" in ternary');
      const b = this.ternary();
      return { t: "ternary", cond, a, b };
    }
    return cond;
  }

  private binLevel(ops: string[], down: () => Node): Node {
    let left = down();
    for (;;) {
      const t = this.peek();
      if (t && t.k === "op" && ops.includes(t.v)) {
        this.next();
        const right = down();
        left = { t: "bin", op: t.v, a: left, b: right };
      } else break;
    }
    return left;
  }

  private or(): Node {
    return this.binLevel(["||"], () => this.and());
  }
  private and(): Node {
    return this.binLevel(["&&"], () => this.cmp());
  }
  private cmp(): Node {
    return this.binLevel(["<", ">", "<=", ">=", "==", "!="], () => this.add());
  }
  private add(): Node {
    return this.binLevel(["+", "-"], () => this.mul());
  }
  private mul(): Node {
    return this.binLevel(["*", "/", "%"], () => this.unary());
  }

  private unary(): Node {
    const t = this.peek();
    if (t && t.k === "op" && (t.v === "-" || t.v === "+" || t.v === "!")) {
      this.next();
      return { t: "unary", op: t.v, a: this.unary() };
    }
    return this.pow();
  }

  // right-associative power, sits above unary so -2^2 = -(2^2)
  private pow(): Node {
    const base = this.atom();
    const t = this.peek();
    if (t && t.k === "op" && t.v === "^") {
      this.next();
      const exp = this.unary();
      return { t: "bin", op: "^", a: base, b: exp };
    }
    return base;
  }

  private atom(): Node {
    const t = this.next();
    if (!t) throw new Error("unexpected end of expression");
    if (t.k === "num") return { t: "num", v: t.v };
    if (t.k === "lp") {
      const inner = this.ternary();
      this.expect((x) => !!x && x.k === "rp", 'expected ")"');
      return inner;
    }
    if (t.k === "ident") {
      const nt = this.peek();
      if (nt && nt.k === "lp") {
        this.next();
        const args: Node[] = [];
        if (!(this.peek() && this.peek()!.k === "rp")) {
          args.push(this.ternary());
          while (this.peek() && this.peek()!.k === "comma") {
            this.next();
            args.push(this.ternary());
          }
        }
        this.expect((x) => !!x && x.k === "rp", 'expected ")" after arguments');
        return { t: "call", name: t.v, args };
      }
      return { t: "var", name: t.v };
    }
    throw new Error("unexpected token");
  }
}

/* ----------------------------- evaluator ----------------------------- */

const CONSTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

type Fn = (...a: number[]) => number;

const FUNCS: Record<string, Fn> = {
  gcd: (a, b) => gcd(a, b),
  lcm: (a, b) => lcm(a, b),
  isprime: (a) => (isPrime(Math.trunc(a)) ? 1 : 0),
  omega: (a) => omega(Math.trunc(a)),
  Omega: (a) => bigOmega(Math.trunc(a)),
  tau: (a) => tauFn(Math.trunc(a)),
  sigma: (a) => sigma(Math.trunc(a)),
  phi: (a) => phi(Math.trunc(a)),
  mu: (a) => mobius(Math.trunc(a)),
  mod: (a, b) => (b === 0 ? 0 : ((a % b) + b) % b),
  abs: (a) => Math.abs(a),
  floor: (a) => Math.floor(a),
  ceil: (a) => Math.ceil(a),
  round: (a) => Math.round(a),
  min: (...xs) => Math.min(...xs),
  max: (...xs) => Math.max(...xs),
  sqrt: (a) => Math.sqrt(Math.abs(a)),
  sin: (a) => Math.sin(a),
  cos: (a) => Math.cos(a),
  sign: (a) => Math.sign(a),
  log: (a) => (a > 0 ? Math.log(a) : 0),
  pow: (a, b) => Math.pow(a, b),
};

function evalNode(node: Node, i: number, n: number): number {
  switch (node.t) {
    case "num":
      return node.v;
    case "var": {
      if (node.name === "i") return i;
      if (node.name === "n" || node.name === "N") return n;
      if (node.name in CONSTS) return CONSTS[node.name];
      throw new Error(`unknown variable "${node.name}"`);
    }
    case "unary": {
      const a = evalNode(node.a, i, n);
      if (node.op === "-") return -a;
      if (node.op === "+") return a;
      if (node.op === "!") return a === 0 ? 1 : 0;
      return 0;
    }
    case "bin": {
      const a = evalNode(node.a, i, n);
      const b = evalNode(node.b, i, n);
      switch (node.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return b === 0 ? 0 : a / b;
        case "%":
          return b === 0 ? 0 : a % b;
        case "^":
          return Math.pow(a, b);
        case "<":
          return a < b ? 1 : 0;
        case ">":
          return a > b ? 1 : 0;
        case "<=":
          return a <= b ? 1 : 0;
        case ">=":
          return a >= b ? 1 : 0;
        case "==":
          return a === b ? 1 : 0;
        case "!=":
          return a !== b ? 1 : 0;
        case "&&":
          return a !== 0 && b !== 0 ? 1 : 0;
        case "||":
          return a !== 0 || b !== 0 ? 1 : 0;
        default:
          return 0;
      }
    }
    case "ternary":
      return evalNode(node.cond, i, n) !== 0
        ? evalNode(node.a, i, n)
        : evalNode(node.b, i, n);
    case "call": {
      const fn = FUNCS[node.name];
      if (!fn) throw new Error(`unknown function "${node.name}"`);
      const args = node.args.map((a) => evalNode(a, i, n));
      return fn(...args);
    }
  }
}

/**
 * Parse + validate an expression, returning a closure and parse status.
 * The closure never throws: any runtime error during evaluation yields 0.
 */
export function compileExpr(expr: string): CompileResult {
  let ast: Node;
  try {
    ast = new Parser(tokenize(expr)).parse();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { fn: () => 0, ok: false, error: msg };
  }
  const fn = (i: number, n: number): number => {
    try {
      const v = evalNode(ast, i, n);
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  };
  return { fn, ok: true, error: null };
}

/** Convenience: just the closure (0 on parse error). For reuse by callers. */
export function compile(expr: string): (i: number, n: number) => number {
  return compileExpr(expr).fn;
}

export const DEFAULT_FORMULA = "isprime(i) ? 144 : -gcd(i,n)*12";

/* ----------------------------- ruleset ----------------------------- */

/**
 * FORMULA ruleset: the user-supplied expression `expr` evaluated at each step
 * produces the yaw in degrees. klass is bucketed by sign of the yaw
 * (0 = left/negative, 1 = zero/straight, 2 = right/positive) for legend colour.
 */
export const formulaRule: Ruleset = {
  id: "formula",
  label: "Custom Formula",
  blurb:
    "yaw(i) = your expression. Vars i, n; functions gcd, lcm, isprime, omega, " +
    "Omega, tau, sigma, phi, mu, mod, abs, floor, min, max, sqrt, sin, cos. " +
    "Operators + - * / % ^, comparisons, and a ? b : c ternary.",
  category: "formula",
  classCount: 3,
  classLabels: ["turn left", "straight", "turn right"],
  knobs: [
    {
      key: "exprScale",
      label: "Yaw scale",
      type: "slider",
      min: 0.1,
      max: 4,
      step: 0.1,
      default: 1,
      hint: "Multiplies the expression result before turning.",
    },
  ],
  generate(params: RulesetParams): StepInstruction[] {
    const { n } = params;
    const expr = typeof params.expr === "string" ? params.expr : DEFAULT_FORMULA;
    const scale = typeof params.exprScale === "number" ? params.exprScale : 1;
    const fn = compile(expr);
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const raw = fn(i, n) * scale;
      const yaw = Number.isFinite(raw) ? raw : 0;
      const klass = yaw < 0 ? 0 : yaw === 0 ? 1 : 2;
      steps.push({ i, yaw, klass, value: yaw });
    }
    return steps;
  },
};
