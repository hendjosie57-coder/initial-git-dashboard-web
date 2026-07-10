import { GitBranch, Network, SquareTerminal, SplitSquareHorizontal, Terminal } from "lucide-react";
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
    <header className="z-30 flex h-11 shrink-0 items-center justify-between border-b border-edge bg-ink px-3">
      {/* Brand + repo context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center border border-edge bg-ink-2">
            <Terminal size={13} className="text-muted" />
          </div>
          <div className="flex items-baseline gap-2 leading-none">
            <span className="font-mono text-[12px] font-semibold text-bright">git-dashboard</span>
            <span className="font-mono text-[10px] text-faint">{REPO.name}</span>
          </div>
        </div>

        <div className="hidden h-5 w-px bg-edge md:block" />

        <div className="hidden items-center gap-1.5 border border-edge bg-ink-2 px-2 py-0.5 md:flex">
          <GitBranch size={11} className="text-muted" />
          <span className="font-mono text-[11px] text-muted">{REPO.branch}</span>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <span className="font-mono text-[11px] text-faint">
            {REPO.files.length} files
          </span>
          <span className="inline-flex items-center gap-1.5 border border-edge bg-ink-2 px-2 py-0.5 font-mono text-[10px] font-semibold text-warn">
            <span className="h-1.5 w-1.5 bg-warn" />
            {HOTSPOTS} debt hotspots
          </span>
        </div>
      </div>

      {/* View switcher — flat segmented control */}
      <div className="flex items-stretch border border-edge">
        {(
          [
            { id: "graph", label: "Debt Graph", icon: Network },
            { id: "sandbox", label: "Refactor Sandbox", icon: SplitSquareHorizontal },
          ] as const
        ).map(({ id, label, icon: Icon }, i) => {
          const active = view === id;
          const disabled = id === "sandbox" && !sandboxFileId;
          return (
            <button
              key={id}
              disabled={disabled}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3 py-1 font-mono text-[11px] font-semibold transition-colors duration-150 ${
                i > 0 ? "border-l border-edge" : ""
              } ${
                active
                  ? "bg-ink-2 text-bright"
                  : disabled
                    ? "cursor-not-allowed bg-ink text-faint/50"
                    : "bg-ink text-muted hover:bg-ink-2 hover:text-bright"
              }`}
              title={disabled ? "Select a file in the graph first" : label}
            >
              <Icon size={12} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <AvatarStack authors={REPO.authors.slice(0, 5)} />
        <button
          onClick={toggleChat}
          className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] font-semibold transition-colors duration-150 ${
            chatOpen
              ? "border-edge-2 bg-ink-2 text-bright"
              : "border-edge bg-ink text-muted hover:bg-ink-2 hover:text-bright"
          }`}
          title="Toggle terminal assistant"
        >
          <SquareTerminal size={13} />
          Assistant
        </button>
      </div>
    </header>
  );
}
