import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { NodeGraph } from "./NodeGraph";
import { FileDrawer } from "./FileDrawer";
import { useDashboard } from "../store";
import { AUTHORS, REPO, fileById } from "../data/mockRepo";
import { RISK_COLORS } from "../lib/colors";

/* ---------------------------------------------------------------------------
   Graph workspace: canvas + floating search, legend, and the file drawer.

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

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-xl border border-edge bg-ink/85 p-3.5 backdrop-blur-md">
      <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-faint">
        Heatmap · commit churn
      </div>
      <div className="mt-2 flex items-center gap-3.5">
        {(
          [
            ["Low", RISK_COLORS.low],
            ["Medium", RISK_COLORS.medium],
            ["High", RISK_COLORS.high],
          ] as const
        ).map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: color,
                boxShadow: label === "High" ? `0 0 8px ${color}` : "none",
              }}
            />
            <span className="text-[10px] text-muted">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="flex items-end gap-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-faint" />
          <span className="h-2.5 w-2.5 rounded-full bg-faint" />
          <span className="h-3.5 w-3.5 rounded-full bg-faint" />
        </span>
        <span className="text-[10px] text-muted">size = cyclomatic complexity</span>
      </div>
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
    <div className="relative h-full w-full overflow-hidden bg-obsidian">
      <NodeGraph matchedIds={matchedIds} />

      {/* Floating search */}
      <div className="absolute left-1/2 top-4 z-10 w-[420px] max-w-[calc(100%-2rem)] -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-xl border border-edge bg-ink/90 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur-md transition-colors focus-within:border-accent/50">
          <Search size={14} className="shrink-0 text-faint" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter nodes…  e.g.  .ts   src/legacy   author:schen"
            className="w-full bg-transparent font-mono text-[12px] text-bright placeholder:text-faint/70 focus:outline-none"
            spellCheck={false}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                onClick={() => setSearchQuery("")}
                className="shrink-0 rounded p-0.5 text-faint hover:text-bright"
              >
                <X size={13} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {matchedIds && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-1.5 text-center font-mono text-[10px] text-muted"
            >
              <span className="text-accent-2">{matchedIds.size}</span> of {REPO.files.length}{" "}
              files match
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Legend />

      {/* Slide-out file inspector */}
      <AnimatePresence>
        {drawerOpen && selectedFile && <FileDrawer file={selectedFile} />}
      </AnimatePresence>
    </div>
  );
}
