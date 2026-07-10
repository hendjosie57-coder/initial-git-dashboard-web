import { motion } from "framer-motion";
import {
  Bug,
  FileCode2,
  GitCommitHorizontal,
  GitPullRequest,
  SquareTerminal,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import { useDashboard } from "../store";
import { authorById, dependentsOf, relativeTime } from "../data/mockRepo";
import { debtScoreColor } from "../lib/colors";
import type { RepoFile } from "../types";
import { Avatar, MonoStat, RiskBadge, SectionLabel } from "./ui";

/* Structural inspector pane for the node selected in the graph. */

function DebtMeter({ score }: { score: number }) {
  const color = debtScoreColor(score);
  return (
    <div className="border border-edge bg-ink p-2.5">
      <div className="flex items-baseline justify-between">
        <SectionLabel>Debt score</SectionLabel>
        <span className="font-mono text-lg font-bold leading-none" style={{ color }}>
          {score}
          <span className="text-[10px] font-semibold text-faint">/100</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full bg-ink-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.15, ease: "linear" }}
          className="h-full"
          style={{ background: color }}
        />
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
      initial={{ x: -340 }}
      animate={{ x: 0 }}
      exit={{ x: -340 }}
      transition={{ duration: 0.15, ease: "linear" }}
      className="absolute bottom-0 left-0 top-0 z-20 flex w-[340px] flex-col overflow-hidden border-r border-edge bg-ink"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-edge p-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-edge bg-ink-2">
            <FileCode2 size={14} className="text-muted" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-mono text-[12px] font-semibold text-bright">
              {file.name}
            </div>
            <div className="truncate font-mono text-[10px] text-faint">{file.path}</div>
            <div className="mt-1.5">
              <RiskBadge risk={file.risk} />
            </div>
          </div>
        </div>
        <button
          onClick={closeDrawer}
          className="p-1 text-faint transition-colors duration-150 hover:bg-ink-2 hover:text-bright"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <DebtMeter score={file.debtScore} />

        <p className="text-[11px] leading-relaxed text-muted">{file.description}</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1.5">
          <MonoStat label="Lines" value={file.loc.toLocaleString()} />
          <MonoStat
            label="Complexity"
            value={file.complexity}
            accent={file.complexity > 40 ? "#f85149" : undefined}
          />
          <MonoStat
            label="Churn / 90d"
            value={file.churn}
            accent={file.churn > 40 ? "#d29922" : undefined}
          />
          <MonoStat
            label="Coverage"
            value={`${file.coverage}%`}
            accent={file.coverage < 30 ? "#f85149" : "#3fb950"}
          />
          <MonoStat label="Commits" value={file.totalCommits} />
          <MonoStat label="Dependents" value={dependents.length} />
        </div>

        {/* Author breakdown */}
        <div className="border border-edge bg-ink p-2.5">
          <SectionLabel>Author breakdown</SectionLabel>
          <div className="mt-2 flex h-1.5 w-full">
            {file.authorShare.map((s) => (
              <div
                key={s.authorId}
                className="h-full"
                style={{ width: `${s.pct}%`, background: authorById(s.authorId).color }}
              />
            ))}
          </div>
          <div className="mt-2 space-y-1">
            {file.authorShare.map((s) => {
              const a = authorById(s.authorId);
              return (
                <div key={s.authorId} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Avatar author={a} size={14} />
                    <span className="font-mono text-[10px] text-muted">{a.handle}</span>
                  </div>
                  <span className="font-mono text-[10px] font-semibold text-bright">
                    {s.pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bug-introducing commits */}
        <div className="border border-edge bg-ink p-2.5">
          <SectionLabel>Top bug-introducing commits</SectionLabel>
          <div className="mt-2 divide-y divide-edge">
            {file.bugCommits.map((c) => {
              const a = authorById(c.authorId);
              return (
                <div key={c.hash} className="py-1.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
                      <GitCommitHorizontal size={11} className="text-faint" />
                      {c.hash.slice(0, 7)}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[9px] font-semibold text-del">
                      <Bug size={9} />
                      {c.bugsIntroduced} bug{c.bugsIntroduced > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] leading-snug text-bright/90">
                    {c.message}
                  </p>
                  <div className="font-mono text-[9px] text-faint">
                    {a.handle} · {relativeTime(c.date)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Merged PRs */}
        <div className="border border-edge bg-ink p-2.5">
          <SectionLabel>Merged pull requests</SectionLabel>
          <div className="mt-2 space-y-1.5">
            {file.prs.slice(0, 3).map((pr) => (
              <div key={pr.number} className="flex items-start gap-1.5">
                <GitPullRequest size={11} className="mt-0.5 shrink-0 text-faint" />
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-medium text-bright/90">
                    <span className="font-mono text-faint">#{pr.number}</span> {pr.title}
                  </div>
                  <div className="font-mono text-[9px] text-faint">
                    {authorById(pr.authorId).handle} · {relativeTime(pr.mergedAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 border-t border-edge p-2.5">
        <button
          onClick={() => openSandbox(file.id)}
          className="flex flex-1 items-center justify-center gap-1.5 border border-edge-2 bg-ink-2 px-3 py-1.5 font-mono text-[11px] font-semibold text-bright transition-colors duration-150 hover:border-faint"
        >
          <SplitSquareHorizontal size={12} />
          Open Refactor Sandbox
        </button>
        <button
          onClick={() => {
            if (!chatOpen) toggleChat();
            askAI(file.id, "", "explain-intent");
          }}
          className="flex items-center justify-center gap-1.5 border border-edge bg-ink px-3 py-1.5 font-mono text-[11px] font-semibold text-muted transition-colors duration-150 hover:bg-ink-2 hover:text-bright"
        >
          <SquareTerminal size={12} />
          Assistant
        </button>
      </div>
    </motion.aside>
  );
}
