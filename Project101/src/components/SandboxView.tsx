import { useEffect, useRef, useState } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { ArrowLeft, GitCompareArrows, Lock, PencilLine } from "lucide-react";
import { useDashboard } from "../store";
import { ImpactReport } from "./ImpactReport";
import { ComplexityBadge, SkeletonLines } from "./ui";

/* ---------------------------------------------------------------------------
   Refactor Sandbox — the split-pane workbench, fed by
   GET /api/v1/file/history:
     1. rawLegacyString    → left, read-only Monaco model
     2. modernizedString   → right, editable comparison viewport
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
  const file = useDashboard((s) =>
    s.sandboxFileId ? (s.files.find((f) => f.id === s.sandboxFileId) ?? null) : null,
  );
  const legacySource = useDashboard((s) => s.activeFileSource);
  const modernized = useDashboard((s) => s.activeModernized);
  const historyStatus = useDashboard((s) => s.historyStatus);
  const historyError = useDashboard((s) => s.historyError);

  const legacyRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [legacyReady, setLegacyReady] = useState(false);

  const handleLegacyMount = (
    editor: MonacoEditor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) => {
    legacyRef.current = editor;
    monacoRef.current = monaco;
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

  if (!file) {
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

  const loading = historyStatus === "loading" || historyStatus === "idle";
  const draft = modernDrafts[file.id] ?? modernized ?? "";

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
          {file.totalCommits} commits · {file.loc.toLocaleString()} lines
        </div>
      </div>

      {/* Three columns */}
      <div className="flex min-h-0 flex-1">
        {/* Legacy */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-edge">
          <ColumnHeader
            icon={<Lock size={12} />}
            title="Legacy source"
            hint="read-only · from git working tree"
          />
          <div className="min-h-0 flex-1">
            {loading ? (
              <EditorSkeleton />
            ) : historyStatus === "error" ? (
              <div className="p-4 text-[12px] text-muted">
                Could not load source: {historyError}
              </div>
            ) : (
              <Editor
                language={file.monacoLang}
                value={legacySource ?? ""}
                theme="gitdash-light"
                beforeMount={defineTheme}
                onMount={handleLegacyMount}
                loading={<EditorSkeleton />}
                options={{ ...BASE_OPTIONS, readOnly: true, lineNumbersMinChars: 4 }}
              />
            )}
          </div>
        </div>

        {/* Modernized */}
        <div className="flex min-w-0 flex-1 flex-col border-r border-edge">
          <ColumnHeader
            icon={<PencilLine size={12} />}
            title="Modernized"
            hint="editable · modernizer preview"
          />
          <div className="min-h-0 flex-1">
            {loading ? (
              <EditorSkeleton />
            ) : (
              <Editor
                language={file.monacoLang}
                value={draft}
                theme="gitdash-light"
                beforeMount={defineTheme}
                loading={<EditorSkeleton />}
                onChange={(value) => setModernDraft(file.id, value ?? "")}
                options={{ ...BASE_OPTIONS, lineNumbersMinChars: 4 }}
              />
            )}
          </div>
        </div>

        {/* Impact analysis */}
        <div className="flex w-[288px] shrink-0 flex-col bg-paper xl:w-[320px]">
          <ColumnHeader
            icon={<GitCompareArrows size={12} />}
            title="Analysis"
            hint="static + git heuristics"
          />
          <div className="min-h-0 flex-1">
            <ImpactReport file={file} />
          </div>
        </div>
      </div>
    </div>
  );
}
