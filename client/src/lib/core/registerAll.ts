/*
 * core/registerAll.ts — registers every extended ruleset into the registry.
 *
 * Imported once for its side effect (see main.tsx), BEFORE any mode renders, so
 * allRulesets() / getRuleset() see the full set (number-theory, gaussian,
 * formula, continuous) alongside the built-in classic rule.
 */

import { registerRulesets } from "./rulesets";
import { EXTENDED_RULESETS } from "./extraRules";

registerRulesets(EXTENDED_RULESETS);
