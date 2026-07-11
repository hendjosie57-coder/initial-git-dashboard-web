import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { CornerDownLeft, Eraser, MessageSquareText } from "lucide-react";
import { selectActiveFile, useDashboard } from "../store";
import { segmentsLength, sliceSegments } from "../lib/segments";
import type { ChatMessage, QuickAction } from "../types";

const QUICK_ACTIONS: Array<{ id: QuickAction; label: string }> = [
  { id: "explain-intent", label: "Explain intent" },
  { id: "find-weaknesses", label: "Find weaknesses" },
  { id: "history", label: "History" },
];

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
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-panel px-3 py-1.5 text-[12.5px] leading-relaxed text-ink">
          {message.segments[0]?.kind === "text" ? message.segments[0].text : ""}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-w-0 text-[12.5px] leading-relaxed text-body ${
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
                className="mx-0.5 rounded border border-edge bg-panel px-1 py-px font-mono text-[11px] text-ink"
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
                className="mx-0.5 inline-flex translate-y-px items-center rounded border border-edge bg-card px-1.5 py-px text-[11px] font-medium text-ink underline decoration-edge-2 underline-offset-2 transition-colors duration-200 hover:bg-panel"
              >
                {seg.label}
              </button>
            );
          case "block":
            return (
              <pre
                key={i}
                className="my-2 overflow-x-auto rounded-md border border-edge bg-paper p-3 font-mono text-[11px] leading-relaxed text-ink"
              >
                {highlight(seg.code)}
              </pre>
            );
        }
      })}
    </div>
  );
}

/* --- Pane --------------------------------------------------------------------- */

export function ChatPane() {
  const messages = useDashboard((s) => s.messages);
  const aiThinking = useDashboard((s) => s.aiThinking);
  const askAI = useDashboard((s) => s.askAI);
  const clearChat = useDashboard((s) => s.clearChat);
  const file = useDashboard(selectActiveFile);
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
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-edge px-3.5">
        <div className="flex items-center gap-2 text-[12px] text-ink">
          <MessageSquareText size={14} className="text-muted" />
          <span className="font-semibold">Blame assistant</span>
          {file && <span className="text-faint">· {file.name}</span>}
        </div>
        <button
          onClick={clearChat}
          title="Clear conversation"
          className="rounded-md p-1 text-faint transition-colors duration-200 hover:bg-panel hover:text-ink"
        >
          <Eraser size={13} />
        </button>
      </div>

      {/* Message stream */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && !aiThinking && (
          <div className="text-[12px] leading-relaxed text-faint">
            {file ? (
              <>
                <p>
                  Context loaded for <span className="font-medium text-muted">{file.name}</span>:
                  live git blame and commit history from the analysis engine.
                </p>
                <p className="mt-1.5">
                  Ask something like <em>“Why was this function rewritten?”</em> or use a quick
                  action below.
                </p>
              </>
            ) : (
              <p>Select a node in the graph to load its blame context.</p>
            )}
          </div>
        )}
        {messages.map((m) => (
          <MessageView key={m.id} message={m} onTick={scrollToBottom} />
        ))}
        {aiThinking && (
          <div className="caret text-[12px] text-faint">Reading blame context</div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-edge px-3.5 py-2.5">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.id}
            disabled={!file || busy}
            onClick={() => file && askAI(file.id, "", qa.id)}
            className="rounded-full border border-edge bg-card px-2.5 py-1 text-[11px] font-medium text-muted transition-colors duration-200 hover:bg-panel hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {qa.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={submit} className="shrink-0 border-t border-edge p-3">
        <div className="shadow-card flex items-center gap-2 rounded-lg border border-edge bg-card px-3 py-2 transition-colors duration-200 focus-within:border-edge-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!file}
            placeholder={file ? `Ask about ${file.name}…` : "Select a file first…"}
            className="w-full bg-transparent text-[12.5px] text-ink placeholder:text-faint focus:outline-none disabled:cursor-not-allowed"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={!file || !input.trim() || busy}
            className="shrink-0 rounded-md border border-edge bg-paper p-1.5 text-muted transition-colors duration-200 hover:text-ink disabled:opacity-40"
          >
            <CornerDownLeft size={12} />
          </button>
        </div>
      </form>
    </div>
  );
}
