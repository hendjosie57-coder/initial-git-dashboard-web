import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { ChatMessage, DepEdge, LiveFile, QuickAction } from "./types";
import {
  fetchFileHistory,
  fetchHealth,
  fetchTopology,
  postContextualBlame,
  type FileAnalytics,
  type TimelineEntry,
  type TopologyNode,
} from "./lib/api";
import { markdownToSegments } from "./lib/segments";

/* ---------------------------------------------------------------------------
   Global app state, hydrated from the FastAPI analysis engine.

   Data flow:
     loadRepository()      → GET /api/v1/repository/topology (+ /health)
     activeFileId mutation → middleware below catches it and fetches
                             GET /api/v1/file/history?path={activeFileId},
                             populating source, timeline, and sidebar metrics
                             atomically in a single set().
     askAI()               → POST /api/v1/chat/contextual-blame
--------------------------------------------------------------------------- */

export type View = "graph" | "sandbox";
export type LoadStatus = "idle" | "loading" | "ready" | "error";

interface RevealTarget {
  fileId: string;
  line: number;
  /** Changes on every jump so repeated jumps to the same line still fire. */
  nonce: number;
}

interface DashboardState {
  view: View;
  drawerOpen: boolean;
  searchQuery: string;
  chatOpen: boolean;

  /* Repository topology (canvas pipeline). */
  files: LiveFile[];
  edges: DepEdge[];
  repoName: string;
  branch: string;
  repoStatus: LoadStatus;
  repoError: string | null;

  /* Active file + its fetched history (drawer, sandbox, metrics). */
  activeFileId: string | null;
  activeFileSource: string | null;
  activeModernized: string | null;
  activeAnalytics: FileAnalytics | null;
  refactorTimeline: TimelineEntry[];
  historyStatus: LoadStatus;
  historyError: string | null;

  messages: ChatMessage[];
  aiThinking: boolean;

  /** File open in the refactor sandbox. */
  sandboxFileId: string | null;
  /** User edits to the modernized pane, keyed by file id. */
  modernDrafts: Record<string, string>;
  /** Files whose refactor has been applied & staged. */
  refactoredIds: string[];
  revealTarget: RevealTarget | null;

  loadRepository: () => Promise<void>;
  setView: (view: View) => void;
  selectFile: (id: string | null) => void;
  closeDrawer: () => void;
  setSearchQuery: (q: string) => void;
  toggleChat: () => void;

  askAI: (fileId: string, input: string, quickAction?: QuickAction) => void;
  finishStreaming: (messageId: string) => void;
  clearChat: () => void;

  openSandbox: (fileId: string) => void;
  setModernDraft: (fileId: string, code: string) => void;
  applyRefactor: (fileId: string) => void;
  jumpToLine: (fileId: string, line: number) => void;
}

let msgCounter = 0;
const nextId = () => `msg-${++msgCounter}`;

const MONACO_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
};

function toLiveFile(node: TopologyNode): LiveFile {
  const path = node.id;
  const slash = path.lastIndexOf("/");
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot) : "";
  return {
    id: path,
    path,
    name,
    dir: slash >= 0 ? path.slice(0, slash) : ".",
    ext,
    monacoLang: MONACO_LANG[ext] ?? "plaintext",
    loc: node.fileSizeLines,
    complexity: node.cyclomaticComplexity,
    totalCommits: node.commitFrequencyCount,
  };
}

/** Quick-action pills become concrete history questions for the backend. */
const QUICK_ACTION_INQUIRIES: Record<QuickAction, string> = {
  "explain-intent":
    "Explain the intent of this file: who shaped it, and what do the commit messages say about why it looks the way it does?",
  "find-weaknesses":
    "Based on the blame history, which lines or areas of this file changed most often or look riskiest, and why?",
  history:
    "Summarize the modification history of this file: who changed it, when, and what did each change accomplish?",
};

