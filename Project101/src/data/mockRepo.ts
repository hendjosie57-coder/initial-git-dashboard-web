import type {
  Author,
  AuthorShare,
  Commit,
  DepEdge,
  PullRequest,
  Repo,
  RepoFile,
  Risk,
} from "../types";
import { riskOf } from "../lib/colors";

/* ---------------------------------------------------------------------------
   Deterministic mock repository engine.

   Everything is derived from a single seeded PRNG so the app renders the
   exact same "legacy monolith" on every load — stable node layout inputs,
   stable blame, stable AI answers.
--------------------------------------------------------------------------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xc0ffee);

const ri = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const rf = (min: number, max: number) => min + rand() * (max - min);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const hash = () => {
  const chars = "0123456789abcdef";
  let h = "";
  for (let i = 0; i < 9; i++) h += chars[Math.floor(rand() * 16)];
  return h;
};

/** ISO date `days` days before "now", jittered within the day. */
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000 - ri(0, 80_000) * 1000).toISOString();

/* --- Authors ---------------------------------------------------------------- */

const AUTHOR_DEFS = [
  ["Sara Chen", "schen"],
  ["Miguel Alvarez", "malvarez"],
  ["Priya Nair", "pnair"],
  ["Tom Okafor", "tokafor"],
  ["Elena Petrova", "epetrova"],
  ["Dave Kim", "dkim"],
  ["Aisha Khan", "akhan"],
  ["Rob Muller", "rmuller"],
] as const;

/* Muted matte tones, index-matched to the .blame-bar-N classes in index.css. */
const AUTHOR_COLORS = [
  "#6a89c9",
  "#5fa8a8",
  "#c9a15f",
  "#6fae7d",
  "#b57a9e",
  "#9a86c0",
  "#c08a66",
  "#8a9199",
];

export const AUTHORS: Author[] = AUTHOR_DEFS.map(([name, handle], i) => ({
  id: handle,
  name,
  handle,
  initials: name
    .split(" ")
    .map((p) => p[0])
    .join(""),
  colorIndex: i,
  color: AUTHOR_COLORS[i],
}));

/* --- Message pools ------------------------------------------------------------ */

const FIX_MESSAGES = [
  "fix: null session on concurrent token refresh",
  "fix: off-by-one in pagination cursor",
  "hotfix: rounding drift in FX conversion",
  "fix: race condition when cache invalidates mid-request",
  "fix: unhandled rejection when upstream times out",
  "fix: duplicate webhook delivery on retry",
  "fix: timezone shift for non-UTC report windows",
  "fix: memory leak in event listener teardown",
  "fix: stale closure captured request context",
  "fix: decimal precision lost during batch totals",
];

const FEAT_MESSAGES = [
  "feat: add idempotency keys to mutation endpoints",
  "feat: support multi-currency settlement",
  "feat: bulk export with resumable chunks",
  "feat: soft-delete with restore window",
  "feat: per-tenant rate limit overrides",
  "feat: streaming CSV download",
  "feat: audit trail for admin actions",
  "feat: optimistic UI updates on save",
];

const CHORE_MESSAGES = [
  "refactor: extract validation into shared helper",
  "chore: bump deps and fix type errors",
  "refactor: flatten nested callbacks",
  "chore: remove dead feature flag branches",
  "refactor: rename ambiguous handler args",
  "docs: annotate retry semantics",
  "perf: memoize expensive lookup table",
  "test: backfill regression cases for edge dates",
];

const BUG_MESSAGES = [
  "quick fix for prod incident, will clean up later",
  "workaround for vendor API returning strings for numbers",
  "temp: bypass validation for enterprise tenant migration",
  "patch legacy path to unblock release",
  "handle weird edge case from support ticket #4821",
  "copy of retry logic with slightly different backoff",
];

