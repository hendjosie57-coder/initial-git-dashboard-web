import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "./components/TopBar";
import { GraphView } from "./components/GraphView";
import { SandboxView } from "./components/SandboxView";
import { ChatPane } from "./components/ChatPane";
import { useDashboard } from "./store";

export default function App() {
  const view = useDashboard((s) => s.view);
  const chatOpen = useDashboard((s) => s.chatOpen);
  const loadRepository = useDashboard((s) => s.loadRepository);

  // Hydrate the canvas pipeline from the analysis engine on boot.
  useEffect(() => {
    void loadRepository();
  }, [loadRepository]);

  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {/* Main workspace */}
        <main className="relative min-w-0 flex-1">
          {view === "graph" ? <GraphView /> : <SandboxView />}
        </main>

        {/* Blame assistant pane */}
        <AnimatePresence initial={false}>
          {chatOpen && (
            <motion.aside
              key="chat"
              initial={{ width: 0 }}
              animate={{ width: 384 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="shrink-0 overflow-hidden border-l border-edge"
            >
              <div className="h-full w-[384px]">
                <ChatPane />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
