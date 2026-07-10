import type { ReactNode } from "react";
import type { Author, Risk } from "../types";
import { RISK_COLORS, RISK_LABELS, hexToRgba } from "../lib/colors";

/* Small shared presentational primitives. */

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
      {children}
    </div>
  );
}

export function RiskBadge({ risk }: { risk: Risk }) {
  const color = RISK_COLORS[risk];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{
        color,
        borderColor: hexToRgba(color, 0.35),
        background: hexToRgba(color, 0.08),
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color, boxShadow: risk === "high" ? `0 0 8px ${color}` : "none" }}
      />
      {RISK_LABELS[risk]}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-edge bg-ink-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}

export function Avatar({ author, size = 24 }: { author: Author; size?: number }) {
  return (
    <div
      title={author.name}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-obsidian"
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
          className="rounded-full ring-2 ring-obsidian"
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
    <div className="panel rounded-lg px-3 py-2">
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold" style={{ color: accent ?? "#f9fafb" }}>
        {value}
      </div>
    </div>
  );
}
