import { useMemo, useState } from "react";
import { Check, GitMerge, Loader2, ShieldAlert, TrendingDown } from "lucide-react";
import { useDashboard } from "../store";
import { hexToRgba, RISK_COLORS, SAGE, TERRACOTTA } from "../lib/colors";
import type { ImpactMetrics, LiveFile, Risk } from "../types";
import { SectionLabel } from "./ui";

/* ---------------------------------------------------------------------------
   Impact analysis for the proposed modernization, computed from live data:
     · complexity before  — the backend's radon score for the file
     · complexity after   — the same decision-point heuristic the backend
                            uses, applied to the modernized pane's content
     · regression risk    — dependents (from the topology links) + complexity
--------------------------------------------------------------------------- */

const BRANCH_RX = /\b(?:if|for|while|case|catch|elif|except)\b|&&|\|\||\?\?/g;

function estimateComplexity(source: string): number {
  if (!source.trim()) return 0;
  return 1 + (source.match(BRANCH_RX)?.length ?? 0);
}

function liveImpact(file: LiveFile, modern: string, dependents: number): ImpactMetrics {
  const before = Math.max(1, file.complexity);
  const after = Math.min(before, Math.max(1, estimateComplexity(modern)));
  const deltaPct = Math.round(((after - before) / before) * 100);
  const regressionRisk: Risk =
    dependents >= 5 || before >= 55
      ? "high"
      : dependents >= 2 || before >= 28
        ? "medium"
        : "low";
  return {
    complexityBefore: before,
    complexityAfter: after,
    complexityDeltaPct: deltaPct,
    locBefore: file.loc,
    locAfter: modern ? modern.split("\n").length : file.loc,
    regressionRisk,
  };
}

function DeltaMeter({
  beforeVal,
  afterVal,
  deltaPct,
}: {
  beforeVal: number;
  afterVal: number;
  deltaPct: number;
}) {
  return (
    <div className="shadow-card rounded-md border border-edge bg-card p-3.5">
      <div className="flex items-center justify-between">
        <SectionLabel>Complexity delta</SectionLabel>
        <TrendingDown size={13} style={{ color: SAGE }} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold" style={{ color: SAGE }}>
          {deltaPct}%
        </span>
        <span className="text-[11px] text-faint">
          {beforeVal} → {afterVal}
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-11 text-[10px] uppercase tracking-wide text-faint">before</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel">
            <div
              className="h-full w-full rounded-full"
              style={{ background: hexToRgba(TERRACOTTA, 0.75) }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-11 text-[10px] uppercase tracking-wide text-faint">after</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel">
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{
                width: `${Math.max(6, (afterVal / beforeVal) * 100)}%`,
                background: SAGE,
              }}
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
    <div className="shadow-card rounded-md border border-edge bg-card p-3.5">
      <div className="flex items-center justify-between">
        <SectionLabel>Regression risk</SectionLabel>
        <ShieldAlert size={13} style={{ color: RISK_COLORS[risk] }} />
      </div>
      <div className="mt-3 flex gap-1.5">
        {levels.map((lvl) => {
          const active = lvl === risk;
          return (
            <div key={lvl} className="flex-1">
              <div
                className="h-1.5 rounded-full"
                style={{ background: active ? RISK_COLORS[lvl] : "#e2e2dd" }}
              />
              <div
                className="mt-1.5 text-center text-[10px] font-medium capitalize"
                style={{ color: active ? RISK_COLORS[lvl] : "#b5b5b0" }}
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

export function ImpactReport({ file }: { file: LiveFile }) {
  const applyRefactor = useDashboard((s) => s.applyRefactor);
  const applied = useDashboard((s) => s.refactoredIds.includes(file.id));
  const modernDraft = useDashboard((s) => s.modernDrafts[file.id]);
  const modernized = useDashboard((s) => s.activeModernized);
  const edges = useDashboard((s) => s.edges);
  const [staging, setStaging] = useState(false);

  const impact = useMemo(() => {
    const modern = modernDraft ?? modernized ?? "";
    const dependents = edges.filter((e) => e.target === file.id).length;
    return liveImpact(file, modern, dependents);
  }, [file, modernDraft, modernized, edges]);

  const handleApply = () => {
    if (applied || staging) return;
    setStaging(true);
    window.setTimeout(() => {
      applyRefactor(file.id);
      setStaging(false);
    }, 1100);
  };

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto p-3">
      <DeltaMeter
        beforeVal={impact.complexityBefore}
        afterVal={impact.complexityAfter}
        deltaPct={impact.complexityDeltaPct}
      />
      <RiskGauge risk={impact.regressionRisk} />

      <div className="shadow-card rounded-md border border-edge bg-card p-3.5">
        <SectionLabel>Lines of code</SectionLabel>
        <div className="mt-1.5 text-[12px] text-body">
          {impact.locBefore} → <span className="font-semibold text-ink">{impact.locAfter}</span>{" "}
          after modernization
        </div>
      </div>

      <div className="mt-auto pt-1">
        {applied ? (
          <div
            className="flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-[12px] font-medium"
            style={{
              color: SAGE,
              borderColor: hexToRgba(SAGE, 0.45),
              background: hexToRgba(SAGE, 0.09),
            }}
          >
            <Check size={14} strokeWidth={2.5} />
            Refactor staged for commit
          </div>
        ) : (
          <button
            onClick={handleApply}
            disabled={staging}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[12px] font-medium text-paper transition-colors duration-200 hover:bg-[#3a3a3a] disabled:opacity-70"
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
