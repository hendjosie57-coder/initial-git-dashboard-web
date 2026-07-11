import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { NodeGraph } from "./NodeGraph";
import { FileDrawer } from "./FileDrawer";
import { selectActiveFile, useDashboard } from "../store";
import { MUSTARD, SAGE, TERRACOTTA } from "../lib/colors";
import type { DepEdge, LiveFile } from "../types";

/* ---------------------------------------------------------------------------
   Graph workspace: filter toolbar + capped node canvas + status footer.

   The canvas renders the 10–12 highest-frequency git change nodes served by
   GET /api/v1/repository/topology, plus only the dependency links that
   connect them.

   Search grammar (tokens AND together):
     payment            substring on path
     .ts  .tsx  .py     extension filter
     src/legacy         directory filter
--------------------------------------------------------------------------- */

const MAX_NODES = 12;

interface GraphSubset {
  files: LiveFile[];
  edges: DepEdge[];
  totalFiles: number;
}

/** Top files by total git commit frequency, with the edges between them. */
function buildSubset(files: LiveFile[], edges: DepEdge[]): GraphSubset {
  const top = [...files]
    .sort((a, b) => b.totalCommits - a.totalCommits || b.complexity - a.complexity)
    .slice(0, MAX_NODES);
  const kept = new Set(top.map((f) => f.id));
  return {
    files: top,
    edges: edges.filter((e) => kept.has(e.source) && kept.has(e.target)),
    totalFiles: files.length,
  };
}

function useMatchedIds(files: LiveFile[], query: string): Set<string> | null {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const tokens = q.split(/\s+/);
    const matched = new Set<string>();
    for (const file of files) {
      const ok = tokens.every((tok) => {
        if (tok.startsWith(".")) return file.ext === tok;
        return file.path.toLowerCase().includes(tok);
      });
      if (ok) matched.add(file.id);
    }
    return matched;
  }, [files, query]);
}

function StatusBar({
  shown,
  total,
  matched,
}: {
  shown: number;
  total: number;
  matched: Set<string> | null;
}) {
  return (
    <div className="flex h-7 shrink-0 items-center justify-between border-t border-edge bg-card px-3">
      <div className="flex items-center gap-4">
        <span className="text-[11px] font-medium text-faint">Cyclomatic complexity</span>
        {(
          [
            ["Low", SAGE],
            ["Medium", MUSTARD],
            ["High", TERRACOTTA],
          ] as const
        ).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="text-[11px] text-muted">{label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="flex items-end gap-0.5">
            <span className="h-1 w-1 rounded-full bg-faint" />
            <span className="h-2 w-2 rounded-full bg-faint" />
            <span className="h-3 w-3 rounded-full bg-faint" />
          </span>
          <span className="text-[11px] text-muted">size = complexity</span>
        </span>
      </div>
      <span className="text-[11px] text-faint">
        {matched
          ? `${matched.size} of ${shown} shown files match`
          : `top ${shown} of ${total} files · by commit frequency`}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Loader2 size={15} className="animate-spin" />
        Analyzing repository topology…
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-md text-center">
        <p className="text-[13px] font-medium text-ink">Analysis engine unavailable</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{message}</p>
        <p className="mt-1 text-[11px] text-faint">
          Start it with <code className="font-mono">python main.py</code> in{" "}
          <code className="font-mono">backend/</code>, then retry.
        </p>
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-edge bg-card px-3 py-1.5 text-[12px] font-medium text-muted transition-colors duration-200 hover:bg-panel hover:text-ink"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    </div>
  );
}

export function GraphView() {
  const searchQuery = useDashboard((s) => s.searchQuery);
  const setSearchQuery = useDashboard((s) => s.setSearchQuery);
  const drawerOpen = useDashboard((s) => s.drawerOpen);
  const files = useDashboard((s) => s.files);
  const edges = useDashboard((s) => s.edges);
  const repoStatus = useDashboard((s) => s.repoStatus);
  const repoError = useDashboard((s) => s.repoError);
  const loadRepository = useDashboard((s) => s.loadRepository);
  const selectedFile = useDashboard(selectActiveFile);

  const subset = useMemo(() => buildSubset(files, edges), [files, edges]);
  const matchedIds = useMatchedIds(subset.files, searchQuery);

  if (repoStatus === "loading" || repoStatus === "idle") {
    return (
      <div className="h-full bg-paper">
        <LoadingState />
      </div>
    );
  }
  if (repoStatus === "error") {
    return (
      <div className="h-full bg-paper">
        <ErrorState message={repoError ?? "Unknown error"} onRetry={loadRepository} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-paper">
      {/* Filter toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-edge bg-card px-3">
        <Search size={14} className="shrink-0 text-faint" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter shown files…  e.g.  .ts   src/components   backend"
          className="w-full max-w-[460px] bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
          spellCheck={false}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="shrink-0 rounded p-0.5 text-faint transition-colors duration-200 hover:text-ink"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Canvas + inspector */}
      <div className="relative min-h-0 flex-1">
        <NodeGraph files={subset.files} edges={subset.edges} matchedIds={matchedIds} />
        <AnimatePresence>
          {drawerOpen && selectedFile && <FileDrawer file={selectedFile} />}
        </AnimatePresence>
      </div>

      <StatusBar shown={subset.files.length} total={subset.totalFiles} matched={matchedIds} />
    </div>
  );
}
