/*
 * features/studio/RulePicker.tsx — Reusable, presentational rule + params editor.
 *
 * Renders a category-grouped Select over allRulesets(), then dynamic controls for
 * the common params (n, angleA, angleB, factorTurnsRight) plus one control per the
 * selected rule's knobs. When the formula rule is selected, also shows a bound
 * <Textarea> with a live parse-status hint (using the formula evaluator).
 *
 * Fully controlled: parent owns { rulesetId, params } and receives onChange.
 */

import * as React from "react";

import { allRulesets, getRuleset } from "@/lib/core/rulesets";
import { defaultParams } from "@/lib/core/types";
import type { Knob, Ruleset, RulesetParams } from "@/lib/core/types";
import { compileExpr, DEFAULT_FORMULA, FORMULA_PRESETS, type FormulaPreset } from "@/lib/core/formula";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface RulePickerProps {
  rulesetId: string;
  params: RulesetParams;
  onChange: (rulesetId: string, params: RulesetParams) => void;
}

const CATEGORY_ORDER: Ruleset["category"][] = [
  "classic",
  "number-theory",
  "gaussian",
  "formula",
  "continuous",
];

const CATEGORY_LABEL: Record<Ruleset["category"], string> = {
  classic: "Classic",
  "number-theory": "Number Theory",
  gaussian: "Gaussian",
  formula: "Formula",
  continuous: "Continuous",
};

const headingStyle: React.CSSProperties = { fontFamily: "'Outfit', sans-serif" };

