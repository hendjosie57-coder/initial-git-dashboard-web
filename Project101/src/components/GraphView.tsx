import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { NodeGraph } from "./NodeGraph";
import { FileDrawer } from "./FileDrawer";
import { useDashboard } from "../store";
import { AUTHORS, fileById, graphSubset } from "../data/mockRepo";
import { MUSTARD, SAGE, TERRACOTTA } from "../lib/colors";
import type { RepoFile } from "../types";

/* ---------------------------------------------------------------------------
   Graph workspace: filter toolbar + capped node canvas + status footer.

   Search grammar (tokens AND together):
     payment            substring on path
     .ts  .tsx  .js     extension filter
     src/legacy         directory filter
     author:schen       files touched by that author (handle or name)
--------------------------------------------------------------------------- */

const MAX_NODES = 12;

function useMatchedIds(files: RepoFile[], query: string): Set<string> | null {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const tokens = q.split(/\s+/);
    const matched = new Set<string>();
    for (const file of files) {
      const ok = tokens.every((tok) => {
        if (tok.startsWith("author:")) {
          const who = tok.slice(7);
          return file.authorShare.some((s) => {
            const a = AUTHORS.find((x) => x.id === s.authorId);
            return (
              a &&
              (a.handle.toLowerCase().includes(who) || a.name.toLowerCase().includes(who))
            );
          });
        }
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
          : `top ${shown} of ${total} files · by connectivity & recency`}
      </span>
    </div>
  );
}

export function GraphView() {
  const searchQuery = useDashboard((s) => s.searchQuery);
  const setSearchQuery = useDashboard((s) => s.setSearchQuery);
  const drawerOpen = useDashboard((s) => s.drawerOpen);
  const selectedFileId = useDashboard((s) => s.selectedFileId);

  const subset = useMemo(() => graphSubset(MAX_NODES), []);
  const matchedIds = useMatchedIds(subset.files, searchQuery);
  const selectedFile = fileById(selectedFileId);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-paper">
      {/* Filter toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-edge bg-card px-3">
        <Search size={14} className="shrink-0 text-faint" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter shown files…  e.g.  .ts   src/legacy   author:schen"
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
        <NodeGraph subset={subset} matchedIds={matchedIds} />
        <AnimatePresence>
          {drawerOpen && selectedFile && <FileDrawer file={selectedFile} />}
        </AnimatePresence>
      </div>

      <StatusBar shown={subset.files.length} total={subset.totalFiles} matched={matchedIds} />
    </div>
  );
}
