import type { Risk } from "../types";

/* Node color rule: cyclomatic complexity mapped onto a visible, non-neon
   traffic-light ramp — green (low) → amber (mid) → red (high). */

export const SAGE = "#2f9e44";
export const MUSTARD = "#dda01f";
export const TERRACOTTA = "#d23f34";

export const RISK_COLORS: Record<Risk, string> = {
  low: SAGE,
  medium: MUSTARD,
  high: TERRACOTTA,
};

export const RISK_LABELS: Record<Risk, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Highest complexity produced by the mock data engine; used to normalize. */
export const COMPLEXITY_MAX = 95;

function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const mix = (sa: number, sb: number) => Math.round(sa + (sb - sa) * t);
  const r = mix((pa >> 16) & 255, (pb >> 16) & 255);
  const g = mix((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = mix(pa & 255, pb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

/** Continuous complexity ramp: green → amber → red. */
export function complexityColor(complexity: number): string {
  const t = Math.min(1, Math.max(0, complexity / COMPLEXITY_MAX));
  return t <= 0.5 ? lerpHex(SAGE, MUSTARD, t * 2) : lerpHex(MUSTARD, TERRACOTTA, (t - 0.5) * 2);
}

export function complexityBand(complexity: number): Risk {
  if (complexity >= 55) return "high";
  if (complexity >= 28) return "medium";
  return "low";
}

/** Used by the mock data engine to derive a file's overall risk level. */
export function riskOf(complexityNorm: number, churnNorm: number): Risk {
  const heat = complexityNorm * 0.5 + churnNorm * 0.5;
  if (complexityNorm > 0.62 && churnNorm > 0.55) return "high";
  if (heat > 0.72) return "high";
  if (heat > 0.38) return "medium";
  return "low";
}

/** Node radius from complexity (area-ish scaling so big files don't explode). */
export function nodeRadius(file: { complexity: number }): number {
  return 4 + Math.sqrt(file.complexity) * 1.1;
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