function RulePicker({ rulesetId, params, onChange }: RulePickerProps) {
  const rules = allRulesets();
  const selected = getRuleset(rulesetId);

  // Group rules by category, preserving CATEGORY_ORDER.
  const grouped = React.useMemo(() => {
    const byCat = new Map<Ruleset["category"], Ruleset[]>();
    for (const r of rules) {
      const arr = byCat.get(r.category) ?? [];
      arr.push(r);
      byCat.set(r.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      rules: byCat.get(c)!,
    }));
  }, [rules]);

  const patch = (next: Partial<RulesetParams>) =>
    onChange(rulesetId, { ...params, ...next });

  const handleRuleSelect = (id: string) => {
    const rule = getRuleset(id);
    if (!rule) return;
    // Seed fresh defaults for the new rule's knobs, but keep n/angleA/angleB/dir.
    const fresh = defaultParams(rule, params.n);
    const merged: RulesetParams = {
      ...fresh,
      n: params.n,
      angleA: params.angleA,
      angleB: params.angleB,
      factorTurnsRight: params.factorTurnsRight,
    };
    // Preserve an existing formula expression across rule switches.
    if (typeof params.expr === "string") merged.expr = params.expr;
    onChange(id, merged);
  };

  const numVal = (key: keyof RulesetParams, fallback: number): number => {
    const v = params[key];
    return typeof v === "number" ? v : fallback;
  };

  return (
    <div className="w-full flex flex-col gap-5 p-1 text-foreground">
      {/* Rule selector */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Ruleset
        </Label>
        <Select value={rulesetId} onValueChange={handleRuleSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a ruleset" />
          </SelectTrigger>
          <SelectContent>
            {grouped.map(({ category, rules: catRules }) => (
              <SelectGroup key={category}>
                <SelectLabel>{CATEGORY_LABEL[category]}</SelectLabel>
                {catRules.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {selected.blurb}
          </p>
        )}
      </div>

      {/* N */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="rp-n" className="text-xs uppercase tracking-wide text-muted-foreground">
          N (steps)
        </Label>
        <Input
          id="rp-n"
          type="number"
          min={1}
          className="font-mono"
          value={params.n}
          onChange={(e) => {
            const v = Math.max(1, Math.round(Number(e.target.value) || 1));
            patch({ n: v });
          }}
        />
      </div>

      {/* angleA / angleB sliders */}
      <SliderRow
        id="rp-angleA"
        label="Angle A"
        value={params.angleA}
        min={0}
        max={360}
        step={1}
        unit="°"
        onChange={(v) => patch({ angleA: v })}
      />
      <SliderRow
        id="rp-angleB"
        label="Angle B"
        value={params.angleB}
        min={0}
        max={360}
        step={1}
        unit="°"
        onChange={(v) => patch({ angleB: v })}
      />

      {/* handedness */}
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="rp-dir" className="text-sm">
          Factor turns right
        </Label>
        <Switch
          id="rp-dir"
          checked={params.factorTurnsRight}
          onCheckedChange={(c) => patch({ factorTurnsRight: c })}
        />
      </div>

      {/* per-rule knobs */}
      {selected?.knobs && selected.knobs.length > 0 && (
        <div className="flex flex-col gap-5 border-t border-border pt-4">
          <div className="text-xs uppercase tracking-wide text-primary" style={headingStyle}>
            {selected.label} controls
          </div>
          {selected.knobs.map((knob) =>
            knob.type === "toggle" ? (
              <ToggleKnob
                key={knob.key}
                knob={knob}
                checked={params[knob.key] === true}
                onChange={(c) => patch({ [knob.key]: c })}
              />
            ) : (
              <SliderRow
                key={knob.key}
                id={`rp-${knob.key}`}
                label={knob.label}
                hint={knob.hint}
                value={numVal(knob.key, Number(knob.default) || 0)}
                min={knob.min ?? 0}
                max={knob.max ?? 100}
                step={knob.step ?? 1}
                onChange={(v) => patch({ [knob.key]: v })}
              />
            )
          )}
        </div>
      )}

      {/* formula editor */}
      {selected?.category === "formula" && (
        <FormulaEditor
          value={typeof params.expr === "string" ? params.expr : DEFAULT_FORMULA}
          onChange={(expr) => patch({ expr })}
          onPick={(p) =>
            patch(p.scale !== undefined ? { expr: p.expr, exprScale: p.scale } : { expr: p.expr })
          }
        />
      )}
    </div>
  );
}

/* ----------------------------- subcomponents ----------------------------- */

function SliderRow({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <span className="font-mono text-xs text-primary">
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {unit ?? ""}
        </span>
      </div>
      <Slider
        id={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleKnob({
  knob,
  checked,
  onChange,
}: {
  knob: Knob;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`rp-${knob.key}`} className="text-sm">
          {knob.label}
        </Label>
        <Switch id={`rp-${knob.key}`} checked={checked} onCheckedChange={onChange} />
      </div>
      {knob.hint && <p className="text-xs text-muted-foreground">{knob.hint}</p>}
    </div>
  );
}

function FormulaEditor({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (preset: FormulaPreset) => void;
}) {
  const status = React.useMemo(() => compileExpr(value), [value]);

  // Group presets by their `group`, preserving first-seen order.
  const groups = React.useMemo(() => {
    const map = new Map<string, FormulaPreset[]>();
    for (const p of FORMULA_PRESETS) {
      const arr = map.get(p.group) ?? [];
      arr.push(p);
      map.set(p.group, arr);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="rp-expr" className="text-xs uppercase tracking-wide text-primary" style={headingStyle}>
          Expression — yaw(i)
        </Label>
        <span
          className={
            "font-mono text-xs " +
            (status.ok ? "text-primary" : "text-destructive")
          }
        >
          {status.ok ? "parse OK" : "error"}
        </span>
      </div>
      <Textarea
        id="rp-expr"
        className="font-mono text-sm min-h-20"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={DEFAULT_FORMULA}
      />
      {!status.ok && status.error && (
        <p className="font-mono text-xs text-destructive">{status.error}</p>
      )}

      {/* Preset library */}
      <div className="mt-1 flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Preset formulae
        </div>
        {groups.map(([group, presets]) => (
          <div key={group} className="flex flex-col gap-1">
            <div className="text-[10px] text-muted-foreground/70">{group}</div>
            <div className="flex flex-wrap gap-1">
              {presets.map((p) => {
                const active = p.expr === value;
                return (
                  <button
                    key={p.name}
                    type="button"
                    title={p.expr}
                    onClick={() => onPick(p)}
                    className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      active
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Vars: i, n. Funcs: gcd, lcm, isprime, omega, Omega, tau, sigma, phi, mu,
        mod, abs, floor, min, max, sqrt, sin, cos. Operators + − * / % ^, comparisons,
        and a ? b : c.
      </p>
    </div>
  );
}

export default RulePicker;
