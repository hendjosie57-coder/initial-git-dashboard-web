import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "./components/TopBar";
import { GraphView } from "./components/GraphView";
import { SandboxView } from "./components/SandboxView";
import { ChatPane } from "./components/ChatPane";
import { useDashboard } from "./store";

export default function App() {
  const view = useDashboard((s) => s.view);
  const chatOpen = useDashboard((s) => s.chatOpen);

  return (
    <div className="flex h-full flex-col bg-obsidian text-bright">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {/* Main workspace */}
        <main className="relative min-w-0 flex-1">
          {view === "graph" ? <GraphView /> : <SandboxView />}
        </main>

        {/* Terminal assistant pane */}
        <AnimatePresence initial={false}>
          {chatOpen && (
            <motion.aside
              key="chat"
              initial={{ width: 0 }}
              animate={{ width: 400 }}
              exit={{ width: 0 }}
              transition={{ duration: 0.15, ease: "linear" }}
              className="shrink-0 overflow-hidden border-l border-edge"
            >
              <div className="h-full w-[400px]">
                <ChatPane />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
