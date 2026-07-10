import { motion } from "framer-motion";
import {
  Bug,
  FileCode2,
  GitCommitHorizontal,
  GitPullRequest,
  MessageSquareCode,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import { useDashboard } from "../store";
import { authorById, dependentsOf, relativeTime } from "../data/mockRepo";
import { debtScoreColor, hexToRgba } from "../lib/colors";
import type { RepoFile } from "../types";
import { Avatar, MonoStat, RiskBadge, SectionLabel } from "./ui";

/* Slide-out inspector for the node selected in the graph. */

function DebtGauge({ score }: { score: number }) {
  const color = debtScoreColor(score);
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" stroke="#1f293d" strokeWidth="6" />
        <motion.circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * score) / 100 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: score >= 70 ? `drop-shadow(0 0 5px ${color})` : undefined }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold leading-none" style={{ color }}>
          {score}
        </span>
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-faint">
          debt
        </span>
      </div>
    </div>
  );
}

export function FileDrawer({ file }: { file: RepoFile }) {
  const closeDrawer = useDashboard((s) => s.closeDrawer);
  const openSandbox = useDashboard((s) => s.openSandbox);
  const askAI = useDashboard((s) => s.askAI);
  const chatOpen = useDashboard((s) => s.chatOpen);
  const toggleChat = useDashboard((s) => s.toggleChat);
  const dependents = dependentsOf(file.id);

  return (
    <motion.aside
      key={file.id}
      initial={{ x: -420, opacity: 0.4 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -420, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 40 }}
      className="absolute bottom-3 left-3 top-3 z-20 flex w-[360px] flex-col overflow-hidden rounded-xl border border-edge bg-ink/95 shadow-2xl shadow-black/50 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-edge p-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge bg-ink-2">
            <FileCode2 size={15} className="text-accent-2" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-bright">{file.name}</div>
            <div className="truncate font-mono text-[10px] text-faint">{file.path}</div>
            <div className="mt-1.5">
              <RiskBadge risk={file.risk} />
            </div>
          </div>
        </div>
        <button
          onClick={closeDrawer}
          className="rounded-md p-1.5 text-faint transition-colors hover:bg-edge hover:text-bright"
        >
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Debt score + description */}
        <div className="flex items-center gap-4">
          <DebtGauge score={file.debtScore} />
          <p className="text-[11px] leading-relaxed text-muted">{file.description}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <MonoStat label="Lines" value={file.loc.toLocaleString()} />
          <MonoStat
            label="Complexity"
            value={file.complexity}
            accent={file.complexity > 40 ? "#ff5a5a" : undefined}
          />
          <MonoStat
            label="Churn / 90d"
            value={file.churn}
            accent={file.churn > 40 ? "#f59e0b" : undefined}
          />
          <MonoStat
            label="Coverage"
            value={`${file.coverage}%`}
            accent={file.coverage < 30 ? "#ff5a5a" : "#10b981"}
          />
          <MonoStat label="Commits" value={file.totalCommits} />
          <MonoStat label="Dependents" value={dependents.length} />
        </div>

        {/* Author breakdown */}
        <div>
          <SectionLabel>Author breakdown</SectionLabel>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full">
            {file.authorShare.map((s) => (
              <motion.div
                key={s.authorId}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full origin-left"
                style={{ width: `${s.pct}%`, background: authorById(s.authorId).color }}
              />
            ))}
          </div>
          <div className="mt-2.5 space-y-1.5">
            {file.authorShare.map((s) => {
              const a = authorById(s.authorId);
              return (
                <div key={s.authorId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar author={a} size={18} />
                    <span className="text-[11px] text-muted">{a.name}</span>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-bright">
                    {s.pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bug-introducing commits */}
        <div>
          <SectionLabel>Top bug-introducing commits</SectionLabel>
          <div className="mt-2 space-y-2">
            {file.bugCommits.map((c) => {
              const a = authorById(c.authorId);
              return (
                <div key={c.hash} className="panel rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-accent-2">
                      <GitCommitHorizontal size={12} />
                      {c.hash.slice(0, 7)}
                    </div>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-bold"
                      style={{
                        color: "#ff5a5a",
                        background: hexToRgba("#ef4444", 0.12),
                      }}
                    >
                      <Bug size={9} />
                      {c.bugsIntroduced} bug{c.bugsIntroduced > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-bright/90">{c.message}</p>
                  <div className="mt-1 text-[10px] text-faint">
                    {a.name} · {relativeTime(c.date)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent PRs */}
        <div>
          <SectionLabel>Merged pull requests</SectionLabel>
          <div className="mt-2 space-y-1.5">
            {file.prs.slice(0, 2).map((pr) => (
              <div key={pr.number} className="flex items-start gap-2">
                <GitPullRequest size={12} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-bright/90">
                    <span className="font-mono text-faint">#{pr.number}</span> {pr.title}
                  </div>
                  <div className="text-[10px] text-faint">
                    {authorById(pr.authorId).name} · {relativeTime(pr.mergedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-edge p-3">
        <button
          onClick={() => openSandbox(file.id)}
          className="glow-accent flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[11px] font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <SplitSquareHorizontal size={13} />
          Open Refactor Sandbox
        </button>
        <button
          onClick={() => {
            if (!chatOpen) toggleChat();
            askAI(file.id, "", "explain-intent");
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-edge bg-ink-2 px-3 py-2 text-[11px] font-semibold text-muted transition-colors hover:border-edge-2 hover:text-bright"
        >
          <MessageSquareCode size={13} />
          Ask AI
        </button>
      </div>
    </motion.aside>
  );
}
