import type { Commit, PullRequest, RepoFile } from "../types";
import { authorById, dependentsOf } from "./mockRepo";
import { pascalTopic } from "./codegen";

/* ---------------------------------------------------------------------------
   File insights for the side panel:
     · legacyExplanation — human-readable markdown explaining the legacy code
     · refactorTimeline  — "previous refactors" reconstructed from git history
                           (refactor-shaped commits + merged PRs)
--------------------------------------------------------------------------- */

export function legacyExplanation(file: RepoFile): string {
  const P = pascalTopic(file);
  const lower = P[0].toLowerCase() + P.slice(1);
  const deps = dependentsOf(file.id);
  const owner = authorById(file.authorShare[0].authorId);
  const oldestPr = file.prs[file.prs.length - 1];
  const flag = `ENABLE_${P.toUpperCase()}_V2`;

  const depNote = deps.length
    ? `It is imported by ${deps.length} other module${deps.length === 1 ? "" : "s"} (${deps
        .slice(0, 3)
        .map((d) => `\`${d.name}\``)
        .join(", ")}${deps.length > 3 ? ", …" : ""}), which makes its three public exports the de-facto contract for this domain.`
    : `Nothing currently imports it directly, but it is still invoked by CI scripts.`;

  return `### What this file does

\`${file.name}\` is the ${file.dir.replace("src/", "")} layer's ${lower} implementation — ${file.description.toLowerCase()} ${depNote}

### How it works

- **\`process${P}\`** resolves a record by id: first through an in-memory cache keyed by \`id:region\`, then a direct database query. On connection failure it re-schedules itself on a fixed timer with no attempt cap.
- **\`validate${P}\`** coerces the vendor's string-typed \`amount\` into a float inside a small retry loop; a failed validation quietly falls back to an *approved* status unless the \`${flag}\` flag is set.
- **\`sync${P}Records\`** walks its input sequentially with chained callbacks, collecting results and swallowing per-item errors.

### Why it looks this way

The blame trail explains most of the strangeness. The oldest merged PR on record, **#${oldestPr.number} “${oldestPr.title}”**, framed the file as a thin adapter: *“${oldestPr.description.split(".")[0]}.”* Since then, ${file.churn} commits in the last 90 days — largely by ${owner.name} (${file.authorShare[0].pct}% of current lines) — have layered feature flags and hotfixes over the original callback structure without restructuring it. The result is a de-facto business-logic hub still wearing an adapter's shape.

### Risk notes

- The module-level cache is unbounded and never evicted.
- The main query is assembled by string concatenation rather than parameters.
- Validation failures are indistinguishable from successes downstream.`;
}

/* --- Previous refactors -------------------------------------------------------- */

export interface RefactorEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
  authorId: string;
  kind: "pr" | "commit";
}

const REFACTOR_RX = /^(refactor|perf|chore)\b/i;

export function refactorTimeline(file: RepoFile): RefactorEvent[] {
  const fromPrs: RefactorEvent[] = file.prs.map((pr: PullRequest) => ({
    id: `pr-${pr.number}`,
    date: pr.mergedAt,
    title: `#${pr.number} ${pr.title}`,
    detail: `${pr.description.split(".")[0]}.`,
    authorId: pr.authorId,
    kind: "pr",
  }));
  const fromCommits: RefactorEvent[] = file.commits
    .filter((c: Commit) => REFACTOR_RX.test(c.message))
    .map((c) => ({
      id: c.hash,
      date: c.date,
      title: c.message,
      detail: `+${c.additions} / −${c.deletions} lines`,
      authorId: c.authorId,
      kind: "commit",
    }));
  return [...fromPrs, ...fromCommits]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6);
}

/* --- Commit metrics for the sparklines ------------------------------------------ */

/** Per-commit size (additions + deletions), oldest → newest. */
export function commitSizes(file: RepoFile): number[] {
  return [...file.commits].reverse().map((c) => c.additions + c.deletions);
}

/** Commits per week over the last `weeks` weeks, oldest → newest. */
export function commitFrequency(file: RepoFile, weeks = 12): number[] {
  const bins = new Array<number>(weeks).fill(0);
  const now = Date.now();
  for (const c of file.commits) {
    const ageWeeks = Math.floor((now - new Date(c.date).getTime()) / (7 * 86_400_000));
    if (ageWeeks >= 0 && ageWeeks < weeks) bins[weeks - 1 - ageWeeks]++;
  }
  return bins;
}
