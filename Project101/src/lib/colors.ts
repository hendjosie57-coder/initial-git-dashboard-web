import type { RepoFile, Risk } from "../types";

/** Heatmap rule: color encodes commit churn, escalated by complexity.
    Palette follows git diff semantics — green/amber/red, matte, no glow. */

export const RISK_COLORS: Record<Risk, string> = {
  low: "#3fb950", // git addition green
  medium: "#d29922", // warning amber
  high: "#f85149", // git deletion red
};

export const RISK_LABELS: Record<Risk, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

/** Neutral gray for very quiet, simple files so the map doesn't read all-green. */
const SLATE = "#5a5a5a";

export function riskOf(complexityNorm: number, churnNorm: number): Risk {
  const heat = complexityNorm * 0.5 + churnNorm * 0.5;
  if (complexityNorm > 0.62 && churnNorm > 0.55) return "high";
  if (heat > 0.72) return "high";
  if (heat > 0.38) return "medium";
  return "low";
}

export function nodeColor(file: RepoFile): string {
  if (file.risk === "high") return RISK_COLORS.high;
  if (file.risk === "medium") return RISK_COLORS.medium;
  return file.churn <= 2 ? SLATE : RISK_COLORS.low;
}

/** Node radius from complexity (area-ish scaling so big files don't explode). */
export function nodeRadius(file: RepoFile): number {
  return 3 + Math.sqrt(file.complexity) * 0.9;
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function debtScoreColor(score: number): string {
  if (score >= 70) return RISK_COLORS.high;
  if (score >= 40) return RISK_COLORS.medium;
  return RISK_COLORS.low;
}
