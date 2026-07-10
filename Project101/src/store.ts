import { create } from "zustand";
import type { ChatMessage, QuickAction } from "./types";
import { composeResponse } from "./data/ai";
import { fileById } from "./data/mockRepo";

/* ---------------------------------------------------------------------------
   Global app state.

   Rendering-heavy derived data (graph filter matches, impact metrics, code)
   is computed in components with useMemo; the store holds only intent.
--------------------------------------------------------------------------- */

export type View = "graph" | "sandbox";

interface RevealTarget {
  fileId: string;
  line: number;
  /** Changes on every jump so repeated jumps to the same line still fire. */
  nonce: number;
}

interface DashboardState {
  view: View;
  selectedFileId: string | null;
  drawerOpen: boolean;
  searchQuery: string;
  chatOpen: boolean;

  messages: ChatMessage[];
  aiThinking: boolean;

  /** File open in the refactor sandbox. */
  sandboxFileId: string | null;
  /** User edits to the modernized pane, keyed by file id. */
  modernDrafts: Record<string, string>;
  /** Files whose refactor has been applied & staged. */
  refactoredIds: string[];
  revealTarget: RevealTarget | null;

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

export const useDashboard = create<DashboardState>((set, get) => ({
  view: "graph",
  selectedFileId: null,
  drawerOpen: false,
  searchQuery: "",
  chatOpen: true,

  messages: [],
  aiThinking: false,

  sandboxFileId: null,
  modernDrafts: {},
  refactoredIds: [],
  revealTarget: null,

  setView: (view) => set({ view }),

  selectFile: (id) =>
    set({
      selectedFileId: id,
      drawerOpen: id !== null,
    }),

  closeDrawer: () => set({ drawerOpen: false }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

  askAI: (fileId, input, quickAction) => {
    const file = fileById(fileId);
    if (!file) return;
    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      fileId,
      segments: [{ kind: "text", text: quickAction ? `/${quickAction}` : input }],
      streaming: false,
    };
    set((s) => ({ messages: [...s.messages, userMsg], aiThinking: true }));

    // Simulated model latency before the streamed response begins.
    const thinkMs = 550 + Math.random() * 650;
    window.setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: nextId(),
        role: "ai",
        fileId,
        segments: composeResponse(file, quickAction ?? input),
        streaming: true,
      };
      set((s) => ({ messages: [...s.messages, aiMsg], aiThinking: false }));
    }, thinkMs);
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
      selectedFileId: fileId,
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
}));
