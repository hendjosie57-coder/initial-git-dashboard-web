import type { ReactNode } from "react";
import type { Author, Risk } from "../types";
import { RISK_COLORS, RISK_LABELS } from "../lib/colors";

/* Small shared presentational primitives. Flat, square, 1px borders. */

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
      {children}
    </div>
  );
}

export function RiskBadge({ risk }: { risk: Risk }) {
  const color = RISK_COLORS[risk];
  return (
    <span className="inline-flex items-center gap-1.5 border border-edge bg-ink-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider">
      <span className="h-2 w-2" style={{ background: color }} />
      <span style={{ color }}>{RISK_LABELS[risk]}</span>
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="border border-edge bg-ink-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}

export function Avatar({ author, size = 24 }: { author: Author; size?: number }) {
  return (
    <div
      title={author.name}
      className="flex shrink-0 items-center justify-center font-mono font-semibold text-obsidian"
      style={{
        width: size,
        height: size,
        background: author.color,
        fontSize: size * 0.38,
      }}
    >
      {author.initials}
    </div>
  );
}

export function AvatarStack({ authors, size = 22 }: { authors: Author[]; size?: number }) {
  return (
    <div className="flex items-center">
      {authors.map((a, i) => (
        <div
          key={a.id}
          className="ring-2 ring-obsidian"
          style={{ marginLeft: i === 0 ? 0 : -size * 0.32 }}
        >
          <Avatar author={a} size={size} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  const widths = ["92%", "76%", "84%", "58%", "88%", "69%"];
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3" style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}

export function MonoStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
}) {
  return (
    <div className="border border-edge bg-ink px-2 py-1.5">
      <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold" style={{ color: accent ?? "#d4d4d4" }}>
        {value}
      </div>
    </div>
  );
}
