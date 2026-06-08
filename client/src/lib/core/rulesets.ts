/*
 * core/rulesets.ts — Ruleset registry + the built-in classic factor rule.
 *
 * Rulesets register themselves into RULESET_REGISTRY. The app reads the registry
 * to populate its rule picker. Feature code adds rulesets by calling
 * registerRulesets([...]) once at startup (see lib/core/registerAll.ts).
 *
 * The classic ruleset here reproduces the original engine exactly so the Canvas
 * mode behaves identically to before the refactor.
 */

import { Ruleset, RulesetParams, StepInstruction } from "./types";
import { sharesFactor } from "./numberTheory";

const registry = new Map<string, Ruleset>();

export function registerRuleset(rule: Ruleset): void {
  registry.set(rule.id, rule);
}

export function registerRulesets(rules: Ruleset[]): void {
  for (const r of rules) registerRuleset(r);
}

export function getRuleset(id: string): Ruleset | undefined {
  return registry.get(id);
}

export function allRulesets(): Ruleset[] {
  return Array.from(registry.values());
}

export function rulesetsByCategory(category: Ruleset["category"]): Ruleset[] {
  return allRulesets().filter((r) => r.category === category);
}

/* ------------------------- classic factor rule ------------------------- */

/**
 * The original rule: steps that share a factor with N turn one way, coprime steps
 * the other. `factorTurnsRight` flips which way; angleA/angleB are the two turn
 * magnitudes (factor angle / non-factor angle).
 */
export const classicFactorRule: Ruleset = {
  id: "classic-factor",
  label: "Classic Factor",
  blurb: "Steps sharing a factor with N turn one way; coprime steps the other.",
  category: "classic",
  classCount: 2,
  classLabels: ["coprime (left)", "shares factor (right)"],
  generate({ n, angleA, angleB, factorTurnsRight }: RulesetParams): StepInstruction[] {
    const steps: StepInstruction[] = [];
    for (let i = 1; i <= n; i++) {
      const shares = sharesFactor(i, n);
      let yaw: number;
      if (shares) {
        yaw = factorTurnsRight ? angleA : -angleA;
      } else {
        yaw = factorTurnsRight ? -angleB : angleB;
      }
      steps.push({ i, yaw, klass: shares ? 1 : 0 });
    }
    return steps;
  },
};

registerRuleset(classicFactorRule);

export const DEFAULT_RULESET_ID = classicFactorRule.id;
