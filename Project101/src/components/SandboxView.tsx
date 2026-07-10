import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { ArrowLeft, GitCompareArrows, Lock, PencilLine } from "lucide-react";
import { useDashboard } from "../store";
import { authorById, fileById, relativeTime } from "../data/mockRepo";
import { getFileCode } from "../data/codegen";
import { ImpactReport } from "./ImpactReport";
import { ComplexityBadge, SkeletonLines } from "./ui";

/* ---------------------------------------------------------------------------
   Refactor Sandbox — legacy code and its modernized transformation side by
   side, plus a slim automated analysis column:
     1. legacy source, read-only Monaco with a git-blame gutter
     2. modernized source, editable Monaco
     3. impact analysis (complexity delta + regression risk)
--------------------------------------------------------------------------- */

function defineTheme(monaco: Monaco) {
  monaco.editor.defineTheme("gitdash-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8f8f89", fontStyle: "italic" },
      { token: "keyword", foreground: "7a5c8f" },
      { token: "string", foreground: "5e7f4d" },
      { token: "number", foreground: "a06a2c" },
      { token: "type", foreground: "4e7f78" },
    ],
    colors: {
      "editor.background": "#fcfcfb",
      "editor.foreground": "#2a2a2a",
      "editor.lineHighlightBackground": "#f0f0ec88",
      "editorLineNumber.foreground": "#a3a39d",
      "editorLineNumber.activeForeground": "#6e6e68",
      "editorIndentGuide.background1": "#e6e6e1",
      "editorGutter.background": "#fcfcfb",
      "editorWidget.background": "#f7f7f5",
      "editorWidget.border": "#d1d1cd",
      "scrollbarSlider.background": "#c9c9c466",
      "scrollbarSlider.hoverBackground": "#c9c9c4aa",
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
  padding: { top: 10, bottom: 10 },
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  contextmenu: false,
  automaticLayout: true,
};

function EditorSkeleton() {
  return (
    <div className="h-full bg-card p-4">
      <SkeletonLines lines={6} />
    </div>
  );
}

function ColumnHeader({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-edge bg-paper px-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
        {icon}
        {title}
      </div>
      <span className="text-[10px] text-faint">{hint}</span>
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
    const timer = window.setTimeout(() => flash.clear(), 1300);
    return () => window.clearTimeout(timer);
  }, [revealTarget, legacyReady, file]);

  if (!file || !code) {
    return (
      <div className="flex h-full items-center justify-center bg-paper">
        <div className="text-center">
          <p className="text-[13px] text-muted">No file loaded in the sandbox.</p>
          <button
            onClick={() => setView("graph")}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-edge bg-card px-3 py-1.5 text-[12px] font-medium text-muted transition-colors duration-200 hover:bg-panel hover:text-ink"
          >
            <ArrowLeft size={12} /> Back to the graph
          </button>
        </div>
      </div>
    );
  }

  const draft = modernDrafts[file.id] ?? code.modern;

  return (
    <div className="flex h-full flex-col bg-paper">
      {/* Context header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-edge bg-card px-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("graph")}
            className="flex items-center gap-1 rounded-md border border-edge bg-card px-2 py-1 text-[11px] font-medium text-muted transition-colors duration-200 hover:bg-panel hover:text-ink"
          >
            <ArrowLeft size={11} /> Graph
          </button>
          <span className="text-[13px] font-medium text-ink">{file.path}</span>
          <ComplexityBadge value={file.complexity} />
        </div>
        <div className="text-[11px] text-faint">
          {file.churn} commits / 90d · {file.loc.toLocaleString()} lines
        </div>
      </div>

      {/* Three columns */}
      <div className="flex min-h-0 flex-1">
        {/* Legacy */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-edge">
          <ColumnHeader
            icon={<Lock size={12} />}
            title="Legacy source"
            hint="read-only · blame gutter"
          />
          <div className="min-h-0 flex-1">
            <Editor
              language="javascript"
              value={code.legacy}
              theme="gitdash-light"
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
            icon={<PencilLine size={12} />}
            title="Modernized"
            hint="editable · suggested rewrite"
          />
          <div className="min-h-0 flex-1">
            <Editor
              language="typescript"
              value={draft}
              theme="gitdash-light"
              beforeMount={defineTheme}
              loading={<EditorSkeleton />}
              onChange={(value) => setModernDraft(file.id, value ?? "")}
              options={{ ...BASE_OPTIONS, lineNumbersMinChars: 4 }}
            />
          </div>
        </div>

        {/* Impact analysis */}
        <div className="flex w-[288px] shrink-0 flex-col bg-paper xl:w-[320px]">
          <ColumnHeader
            icon={<GitCompareArrows size={12} />}
            title="Analysis"
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
