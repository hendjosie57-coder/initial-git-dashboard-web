import type { ChatSegment, QuickAction, RepoFile } from "../types";
import { authorById, dependentsOf, relativeTime } from "./mockRepo";
import { blameAt, getFileCode } from "./codegen";

/* ---------------------------------------------------------------------------
   Contextual Blame AI — mock response composer.

   Responses are synthesized from the same mock context a real agent would
   ingest: the file source, its blame chunks, PR titles/descriptions, and
   commit history. Output is a segment list the ChatPane streams token-style.
--------------------------------------------------------------------------- */

const t = (text: string): ChatSegment => ({ kind: "text", text });
const code = (text: string): ChatSegment => ({ kind: "inline", text });
const line = (n: number, label?: string): ChatSegment => ({
  kind: "lineref",
  line: n,
  label: label ?? `L${n}`,
});

export function composeResponse(file: RepoFile, action: QuickAction | string): ChatSegment[] {
  switch (action) {
    case "explain-intent":
      return explainIntent(file);
    case "find-weaknesses":
      return findWeaknesses(file);
    case "history":
      return history(file);
    default:
      return freeform(file, action);
  }
}

function explainIntent(file: RepoFile): ChatSegment[] {
  const src = getFileCode(file);
  const topPr = file.prs[0];
  const oldestPr = file.prs[file.prs.length - 1];
  const owner = authorById(file.authorShare[0].authorId);
  const chunk = src.blame[Math.min(2, src.blame.length - 1)];
  return [
    t(`This file is the ${file.dir.replace("src/", "")} layer's `),
    code(file.name.replace(/\.\w+$/, "")),
    t(
      ` implementation — ${file.description.toLowerCase()} ` +
        `Primary ownership sits with ${owner.name} (${file.authorShare[0].pct}% of lines).\n\n` +
        `Reading the merged PR trail, the architectural intent has shifted over time. ` +
        `The earliest relevant PR, #${oldestPr.number} “${oldestPr.title}”, framed it as: ` +
        `“${oldestPr.description.split(".")[0]}.” More recently, #${topPr.number} ` +
        `(“${topPr.title}”) notes: “${topPr.description.split(".")[0]}.”\n\n`,
    ),
    t(`The core entry point is `),
    code(`process${file.name.replace(/\.\w+$/, "").replace(/^use/, "")}`.slice(0, 28)),
    t(` around `),
    line(12),
    t(
      `, which still carries the original callback signature so legacy callers don't break. ` +
        `The chunk starting at `,
    ),
    line(chunk.startLine),
    t(
      ` was last touched ${relativeTime(chunk.date)} by ${authorById(chunk.authorId).name} ` +
        `(commit `,
    ),
    code(chunk.commitHash.slice(0, 7)),
    t(
      `), which is where the current behavior diverges from the documented intent. ` +
        `In short: it was designed as a thin adapter, but ${file.churn} commits this quarter ` +
        `have turned it into a de-facto business-logic hub.`,
    ),
  ];
}

function findWeaknesses(file: RepoFile): ChatSegment[] {
  const worst = file.bugCommits[0];
  const worstAuthor = authorById(worst.authorId);
  return [
    t(
      `I cross-referenced the source with its blame history and bug-linked commits. ` +
        `Four concrete weaknesses stand out:\n\n1. Unbounded module cache — `,
    ),
    code("_cache"),
    t(` declared at `),
    line(9),
    t(
      ` is never evicted. Under multi-tenant load this is a slow memory leak; the FIXME has ` +
        `been there since the file's second commit.\n\n2. SQL injection surface — the query at `,
    ),
    line(27),
    t(` concatenates `),
    code("input.id"),
    t(
      ` directly into the statement. It predates the parameterized query helper in ` +
        `queryBuilder.ts.\n\n3. Silent failure defaults — `,
    ),
    line(14),
    t(` returns `),
    code("callback(null, null)"),
    t(` for bad input, and the branch near `),
    line(37),
    t(` sets `),
    code("status = 'approved'"),
    t(
      ` when validation errors. Failures are indistinguishable from successes downstream.\n\n` +
        `4. Retry without backoff cap — the reconnect loop at `,
    ),
    line(23),
    t(
      ` recurses on a fixed timer with no attempt limit (the incident comment references 2021-04).\n\n` +
        `Blame corroborates this: the highest bug-yield commit here is `,
    ),
    code(worst.hash.slice(0, 7)),
    t(
      ` (“${worst.message}”, ${worstAuthor.name}, ${relativeTime(worst.date)}) with ` +
        `${worst.bugsIntroduced} bug reports traced to it. A sketch of the safe query path:`,
    ),
    {
      kind: "block",
      lang: "typescript",
      code: [
        `const rows = await pool.query(`,
        `  "SELECT * FROM records WHERE id = $1",`,
        `  [input.id], // parameterized`,
        `);`,
      ].join("\n"),
    },
    t(`\nOpen the Refactor Sandbox to see the full modernized version with these fixed.`),
  ];
}

