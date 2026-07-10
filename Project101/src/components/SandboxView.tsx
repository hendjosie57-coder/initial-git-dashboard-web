import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { motion } from "framer-motion";
import { ArrowLeft, History, Lock, PencilLine } from "lucide-react";
import { useDashboard } from "../store";
import { authorById, fileById, relativeTime } from "../data/mockRepo";
import { getFileCode } from "../data/codegen";
import { ImpactReport } from "./ImpactReport";
import { RiskBadge, SkeletonLines } from "./ui";

/* ---------------------------------------------------------------------------
   Refactor Sandbox — three columns:
     1. legacy source, read-only Monaco with a git-blame gutter
     2. modernized source, editable Monaco
     3. automated impact report
--------------------------------------------------------------------------- */

function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("gitdash", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "keyword", foreground: "c084fc" },
      { token: "string", foreground: "86efac" },
      { token: "number", foreground: "fbbf24" },
      { token: "type", foreground: "5eead4" },
    ],
    colors: {
      "editor.background": "#0b0f19",
      "editor.foreground": "#e2e8f0",
      "editor.lineHighlightBackground": "#12182666",
      "editorLineNumber.foreground": "#475569",
      "editorLineNumber.activeForeground": "#9ca3af",
      "editorIndentGuide.background1": "#1f293d",
      "editorGutter.background": "#0b0f19",
      "editorWidget.background": "#121826",
      "editorWidget.border": "#1f293d",
      "scrollbarSlider.background": "#2a365066",
      "scrollbarSlider.hoverBackground": "#2a3650aa",
    },
  });
}

const BASE_OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 12,
  lineHeight: 20,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  renderLineHighlight: "line",
  folding: false,
  smoothScrolling: true,
  cursorBlinking: "phase",
  padding: { top: 12, bottom: 12 },
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  contextmenu: false,
  automaticLayout: true,
};

function EditorSkeleton() {
  return (
    <div className="h-full bg-obsidian p-4">
      <SkeletonLines lines={6} />
    </div>
  );
}

function ColumnHeader({
  icon,
  title,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-edge bg-ink px-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: tone }}>
        {icon}
        {title}
      </div>
      <span className="font-mono text-[9px] text-faint">{hint}</span>
    </div>
  );
}

