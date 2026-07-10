/** Core domain types for Git Dashboard. */

export type Risk = "low" | "medium" | "high";

export interface Author {
  id: string;
  name: string;
  handle: string;
  initials: string;
  /** Index into the blame color palette (blame-bar-N css classes). */
  colorIndex: number;
  color: string;
}

export interface Commit {
  hash: string;
  message: string;
  authorId: string;
  date: string; // ISO
  additions: number;
  deletions: number;
  /** Number of bug reports later traced back to this commit. */
  bugsIntroduced: number;
}

export interface PullRequest {
  number: number;
  title: string;
  description: string;
  authorId: string;
  mergedAt: string; // ISO
}

export interface BlameChunk {
  startLine: number;
  endLine: number;
  commitHash: string;
  authorId: string;
  date: string;
}

export interface AuthorShare {
  authorId: string;
  pct: number; // 0..100
}

export interface RepoFile {
  id: string; // full path, unique
  path: string;
  name: string;
  dir: string;
  ext: string;
  lang: "typescript" | "javascript";
  loc: number;
  /** Cyclomatic complexity estimate. */
  complexity: number;
  /** Commits in the last 90 days. */
  churn: number;
  totalCommits: number;
  createdAt: string;
  lastModified: string;
  authorShare: AuthorShare[];
  commits: Commit[];
  bugCommits: Commit[];
  prs: PullRequest[];
  /** 0..100 composite of complexity + churn. */
  debtScore: number;
  risk: Risk;
  /** Estimated test coverage percentage. */
  coverage: number;
  description: string;
}

export interface DepEdge {
  source: string;
  target: string;
}

export interface Repo {
  name: string;
  branch: string;
  files: RepoFile[];
  edges: DepEdge[];
  authors: Author[];
}

/* --- Chat ----------------------------------------------------------------- */

export type ChatSegment =
  | { kind: "text"; text: string }
  | { kind: "inline"; text: string }
  | { kind: "lineref"; line: number; label: string }
  | { kind: "block"; code: string; lang: string };

export type QuickAction = "explain-intent" | "find-weaknesses" | "history";

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  fileId: string | null;
  segments: ChatSegment[];
  /** True while the AI response is still streaming in. */
  streaming: boolean;
}

/* --- Sandbox --------------------------------------------------------------- */

export interface ImpactMetrics {
  complexityBefore: number;
  complexityAfter: number;
  complexityDeltaPct: number; // negative = reduction
  locBefore: number;
  locAfter: number;
  regressionRisk: Risk;
  coverageBefore: number;
  coverageAfter: number;
  affectedDependents: number;
}