function history(file: RepoFile): ChatSegment[] {
  const commits = file.commits.slice(0, 5);
  const segs: ChatSegment[] = [
    t(
      `${file.name} has ${file.totalCommits} total commits; ${file.churn} landed in the last ` +
        `90 days, which puts it in the top churn band for this repo. Recent activity:\n\n`,
    ),
  ];
  for (const c of commits) {
    const a = authorById(c.authorId);
    segs.push(code(c.hash.slice(0, 7)));
    segs.push(
      t(
        `  ${c.message} — ${a.name}, ${relativeTime(c.date)} (+${c.additions}/−${c.deletions})` +
          (c.bugsIntroduced > 0 ? `  ⚠ ${c.bugsIntroduced} linked bug${c.bugsIntroduced > 1 ? "s" : ""}` : "") +
          `\n`,
      ),
    );
  }
  const shares = file.authorShare
    .map((s) => `${authorById(s.authorId).name} ${s.pct}%`)
    .join(", ");
  segs.push(
    t(
      `\nAuthorship is split ${shares}. The merged-PR record shows ${file.prs.length} PRs ` +
        `touching this file; the most recent, #${file.prs[0].number} “${file.prs[0].title}”, ` +
        `merged ${relativeTime(file.prs[0].mergedAt)}. Debt score is currently ` +
        `${file.debtScore}/100 — driven ${file.complexity > 40 ? "primarily by cyclomatic complexity" : "mostly by modification frequency"}.`,
    ),
  );
  return segs;
}

function freeform(file: RepoFile, question: string): ChatSegment[] {
  const src = getFileCode(file);
  const deps = dependentsOf(file.id);
  const q = question.toLowerCase();

  if (q.includes("test") || q.includes("coverage")) {
    return [
      t(
        `Estimated coverage for ${file.name} is ${file.coverage}%. ` +
          `${file.coverage < 30 ? "That's effectively untested for a file with this churn profile — the riskiest combination in the repo." : "Reasonable, but the uncovered branches cluster in the error paths."} ` +
          `The highest-value test to add first targets the validation fallthrough near `,
      ),
      line(34),
      t(`, since that branch decides whether records silently self-approve.`),
    ];
  }
  if (q.includes("depend") || q.includes("import") || q.includes("break")) {
    return [
      t(
        `${deps.length} file${deps.length === 1 ? "" : "s"} import${deps.length === 1 ? "s" : ""} ${file.name}` +
          (deps.length
            ? `: ${deps
                .slice(0, 4)
                .map((d) => d.name)
                .join(", ")}${deps.length > 4 ? "…" : ""}. `
            : ". "),
      ),
      t(
        `The public surface is the three exports at the bottom (`,
      ),
      line(src.legacyLines - 1),
      t(
        `). Any refactor that preserves those three signatures is behavior-compatible; ` +
          `the sandbox's modernized version keeps them intact while making them async.`,
      ),
    ];
  }
  if (q.includes("who") || q.includes("author") || q.includes("owner")) {
    const owner = authorById(file.authorShare[0].authorId);
    const chunk = blameAt(src, 20) ?? src.blame[0];
    return [
      t(
        `${owner.name} owns ${file.authorShare[0].pct}% of the current lines and is the best ` +
          `first reviewer. The hot region around `,
      ),
      line(chunk.startLine),
      t(
        ` was last changed by ${authorById(chunk.authorId).name} in `,
      ),
      code(chunk.commitHash.slice(0, 7)),
      t(
        `, ${relativeTime(chunk.date)}. Full breakdown: ` +
          file.authorShare
            .map((s) => `${authorById(s.authorId).name} ${s.pct}%`)
            .join(", ") +
          `.`,
      ),
    ];
  }
  // Generic grounded answer.
  return [
    t(
      `Here's what the context says about “${question.trim()}” for ${file.name}: the file scores ` +
        `${file.debtScore}/100 on debt (${file.risk} risk), with complexity ${file.complexity} and ` +
        `${file.churn} commits in the last quarter. The most load-bearing region is the entry ` +
        `point at `,
    ),
    line(12),
    t(`, and the most fragile is the validation fallback near `),
    line(34),
    t(
      `. If you tell me what you're trying to change, I can trace the exact blame chunk and ` +
        `PRs that explain why it looks the way it does — or try the quick actions below.`,
    ),
  ];
}

/* --- Streaming helpers ------------------------------------------------------- */

/** Total character length of a segment list (blocks count as their code). */
export function segmentsLength(segments: ChatSegment[]): number {
  return segments.reduce((sum, s) => {
    if (s.kind === "text" || s.kind === "inline") return sum + s.text.length;
    if (s.kind === "lineref") return sum + s.label.length;
    return sum + s.code.length;
  }, 0);
}

/** Slice a segment list to the first `chars` characters, for streaming. */
export function sliceSegments(segments: ChatSegment[], chars: number): ChatSegment[] {
  const out: ChatSegment[] = [];
  let used = 0;
  for (const s of segments) {
    const len =
      s.kind === "text" || s.kind === "inline"
        ? s.text.length
        : s.kind === "lineref"
          ? s.label.length
          : s.code.length;
    if (used + len <= chars) {
      out.push(s);
      used += len;
      continue;
    }
    const remain = chars - used;
    if (remain <= 0) break;
    if (s.kind === "text") out.push({ kind: "text", text: s.text.slice(0, remain) });
    else if (s.kind === "block") out.push({ ...s, code: s.code.slice(0, remain) });
    // inline/lineref chips appear atomically once fully streamed
    break;
  }
  return out;
}
