import { useMemo } from "react";
import { motion } from "framer-motion";
import { marked } from "marked";
import { FileCode2, GitCommitHorizontal, GitPullRequest, MessageSquareText, SplitSquareHorizontal, X } from "lucide-react";
import { useDashboard } from "../store";
import { authorById, relativeTime } from "../data/mockRepo";
import { commitFrequency, commitSizes, legacyExplanation, refactorTimeline } from "../data/insights";
import type { RepoFile } from "../types";
import { ComplexityBadge, SectionLabel, Sparkline, Stat } from "./ui";

/* ---------------------------------------------------------------------------
   File side panel. Listens to the selected node and shows:
     · metadata header with minimalist commit-metric sparklines
     · a human-readable markdown explanation of the legacy code
     · a "previous refactors" timeline reconstructed from git history
--------------------------------------------------------------------------- */

const EASE = [0.25, 0.1, 0.25, 1] as const;

function CommitMetrics({ file }: { file: RepoFile }) {
  const sizes = useMemo(() => commitSizes(file), [file]);
  const freq = useMemo(() => commitFrequency(file), [file]);
  const avgSize = Math.round(sizes.reduce((a, b) => a + b, 0) / Math.max(1, sizes.length));
  const perWeek = (file.churn / 13).toFixed(1);
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-2">
        <div>
          <div className="text-[10px] text-faint">Commit size</div>
          <div className="text-[11px] font-medium text-muted">~{avgSize} lines</div>
        </div>
        <Sparkline values={sizes} />
      </div>
      <div className="flex items-center gap-2">
        <div>
          <div className="text-[10px] text-faint">Frequency</div>
          <div className="text-[11px] font-medium text-muted">{perWeek}/wk</div>
        </div>
        <Sparkline values={freq} />
      </div>
    </div>
  );
}

function RefactorTimeline({ file }: { file: RepoFile }) {
  const events = useMemo(() => refactorTimeline(file), [file]);
  if (events.length === 0) {
    return <p className="text-[12px] text-faint">No prior refactors on record.</p>;
  }
  return (
    <div className="relative ml-1.5 border-l border-edge pl-4">
      {events.map((ev) => {
        const author = authorById(ev.authorId);
        return (
          <div key={ev.id} className="relative pb-4 last:pb-0">
            <span
              className={`absolute -left-[21.5px] top-1 flex h-3 w-3 items-center justify-center rounded-full border bg-card ${
                ev.kind === "pr" ? "border-sage" : "border-edge-2"
              }`}
            >
              <span
                className={`h-1 w-1 rounded-full ${ev.kind === "pr" ? "bg-sage" : "bg-edge-2"}`}
              />
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-faint">
              {ev.kind === "pr" ? (
                <GitPullRequest size={10} />
              ) : (
                <GitCommitHorizontal size={10} />
              )}
              {author.name} · {relativeTime(ev.date)}
            </div>
            <div className="mt-0.5 text-[12px] font-medium leading-snug text-ink">
              {ev.title}
            </div>
            <div className="text-[11px] leading-relaxed text-muted">{ev.detail}</div>
          </div>
        );
      })}
    </div>
  );
}

export function FileDrawer({ file }: { file: RepoFile }) {
  const closeDrawer = useDashboard((s) => s.closeDrawer);
  const openSandbox = useDashboard((s) => s.openSandbox);
  const askAI = useDashboard((s) => s.askAI);
  const chatOpen = useDashboard((s) => s.chatOpen);
  const toggleChat = useDashboard((s) => s.toggleChat);

  const explanationHtml = useMemo(
    () => marked.parse(legacyExplanation(file), { async: false }) as string,
    [file],
  );

  return (
    <motion.aside
      key={file.id}
      initial={{ x: -380, opacity: 0.6 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -380, opacity: 0 }}
      transition={{ duration: 0.32, ease: EASE }}
      className="shadow-card absolute bottom-0 left-0 top-0 z-20 flex w-[372px] flex-col overflow-hidden border-r border-edge bg-card"
    >
      {/* Metadata header */}
      <div className="shrink-0 border-b border-edge p-4 pb-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-edge bg-paper">
              <FileCode2 size={15} className="text-muted" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-ink">{file.name}</div>
              <div className="truncate text-[11px] text-faint">{file.path}</div>
            </div>
          </div>
          <button
            onClick={closeDrawer}
            className="rounded-md p-1 text-faint transition-colors duration-200 hover:bg-panel hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <ComplexityBadge value={file.complexity} />
        </div>

        <div className="mt-3">
          <CommitMetrics file={file} />
        </div>

        <div className="mt-3 flex items-center gap-4">
          <Stat label="Lines" value={file.loc.toLocaleString()} />
          <Stat label="Commits" value={file.totalCommits} />
          <Stat label="Churn 90d" value={file.churn} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <SectionLabel>Legacy code explanation</SectionLabel>
          <div
            className="prose-min mt-2"
            dangerouslySetInnerHTML={{ __html: explanationHtml }}
          />
        </section>

        <section>
          <SectionLabel>Previous refactors</SectionLabel>
          <div className="mt-2.5">
            <RefactorTimeline file={file} />
          </div>
        </section>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-2 border-t border-edge p-3">
        <button
          onClick={() => openSandbox(file.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-ink px-3 py-2 text-[12px] font-medium text-paper transition-colors duration-200 hover:bg-[#3a3a3a]"
        >
          <SplitSquareHorizontal size={13} />
          Open refactor sandbox
        </button>
        <button
          onClick={() => {
            if (!chatOpen) toggleChat();
            askAI(file.id, "", "explain-intent");
          }}
          className="flex items-center justify-center gap-1.5 rounded-md border border-edge bg-card px-3 py-2 text-[12px] font-medium text-muted transition-colors duration-200 hover:bg-panel hover:text-ink"
        >
          <MessageSquareText size={13} />
          Ask assistant
        </button>
      </div>
    </motion.aside>
  );
}
