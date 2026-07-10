import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
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
      { token: "comment", foreground: "6a9955", fontStyle: "italic" },
      { token: "keyword", foreground: "c586c0" },
      { token: "string", foreground: "ce9178" },
      { token: "number", foreground: "b5cea8" },
      { token: "type", foreground: "4ec9b0" },
    ],
    colors: {
      "editor.background": "#181818",
      "editor.foreground": "#d4d4d4",
      "editor.lineHighlightBackground": "#1e1e1e66",
      "editorLineNumber.foreground": "#6e6e6e",
      "editorLineNumber.activeForeground": "#9d9d9d",
      "editorIndentGuide.background1": "#333333",
      "editorGutter.background": "#181818",
      "editorWidget.background": "#1e1e1e",
      "editorWidget.border": "#333333",
      "scrollbarSlider.background": "#45454566",
      "scrollbarSlider.hoverBackground": "#454545aa",
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
  smoothScrolling: false,
  cursorBlinking: "blink",
  padding: { top: 8, bottom: 8 },
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
  tone?: string;
}) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-b border-edge bg-ink px-3">
      <div
        className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: tone ?? "#9d9d9d" }}
      >
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
    const timer = window.setTimeout(() => flash.clear(), 900);
    return () => window.clearTimeout(timer);
  }, [revealTarget, legacyReady, file]);

  if (!file || !code) {
    return (
      <div className="flex h-full items-center justify-center bg-obsidian">
        <div className="text-center">
          <p className="font-mono text-[12px] text-muted">no file loaded in the sandbox</p>
          <button
            onClick={() => setView("graph")}
            className="mt-3 inline-flex items-center gap-1.5 border border-edge bg-ink-2 px-3 py-1.5 font-mono text-[11px] font-semibold text-muted transition-colors duration-150 hover:text-bright"
          >
            <ArrowLeft size={12} /> Back to the debt graph
          </button>
        </div>
      </div>
    );
  }

  const draft = modernDrafts[file.id] ?? code.modern;

  return (
    <div className="flex h-full flex-col bg-obsidian">
      {/* Context header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-edge bg-ink px-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("graph")}
            className="flex items-center gap-1 border border-edge bg-ink-2 px-2 py-0.5 font-mono text-[10px] font-semibold text-muted transition-colors duration-150 hover:text-bright"
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
            tone="#f85149"
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
            hint="editable · suggested rewrite"
            tone="#3fb950"
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
        <div className="flex w-[300px] shrink-0 flex-col bg-ink xl:w-[340px]">
          <ColumnHeader
            icon={<History size={11} />}
            title="Automated analysis"
            hint="static + blame heuristics"
          />
          <div className="min-h-0 flex-1">
            <ImpactReport file={file} />
          </div>
        </div>
      </div>
    </div>
  );
}