export const useDashboard = create<DashboardState>()(
  subscribeWithSelector((set, get) => ({
    view: "graph",
    drawerOpen: false,
    searchQuery: "",
    chatOpen: true,

    files: [],
    edges: [],
    repoName: "",
    branch: "",
    repoStatus: "idle",
    repoError: null,

    activeFileId: null,
    activeFileSource: null,
    activeModernized: null,
    activeAnalytics: null,
    refactorTimeline: [],
    historyStatus: "idle",
    historyError: null,

    messages: [],
    aiThinking: false,

    sandboxFileId: null,
    modernDrafts: {},
    refactoredIds: [],
    revealTarget: null,

    loadRepository: async () => {
      if (get().repoStatus === "loading") return;
      set({ repoStatus: "loading", repoError: null });
      try {
        const [topology, health] = await Promise.all([
          fetchTopology(),
          fetchHealth().catch(() => null),
        ]);
        set({
          files: topology.nodes.map(toLiveFile),
          edges: topology.links.map(({ source, target }) => ({ source, target })),
          repoName: health?.repositoryName ?? "",
          branch: health?.branch ?? "",
          repoStatus: "ready",
        });
      } catch (err) {
        set({
          repoStatus: "error",
          repoError: err instanceof Error ? err.message : String(err),
        });
      }
    },

    setView: (view) => set({ view }),

    selectFile: (id) =>
      set({
        activeFileId: id,
        drawerOpen: id !== null,
      }),

    closeDrawer: () => set({ drawerOpen: false }),

    setSearchQuery: (searchQuery) => set({ searchQuery }),

    toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

    askAI: (fileId, input, quickAction) => {
      const inquiry = quickAction ? QUICK_ACTION_INQUIRIES[quickAction] : input;
      if (!inquiry.trim()) return;

      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        fileId,
        segments: [{ kind: "text", text: quickAction ? `/${quickAction}` : input }],
        streaming: false,
      };
      set((s) => ({ messages: [...s.messages, userMsg], aiThinking: true }));

      void postContextualBlame(fileId, inquiry)
        .then((res) => {
          const aiMsg: ChatMessage = {
            id: nextId(),
            role: "ai",
            fileId,
            segments: markdownToSegments(res.replyText),
            streaming: true,
          };
          set((s) => ({ messages: [...s.messages, aiMsg], aiThinking: false }));
        })
        .catch((err: unknown) => {
          const aiMsg: ChatMessage = {
            id: nextId(),
            role: "ai",
            fileId,
            segments: [
              {
                kind: "text",
                text: `Could not reach the blame engine: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              },
            ],
            streaming: false,
          };
          set((s) => ({ messages: [...s.messages, aiMsg], aiThinking: false }));
        });
    },

    finishStreaming: (messageId) =>
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === messageId ? { ...m, streaming: false } : m,
        ),
      })),

    clearChat: () => set({ messages: [], aiThinking: false }),

    openSandbox: (fileId) =>
      set({
        view: "sandbox",
        sandboxFileId: fileId,
        activeFileId: fileId,
        drawerOpen: false,
      }),

    setModernDraft: (fileId, code) =>
      set((s) => ({ modernDrafts: { ...s.modernDrafts, [fileId]: code } })),

    applyRefactor: (fileId) =>
      set((s) => ({
        refactoredIds: s.refactoredIds.includes(fileId)
          ? s.refactoredIds
          : [...s.refactoredIds, fileId],
      })),

    jumpToLine: (fileId, line) => {
      const { openSandbox } = get();
      openSandbox(fileId);
      set({ revealTarget: { fileId, line, nonce: Date.now() } });
    },
  })),
);

/* ---------------------------------------------------------------------------
   State-synchronization middleware: every activeFileId mutation — regardless
   of which action dispatched it — triggers the file-history fetch. Results
   land atomically in one set(); stale responses (user already clicked away)
   are dropped.
--------------------------------------------------------------------------- */

useDashboard.subscribe(
  (s) => s.activeFileId,
  (fileId) => {
    if (!fileId) return;
    useDashboard.setState({ historyStatus: "loading", historyError: null });
    void fetchFileHistory(fileId)
      .then((history) => {
        if (useDashboard.getState().activeFileId !== fileId) return; // stale
        useDashboard.setState({
          activeFileSource: history.rawLegacyString,
          activeModernized: history.modernizedString,
          activeAnalytics: history.analytics,
          refactorTimeline: history.refactorTimeline,
          historyStatus: "ready",
        });
      })
      .catch((err: unknown) => {
        if (useDashboard.getState().activeFileId !== fileId) return;
        useDashboard.setState({
          activeFileSource: null,
          activeModernized: null,
          activeAnalytics: null,
          refactorTimeline: [],
          historyStatus: "error",
          historyError: err instanceof Error ? err.message : String(err),
        });
      });
  },
);

/** Stable-selector helper: the active LiveFile record, or null. */
export const selectActiveFile = (s: DashboardState): LiveFile | null =>
  s.activeFileId ? (s.files.find((f) => f.id === s.activeFileId) ?? null) : null;
