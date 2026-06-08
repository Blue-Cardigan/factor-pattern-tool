/*
 * core/rulesets/index.ts — Aggregates all extended rulesets.
 *
 * The integrator wires these into the registry once at startup:
 *   import { EXTENDED_RULESETS } from "@/lib/core/rulesets";
 *   registerRulesets(EXTENDED_RULESETS);
 *
 * Individual rules are re-exported for direct import/testing.
 */

import { Ruleset } from "../types";
import { NUMBER_THEORY_RULES } from "./numberTheoryRules";
import { gaussianRule } from "../gaussian";
import { formulaRule } from "../formula";
import { CONTINUOUS_RULES } from "../continuous";

export * from "./numberTheoryRules";
export {
  gaussianRule,
  gaussianNorm,
  gaussianPrimeFactorCount,
  isGaussianPrime,
} from "../gaussian";
export {
  formulaRule,
  compile,
  compileExpr,
  DEFAULT_FORMULA,
} from "../formula";
export type { CompileResult } from "../formula";
export {
  sineCurveRule,
  totientCurlRule,
  CONTINUOUS_RULES,
} from "../continuous";

/** Every ruleset this feature contributes, in display order. */
export const EXTENDED_RULESETS: Ruleset[] = [
  ...NUMBER_THEORY_RULES,
  gaussianRule,
  formulaRule,
  ...CONTINUOUS_RULES,
];
