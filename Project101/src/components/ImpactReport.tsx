import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, GitMerge, Loader2, ShieldAlert, TestTube2, TrendingDown, Zap } from "lucide-react";
import { computeImpact } from "../data/codegen";
import { useDashboard } from "../store";
import { RISK_COLORS } from "../lib/colors";
import type { RepoFile, Risk } from "../types";
import { SectionLabel } from "./ui";

/* Automated impact analysis for the proposed refactor. */

function DeltaMeter({ beforeVal, afterVal, deltaPct }: { beforeVal: number; afterVal: number; deltaPct: number }) {
  return (
    <div className="panel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Complexity delta</SectionLabel>
        <TrendingDown size={13} className="text-risk-low" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-3xl font-bold text-risk-low"
          style={{ textShadow: "0 0 18px rgba(16,185,129,0.45)" }}
        >
          {deltaPct}%
        </motion.span>
        <span className="font-mono text-[11px] text-faint">
          {beforeVal} → {afterVal}
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-10 font-mono text-[9px] uppercase text-faint">before</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full bg-risk-high/80"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-10 font-mono text-[9px] uppercase text-faint">after</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(6, (afterVal / beforeVal) * 100)}%` }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
              className="h-full rounded-full bg-risk-low"
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
    <div className="panel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Regression risk</SectionLabel>
        <ShieldAlert size={13} style={{ color: RISK_COLORS[risk] }} />
      </div>
      <div className="mt-3 flex gap-1.5">
        {levels.map((lvl) => {
          const active = lvl === risk;
          return (
            <div key={lvl} className="flex-1">
              <motion.div
                initial={{ scaleY: 0.4, opacity: 0 }}
                animate={{ scaleY: 1, opacity: active ? 1 : 0.22 }}
                transition={{ duration: 0.4 }}
                className="h-2 rounded-full"
                style={{
                  background: RISK_COLORS[lvl],
                  boxShadow: active ? `0 0 10px ${RISK_COLORS[lvl]}` : "none",
                }}
              />
              <div
                className={`mt-1.5 text-center text-[9px] font-bold uppercase tracking-wider ${
                  active ? "" : "text-faint/50"
                }`}
                style={active ? { color: RISK_COLORS[lvl] } : undefined}
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
    <div className="panel rounded-xl p-4">
      <div className="flex items-center justify-between">
        <SectionLabel>Test coverage impact</SectionLabel>
        <TestTube2 size={13} className="text-accent-2" />
      </div>
      <div className="mt-2 flex items-baseline gap-2 font-mono">
        <span className="text-sm text-muted">{before}%</span>
        <span className="text-faint">→</span>
        <span className="text-xl font-bold text-accent-2">{after}%</span>
        <span className="text-[10px] font-semibold text-risk-low">+{after - before}pt est.</span>
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-edge">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${after}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute h-full rounded-full bg-accent-2/40"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${before}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute h-full rounded-full bg-accent-2"
        />
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
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center gap-2 px-1 pt-1">
        <Zap size={13} className="text-risk-mid" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          Impact report
        </span>
      </div>

      <DeltaMeter
        beforeVal={impact.complexityBefore}
        afterVal={impact.complexityAfter}
        deltaPct={impact.complexityDeltaPct}
      />
      <RiskGauge risk={impact.regressionRisk} />
      <CoverageImpact before={impact.coverageBefore} after={impact.coverageAfter} />

      <div className="panel rounded-xl p-4">
        <div className="flex items-center justify-between">
          <SectionLabel>Blast radius</SectionLabel>
          <GitMerge size={13} className="text-accent" />
        </div>
        <div className="mt-2 font-mono text-sm text-bright">
          {impact.affectedDependents} dependent file{impact.affectedDependents === 1 ? "" : "s"}
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-faint">
          Public exports keep their names and arity; call sites need only async adoption.
        </p>
      </div>

      <div className="mt-auto pt-1">
        <AnimatePresence mode="wait" initial={false}>
          {applied ? (
            <motion.div
              key="applied"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glow-emerald flex w-full items-center justify-center gap-2 rounded-xl border border-risk-low/50 bg-risk-low/15 px-4 py-3 text-[12px] font-bold text-risk-low"
            >
              <Check size={15} strokeWidth={3} />
              Refactor staged for commit
            </motion.div>
          ) : (
            <motion.button
              key="apply"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={handleApply}
              disabled={staging}
              whileHover={{ scale: staging ? 1 : 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="glow-emerald flex w-full items-center justify-center gap-2 rounded-xl bg-risk-low px-4 py-3 text-[12px] font-bold text-obsidian transition-colors hover:bg-[#34d399] disabled:opacity-80"
            >
              {staging ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Staging changes…
                </>
              ) : (
                <>
                  <Zap size={15} strokeWidth={2.6} />
                  Apply refactor & stage
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
