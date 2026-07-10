import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Eraser, FileCode2, Sparkles, TerminalSquare } from "lucide-react";
import { useDashboard } from "../store";
import { fileById } from "../data/mockRepo";
import { segmentsLength, sliceSegments } from "../data/ai";
import type { ChatMessage, QuickAction } from "../types";
import { SkeletonLines } from "./ui";

/* ---------------------------------------------------------------------------
   Contextual Blame AI — terminal-style chat pane.

   · streams AI segments token-style with a blinking caret
   · inline `code` tokens and clickable L42 chips that jump the sandbox editor
   · syntax-highlighted code blocks
   · quick-action pills: /explain-intent  /find-weaknesses  /history
--------------------------------------------------------------------------- */

const QUICK_ACTIONS: Array<{ id: QuickAction; label: string }> = [
  { id: "explain-intent", label: "explain-intent" },
  { id: "find-weaknesses", label: "find-weaknesses" },
  { id: "history", label: "history" },
];

/* --- Tiny syntax highlighter (chat code blocks only) ------------------------ */

const TOKEN_RX =
  /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|function|return|if|else|await|async|export|import|from|interface|type|new|for|while|typeof|null|undefined|true|false|of|in|class|extends)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Z][A-Za-z0-9_]*)\b|([a-zA-Z_$][\w$]*)(?=\()/gm;

const TOKEN_CLASSES = ["tok-com", "tok-str", "tok-kw", "tok-num", "tok-type", "tok-fn"];

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of code.matchAll(TOKEN_RX)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(code.slice(last, idx));
    const groupIdx = m.slice(1).findIndex((g) => g !== undefined);
    out.push(
      <span key={key++} className={TOKEN_CLASSES[groupIdx]}>
        {m[0]}
      </span>,
    );
    last = idx + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

/* --- Message rendering -------------------------------------------------------- */

function MessageView({ message, onTick }: { message: ChatMessage; onTick: () => void }) {
  const finishStreaming = useDashboard((s) => s.finishStreaming);
  const jumpToLine = useDashboard((s) => s.jumpToLine);
  const total = useMemo(() => segmentsLength(message.segments), [message.segments]);
  const [chars, setChars] = useState(message.streaming ? 0 : total);

  useEffect(() => {
    if (!message.streaming) return;
    const iv = window.setInterval(() => {
      setChars((c) => {
        const next = c + 5 + Math.floor(Math.random() * 8);
        if (next >= total) {
          window.clearInterval(iv);
          finishStreaming(message.id);
          return total;
        }
        return next;
      });
      onTick();
    }, 22);
    return () => window.clearInterval(iv);
  }, [message.streaming, message.id, total, finishStreaming, onTick]);

  const visible = message.streaming ? sliceSegments(message.segments, chars) : message.segments;

  if (message.role === "user") {
    return (
      <div className="flex items-start gap-2 font-mono text-[12px]">
        <span className="mt-px select-none font-bold text-accent-2">❯</span>
        <span className="whitespace-pre-wrap break-words text-bright">
          {message.segments[0]?.kind === "text" ? message.segments[0].text : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent-2">
        <Sparkles size={11} className="text-white" />
      </div>
      <div
        className={`min-w-0 flex-1 text-[12px] leading-relaxed text-bright/90 ${
          message.streaming ? "caret" : ""
        }`}
      >
        {visible.map((seg, i) => {
          switch (seg.kind) {
            case "text":
              return (
                <span key={i} className="whitespace-pre-wrap break-words">
                  {seg.text}
                </span>
              );
            case "inline":
              return (
                <code
                  key={i}
                  className="mx-0.5 rounded border border-edge bg-ink-2 px-1 py-px font-mono text-[11px] text-accent-2"
                >
                  {seg.text}
                </code>
              );
            case "lineref":
              return (
                <button
                  key={i}
                  onClick={() => message.fileId && jumpToLine(message.fileId, seg.line)}
                  title={`Jump to line ${seg.line} in the sandbox`}
                  className="mx-0.5 inline-flex translate-y-px items-center gap-0.5 rounded border border-accent/40 bg-accent/10 px-1 py-px font-mono text-[10px] font-semibold text-accent-2 transition-all hover:border-accent hover:bg-accent/25"
                >
                  <FileCode2 size={9} />
                  {seg.label}
                </button>
              );
            case "block":
              return (
                <pre
                  key={i}
                  className="my-2 overflow-x-auto rounded-lg border border-edge bg-obsidian p-3 font-mono text-[11px] leading-relaxed"
                >
                  {highlight(seg.code)}
                </pre>
              );
          }
        })}
      </div>
    </div>
  );
}

/* --- Pane --------------------------------------------------------------------- */

export function ChatPane() {
  const selectedFileId = useDashboard((s) => s.selectedFileId);
  const messages = useDashboard((s) => s.messages);
  const aiThinking = useDashboard((s) => s.aiThinking);
  const askAI = useDashboard((s) => s.askAI);
  const clearChat = useDashboard((s) => s.clearChat);
  const file = fileById(selectedFileId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(scrollToBottom, [messages.length, aiThinking, scrollToBottom]);

  const busy = aiThinking || messages.some((m) => m.streaming);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file || !input.trim() || busy) return;
    askAI(file.id, input.trim());
    setInput("");
  };

  return (
    <div className="flex h-full flex-col bg-ink">
      {/* Terminal chrome header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-edge px-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
            <TerminalSquare size={12} className="text-accent-2" />
            blame-ai
            {file && <span className="text-faint">— {file.name}</span>}
          </div>
        </div>
        <button
          onClick={clearChat}
          title="Clear conversation"
          className="rounded p-1 text-faint transition-colors hover:bg-edge hover:text-bright"
        >
          <Eraser size={13} />
        </button>
      </div>

      {/* Message stream */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && !aiThinking && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-edge bg-ink-2">
              <Sparkles size={17} className="text-accent" />
            </div>
            <p className="max-w-[240px] text-[11px] leading-relaxed text-faint">
              {file ? (
                <>
                  Ask about <span className="font-mono text-muted">{file.name}</span>. I've
                  ingested its source, git blame, merged PRs, and commit history.
                </>
              ) : (
                "Select a node in the graph to load its blame context."
              )}
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <MessageView message={m} onTick={scrollToBottom} />
            </motion.div>
          ))}
        </AnimatePresence>
        {aiThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2.5"
          >
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent-2">
              <Sparkles size={11} className="text-white" />
            </div>
            <div className="flex-1 pt-0.5">
              <SkeletonLines lines={3} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-edge px-3 py-2">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.id}
            disabled={!file || busy}
            onClick={() => file && askAI(file.id, "", qa.id)}
            className="rounded-full border border-edge bg-ink-2 px-2.5 py-1 font-mono text-[10px] text-muted transition-all hover:border-accent/50 hover:text-accent-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            /{qa.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={submit} className="shrink-0 border-t border-edge p-3">
        <div className="flex items-center gap-2 rounded-lg border border-edge bg-obsidian px-3 py-2 transition-colors focus-within:border-accent/50">
          <span className="select-none font-mono text-[12px] font-bold text-accent-2">❯</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!file}
            placeholder={file ? `Ask about ${file.name}…` : "Select a file first…"}
            className="w-full bg-transparent font-mono text-[12px] text-bright placeholder:text-faint/60 focus:outline-none disabled:cursor-not-allowed"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={!file || !input.trim() || busy}
            className="shrink-0 rounded-md border border-edge bg-ink-2 p-1.5 text-muted transition-colors hover:text-bright disabled:opacity-40"
          >
            <CornerDownLeft size={12} />
          </button>
        </div>
      </form>
    </div>
  );
}
