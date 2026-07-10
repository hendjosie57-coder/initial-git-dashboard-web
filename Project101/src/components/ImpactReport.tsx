import { useMemo, useState } from "react";
import { Check, GitMerge, Loader2, ShieldAlert, TestTube2, TrendingDown } from "lucide-react";
import { computeImpact } from "../data/codegen";
import { useDashboard } from "../store";
import { RISK_COLORS } from "../lib/colors";
import type { RepoFile, Risk } from "../types";
import { SectionLabel } from "./ui";

/* Automated impact analysis for the proposed refactor. Flat panels,
   git diff colors only (red = before/deletions, green = after/additions). */

function DeltaMeter({ beforeVal, afterVal, deltaPct }: { beforeVal: number; afterVal: number; deltaPct: number }) {
  return (
    <div className="border border-edge bg-obsidian p-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Complexity delta</SectionLabel>
        <TrendingDown size={13} className="text-risk-low" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-risk-low">{deltaPct}%</span>
        <span className="font-mono text-[11px] text-faint">
          {beforeVal} → {afterVal}
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-10 font-mono text-[9px] uppercase text-faint">before</span>
          <div className="h-1.5 flex-1 bg-ink-2">
            <div className="h-full w-full bg-del" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-10 font-mono text-[9px] uppercase text-faint">after</span>
          <div className="h-1.5 flex-1 bg-ink-2">
            <div
              className="h-full bg-add transition-[width] duration-150"
              style={{ width: `${Math.max(6, (afterVal / beforeVal) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskGauge({ risk }: { risk: Risk }) {
  const levels: Risk[] = ["low", "medium", "high"];
  return (
    <div className="border border-edge bg-obsidian p-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Regression risk</SectionLabel>
        <ShieldAlert size={13} style={{ color: RISK_COLORS[risk] }} />
      </div>
      <div className="mt-3 flex gap-1">
        {levels.map((lvl) => {
          const active = lvl === risk;
          return (
            <div key={lvl} className="flex-1">
              <div
                className="h-2"
                style={{
                  background: active ? RISK_COLORS[lvl] : "#252525",
                }}
              />
              <div
                className="mt-1.5 text-center font-mono text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: active ? RISK_COLORS[lvl] : "#6e6e6e" }}
              >
                {lvl}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoverageImpact({ before, after }: { before: number; after: number }) {
  return (
    <div className="border border-edge bg-obsidian p-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Test coverage impact</SectionLabel>
        <TestTube2 size={13} className="text-faint" />
      </div>
      <div className="mt-2 flex items-baseline gap-2 font-mono">
        <span className="text-sm text-muted">{before}%</span>
        <span className="text-faint">→</span>
        <span className="text-xl font-bold text-bright">{after}%</span>
        <span className="text-[10px] font-semibold text-add">+{after - before}pt est.</span>
      </div>
      <div className="relative mt-3 h-1.5 bg-ink-2">
        <div className="absolute h-full bg-add/30" style={{ width: `${after}%` }} />
        <div className="absolute h-full bg-add" style={{ width: `${before}%` }} />
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-faint">
        Typed signatures and extracted pure functions make the untested branches directly
        unit-testable.
      </p>
    </div>
  );
}

export function ImpactReport({ file }: { file: RepoFile }) {
  const impact = useMemo(() => computeImpact(file), [file]);
  const applyRefactor = useDashboard((s) => s.applyRefactor);
  const applied = useDashboard((s) => s.refactoredIds.includes(file.id));
  const [staging, setStaging] = useState(false);

  const handleApply = () => {
    if (applied || staging) return;
    setStaging(true);
    window.setTimeout(() => {
      applyRefactor(file.id);
      setStaging(false);
    }, 1100);
  };

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-2.5">
      <DeltaMeter
        beforeVal={impact.complexityBefore}
        afterVal={impact.complexityAfter}
        deltaPct={impact.complexityDeltaPct}
      />
      <RiskGauge risk={impact.regressionRisk} />
      <CoverageImpact before={impact.coverageBefore} after={impact.coverageAfter} />

      <div className="border border-edge bg-obsidian p-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Blast radius</SectionLabel>
          <GitMerge size={13} className="text-faint" />
        </div>
        <div className="mt-2 font-mono text-sm text-bright">
          {impact.affectedDependents} dependent file{impact.affectedDependents === 1 ? "" : "s"}
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-faint">
          Public exports keep their names and arity; call sites need only async adoption.
        </p>
      </div>

      <div className="mt-auto pt-1">
        {applied ? (
          <div className="flex w-full items-center justify-center gap-2 border border-add bg-add/10 px-4 py-2.5 font-mono text-[12px] font-bold text-add">
            <Check size={14} strokeWidth={3} />
            Refactor staged for commit
          </div>
        ) : (
          <button
            onClick={handleApply}
            disabled={staging}
            className="flex w-full items-center justify-center gap-2 border border-add bg-transparent px-4 py-2.5 font-mono text-[12px] font-bold text-add transition-colors duration-150 hover:bg-add/10 disabled:opacity-70"
          >
            {staging ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Staging changes…
              </>
            ) : (
              <>
                <GitMerge size={14} />
                Apply refactor & stage
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
