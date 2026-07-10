import { GitBranch, MessageSquareText, Network, SplitSquareHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { useDashboard } from "../store";
import { REPO } from "../data/mockRepo";
import { TERRACOTTA } from "../lib/colors";
import { AvatarStack } from "./ui";

const HIGH_COMPLEXITY = REPO.files.filter((f) => f.complexity >= 55).length;

export function TopBar() {
  const view = useDashboard((s) => s.view);
  const setView = useDashboard((s) => s.setView);
  const chatOpen = useDashboard((s) => s.chatOpen);
  const toggleChat = useDashboard((s) => s.toggleChat);
  const sandboxFileId = useDashboard((s) => s.sandboxFileId);

  return (
    <header className="z-30 flex h-12 shrink-0 items-center justify-between border-b border-edge bg-card px-4">
      {/* Brand + repo context */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2 leading-none">
          <span className="text-[13px] font-semibold tracking-tight text-ink">
            Git Dashboard
          </span>
          <span className="text-[11px] text-faint">{REPO.name}</span>
        </div>

        <div className="hidden h-4 w-px bg-edge md:block" />

        <div className="hidden items-center gap-1.5 rounded-md border border-edge bg-paper px-2 py-0.5 md:flex">
          <GitBranch size={11} className="text-muted" />
          <span className="text-[11px] text-muted">{REPO.branch}</span>
        </div>

        <span className="hidden items-center gap-1.5 text-[11px] text-muted lg:flex">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: TERRACOTTA }} />
          {HIGH_COMPLEXITY} high-complexity files
        </span>
      </div>

      {/* View switcher — quiet segmented control */}
      <div className="flex items-center rounded-lg border border-edge bg-panel p-0.5">
        {(
          [
            { id: "graph", label: "Module graph", icon: Network },
            { id: "sandbox", label: "Refactor sandbox", icon: SplitSquareHorizontal },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = view === id;
          const disabled = id === "sandbox" && !sandboxFileId;
          return (
            <button
              key={id}
              disabled={disabled}
              onClick={() => setView(id)}
              className={`relative flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-medium transition-colors duration-200 ${
                active
                  ? "text-ink"
                  : disabled
                    ? "cursor-not-allowed text-faint/60"
                    : "text-muted hover:text-ink"
              }`}
              title={disabled ? "Select a file in the graph first" : label}
            >
              {active && (
                <motion.span
                  layoutId="view-pill"
                  className="shadow-card absolute inset-0 rounded-md bg-card"
                  transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                />
              )}
              <Icon size={13} className="relative" />
              <span className="relative hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <AvatarStack authors={REPO.authors.slice(0, 5)} />
        <button
          onClick={toggleChat}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-200 ${
            chatOpen
              ? "border-edge-2 bg-panel text-ink"
              : "border-edge bg-card text-muted hover:bg-panel hover:text-ink"
          }`}
          title="Toggle blame assistant"
        >
          <MessageSquareText size={13} />
          Assistant
        </button>
      </div>
    </header>
  );
}
