import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { CornerDownLeft, Eraser, SquareTerminal } from "lucide-react";
import { useDashboard } from "../store";
import { fileById } from "../data/mockRepo";
import { segmentsLength, sliceSegments } from "../data/ai";
import type { ChatMessage, QuickAction } from "../types";

/* ---------------------------------------------------------------------------
   Terminal Assistant — blame-context query console.

   · streams response segments token-style with a blinking caret
   · inline `code` tokens and clickable L42 chips that jump the sandbox editor
   · syntax-highlighted code blocks
   · quick commands: /explain-intent  /find-weaknesses  /history
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
        <span className="mt-px select-none font-bold text-bright">❯</span>
        <span className="whitespace-pre-wrap break-words text-bright">
          {message.segments[0]?.kind === "text" ? message.segments[0].text : ""}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <span className="mt-px select-none font-mono text-[12px] font-bold text-faint">$</span>
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
                  className="mx-0.5 border border-edge bg-ink-2 px-1 py-px font-mono text-[11px] text-bright"
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
                  className="mx-0.5 inline-flex translate-y-px items-center gap-0.5 border border-edge bg-ink-2 px-1 py-px font-mono text-[10px] font-semibold text-bright underline decoration-faint underline-offset-2 transition-colors duration-150 hover:border-edge-2 hover:bg-edge"
                >
                  {seg.label}
                </button>
              );
            case "block":
              return (
                <pre
                  key={i}
                  className="my-2 overflow-x-auto border border-edge bg-obsidian p-3 font-mono text-[11px] leading-relaxed"
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
      {/* Console header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-edge px-3">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
          <SquareTerminal size={12} className="text-faint" />
          <span className="font-semibold uppercase tracking-[0.12em]">Terminal Assistant</span>
          {file && <span className="text-faint">— {file.name}</span>}
        </div>
        <button
          onClick={clearChat}
          title="Clear session"
          className="p-1 text-faint transition-colors duration-150 hover:bg-ink-2 hover:text-bright"
        >
          <Eraser size={13} />
        </button>
      </div>

      {/* Message stream */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !aiThinking && (
          <div className="font-mono text-[11px] leading-relaxed text-faint">
            {file ? (
              <>
                <p>
                  blame context loaded: <span className="text-muted">{file.name}</span>
                </p>
                <p className="mt-1">
                  source · git blame · merged PRs · commit history indexed.
                </p>
                <p className="mt-1">type a query or run a /command below.</p>
              </>
            ) : (
              <p>no context — select a node in the graph to load its blame data.</p>
            )}
          </div>
        )}
        {messages.map((m) => (
          <MessageView key={m.id} message={m} onTick={scrollToBottom} />
        ))}
        {aiThinking && (
          <div className="flex items-start gap-2 font-mono text-[12px]">
            <span className="mt-px select-none font-bold text-faint">$</span>
            <span className="caret text-faint">analyzing blame context</span>
          </div>
        )}
      </div>

      {/* Quick commands */}
      <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-edge px-3 py-2">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.id}
            disabled={!file || busy}
            onClick={() => file && askAI(file.id, "", qa.id)}
            className="border border-edge bg-ink-2 px-2 py-0.5 font-mono text-[10px] text-muted transition-colors duration-150 hover:border-edge-2 hover:text-bright disabled:cursor-not-allowed disabled:opacity-40"
          >
            /{qa.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={submit} className="shrink-0 border-t border-edge p-2.5">
        <div className="flex items-center gap-2 border border-edge bg-obsidian px-2.5 py-1.5 transition-colors duration-150 focus-within:border-edge-2">
          <span className="select-none font-mono text-[12px] font-bold text-muted">❯</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!file}
            placeholder={file ? `query ${file.name}…` : "select a file first…"}
            className="w-full bg-transparent font-mono text-[12px] text-bright placeholder:text-faint/60 focus:outline-none disabled:cursor-not-allowed"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={!file || !input.trim() || busy}
            className="shrink-0 border border-edge bg-ink-2 p-1 text-muted transition-colors duration-150 hover:text-bright disabled:opacity-40"
          >
            <CornerDownLeft size={12} />
          </button>
        </div>
      </form>
    </div>
  );
}
