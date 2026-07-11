import { useMemo } from "react";
import { motion } from "framer-motion";
import { marked } from "marked";
import { FileCode2, GitCommitHorizontal, MessageSquareText, SplitSquareHorizontal, X } from "lucide-react";
import { useDashboard } from "../store";
import type { TimelineEntry } from "../lib/api";
import { complexityBand } from "../lib/colors";
import type { LiveFile } from "../types";
import { ComplexityBadge, SectionLabel, SkeletonLines, Sparkline, Stat } from "./ui";

/* ---------------------------------------------------------------------------
   File side panel, fed by GET /api/v1/file/history (fetched automatically by
   the store middleware whenever activeFileId changes):
     · metadata header with live commit-metric sparklines
     · a markdown summary synthesized from the file's real git analytics
     · the refactor timeline parsed from `git log --follow`
--------------------------------------------------------------------------- */

const EASE = [0.25, 0.1, 0.25, 1] as const;

/** Commits per month over the last `months` months, oldest → newest. */
function monthlyCommitBins(timeline: TimelineEntry[], months = 12): number[] {
  const bins = new Array<number>(months).fill(0);
  const now = Date.now();
  for (const entry of timeline) {
    const age = Math.floor((now - new Date(entry.dateString).getTime()) / (30.44 * 86_400_000));
    if (age >= 0 && age < months) bins[months - 1 - age]++;
  }
  return bins;
}

function CommitMetrics({ file }: { file: LiveFile }) {
  const analytics = useDashboard((s) => s.activeAnalytics);
  const timeline = useDashboard((s) => s.refactorTimeline);
  const bins = useMemo(() => monthlyCommitBins(timeline), [timeline]);
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-2">
        <div>
          <div className="text-[10px] text-faint">Commit size</div>
          <div className="text-[11px] font-medium text-muted">
            ~{analytics?.averageCommitSizeLines ?? 0} lines
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div>
          <div className="text-[10px] text-faint">Frequency</div>
          <div className="text-[11px] font-medium text-muted">
            {(analytics?.commitFrequencyPerMonth ?? file.totalCommits).toFixed(1)}/mo
          </div>
        </div>
        <Sparkline values={bins} />
      </div>
    </div>
  );
}

/** Markdown explanation grounded in the file's real git analytics. */
function liveExplanation(file: LiveFile, timeline: TimelineEntry[]): string {
  const authors = new Map<string, number>();
  for (const e of timeline) authors.set(e.author, (authors.get(e.author) ?? 0) + 1);
  const ranked = [...authors.entries()].sort((a, b) => b[1] - a[1]);
  const authorNote = ranked.length
    ? `Its history involves ${ranked.length} author${ranked.length === 1 ? "" : "s"}, led by **${
        ranked[0][0]
      }** (${ranked[0][1]} of ${timeline.length} commits).`
    : "No commit history is recorded for it yet.";
  const span = timeline.length
    ? `First recorded commit ${timeline[0].dateString}, most recent ${
        timeline[timeline.length - 1].dateString
      }.`
    : "";
  const band = complexityBand(file.complexity);

  return `### What this file is

\`${file.name}\` lives in \`${file.dir}\` — ${file.loc.toLocaleString()} lines with a **${band}** cyclomatic complexity score of ${file.complexity} (radon static analysis).

### What its history says

${authorNote} ${span}

Recent commit subjects are listed in the timeline below; ask the blame assistant for a line-level answer to *why* any of them happened.`;
}

function RefactorTimeline() {
  const timeline = useDashboard((s) => s.refactorTimeline);
  const events = useMemo(() => [...timeline].reverse().slice(0, 6), [timeline]);
  if (events.length === 0) {
    return <p className="text-[12px] text-faint">No commit history on record.</p>;
  }
  return (
    <div className="relative ml-1.5 border-l border-edge pl-4">
      {events.map((ev) => (
        <div key={ev.commitHash} className="relative pb-4 last:pb-0">
          <span className="absolute -left-[21.5px] top-1 flex h-3 w-3 items-center justify-center rounded-full border border-edge-2 bg-card">
            <span className="h-1 w-1 rounded-full bg-edge-2" />
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-faint">
            <GitCommitHorizontal size={10} />
            {ev.author} · {ev.dateString}
          </div>
          <div className="mt-0.5 text-[12px] font-medium leading-snug text-ink">
            {ev.summary || "(no message)"}
          </div>
          <div className="font-mono text-[10px] text-faint">{ev.commitHash.slice(0, 10)}</div>
        </div>
      ))}
    </div>
  );
}

export function FileDrawer({ file }: { file: LiveFile }) {
  const closeDrawer = useDashboard((s) => s.closeDrawer);
  const openSandbox = useDashboard((s) => s.openSandbox);
  const askAI = useDashboard((s) => s.askAI);
  const chatOpen = useDashboard((s) => s.chatOpen);
  const toggleChat = useDashboard((s) => s.toggleChat);
  const historyStatus = useDashboard((s) => s.historyStatus);
  const historyError = useDashboard((s) => s.historyError);
  const timeline = useDashboard((s) => s.refactorTimeline);

  const explanationHtml = useMemo(
    () => marked.parse(liveExplanation(file, timeline), { async: false }) as string,
    [file, timeline],
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
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {historyStatus === "loading" ? (
          <SkeletonLines lines={6} />
        ) : historyStatus === "error" ? (
          <p className="text-[12px] leading-relaxed text-muted">
            Could not load history: {historyError}
          </p>
        ) : (
          <>
            <section>
              <SectionLabel>File summary</SectionLabel>
              <div
                className="prose-min mt-2"
                dangerouslySetInnerHTML={{ __html: explanationHtml }}
              />
            </section>

            <section>
              <SectionLabel>Commit timeline</SectionLabel>
              <div className="mt-2.5">
                <RefactorTimeline />
              </div>
            </section>
          </>
        )}
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
