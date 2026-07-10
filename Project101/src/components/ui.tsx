import type { ReactNode } from "react";
import type { Author } from "../types";
import { complexityBand, complexityColor, hexToRgba, RISK_LABELS } from "../lib/colors";

/* Shared presentational primitives. Flat, minimal, sans-serif. */

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
      {children}
    </div>
  );
}

/** Complexity chip: muted dot + band label, colored by the sage→terracotta ramp. */
export function ComplexityBadge({ value }: { value: number }) {
  const color = complexityColor(value);
  const band = complexityBand(value);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{
        color,
        borderColor: hexToRgba(color, 0.35),
        background: hexToRgba(color, 0.08),
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {RISK_LABELS[band]} complexity · {value}
    </span>
  );
}

export function Avatar({ author, size = 24 }: { author: Author; size?: number }) {
  return (
    <div
      title={author.name}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: author.color,
        color: "#fcfcfb",
        fontSize: size * 0.36,
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
          className="rounded-full ring-2 ring-paper"
          style={{ marginLeft: i === 0 ? 0 : -size * 0.3 }}
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

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-faint">{label}</span>
      <span className="text-[12px] font-semibold text-ink">{value}</span>
    </div>
  );
}

/** Minimalist inline sparkline — a thin polyline with a terminal dot. */
export function Sparkline({
  values,
  width = 84,
  height = 18,
  stroke = "#9c9c96",
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (values.length < 2) {
    return <div className="h-[18px] w-[84px] border-b border-edge" />;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="1.8" fill={stroke} />
    </svg>
  );
}