const PR_TEMPLATES: Array<[string, string]> = [
  [
    "Stabilize {topic} error handling",
    "Wraps the {topic} pipeline in structured error boundaries. Follow-up to the Q3 incident review — previous behavior swallowed upstream failures and returned partial results silently.",
  ],
  [
    "Migrate {topic} to async/await",
    "Removes the callback pyramid in {file}. No behavior change intended; verified against the golden-output snapshot suite.",
  ],
  [
    "Add retry + circuit breaker around {topic}",
    "The vendor endpoint flakes under load. Adds exponential backoff with jitter and a half-open breaker. Config lives in ConfigLoader.",
  ],
  [
    "Support multi-region {topic}",
    "Threads a region context object through {file}. NOTE: legacy callers default to us-east-1 — see the TODO on the adapter shim.",
  ],
  [
    "Hotfix: {topic} regression from #%N",
    "Reverts the eager cache warm added last sprint; it raced the connection pool on cold boot. Root cause writeup in the incident doc.",
  ],
  [
    "Tighten types across {topic}",
    "Replaces `any` with discriminated unions in {file}. Found two real bugs while migrating — both were silently coercing undefined to 0.",
  ],
];

/* --- Directory blueprints ------------------------------------------------------ */

interface DirSpec {
  dir: string;
  files: string[];
  /** [complexity min, complexity max] */
  cx: [number, number];
  /** [churn min, churn max] commits per quarter */
  ch: [number, number];
  loc: [number, number];
  desc: string;
}

const DIR_SPECS: DirSpec[] = [
  {
    dir: "src/legacy",
    files: [
      "PaymentProcessor.js",
      "OrderReconciler.js",
      "InvoiceEngine.js",
      "SessionManager.js",
      "LegacyRouter.js",
      "ReportBuilder.js",
      "CsvExporter.js",
      "SoapAdapter.js",
    ],
    cx: [38, 92],
    ch: [24, 110],
    loc: [420, 1400],
    desc: "Pre-2019 monolith core. Callback-driven, minimal tests, load-bearing.",
  },
  {
    dir: "src/core",
    files: [
      "AppKernel.ts",
      "EventBus.ts",
      "DIContainer.ts",
      "ConfigLoader.ts",
      "Scheduler.ts",
      "CacheLayer.ts",
    ],
    cx: [18, 46],
    ch: [3, 14],
    loc: [200, 620],
    desc: "Platform kernel. Stable, changes rarely, everything imports it.",
  },
  {
    dir: "src/api",
    files: [
      "userController.ts",
      "orderController.ts",
      "paymentController.ts",
      "webhookHandler.ts",
      "authMiddleware.ts",
      "rateLimiter.ts",
      "apiClient.ts",
    ],
    cx: [14, 52],
    ch: [10, 48],
    loc: [160, 700],
    desc: "HTTP edge. Controllers and middleware, moderate churn from feature work.",
  },
  {
    dir: "src/services",
    files: [
      "userService.ts",
      "orderService.ts",
      "paymentService.ts",
      "notificationService.ts",
      "auditService.ts",
      "searchService.ts",
      "syncService.ts",
    ],
    cx: [16, 58],
    ch: [8, 42],
    loc: [180, 760],
    desc: "Business logic layer between controllers and persistence.",
  },
  {
    dir: "src/components",
    files: [
      "Dashboard.tsx",
      "DataTable.tsx",
      "Modal.tsx",
      "Sidebar.tsx",
      "Chart.tsx",
      "FormBuilder.tsx",
      "Toast.tsx",
      "UserCard.tsx",
    ],
    cx: [8, 34],
    ch: [6, 30],
    loc: [120, 520],
    desc: "React UI. FormBuilder and DataTable accrete props every sprint.",
  },
  {
    dir: "src/hooks",
    files: ["useFetch.ts", "useAuth.ts", "usePagination.ts", "useDebounce.ts", "useWebsocket.ts"],
    cx: [6, 22],
    ch: [4, 18],
    loc: [60, 240],
    desc: "Shared React hooks.",
  },
  {
    dir: "src/utils",
    files: [
      "dates.ts",
      "currency.ts",
      "validation.ts",
      "strings.ts",
      "deepMerge.ts",
      "retry.ts",
      "logger.ts",
    ],
    cx: [4, 28],
    ch: [2, 26],
    loc: [40, 340],
    desc: "Grab-bag utilities. dates.ts and validation.ts are quiet hotspots.",
  },
  {
    dir: "src/db",
    files: ["models.ts", "migrations.ts", "queryBuilder.ts", "connectionPool.ts"],
    cx: [12, 44],
    ch: [3, 16],
    loc: [140, 680],
    desc: "Persistence layer over Postgres.",
  },
  {
    dir: "scripts",
    files: ["seed.js", "deploy.js"],
    cx: [6, 18],
    ch: [1, 6],
    loc: [60, 220],
    desc: "Operational scripts, run by CI.",
  },
  {
    dir: "tests",
    files: ["payment.spec.ts", "order.spec.ts"],
    cx: [4, 12],
    ch: [3, 12],
    loc: [120, 400],
    desc: "The only two integration suites that survived the 2021 test purge.",
  },
];