export function SandboxView() {
  const sandboxFileId = useDashboard((s) => s.sandboxFileId);
  const setView = useDashboard((s) => s.setView);
  const modernDrafts = useDashboard((s) => s.modernDrafts);
  const setModernDraft = useDashboard((s) => s.setModernDraft);
  const revealTarget = useDashboard((s) => s.revealTarget);

  const file = fileById(sandboxFileId);
  const code = useMemo(() => (file ? getFileCode(file) : null), [file]);

  const legacyRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [legacyReady, setLegacyReady] = useState(false);

  // Per-line blame lookup for the custom gutter.
  const lineBlame = useMemo(() => {
    if (!code) return [];
    const arr: (typeof code.blame)[number][] = [];
    for (const chunk of code.blame) {
      for (let l = chunk.startLine; l <= chunk.endLine; l++) arr[l] = chunk;
    }
    return arr;
  }, [code]);

  const handleLegacyMount = (
    editor: MonacoEditor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) => {
    legacyRef.current = editor;
    monacoRef.current = monaco;
    if (code && file) {
      editor.createDecorationsCollection(
        code.blame.map((chunk) => {
          const author = authorById(chunk.authorId);
          return {
            range: new monaco.Range(chunk.startLine, 1, chunk.endLine, 1),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: `blame-bar-${author.colorIndex}`,
              hoverMessage: {
                value: `**${author.name}** · \`${chunk.commitHash.slice(0, 7)}\` · ${relativeTime(chunk.date)}`,
              },
            },
          };
        }),
      );
    }
    setLegacyReady(true);
  };

  // Chat line-refs land here: reveal + flash the target line.
  useEffect(() => {
    if (!revealTarget || !legacyReady || !file) return;
    if (revealTarget.fileId !== file.id) return;
    const editor = legacyRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    editor.revealLineInCenter(revealTarget.line, 0);
    editor.setPosition({ lineNumber: revealTarget.line, column: 1 });
    const flash = editor.createDecorationsCollection([
      {
        range: new monaco.Range(revealTarget.line, 1, revealTarget.line, 1),
        options: { isWholeLine: true, className: "jump-line-flash" },
      },
    ]);
    const timer = window.setTimeout(() => flash.clear(), 1700);
    return () => window.clearTimeout(timer);
  }, [revealTarget, legacyReady, file]);

  if (!file || !code) {
    return (
      <div className="flex h-full items-center justify-center bg-obsidian">
        <div className="text-center">
          <p className="text-[13px] text-muted">No file loaded in the sandbox.</p>
          <button
            onClick={() => setView("graph")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-edge bg-ink-2 px-3 py-1.5 text-[11px] font-semibold text-muted hover:text-bright"
          >
            <ArrowLeft size={12} /> Back to the debt graph
          </button>
        </div>
      </div>
    );
  }

  const draft = modernDrafts[file.id] ?? code.modern;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex h-full flex-col bg-obsidian"
    >
      {/* Context header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-edge bg-ink px-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("graph")}
            className="flex items-center gap-1 rounded-md border border-edge bg-ink-2 px-2 py-1 text-[10px] font-semibold text-muted transition-colors hover:text-bright"
          >
            <ArrowLeft size={11} /> Graph
          </button>
          <span className="font-mono text-[12px] text-bright">{file.path}</span>
          <RiskBadge risk={file.risk} />
        </div>
        <div className="font-mono text-[10px] text-faint">
          debt {file.debtScore}/100 · complexity {file.complexity} · churn {file.churn}/90d
        </div>
      </div>

      {/* Three columns */}
      <div className="flex min-h-0 flex-1">
        {/* Legacy */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-edge">
          <ColumnHeader
            icon={<Lock size={11} />}
            title="Legacy source"
            hint="read-only · blame gutter"
            tone="#ff5a5a"
          />
          <div className="min-h-0 flex-1">
            <Editor
              language="javascript"
              value={code.legacy}
              theme="gitdash"
              beforeMount={defineTheme}
              onMount={handleLegacyMount}
              loading={<EditorSkeleton />}
              options={{
                ...BASE_OPTIONS,
                readOnly: true,
                lineNumbersMinChars: 20,
                lineNumbers: (n: number) => {
                  const chunk = lineBlame[n];
                  if (!chunk) return String(n);
                  const author = authorById(chunk.authorId);
                  return `${chunk.commitHash.slice(0, 7)} ${author.handle.padEnd(8, " ")} ${String(n).padStart(3, " ")}`;
                },
              }}
            />
          </div>
        </div>

        {/* Modernized */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-edge">
          <ColumnHeader
            icon={<PencilLine size={11} />}
            title="Modernized"
            hint="editable · AI suggestion"
            tone="#10b981"
          />
          <div className="min-h-0 flex-1">
            <Editor
              language="typescript"
              value={draft}
              theme="gitdash"
              beforeMount={defineTheme}
              loading={<EditorSkeleton />}
              onChange={(value) => setModernDraft(file.id, value ?? "")}
              options={{ ...BASE_OPTIONS, lineNumbersMinChars: 4 }}
            />
          </div>
        </div>

        {/* Impact report */}
        <div className="flex w-[300px] shrink-0 flex-col bg-ink/50 xl:w-[340px]">
          <ColumnHeader
            icon={<History size={11} />}
            title="Automated analysis"
            hint="static + blame heuristics"
            tone="#22d3ee"
          />
          <div className="min-h-0 flex-1">
            <ImpactReport file={file} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
