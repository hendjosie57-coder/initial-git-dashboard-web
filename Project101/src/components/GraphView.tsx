import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { NodeGraph } from "./NodeGraph";
import { FileDrawer } from "./FileDrawer";
import { useDashboard } from "../store";
import { AUTHORS, REPO, fileById } from "../data/mockRepo";
import { RISK_COLORS } from "../lib/colors";

/* ---------------------------------------------------------------------------
   Graph workspace: filter toolbar + canvas + status-bar legend + inspector.

   Search grammar (tokens AND together):
     payment            substring on path
     .ts  .tsx  .js     extension filter
     src/legacy         directory filter
     author:schen       files touched by that author (handle or name)
--------------------------------------------------------------------------- */

function useMatchedIds(query: string): Set<string> | null {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const tokens = q.split(/\s+/);
    const matched = new Set<string>();
    for (const file of REPO.files) {
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
  }, [query]);
}

function StatusBar({ matched }: { matched: Set<string> | null }) {
  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-edge bg-ink px-3">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
          heatmap · commit churn
        </span>
        {(
          [
            ["low", RISK_COLORS.low],
            ["med", RISK_COLORS.medium],
            ["high", RISK_COLORS.high],
          ] as const
        ).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2" style={{ background: color }} />
            <span className="font-mono text-[10px] text-muted">{label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="flex items-end gap-0.5">
            <span className="h-1 w-1 bg-faint" />
            <span className="h-2 w-2 bg-faint" />
            <span className="h-3 w-3 bg-faint" />
          </span>
          <span className="font-mono text-[10px] text-muted">size = complexity</span>
        </span>
      </div>
      <span className="font-mono text-[10px] text-faint">
        {matched ? `${matched.size}/${REPO.files.length} match` : `${REPO.files.length} files`}
      </span>
    </div>
  );
}

export function GraphView() {
  const searchQuery = useDashboard((s) => s.searchQuery);
  const setSearchQuery = useDashboard((s) => s.setSearchQuery);
  const drawerOpen = useDashboard((s) => s.drawerOpen);
  const selectedFileId = useDashboard((s) => s.selectedFileId);
  const matchedIds = useMatchedIds(searchQuery);
  const selectedFile = fileById(selectedFileId);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-obsidian">
      {/* Filter toolbar */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-edge bg-ink px-3">
        <Search size={13} className="shrink-0 text-faint" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="filter nodes…  e.g.  .ts   src/legacy   author:schen"
          className="w-full max-w-[480px] bg-transparent font-mono text-[12px] text-bright placeholder:text-faint/70 focus:outline-none"
          spellCheck={false}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="shrink-0 p-0.5 text-faint transition-colors duration-150 hover:text-bright"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Canvas + inspector */}
      <div className="relative min-h-0 flex-1">
        <NodeGraph matchedIds={matchedIds} />
        <AnimatePresence>
          {drawerOpen && selectedFile && <FileDrawer file={selectedFile} />}
        </AnimatePresence>
      </div>

      <StatusBar matched={matchedIds} />
    </div>
  );
}