/* --- File synthesis ------------------------------------------------------------ */

function topicOf(name: string): string {
  return name
    .replace(/\.(tsx|ts|js)$/, "")
    .replace(/^use/, "")
    .replace(/(Controller|Service|Handler|Manager|Builder|Engine|Adapter|Processor|Reconciler|Layer|Loader)$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim() || "core";
}

function makeCommits(count: number, maxAgeDays: number, shares: AuthorShare[]): Commit[] {
  const weighted: string[] = [];
  for (const s of shares) {
    for (let i = 0; i < Math.max(1, Math.round(s.pct / 10)); i++) weighted.push(s.authorId);
  }
  const commits: Commit[] = [];
  for (let i = 0; i < count; i++) {
    const pool = rand() < 0.42 ? FIX_MESSAGES : rand() < 0.5 ? FEAT_MESSAGES : CHORE_MESSAGES;
    const isSloppy = rand() < 0.18;
    commits.push({
      hash: hash(),
      message: isSloppy ? pick(BUG_MESSAGES) : pick(pool),
      authorId: pick(weighted),
      date: daysAgo(ri(1, maxAgeDays)),
      additions: ri(4, 220),
      deletions: ri(1, 140),
      bugsIntroduced: isSloppy ? ri(1, 5) : rand() < 0.12 ? ri(1, 2) : 0,
    });
  }
  return commits.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function makeShares(): AuthorShare[] {
  const n = ri(2, 5);
  const chosen = [...AUTHORS].sort(() => rand() - 0.5).slice(0, n);
  let remaining = 100;
  const shares: AuthorShare[] = chosen.map((a, i) => {
    const pct = i === chosen.length - 1 ? remaining : Math.min(remaining - (chosen.length - 1 - i), ri(10, Math.max(11, remaining - 10 * (chosen.length - 1 - i))));
    remaining -= pct;
    return { authorId: a.id, pct };
  });
  return shares.sort((a, b) => b.pct - a.pct);
}

let prCounter = 1180;

function makePRs(file: string, topic: string, shares: AuthorShare[]): PullRequest[] {
  const n = ri(2, 4);
  const prs: PullRequest[] = [];
  for (let i = 0; i < n; i++) {
    const [t, d] = pick(PR_TEMPLATES);
    prCounter += ri(3, 40);
    prs.push({
      number: prCounter,
      title: t.replace("{topic}", topic).replace("%N", String(prCounter - ri(40, 300))),
      description: d.replaceAll("{topic}", topic).replaceAll("{file}", file),
      authorId: pick(shares).authorId,
      mergedAt: daysAgo(ri(5, 700)),
    });
  }
  return prs.sort((a, b) => (a.mergedAt < b.mergedAt ? 1 : -1));
}

const CX_MAX = 95;
const CHURN_MAX = 115;

function buildFiles(): RepoFile[] {
  const files: RepoFile[] = [];
  for (const spec of DIR_SPECS) {
    for (const name of spec.files) {
      const path = `${spec.dir}/${name}`;
      const ext = name.slice(name.lastIndexOf("."));
      const complexity = ri(spec.cx[0], spec.cx[1]);
      const churn = ri(spec.ch[0], spec.ch[1]);
      const loc = ri(spec.loc[0], spec.loc[1]);
      const shares = makeShares();
      const totalCommits = churn + ri(5, 160);
      const commits = makeCommits(Math.min(14, Math.max(6, Math.round(churn / 3))), 90, shares);
      const bugCommits = commits
        .filter((c) => c.bugsIntroduced > 0)
        .sort((a, b) => b.bugsIntroduced - a.bugsIntroduced)
        .slice(0, 3);
      // Guarantee at least two "bug" commits so the drawer always has content.
      while (bugCommits.length < 2) {
        const c = commits[ri(0, commits.length - 1)];
        if (!bugCommits.includes(c)) {
          c.bugsIntroduced = ri(1, 3);
          c.message = pick(BUG_MESSAGES);
          bugCommits.push(c);
        }
      }
      const cxNorm = complexity / CX_MAX;
      const chNorm = churn / CHURN_MAX;
      const risk: Risk = riskOf(cxNorm, chNorm);
      const debtScore = Math.min(
        99,
        Math.round((cxNorm * 0.55 + chNorm * 0.45) * 100 + rf(-4, 4)),
      );
      const topic = topicOf(name);
      files.push({
        id: path,
        path,
        name,
        dir: spec.dir,
        ext,
        lang: ext === ".js" ? "javascript" : "typescript",
        loc,
        complexity,
        churn,
        totalCommits,
        createdAt: daysAgo(ri(400, 2600)),
        lastModified: commits[0]?.date ?? daysAgo(ri(1, 90)),
        authorShare: shares,
        commits,
        bugCommits,
        prs: makePRs(name, topic, shares),
        debtScore: Math.max(4, debtScore),
        risk,
        coverage:
          spec.dir === "src/legacy"
            ? ri(0, 22)
            : spec.dir === "tests"
              ? 100
              : ri(28, 88),
        description: spec.desc,
      });
    }
  }
  return files;
}

/* --- Dependency edges ----------------------------------------------------------- */

const IMPORT_RULES: Record<string, string[]> = {
  "src/legacy": ["src/utils", "src/db", "src/legacy", "src/core"],
  "src/core": ["src/utils"],
  "src/api": ["src/services", "src/core", "src/utils", "src/legacy"],
  "src/services": ["src/db", "src/utils", "src/core", "src/legacy"],
  "src/components": ["src/hooks", "src/utils", "src/api"],
  "src/hooks": ["src/utils", "src/api"],
  "src/utils": ["src/utils"],
  "src/db": ["src/utils", "src/core"],
  scripts: ["src/db", "src/services"],
  tests: ["src/services", "src/api"],
};

function buildEdges(files: RepoFile[]): DepEdge[] {
  const byDir = new Map<string, RepoFile[]>();
  for (const f of files) {
    const list = byDir.get(f.dir) ?? [];
    list.push(f);
    byDir.set(f.dir, list);
  }
  const edges: DepEdge[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const targets = IMPORT_RULES[f.dir] ?? ["src/utils"];
    const n = ri(1, 4);
    for (let i = 0; i < n; i++) {
      const dirPool = byDir.get(pick(targets));
      if (!dirPool || dirPool.length === 0) continue;
      const t = pick(dirPool);
      if (t.id === f.id) continue;
      const key = `${f.id}->${t.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: f.id, target: t.id });
    }
  }
  return edges;
}

/* --- Public repo singleton -------------------------------------------------------- */

function buildRepo(): Repo {
  const files = buildFiles();
  return {
    name: "acme/atlas-monolith",
    branch: "legacy-refactor-v2",
    files,
    edges: buildEdges(files),
    authors: AUTHORS,
  };
}

export const REPO: Repo = buildRepo();

export const fileById = (id: string | null): RepoFile | null =>
  id ? (REPO.files.find((f) => f.id === id) ?? null) : null;

export const authorById = (id: string): Author =>
  REPO.authors.find((a) => a.id === id) ?? REPO.authors[0];

/** Files importing the given file (its dependents). */
export const dependentsOf = (id: string): RepoFile[] =>
  REPO.edges
    .filter((e) => e.target === id)
    .map((e) => REPO.files.find((f) => f.id === e.source))
    .filter((f): f is RepoFile => Boolean(f));

/* --- Graph subset ------------------------------------------------------------
   The node graph renders at most `max` files (10–12). Files are ranked by a
   blend of connectivity (dependency degree) and recency of modification, so
   the graph always surfaces the most load-bearing, most active modules. */

export interface GraphSubset {
  files: RepoFile[];
  edges: DepEdge[];
  totalFiles: number;
}

export function graphSubset(max = 12): GraphSubset {
  const degree = new Map<string, number>();
  for (const e of REPO.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const now = Date.now();
  const files = [...REPO.files]
    .map((f) => {
      const deg = degree.get(f.id) ?? 0;
      const ageDays = (now - new Date(f.lastModified).getTime()) / 86_400_000;
      const recency = Math.max(0, 90 - ageDays) / 90; // 1 = touched today
      return { f, score: deg + recency * 4 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.f);
  const ids = new Set(files.map((f) => f.id));
  return {
    files,
    edges: REPO.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    totalFiles: REPO.files.length,
  };
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
