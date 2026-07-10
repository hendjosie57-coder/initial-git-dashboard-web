import { GitBranch, Hexagon, MessageSquareCode, Network, SplitSquareHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { useDashboard } from "../store";
import { REPO } from "../data/mockRepo";
import { AvatarStack } from "./ui";

const HOTSPOTS = REPO.files.filter((f) => f.risk === "high").length;

export function TopBar() {
  const view = useDashboard((s) => s.view);
  const setView = useDashboard((s) => s.setView);
  const chatOpen = useDashboard((s) => s.chatOpen);
  const toggleChat = useDashboard((s) => s.toggleChat);
  const sandboxFileId = useDashboard((s) => s.sandboxFileId);

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-edge bg-ink px-4">
      {/* Brand + repo context */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2 glow-accent">
            <Hexagon size={17} strokeWidth={2.4} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-tight text-bright">
              Git Dashboard
            </div>
            <div className="font-mono text-[10px] text-faint">{REPO.name}</div>
          </div>
        </div>

        <div className="hidden h-6 w-px bg-edge md:block" />

        <div className="hidden items-center gap-1.5 rounded-md border border-edge bg-ink-2 px-2.5 py-1 md:flex">
          <GitBranch size={12} className="text-accent-2" />
          <span className="font-mono text-[11px] text-muted">{REPO.branch}</span>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <span className="font-mono text-[11px] text-faint">
            {REPO.files.length} files
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-risk-high/30 bg-risk-high/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-risk-glow">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-risk-glow" />
            {HOTSPOTS} debt hotspots
          </span>
        </div>
      </div>

      {/* View switcher */}
      <div className="relative flex items-center rounded-lg border border-edge bg-ink-2 p-0.5">
        {(
          [
            { id: "graph", label: "Debt Graph", icon: Network },
            { id: "sandbox", label: "Refactor Sandbox", icon: SplitSquareHorizontal },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = view === id;
          const disabled = id === "sandbox" && !sandboxFileId;
          return (
            <button
              key={id}
              disabled={disabled}
              onClick={() => setView(id)}
              className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                active ? "text-bright" : disabled ? "cursor-not-allowed text-faint/50" : "text-muted hover:text-bright"
              }`}
              title={disabled ? "Select a file in the graph first" : label}
            >
              {active && (
                <motion.span
                  layoutId="view-pill"
                  className="absolute inset-0 rounded-md bg-edge"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
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
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
            chatOpen
              ? "border-accent/40 bg-accent/10 text-accent-2"
              : "border-edge bg-ink-2 text-muted hover:text-bright"
          }`}
          title="Toggle Blame AI pane"
        >
          <MessageSquareCode size={14} />
          Blame AI
        </button>
      </div>
    </header>
  );
}
